#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FLUTTER_BIN="${FLUTTER_BIN:-/Users/therciojosesilva/flutter/bin/flutter}"
SIMULATOR_NAME="${SIMULATOR_NAME:-iPhone 16 Pro Max}"
SIMULATOR_UDID="${SIMULATOR_UDID:-302D82E5-F083-401A-B3D9-3BE76934EBCE}"
BUNDLE_ID="${BUNDLE_ID:-com.trmultichatMobile}"
OUT_DIR="$ROOT_DIR/store_assets/apple/iphone-6.9"

mkdir -p "$OUT_DIR"

echo "==> Build iOS simulator app"
"$FLUTTER_BIN" build ios --debug --simulator

APP_PATH="$ROOT_DIR/build/ios/iphonesimulator/Runner.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "Runner.app nao encontrado em: $APP_PATH"
  exit 1
fi

echo "==> Boot simulator: $SIMULATOR_NAME"
xcrun simctl boot "$SIMULATOR_UDID" || true
xcrun simctl bootstatus "$SIMULATOR_UDID" -b
open -a Simulator

echo "==> Install and launch app"
xcrun simctl install "$SIMULATOR_UDID" "$APP_PATH"
xcrun simctl terminate "$SIMULATOR_UDID" "$BUNDLE_ID" || true
xcrun simctl launch "$SIMULATOR_UDID" "$BUNDLE_ID" || true

echo "==> Apply App Store status bar style (9:41)"
xcrun simctl status_bar "$SIMULATOR_UDID" override --time 9:41 --dataNetwork wifi --wifiBars 3 --cellularBars 4 --batteryState charged --batteryLevel 100 || true

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
  xcrun simctl io "$SIMULATOR_UDID" screenshot "$OUT_DIR/$shot.png"
  echo "  -> salvo: $OUT_DIR/$shot.png"
done

echo "==> Clear status bar override"
xcrun simctl status_bar "$SIMULATOR_UDID" clear || true

echo
echo "Capturas iOS finalizadas em: $OUT_DIR"
