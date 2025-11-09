#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> [1/5] Health da API"
curl -i -s http://localhost:4004/health || true
echo

echo "==> [2/5] Teste de login (status e body)"
curl -i -s -X POST http://localhost:4004/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"thercio@trtecnologias.com.br","password":"Tr030785"}' || true
echo

echo "==> [3/5] Logs recentes do backend"
(cd "$ROOT_DIR/infrastructure/docker" && docker compose logs backend --tail=150) || true
echo

echo "==> [4/5] Verificando usuário no banco e (se necessário) resetando a senha"
(cd "$ROOT_DIR/infrastructure/docker" && docker compose exec -T backend bash -lc '
node -e "
(async () => {
  try {
    const { Client } = require(\"pg\");
    const db = new Client({
      host: process.env.DB_HOST || \"postgres\",
      port: +(process.env.DB_PORT || 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });
    await db.connect();
    const email = \"thercio@trtecnologias.com.br\";
    const r1 = await db.query(\"select id, name, email from \\\"Users\\\" where email=$1 limit 1\", [email]);
    if (r1.rows.length === 0) {
      console.log(\"[info] Admin não existe — vou criar via seedLocalAdmin...\");
      process.exit(10);
    } else {
      console.log(\"[ok] Admin existe:\", r1.rows[0]);
      process.exit(0);
    }
  } catch (e) {
    console.error(e); process.exit(2);
  }
})();
" || EXIT=$?
[ "${EXIT:-0}" = "10" ] && (echo "[seed] criando admin..."; npm run build && node dist/scripts/seedLocalAdmin.js || true)
') || true
echo

echo "==> [5/5] Novo teste de login"
curl -i -s -X POST http://localhost:4004/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"thercio@trtecnologias.com.br","password":"Tr030785"}' \
  | sed -E 's/\"(accessToken|refreshToken)\":\"[^\"]+\"/\"\1\":\"***\"/g' || true
echo

echo "==> Dica: se vier 401 de LICENÇA em DEV, confirme DEV_MODE=true no backend. Se vier 404, a rota /auth/login não está montada."






