# App nativo (Capacitor)

O jogo já é um PWA instalável (Fase 2). Use o app nativo só se precisar estar na Play Store / App Store.

O Capacitor empacota o mesmo `dist/` dentro de um app. Nada no código do jogo muda.

## Android

Pré-requisitos: Android Studio com SDK instalado.

```bash
npm run build
npx cap add android        # só na primeira vez; cria a pasta android/
npm run cap:android        # build + sincroniza + abre no Android Studio
```

No Android Studio: **Run** para testar num celular, ou **Build → Generate Signed Bundle** para publicar.

Trave a orientação em paisagem em `android/app/src/main/AndroidManifest.xml`, na `<activity>`:

```xml
android:screenOrientation="sensorLandscape"
```

## iOS

Pré-requisitos: Mac com Xcode.

```bash
npm run build
npx cap add ios
npm run cap:ios
```

No Xcode, em *General → Deployment Info*, deixe só as orientações paisagem.

## Atualizar depois de mudar o jogo

```bash
npm run cap:sync
```
