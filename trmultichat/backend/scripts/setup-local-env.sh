#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env já existe em $(pwd)/.env - nada a fazer."
  exit 0
fi

if [ ! -f .env-example ]; then
  echo "Arquivo .env-example não encontrado em $(pwd)."
  exit 1
fi

cp .env-example .env
echo ".env criado a partir de .env-example em $(pwd)/.env"


