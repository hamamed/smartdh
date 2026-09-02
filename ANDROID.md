# Building the KanzUp Android app (APK)

The app is a **TWA** (Trusted Web Activity) — a thin native wrapper around kanzup.com.
GitHub Actions builds and signs it; the APK is committed into `public/downloads/` so it
ships to the VPS with your normal `git pull`.

## One-time setup

1. **Create your signing key** (needs Java/keytool, which you have):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\make-keystore.ps1
   ```
   It prints 4 values. Keep them private and keep a backup of the `.keystore` file —
   if you lose the key you can't publish upgrades that install over the old app.

2. **Add the 4 secrets** to GitHub → repo **Settings → Secrets and variables → Actions**:
   `KEY_ALIAS`, `KEY_STORE_PASSWORD`, `KEY_PASSWORD`, `ANDROID_KEYSTORE_BASE64`.

## Build an APK

- GitHub → **Actions** tab → **Build Android APK** → **Run workflow**.
  (Or push a tag: `git tag v1.0.1 && git push origin v1.0.1`.)

The workflow builds the signed APK, generates `assetlinks.json` (removes the browser
URL bar inside the app), commits both into the repo, and — for tag builds — attaches the
APK to a Release.

## Go live

```bash
cd /var/www/smartdh && git pull && systemctl restart smartdh
```

Now the **Download** page (`/download`) shows a working "Download Android APK" button
(`https://kanzup.com/downloads/kanzup.apk`), and the "Install app" button installs the
PWA on any phone without an APK.
