#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/docker"

# ---------------------- ENV BASE ----------------------
if [ ! -f .env.local ]; then
  if [ -f .env.local.example ]; then
    cp .env.local.example .env.local
  else
    cat > .env.local <<'EOF'
POSTGRES_USER=trmultichat_user
POSTGRES_PASSWORD=trmultichat_local
POSTGRES_DB=trmultichat
REDIS_PASSWORD=trmultichat_local
JWT_SECRET=local_secret_123
JWT_REFRESH_SECRET=local_refresh_123
MULTI_TENANT=true
DEV_MODE=true
DEFAULT_PLAN_MAX_USERS=10
DEFAULT_PLAN_MAX_WHATS=2
API_BASE_URL=http://localhost:4004
APP_BASE_URL=http://localhost:9089
PORT_API=4004
PORT_APP=9089
ADMIN_NAME=Thercio
ADMIN_EMAIL=thercio@trtecnologias.com.br
ADMIN_PASSWORD=Tr030785
ADMIN_TENANT_NAME="TR TECNOLOGIAS"
DB_HOST=postgres
DB_PORT=5432
DB_USER=trmultichat_user
DB_PASS=trmultichat_local
DB_NAME=trmultichat
DB_DIALECT=postgres
EOF
  fi
fi

# Garantir chaves DB_* mínimas
grep -q '^DB_HOST=' .env.local || echo "DB_HOST=postgres" >> .env.local
grep -q '^DB_PORT=' .env.local || echo "DB_PORT=5432" >> .env.local
grep -q '^DB_USER=' .env.local || echo "DB_USER=$POSTGRES_USER" >> .env.local
grep -q '^DB_PASS=' .env.local || echo "DB_PASS=$POSTGRES_PASSWORD" >> .env.local
grep -q '^DB_NAME=' .env.local || echo "DB_NAME=$POSTGRES_DB" >> .env.local
grep -q '^DB_DIALECT=' .env.local || echo "DB_DIALECT=postgres" >> .env.local

# Exportar variáveis para o ambiente do shell (para substituição do compose)
set -a
. ./.env.local
set +a

GREEN='\033[0;32m'; RED='\033[0;31m'; YEL='\033[0;33m'; NC='\033[0m'

echo -e "${YEL}Stopping old stack (if any)...${NC}"
docker compose down -v --remove-orphans || true
docker rm -f pg-forwarder 2>/dev/null || true

echo -e "${YEL}Starting Postgres & Redis (sem publicar portas no host)...${NC}"
docker compose up -d --build --remove-orphans postgres redis

# Descobrir network (ex.: docker_trnet)
NET_NAME="$(docker network ls --format '{{.Name}}' | grep -E 'docker_trnet|trnet' | head -n1 || true)"
if [ -z "$NET_NAME" ]; then
  echo -e "${RED}Não foi possível detectar a network do compose (trnet).${NC}"; exit 1
fi

# Aguardar Postgres ficar pronto
PG_CID="$(docker compose ps -q postgres | head -n1 || true)"
if [ -z "$PG_CID" ]; then
  PG_CID="$(docker ps --format '{{.ID}} {{.Names}}' | awk '/postgres/{print $1}' | head -n1 || true)"
fi

echo -e "${YEL}Waiting for Postgres to be ready...${NC}"
for i in $(seq 1 60); do
  if docker exec "$PG_CID" bash -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    echo -e "${GREEN}Postgres is ready.${NC}"
    break
  fi
  sleep 2
done

# ---------------------- FORWARDER (SOCAT) ----------------------
# Cria forwarder local 127.0.0.1:65432 -> postgres:5432 (na mesma rede do compose)
echo -e "${YEL}Starting forwarder 127.0.0.1:65432 -> postgres:5432 (socat)...${NC}"
docker rm -f pg-forwarder 2>/dev/null || true
docker run -d --name pg-forwarder --restart=unless-stopped \
  --network "$NET_NAME" -p 127.0.0.1:65432:65432 alpine/socat \
  -dd TCP-LISTEN:65432,fork,reuseaddr TCP:postgres:5432 >/dev/null

sleep 2
if ! lsof -nP -iTCP:65432 -sTCP:LISTEN >/dev/null 2>&1; then
  echo -e "${RED}Forwarder não está escutando em 127.0.0.1:65432.${NC}"; exit 1
fi
echo -e "${GREEN}Forwarder OK em 127.0.0.1:65432.${NC}"

# ---------------------- RUNNER DESCARTÁVEL ----------------------
# Executa npm install, health-loop REAL via 'pg', migrations, build e seed FORA do backend
# (evita corrida com 'npm install' do serviço backend)

RUNNER_ENV="--env-file .env.local -e DB_HOST=host.docker.internal -e DB_PORT=65432 -e DB_DIALECT=postgres"
BACKEND_ABS="$(cd ../../trmultichat/backend && pwd)"

