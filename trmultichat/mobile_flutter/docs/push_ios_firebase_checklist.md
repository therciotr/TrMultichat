# Checklist definitivo - Push iOS (Firebase + APNs + Backend)

Este documento registra a configuracao que deixou as notificacoes funcionando com o app minimizado/fechado.

## 1) Apple Developer

- App ID correto: `com.trmultichatMobile`
- Capability habilitada: `Push Notifications`
- Chave APNs `.p8` criada com servico:
  - `Apple Push Notifications service (APNs)`
- Team ID utilizado:
  - `356754HM3J`

## 2) Firebase (projeto do app iOS)

- Projeto Firebase utilizado no app iOS:
  - `tr-multichat-7b2f4`
- App iOS cadastrado no Firebase com bundle:
  - `com.trmultichatMobile`
- Arquivo iOS de configuracao:
  - `ios/Runner/GoogleService-Info.plist`
- APNs no Firebase Cloud Messaging:
  - Upload da chave `.p8` correta
  - Key ID correspondente ao nome da chave `AuthKey_<KEY_ID>.p8`
  - Team ID `356754HM3J`

## 3) Flutter iOS (projeto)

- `GoogleService-Info.plist` incluido no target `Runner` e em `Resources`.
- Entitlements com APNs:
  - `ios/Runner/Runner.entitlements` com `aps-environment = production`
- Inicializacao de push no app:
  - `firebase_core` + `firebase_messaging`
  - Registro de token no backend em `/devices/push-token`

## 4) Backend (producao)

- Servico de push implementado:
  - `backend/src/services/pushNotificationService.ts`
- Rota de token de dispositivo:
  - `backend/src/modules/devices/devices.routes.ts`
- Disparo de push no inbound:
  - `backend/src/libs/ticketIngest.ts`
- Tabela de tokens:
  - `"MobilePushTokens"`

## 5) Variaveis de ambiente do backend (VPS)

- `FIREBASE_SERVICE_ACCOUNT_PATH=/home/deploy/trmultichat/trmultichat/trmultichat/backend/secrets/firebase-adminsdk-tr-multichat.json`
- `FIREBASE_PROJECT_ID=tr-multichat-7b2f4`

## 6) Seguranca e segredos

- Nao versionar no GitHub:
  - Arquivos `.p8`, `.p12`, `GoogleService-Info.plist` sensivel de outros ambientes, `service-account.json`, tokens e senhas.
- Manter segredos apenas em:
  - GitHub Secrets (CI/CD)
  - VPS (arquivo local fora do repositorio publico)

## 7) Teste de validacao (obrigatorio)

1. Instalar build mais recente do TestFlight.
2. Abrir app e fazer login uma vez (registrar token).
3. Minimizar/fechar app.
4. Enviar mensagem inbound de teste.
5. Confirmar banner + som no iOS.

## 8) Diagnostico rapido quando falhar

- Erro `messaging/third-party-auth-error` no backend:
  - APNs no Firebase invalido (Key ID/Team ID/chave errada).
- Sem token em `"MobilePushTokens"`:
  - app nao registrou token (abrir app e logar novamente).
- Notifica em foreground, mas nao em background:
  - problema de APNs/Firebase ou permissao de notificacao no iOS.
