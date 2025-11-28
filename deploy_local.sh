#!/usr/bin/env bash
set -e
set -o pipefail

cd "/Users/therciojosesilva/Desktop/TR MULTCHAT"

echo "[LOCAL] Estado do repositório:"
git status

echo "[LOCAL] Enviando código para origin main..."
git push origin main

ssh root@5.161.196.30 << 'EOF'
  set -e

  echo "[VPS] Indo para pasta do projeto..."
  cd /home/deploy/trmultichat/trmultichat

  echo "[VPS] Atualizando código (git pull origin main)..."
  git pull origin main

  echo "[VPS] Executando script de deploy..."
  if [ -f trmultichat/deploy_trmultichat_frontend_backend.sh ]; then
    bash trmultichat/deploy_trmultichat_frontend_backend.sh
  elif [ -f deploy_trmultichat_frontend_backend.sh ]; then
    bash deploy_trmultichat_frontend_backend.sh
  else
    echo "[VPS] ERRO: Script deploy_trmultichat_frontend_backend.sh não encontrado nem na raiz nem em trmultichat/."
    exit 1
  fi

  echo "[VPS] Deploy finalizado com sucesso."
EOF

echo "[OK] Deploy concluído. Agora teste em https://app.trmultichat.com.br"


