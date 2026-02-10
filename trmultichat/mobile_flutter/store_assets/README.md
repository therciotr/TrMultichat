# Store Screenshots (Google Play + App Store)

Este diretório concentra as capturas de tela para publicação do app.

## Estrutura

- `apple/iphone-6.9/` -> screenshots para App Store (iPhone 6.9")
- `google-play/phone/` -> screenshots para Google Play (telefone)

## Captura automática (assistida)

### iOS (App Store)

```bash
cd "trmultichat/mobile_flutter"
bash tools/capture_ios_store_screenshots.sh
```

### Android (Google Play)

```bash
cd "trmultichat/mobile_flutter"
bash tools/capture_android_store_screenshots.sh
```

Os scripts fazem build, instalam o app no simulador/emulador e pedem para você
navegar em cada tela antes de capturar.

## Sequência recomendada de telas

1. Login
2. Dashboard/Tickets (home)
3. Lista de tickets
4. Conversa/ticket (chat)
5. Contatos
6. Chat interno/comunicados
7. Agenda
8. Configurações/identidade visual

## Observações

- Use dados reais e visual final (branding aplicado) antes das capturas.
- Para iOS, mantenha status bar com horário 9:41 (o script já aplica override).
- Para Android, evite notificações sobrepondo a UI no momento da captura.
