# Pendencias atuais para publicar nas lojas

Atualizado automaticamente no ambiente local.

## 1) Google Play (Android)

Status atual:
- Build Android no GitHub Actions esta concluindo com sucesso.
- Falha ocorre apenas no upload para Play.

Erro identificado:
- `Google Play Android Developer API has not been used in project 195442640345 before or it is disabled`.

Acao necessaria no Google Cloud:
- Habilitar a API `androidpublisher.googleapis.com` no projeto do service account usado em `PLAY_SERVICE_ACCOUNT_JSON`.

Acao necessaria no Play Console:
- Validar que a mesma service account tem permissao de release para o app `com.trmultichat.mobile`.

## 2) App Store Connect (iOS)

Status atual:
- Job iOS para em `Validate iOS secrets`.

Secrets obrigatorios ainda ausentes:
- `IOS_DIST_P12_BASE64`
- `IOS_DIST_P12_PASSWORD`
- `APPSTORE_ISSUER_ID`
- `APPSTORE_KEY_ID`
- `APPSTORE_API_PRIVATE_KEY`

Sem esses secrets, o CI nao consegue:
- importar certificado de distribuicao;
- baixar provisioning profile App Store;
- gerar e enviar IPA.

## 3) Secrets ja presentes no repositorio

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `PLAY_SERVICE_ACCOUNT_JSON`