# Ensure RSA keys for local demo (public key only is used by backend)
if [ ! -f "$BACKEND_ABS/certs/public.pem" ] || [ ! -f "$BACKEND_ABS/private.pem" ]; then
  mkdir -p "$BACKEND_ABS/certs"
  openssl genrsa -out "$BACKEND_ABS/private.pem" 2048 >/dev/null 2>&1 || true
  openssl rsa -in "$BACKEND_ABS/private.pem" -pubout -out "$BACKEND_ABS/certs/public.pem" >/dev/null 2>&1 || true
fi

echo -e "${YEL}Running one-off runner (node:20) para preparar backend e migrar/seed...${NC}"
docker run --rm --network "$NET_NAME" $RUNNER_ENV -v "$BACKEND_ABS:/app" node:20 bash -lc '
  set -euo pipefail
  cd /app

  # 1) Dependências
  npm install --silent --no-audit --no-fund

  # 2) Health-loop REAL contra o banco (SELECT 1), até 30s
  node -e "
    const { Client } = require(\"pg\");
    const host = process.env.DB_HOST, port = Number(process.env.DB_PORT);
    const user = process.env.DB_USER, password = process.env.DB_PASS, database = process.env.DB_NAME;
    const start = Date.now();
    function tryOnce() {
      const c = new Client({ host, port, user, password, database });
      c.connect().then(()=>c.query(\"SELECT 1\").then(()=>{ console.log(\"db-ok\"); c.end(); process.exit(0); }))
       .catch(()=>{ c.end().catch(()=>{}); if(Date.now()-start>30000){ process.exit(1);} setTimeout(tryOnce,1000); });
    }
    tryOnce();
  "

  # 3) Migrations (via forwarder host.docker.internal:65432)
  DB_HOST=$DB_HOST DB_PORT=$DB_PORT DB_DIALECT=$DB_DIALECT \
  DB_USER="$POSTGRES_USER" DB_PASS="$POSTGRES_PASSWORD" DB_NAME="$POSTGRES_DB" \
  npx sequelize db:migrate || true

  # 4) Build para seed (seed usa dist/)
  npm run build

  # 5) Seed (via forwarder)
  DB_HOST=$DB_HOST DB_PORT=$DB_PORT DB_DIALECT=$DB_DIALECT \
  DB_USER="$POSTGRES_USER" DB_PASS="$POSTGRES_PASSWORD" DB_NAME="$POSTGRES_DB" \
  node dist/scripts/seedLocalAdmin.js

  # 6) Gerar licença local (token RSA), salvo em /app/license.json
  node dist/license/generateLicense.js \
    --privateKeyPath /app/private.pem \
    --company "TR TECNOLOGIAS" \
    --aud trmultichat \
    --iss "TR MULTICHAT" \
    --plan pro \
    --maxUsers 50 \
    --expires 2026-12-31 \
    --out /app/license.json || true
'

# ---------------------- BACKEND & FRONTEND ----------------------
echo -e "${YEL}Starting backend...${NC}"
docker compose up -d --build --remove-orphans backend


echo -e "${YEL}Starting frontend...${NC}"
docker compose up -d --build --remove-orphans frontend

# ---------------------- HEALTH & OUTPUTS ----------------------
echo -e "${YEL}Checking health...${NC}"
HEALTH="$(curl -sS http://localhost:4004/health || true)"
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo -e "${GREEN}✅ API: http://localhost:4004/health${NC}"
else
  echo -e "${RED}❌ API health check failed${NC}"
  echo "$HEALTH"
fi

curl -s http://localhost:9089 >/dev/null 2>&1 \
  && echo -e "${GREEN}✅ Frontend ativo em http://localhost:9089${NC}" \
  || echo -e "${RED}❌ Frontend indisponível em http://localhost:9089${NC}"

echo -e "${YEL}===== docker compose ps =====${NC}"
docker compose -f docker-compose.yml ps

echo -e "${YEL}===== /health =====${NC}"
curl -sS http://localhost:4004/health || true

echo -e "${YEL}===== Frontend HTML head =====${NC}"
curl -s http://localhost:9089 | head -n 15 || true

echo -e "${YEL}===== Login (tokens mascarados) =====${NC}"
curl -i -s -X POST http://localhost:4004/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"thercio@trtecnologias.com.br","password":"Tr030785"}' \
  | sed -e 's/"accessToken":"[^"]\{10\}[^"]*"/"accessToken":"***"/g' \
        -e 's/"refreshToken":"[^"]\{10\}[^"]*"/"refreshToken":"***"/g'


echo -e "${GREEN}Pronto. Runtime: API :4004, Frontend :9089, backend DB_HOST=postgres. Forwarder usado só em migrate/seed (65432).${NC}"


