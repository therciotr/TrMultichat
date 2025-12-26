#!/usr/bin/env bash
set -e
set -o pipefail

cd "/Users/therciojosesilva/Desktop/TR MULTCHAT"

#
# SSH por senha (não-interativo) — sem salvar senha no Git.
# - Coloque a senha em um arquivo local ignorado (recomendado): .deploy.local.env (oculto no macOS)
#   ou deploy_local.env (visível)
#   Exemplo:
#     VPS_PASSWORD='SUA_SENHA_AQUI'
# - Ou exporte a variável no terminal antes de rodar:
#     export VPS_PASSWORD='SUA_SENHA_AQUI'
#
if [ -f .deploy.local.env ]; then
  # shellcheck disable=SC1091
  . ./.deploy.local.env
elif [ -f deploy_local.env ]; then
  # shellcheck disable=SC1091
  . ./deploy_local.env
fi

echo "[LOCAL] Estado do repositório:"
git status

echo "[LOCAL] Enviando código para origin main..."
git push origin main

VPS_HOST="${VPS_HOST:-5.161.196.30}"
VPS_USER="${VPS_USER:-root}"

SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=4
)

SSH_TARGET="${VPS_USER}@${VPS_HOST}"

remote_script() {
  cat <<'EOF'
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
}

if [ -n "${VPS_PASSWORD:-}" ]; then
  echo "[LOCAL] Conectando via SSH com senha (modo não-interativo via SSH_ASKPASS)..."
  export VPS_PASSWORD
  export SSH_ASKPASS="$(cd "$(dirname "$0")" && pwd)/infrastructure/ssh_askpass.sh"
  export SSH_ASKPASS_REQUIRE=force
  export DISPLAY="${DISPLAY:-:0}"

  if command -v setsid >/dev/null 2>&1; then
    remote_script | setsid -w ssh "${SSH_OPTS[@]}" -o PreferredAuthentications=password -o PubkeyAuthentication=no "$SSH_TARGET" bash -s
  else
    echo "[LOCAL] AVISO: 'setsid' não encontrado; caindo para SSH interativo."
    remote_script | ssh "${SSH_OPTS[@]}" "$SSH_TARGET" bash -s
  fi
else
  echo "[LOCAL] Conectando via SSH (interativo)..."
  remote_script | ssh "${SSH_OPTS[@]}" "$SSH_TARGET" bash -s
fi

echo "[OK] Deploy concluído. Agora teste em https://app.trmultichat.com.br"


