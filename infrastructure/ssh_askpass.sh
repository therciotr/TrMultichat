#!/usr/bin/env bash
set -euo pipefail

# Este script é chamado automaticamente pelo SSH quando VPS_PASSWORD está definida
# e o deploy_local.sh força SSH_ASKPASS. NÃO coloque a senha aqui.

if [ -z "${VPS_PASSWORD:-}" ]; then
  echo "VPS_PASSWORD não definida" >&2
  exit 1
fi

printf '%s\n' "$VPS_PASSWORD"


