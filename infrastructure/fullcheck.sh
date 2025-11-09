#!/usr/bin/env bash
# Full check robusto com retries e sumário ✔️/❌
set -u  # (não usamos -e para não abortar nas falhas)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$ROOT_DIR/infrastructure/last_check.log"
SNAP_FILE="$ROOT_DIR/infrastructure/snapshot_$(date +%F).tar"

# --- Utils ---
GREEN="$(printf '\033[32m')"; RED="$(printf '\033[31m')"; YELLOW="$(printf '\033[33m')"; NC="$(printf '\033[0m')"
ok(){ echo "✔️  $*"; }
ko(){ echo "❌ $*"; }
warn(){ echo "⚠️  $*"; }
log(){ echo "$*" | tee -a "$LOG_FILE"; }
hr(){ printf -- "------------------------------\n" | tee -a "$LOG_FILE"; }

# Registra cabeçalho
: > "$LOG_FILE"
log "===== $(date) - FULL STACK CHECK (robusto) ====="
hr

STATUS_1="❌"; STATUS_2="❌"; STATUS_3="❌"; STATUS_4="❌"; STATUS_5="❌"; STATUS_6="❌"

# [1] Rebuild limpo (com tolerância)
echo "[1/6] Rebuild limpo da stack"
{
  cd "$ROOT_DIR/infrastructure/docker" || exit 1
  docker compose down -v --remove-orphans >> "$LOG_FILE" 2>&1 || true
  docker compose up -d --build postgres redis backend frontend >> "$LOG_FILE" 2>&1
  cd "$ROOT_DIR" || exit 1
  STATUS_1="✔️"
  ok "Stack (postgres/redis/backend/frontend) iniciado"
} || {
  ko "Falha ao subir a stack (ver log)"
}
hr

# Função retry genérica
retry() { # retry <tentativas> <intervalo_s> <cmd...>
  local tries="$1"; shift
  local delay="$1"; shift
  local i
  for i in $(seq 1 "$tries"); do
    if "$@" >> "$LOG_FILE" 2>&1; then return 0; fi
    sleep "$delay"
  done
  return 1
}

# [2] /health com retries
echo "[2/6] Saúde da API (/health)"
if retry 12 5 curl -sS http://localhost:4004/health; then
  curl -sS http://localhost:4004/health | tee -a "$LOG_FILE"; echo >> "$LOG_FILE"
  STATUS_2="✔️"; ok "/health OK"
else
  ko "Falha em /health após retries"
fi
hr

# [3] Login API com retries e mascarando tokens
echo "[3/6] Login na API"
LOGIN_TMP="$(mktemp)"
if retry 6 5 bash -lc 'curl -i -s -X POST http://localhost:4004/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"thercio@trtecnologias.com.br\",\"password\":\"Tr030785\"}"'; then
  curl -i -s -X POST http://localhost:4004/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"thercio@trtecnologias.com.br","password":"Tr030785"}' \
    | sed -E 's/"(accessToken|refreshToken)":"[^"]+"/"\1":"***"/g' | tee -a "$LOG_FILE"
  echo >> "$LOG_FILE"
  STATUS_3="✔️"; ok "Login OK"
else
  ko "Login falhou após retries"
fi
rm -f "$LOGIN_TMP" 2>/dev/null || true
hr

# [4] HEAD do frontend (reconstruído do zero)
echo "[4/6] Build do frontend servido"
if retry 12 5 curl -s http://localhost:9089; then
  curl -s http://localhost:9089 | head -n 20 | tee -a "$LOG_FILE"
  echo >> "$LOG_FILE"
  STATUS_4="✔️"; ok "Frontend respondendo"
else
  ko "Frontend não respondeu após retries"
fi
hr

# [5] Handshake do Socket.io (checa upgrades:["websocket"])
echo "[5/6] Handshake do Socket.io"
HS="$(curl -i -s "http://localhost:4004/socket.io/?EIO=4&transport=polling&t=$(date +%s)")"
echo "$HS" | head -n 20 | tee -a "$LOG_FILE"
if echo "$HS" | grep -q '"upgrades":\["websocket"\]'; then
  STATUS_5="✔️"; ok "Handshake OK (upgrade websocket disponível)"
else
  warn "Handshake sem upgrade websocket (pode ser timing)."
  # tenta mais 3 vezes
  if retry 3 3 bash -lc 'curl -i -s "http://localhost:4004/socket.io/?EIO=4&transport=polling&t=$(date +%s)" | grep -q "\"upgrades\":\\[\"websocket\"\\]"'; then
    STATUS_5="✔️"; ok "Handshake OK após retry"
  else
    ko "Handshake não indicou upgrade websocket"
  fi
fi
hr

# [6] Snapshot das imagens (não falha o check)
echo "[6/6] Snapshot opcional das imagens"
if docker images --format '{{.Repository}}:{{.Tag}}' | grep -v '<none>' | xargs -I{} true; then
  docker save -o "$SNAP_FILE" $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -v '<none>') >> "$LOG_FILE" 2>&1 || true
  STATUS_6="✔️"
  ok "Snapshot em $SNAP_FILE"
else
  warn "Sem imagens para snapshot"
  STATUS_6="✔️"
fi
hr

# Sumário
echo
echo "===== SUMÁRIO ====="
echo "[1/6] Rebuild stack ............... $STATUS_1"
echo "[2/6] /health ..................... $STATUS_2"
echo "[3/6] Login API ................... $STATUS_3"
echo "[4/6] Frontend HEAD ............... $STATUS_4"
echo "[5/6] Socket handshake ............ $STATUS_5"
echo "[6/6] Snapshot .................... $STATUS_6"
echo
echo "Log completo: $LOG_FILE"