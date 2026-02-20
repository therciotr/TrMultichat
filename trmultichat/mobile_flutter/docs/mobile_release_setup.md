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

## 6) Assinatura Android local (release)

Para evitar envio em modo debug para a Play Store:

1. Garantir keystore em `android/app/upload-keystore.jks`.
2. Preencher `android/key.properties` com valores reais.
3. Gerar o bundle assinado:
   - `flutter build appbundle --release`
4. Validar assinatura:
   - `jarsigner -verify -verbose -certs build/app/outputs/bundle/release/app-release.aab`
   - o certificado nao deve ser `CN=Android Debug`.

As credenciais locais devem ficar fora do git e podem ser armazenadas em:

- `trmultichat/mobile_flutter/secrets/android/release_keystore_credentials.local.txt`

Última atualização do guia: trigger CI mobile.
Verificação adicional: novo disparo para validação de secrets no CI.
Disparo solicitado para envio em produção nas lojas oficiais.
Politica de privacidade publicada em: https://politicadeprivacidade.trmultichat.com.br

## 6) Status real da automação (Jan/2026)

### 6.1 O que já está configurado

- `ANDROID_KEYSTORE_BASE64`: configurado.
- `ANDROID_KEYSTORE_PASSWORD`: configurado.
- `ANDROID_KEY_ALIAS`: configurado.
- `ANDROID_KEY_PASSWORD`: configurado.
- `PLAY_SERVICE_ACCOUNT_JSON`: configurado.

### 6.2 O que já foi corrigido no workflow

Arquivo: `.github/workflows/mobile-release.yml`

- Corrigido caminho do keystore Android no CI para `android/app/upload-keystore.jks`.
- Corrigido `storeFile` do `key.properties` para `upload-keystore.jks`.
- Desabilitado file watch do Gradle no build release (`GRADLE_OPTS=-Dorg.gradle.vfs.watch=false`) para evitar travamentos no runner.

### 6.3 Falhas atuais encontradas no último disparo

- Android:
  - build do `.aab` concluído;
  - falha apenas no upload para Play com erro de API:
    - `Google Play Android Developer API has not been used in project 195442640345 before or it is disabled`.
- iOS:
  - falha em `Validate iOS secrets` por falta dos secrets iOS obrigatórios.

### 6.4 Pendências para concluir envio em produção

1. Google Play
   - Habilitar `androidpublisher.googleapis.com` no projeto GCP do JSON usado em `PLAY_SERVICE_ACCOUNT_JSON`.
   - Garantir que a service account desse JSON esteja vinculada no Play Console com permissão de release do app `com.trmultichat.mobile`.

2. App Store Connect (secrets ausentes)
   - `IOS_DIST_P12_BASE64`
   - `IOS_DIST_P12_PASSWORD`
   - `APPSTORE_ISSUER_ID`
   - `APPSTORE_KEY_ID`
   - `APPSTORE_API_PRIVATE_KEY`

Sem essas pendências, o pipeline não consegue publicar em produção nas lojas.
