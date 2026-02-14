#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FLUTTER_BIN="${FLUTTER_BIN:-/Users/therciojosesilva/flutter/bin/flutter}"
ADB_BIN="${ADB_BIN:-/Users/therciojosesilva/Library/Android/sdk/platform-tools/adb}"
BUNDLE_ID="${BUNDLE_ID:-com.trmultichat.mobile}"
OUT_DIR="$ROOT_DIR/store_assets/google-play/phone"

mkdir -p "$OUT_DIR"

echo "==> Checking Android device/emulator"
DEVICE_LINE="$($ADB_BIN devices | awk 'NR>1 && $2==\"device\" {print $1; exit}')"
if [[ -z "${DEVICE_LINE:-}" ]]; then
  echo "Nenhum device Android ativo encontrado."
  echo "Inicie um emulador/dispositivo e rode novamente."
  exit 1
fi
ANDROID_SERIAL="$DEVICE_LINE"
echo "Dispositivo: $ANDROID_SERIAL"

echo "==> Build Android debug APK"
"$FLUTTER_BIN" build apk --debug

APK_PATH="$ROOT_DIR/build/app/outputs/flutter-apk/app-debug.apk"
if [[ ! -f "$APK_PATH" ]]; then
  echo "APK nao encontrado em: $APK_PATH"
  exit 1
fi

echo "==> Install and launch app"
"$ADB_BIN" -s "$ANDROID_SERIAL" install -r "$APK_PATH"
"$ADB_BIN" -s "$ANDROID_SERIAL" shell monkey -p "$BUNDLE_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true

shots=(
  "01-login"
  "02-dashboard"
  "03-tickets-lista"
  "04-chat-ticket"
  "05-contatos"
  "06-chat-interno"
  "07-agenda"
  "08-configuracoes"
)

echo
echo "Navegue manualmente para cada tela e pressione ENTER para capturar."
echo

for shot in "${shots[@]}"; do
  read -r -p "Pronto para capturar [$shot]? Pressione ENTER..."
  "$ADB_BIN" -s "$ANDROID_SERIAL" exec-out screencap -p > "$OUT_DIR/$shot.png"
  echo "  -> salvo: $OUT_DIR/$shot.png"
done

echo
echo "Capturas Android finalizadas em: $OUT_DIR"
