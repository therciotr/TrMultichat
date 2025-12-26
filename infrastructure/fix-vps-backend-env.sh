#!/usr/bin/env bash
set -euo pipefail

# Script idempotente para corrigir login na VPS:
# - garante usuário/role Postgres (default: wtsaas)
# - escreve backend/.env com DB_* (Postgres) + JWT_* + URLs
# - reinicia pm2 (trmultichat-backend)
# - testa /health e /auth/login
#
# Como usar (na VPS):
#   cd /home/deploy/trmultichat/trmultichat
#   sudo bash infrastructure/fix-vps-backend-env.sh
#
# Variáveis opcionais:
#   BACKEND_DIR=/home/deploy/trmultichat/trmultichat/backend
#   DB_NAME=trmultichat
#   DB_USER=wtsaas
#   DB_PASS=...              (recomendado em produção!)
#   JWT_SECRET=...
#   JWT_REFRESH_SECRET=...
#   API_BASE_URL=https://api.trmultichat.com.br
#   APP_BASE_URL=https://app.trmultichat.com.br
#   ALLOW_ORIGIN=https://app.trmultichat.com.br
#   ADMIN_EMAIL=thercio@trtecnologias.com.br
#   ADMIN_PASSWORD=Tr030785

BACKEND_DIR="${BACKEND_DIR:-/home/deploy/trmultichat/trmultichat/backend}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-trmultichat}"
DB_USER="${DB_USER:-wtsaas}"
DB_PASS="${DB_PASS:-password}"
DB_DIALECT="${DB_DIALECT:-postgres}"

API_BASE_URL="${API_BASE_URL:-https://api.trmultichat.com.br}"
APP_BASE_URL="${APP_BASE_URL:-https://app.trmultichat.com.br}"
ALLOW_ORIGIN="${ALLOW_ORIGIN:-https://app.trmultichat.com.br}"

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
MULTI_TENANT="${MULTI_TENANT:-true}"

JWT_SECRET="${JWT_SECRET:-}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-}"

ADMIN_EMAIL="${ADMIN_EMAIL:-thercio@trtecnologias.com.br}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Tr030785}"

if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET="$(openssl rand -hex 32)"
fi
if [ -z "$JWT_REFRESH_SECRET" ]; then
  JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
fi

echo "[1/4] Garantindo role Postgres '${DB_USER}' e permissões no DB '${DB_NAME}'..."
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO
\$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL

sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<SQL
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
ALTER SCHEMA public OWNER TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};
SQL

echo "[2/4] Escrevendo ${BACKEND_DIR}/.env (backup automático)..."
cd "$BACKEND_DIR"
if [ -f .env ]; then
  cp .env ".env.bak_$(date +"%Y%m%d-%H%M%S")"
fi

cat > .env <<EOF
NODE_ENV=production
PORT=4004

DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_DIALECT=${DB_DIALECT}

JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

REDIS_HOST=${REDIS_HOST}
REDIS_PORT=${REDIS_PORT}
MULTI_TENANT=${MULTI_TENANT}
API_BASE_URL=${API_BASE_URL}
APP_BASE_URL=${APP_BASE_URL}
ALLOW_ORIGIN=${ALLOW_ORIGIN}
EOF

echo "[3/4] Reiniciando PM2 (trmultichat-backend)..."
pm2 delete trmultichat-backend >/dev/null 2>&1 || true
pm2 start dist/server.js --name trmultichat-backend --cwd "$BACKEND_DIR" --update-env
pm2 save >/dev/null 2>&1 || true

echo "[4/4] Testes rápidos..."
sleep 3
echo "- GET /health:"
curl -sS "http://127.0.0.1:4004/health" || true
echo
echo "- POST /auth/login (tokens podem aparecer):"
curl -sS -X POST "http://127.0.0.1:4004/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" || true
echo

echo "OK. Se /health retornar ok:true e o login retornar tokens, o app deve voltar a logar."


