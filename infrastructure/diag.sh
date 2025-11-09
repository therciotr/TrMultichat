#!/usr/bin/env bash
set -euo pipefail

echo "===== HEALTH ====="
curl -sS http://localhost:4004/health || true
echo

echo "===== LOGIN (API) ====="
curl -i -s -X POST http://localhost:4004/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"thercio@trtecnologias.com.br","password":"Tr030785"}' | sed -E 's/"(accessToken|refreshToken)":"[^"]+"/"\1":"***"/g'
echo

echo "===== FRONTEND HEAD ====="
curl -s http://localhost:9089 | head -n 20 || true
echo

echo "===== SOCKET CHECK (HTTP handshake) ====="
curl -i -s "http://localhost:4004/socket.io/?EIO=4&transport=polling&t=$(date +%s)" | head -n 15




