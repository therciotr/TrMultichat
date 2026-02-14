# Mobile release automation (Play Store + App Store Connect)

Este projeto publica automaticamente o app mobile quando há push/merge em `main` com alterações em `trmultichat/mobile_flutter/**`.

## 1) Secrets obrigatórios no GitHub

Configurar no repositório (Settings > Secrets and variables > Actions):

- `ANDROID_KEYSTORE_BASE64`: keystore Android em base64.
- `ANDROID_KEYSTORE_PASSWORD`: senha do keystore.
- `ANDROID_KEY_ALIAS`: alias da chave.
- `ANDROID_KEY_PASSWORD`: senha da chave.
- `PLAY_SERVICE_ACCOUNT_JSON`: JSON da conta de serviço com acesso ao Play Console.
- `IOS_DIST_P12_BASE64`: certificado de distribuição iOS (`.p12`) em base64.
- `IOS_DIST_P12_PASSWORD`: senha do `.p12`.
- `APPSTORE_ISSUER_ID`: issuer ID da App Store Connect API key.
- `APPSTORE_KEY_ID`: key ID da App Store Connect API key.
- `APPSTORE_API_PRIVATE_KEY`: conteúdo da chave privada (`.p8`).

## 2) Identificadores de produção

- Android `applicationId`: `com.trmultichat.mobile`
- iOS bundle id: `com.trmultichatMobile`

Antes do primeiro release, confirme que estes IDs existem nas lojas corretas.

## 3) Versionamento

- Versão semântica no `pubspec.yaml` (ex.: `1.0.0+1`).
- Build number automático no CI: `${{ github.run_number }}` para Android e iOS.

## 4) Pipeline

Workflow: `.github/workflows/mobile-release.yml`

- Job Android:
  - gera `android/key.properties` com secrets
  - build `appbundle`
  - upload em `production` no Google Play
- Job iOS:
  - importa certificado de distribuição
  - baixa provisioning profile App Store
  - build IPA com `ios/ExportOptions.plist`
  - upload para App Store Connect (TestFlight)

## 5) Primeiro release (validação inicial)

1. Faça merge em `main` alterando qualquer arquivo em `trmultichat/mobile_flutter/`.
2. Acompanhe a execução no GitHub Actions (`Mobile Release`).
3. Validar:
   - Play Console: novo release em produção.
   - App Store Connect/TestFlight: novo build processado.
4. Em caso de falha:
   - conferir secrets;
   - conferir permissões da service account do Play;
   - conferir API key, certificado e profile iOS.
