#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FLUTTER_BIN="${FLUTTER_BIN:-$ROOT_DIR/.flutter_sdk/flutter/bin/flutter}"
ANDROID_TRACK="${ANDROID_TRACK:-internal}"
IOS_EXPORT_OPTIONS="${IOS_EXPORT_OPTIONS:-$ROOT_DIR/ios/ExportOptions.plist}"

DO_BUILD_ANDROID=true
DO_BUILD_IOS=true
DO_UPLOAD_PLAY=true
DO_UPLOAD_APPLE=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-only)
      DO_UPLOAD_PLAY=false
      DO_UPLOAD_APPLE=false
      shift
      ;;
    --android-only)
      DO_BUILD_IOS=false
      DO_UPLOAD_APPLE=false
      shift
      ;;
    --ios-only)
      DO_BUILD_ANDROID=false
      DO_UPLOAD_PLAY=false
      shift
      ;;
    --no-upload-play)
      DO_UPLOAD_PLAY=false
      shift
      ;;
    --no-upload-apple)
      DO_UPLOAD_APPLE=false
      shift
      ;;
    *)
      echo "Parametro desconhecido: $1"
      echo "Uso: $0 [--build-only] [--android-only] [--ios-only] [--no-upload-play] [--no-upload-apple]"
      exit 1
      ;;
  esac
done

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Comando obrigatorio nao encontrado: $1"
    exit 1
  }
}

if [[ ! -x "$FLUTTER_BIN" ]]; then
  echo "Flutter nao encontrado em: $FLUTTER_BIN"
  echo "Defina FLUTTER_BIN=/caminho/flutter"
  exit 1
fi

if [[ "$DO_UPLOAD_PLAY" == true ]]; then
  need_cmd bundletool
fi
if [[ "$DO_UPLOAD_APPLE" == true ]]; then
  need_cmd xcrun
fi

echo "==> Flutter pub get"
"$FLUTTER_BIN" pub get

if [[ "$DO_BUILD_ANDROID" == true ]]; then
  echo "==> Build Android App Bundle (AAB)"
  "$FLUTTER_BIN" build appbundle --release
  AAB_PATH="$ROOT_DIR/build/app/outputs/bundle/release/app-release.aab"
  if [[ ! -f "$AAB_PATH" ]]; then
    echo "AAB nao encontrado em: $AAB_PATH"
    exit 1
  fi
  echo "AAB gerado: $AAB_PATH"

  if [[ "$DO_UPLOAD_PLAY" == true ]]; then
    PLAY_JSON="$ROOT_DIR/secrets/android/PLAY_SERVICE_ACCOUNT_JSON.json"
    if [[ ! -f "$PLAY_JSON" ]]; then
      echo "Credencial do Google Play nao encontrada: $PLAY_JSON"
      exit 1
    fi
    echo "==> Upload Google Play ($ANDROID_TRACK)"
    bundletool publish \
      --service-account-json "$PLAY_JSON" \
      --aab "$AAB_PATH" \
      --track "$ANDROID_TRACK"
    echo "Upload Google Play concluido."
  fi
fi

if [[ "$DO_BUILD_IOS" == true ]]; then
  echo "==> Build iOS IPA (App Store)"
  "$FLUTTER_BIN" build ipa --release --export-options-plist="$IOS_EXPORT_OPTIONS"
  IPA_PATH="$ROOT_DIR/build/ios/ipa/*.ipa"
  if ! ls $IPA_PATH >/dev/null 2>&1; then
    echo "IPA nao encontrado em: $ROOT_DIR/build/ios/ipa/"
    exit 1
  fi
  echo "IPA gerado em: $ROOT_DIR/build/ios/ipa/"

  if [[ "$DO_UPLOAD_APPLE" == true ]]; then
    APPSTORE_ISSUER_ID_FILE="$ROOT_DIR/secrets/ios/APPSTORE_ISSUER_ID.txt"
    APPSTORE_KEY_ID_FILE="$ROOT_DIR/secrets/ios/APPSTORE_KEY_ID.txt"
    APPSTORE_P8_FILE="$ROOT_DIR/secrets/ios/APPSTORE_API_PRIVATE_KEY.p8"
    if [[ ! -f "$APPSTORE_ISSUER_ID_FILE" || ! -f "$APPSTORE_KEY_ID_FILE" || ! -f "$APPSTORE_P8_FILE" ]]; then
      echo "Credenciais App Store ausentes em secrets/ios."
      exit 1
    fi

    APPSTORE_ISSUER_ID="$(tr -d '\r\n' < "$APPSTORE_ISSUER_ID_FILE")"
    APPSTORE_KEY_ID="$(tr -d '\r\n' < "$APPSTORE_KEY_ID_FILE")"
    IPA_FILE="$(ls -1 "$ROOT_DIR"/build/ios/ipa/*.ipa | head -n 1)"

    echo "==> Upload App Store Connect"
    xcrun altool --upload-app \
      --type ios \
      --file "$IPA_FILE" \
      --apiKey "$APPSTORE_KEY_ID" \
      --apiIssuer "$APPSTORE_ISSUER_ID"

    echo "Upload App Store concluido."
  fi
fi

echo "==> Processo finalizado."
