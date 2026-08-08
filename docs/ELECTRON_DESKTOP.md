# Electron Desktop Application Guide

ChatApp includes built-in support for running as a cross-platform desktop application using **Electron**.

---

## 🛠️ Step 1: Running Electron in Development Mode

Before launching Electron, ensure the full-stack web app server is running on `http://localhost:3000`:

```bash
# Terminal 1: Start full-stack web application
npm run dev

# Terminal 2: Launch Electron desktop wrapper
npm run electron:dev
```

---

## 📦 Step 2: Packaging Native Desktop Executables

To build standalone, native desktop executables (`.dmg`, `.exe`, `.AppImage`, `.deb`), use the following commands:

### Build for macOS (`.dmg`, `.zip`)
```bash
npm run electron:pack:mac
```

### Build for Windows (`.exe` NSIS installer & portable)
```bash
npm run electron:pack:win
```

### Build for Linux (`.AppImage`, `.deb`)
```bash
npm run electron:pack:linux
```

All built desktop packages will be saved into the `dist-electron/` directory.

---

## ⚙️ Electron Configuration

Electron configuration is managed in `package.json` under the `"build"` key and the `electron/main.js` entry point:

- Window Dimensions: `1200 x 800` (min width: `380px` for mobile testing)
- Web Preferences: Node integration disabled, context isolation enabled for security.
