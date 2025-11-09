#!/usr/bin/env bash
set -euo pipefail

API_DOMAIN=${API_DOMAIN:-api.trmultichat.com.br}
APP_DOMAIN=${APP_DOMAIN:-app.trmultichat.com.br}
APP_USER=${APP_USER:-appuser}

echo "[1/8] Updating system and installing Docker..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release ufw

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "[2/8] Creating non-root user (${APP_USER})..."
if ! id -u ${APP_USER} >/dev/null 2>&1; then
  sudo useradd -m -s /bin/bash ${APP_USER}
  sudo usermod -aG sudo ${APP_USER}
  sudo usermod -aG docker ${APP_USER}
fi

echo "[3/8] Installing Nginx and Certbot..."
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "[4/8] Generating credentials (.env) ..."
ENV_DIR=$(dirname "$0")/docker
mkdir -p "$ENV_DIR"
ENV_FILE="$ENV_DIR/.env"

JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
POSTGRES_USER=truser
POSTGRES_DB=trmultichat

cat > "$ENV_FILE" <<EOF
API_DOMAIN=${API_DOMAIN}
APP_DOMAIN=${APP_DOMAIN}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ALLOW_ORIGIN=https://$APP_DOMAIN
EOF

echo "[5/8] Starting Docker Compose..."
cd "$(dirname "$0")/docker"
docker compose --env-file ./.env up -d --build

echo "[6/8] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/trmultichat-api.conf > /dev/null <<NGINX
server {
  listen 80;
  server_name ${API_DOMAIN};
  location / {
    proxy_pass http://localhost:4004;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGINX

sudo tee /etc/nginx/sites-available/trmultichat-app.conf > /dev/null <<NGINX
server {
  listen 80;
  server_name ${APP_DOMAIN};
  location / {
    proxy_pass http://localhost:9089;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/trmultichat-api.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/trmultichat-app.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

echo "[7/8] Obtaining SSL certificates..."
sudo certbot --nginx -d ${API_DOMAIN} --non-interactive --agree-tos -m admin@${API_DOMAIN}
sudo certbot --nginx -d ${APP_DOMAIN} --non-interactive --agree-tos -m admin@${APP_DOMAIN}

echo "[8/8] Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo y | sudo ufw enable || true

echo "Deployment finished."
echo "API: https://${API_DOMAIN}"
echo "APP: https://${APP_DOMAIN}"







