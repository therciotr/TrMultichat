#!/usr/bin/env bash
set -euo pipefail

# Ir para a raiz do backend
cd "$(dirname "$0")/.."

echo "[post-deploy] Buildando backend..."
npm run build --silent

echo "[post-deploy] Aplicando migrações de banco (se configuradas)..."
npm run db:migrate || echo "[post-deploy] Aviso: db:migrate falhou ou não está configurado, seguindo assim mesmo."

echo "[post-deploy] Reiniciando backend via PM2..."
pm2 restart trmultichat-backend || pm2 start trmultichat-backend

echo "[post-deploy] Aguardando backend subir..."
sleep 3

export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:4004}"
export TEST_EMAIL="${TEST_EMAIL:-renilda@trtecnologias.com.br}"

echo "[post-deploy] Executando testes rápidos de esqueci/reset de senha..."
npm run test:auth-flow

echo "[post-deploy] post-deploy concluído com sucesso."


