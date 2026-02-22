# Pasta local para credenciais de release (nao versionar segredos reais)

Use esta estrutura local para facilitar a configuracao automatica dos secrets:

## Android

Criar em `trmultichat/mobile_flutter/secrets/android/`:

- `upload-keystore.base64.txt`
- `ANDROID_KEYSTORE_PASSWORD.txt`
- `ANDROID_KEY_ALIAS.txt`
- `ANDROID_KEY_PASSWORD.txt`
- `PLAY_SERVICE_ACCOUNT_JSON.json`

## iOS

Criar em `trmultichat/mobile_flutter/secrets/ios/`:

- `IOS_DIST_P12_BASE64.txt`
- `IOS_DIST_P12_PASSWORD.txt`
- `APPSTORE_ISSUER_ID.txt`
- `APPSTORE_KEY_ID.txt`
- `APPSTORE_API_PRIVATE_KEY.p8`

Depois execute:

`./trmultichat/mobile_flutter/tools/set_mobile_store_secrets.sh`

## Assinatura Android criada localmente

Neste ambiente foi gerada uma keystore de release em:

- `trmultichat/mobile_flutter/android/app/upload-keystore.jks`

Credenciais locais (nao versionadas):

- `trmultichat/mobile_flutter/secrets/android/release_keystore_credentials.local.txt`

Arquivo `key.properties` (nao versionado) atualizado em:

- `trmultichat/mobile_flutter/android/key.properties`

Observacao:

- keystore atual em formato PKCS12 usa a mesma senha para `storePassword` e `keyPassword`.
