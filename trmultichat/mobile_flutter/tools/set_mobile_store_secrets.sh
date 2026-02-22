#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./trmultichat/mobile_flutter/tools/set_mobile_store_secrets.sh /path/to/repo/root
#
# This script sets GitHub Actions secrets for mobile release.
# It expects gh CLI already authenticated and a standard local folder with secrets.

ROOT_DIR="${1:-$(pwd)}"
SECRETS_DIR="$ROOT_DIR/trmultichat/mobile_flutter/secrets"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI nao encontrado. Instale e autentique antes de continuar."
  exit 1
fi

echo "Configurando secrets Android..."
gh secret set ANDROID_KEYSTORE_BASE64 < "$SECRETS_DIR/android/upload-keystore.base64.txt"
gh secret set ANDROID_KEYSTORE_PASSWORD < "$SECRETS_DIR/android/ANDROID_KEYSTORE_PASSWORD.txt"
gh secret set ANDROID_KEY_ALIAS < "$SECRETS_DIR/android/ANDROID_KEY_ALIAS.txt"
gh secret set ANDROID_KEY_PASSWORD < "$SECRETS_DIR/android/ANDROID_KEY_PASSWORD.txt"
gh secret set PLAY_SERVICE_ACCOUNT_JSON < "$SECRETS_DIR/android/PLAY_SERVICE_ACCOUNT_JSON.json"

echo "Configurando secrets iOS..."
# Skip iOS secret update when placeholder values are present.
if rg -q "PREENCHER_AQUI" "$SECRETS_DIR/ios/IOS_DIST_P12_BASE64.txt" \
  || rg -q "PREENCHER_AQUI" "$SECRETS_DIR/ios/IOS_DIST_P12_PASSWORD.txt" \
  || rg -q "PREENCHER_AQUI" "$SECRETS_DIR/ios/APPSTORE_ISSUER_ID.txt" \
  || rg -q "PREENCHER_AQUI" "$SECRETS_DIR/ios/APPSTORE_KEY_ID.txt" \
  || rg -q "PREENCHER_AQUI" "$SECRETS_DIR/ios/APPSTORE_API_PRIVATE_KEY.p8"; then
  echo "Valores iOS em placeholder detectados. Secrets iOS nao serao alterados."
else
  gh secret set IOS_DIST_P12_BASE64 < "$SECRETS_DIR/ios/IOS_DIST_P12_BASE64.txt"
  gh secret set IOS_DIST_P12_PASSWORD < "$SECRETS_DIR/ios/IOS_DIST_P12_PASSWORD.txt"
  gh secret set APPSTORE_ISSUER_ID < "$SECRETS_DIR/ios/APPSTORE_ISSUER_ID.txt"
  gh secret set APPSTORE_KEY_ID < "$SECRETS_DIR/ios/APPSTORE_KEY_ID.txt"
  gh secret set APPSTORE_API_PRIVATE_KEY < "$SECRETS_DIR/ios/APPSTORE_API_PRIVATE_KEY.p8"
fi

echo
echo "Secrets configurados. Estado atual:"
gh secret list
