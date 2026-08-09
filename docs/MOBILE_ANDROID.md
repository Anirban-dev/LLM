# Mobile Android Application Guide

ChatApp is optimized for mobile responsiveness and configured for Android builds via **Capacitor**.

---

## 📋 Prerequisites for Android Development

- **Android Studio**: Latest version with Android SDK (API level 33+)
- **Java Development Kit (JDK)**: JDK 17 or later
- **Capacitor CLI**: `npx cap`

---

## 📱 Step-by-Step Android Setup

### Step 1: Build Web Assets & Sync Capacitor

Build the production frontend bundle and sync it into the Android project wrapper:

```bash
npm run android:build
```

This executes:
1. `vite build` to output distribution files into `dist/`
2. `npx cap sync android` to copy built assets into the native Android platform project.

### Step 2: Open in Android Studio

To open the project in Android Studio for building APKs or running on physical devices/emulators:

```bash
npm run android:open
```

In Android Studio:
1. Select an Android Virtual Device (AVD) or connect a physical phone via USB Debugging.
2. Click **Run 'app'** (`Shift + F10`) to build and launch on the device.

---

## 🔧 Server Host Configuration for Android Emulator

When testing on an Android Emulator:
- Replace `localhost` API endpoints with `http://10.0.2.2:3000` (Android host alias for localhost).
- For physical devices over Wi-Fi, use your local machine's local IP address (e.g. `http://192.168.1.X:3000`).

---

## ⚙️ Capacitor Configuration

Main settings are stored in `capacitor.config.json`:

```json
{
  "appId": "com.chatapp.mobile",
  "appName": "ChatApp",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  }
}
```
