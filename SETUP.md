# 🔐 Setup Google Drive Credentials (SECURITY)

## ⚠️ IMPORTANT: Do NOT Commit Credentials to GitHub!

### 1. Create Environment File
Copy the example file:
```bash
cp .env.example .env.local
```

### 2. Add Your Google Client ID
Edit `.env.local` (this file is in .gitignore):
```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
```

### 3. Build Extension
```bash
npm run build
```

The build process will:
- ✅ Read your Client ID from `.env.local`
- ✅ Generate `dist/manifest.json` with your credentials
- ✅ Keep your credentials secure and out of Git

### 4. File Structure for Security

```
voice-recorder-ext/
├── .env.example              # ✅ Safe to commit (template)
├── .env.local               # ❌ NEVER commit (contains your credentials)
├── src/manifest.json        # ✅ Safe (contains placeholder)
├── dist/manifest.json       # ✅ Generated locally with your credentials
└── .gitignore               # ✅ Protects .env.local
```

## 🔍 What Gets Pushed to GitHub?

✅ **Safe to Commit:**
- Source code
- `.env.example` (template only)
- `src/manifest.json` (contains placeholder: `__GOOGLE_CLIENT_ID__`)
- Configuration files

❌ **NEVER Commit:**
- `.env.local` (contains your actual Client ID)
- `dist/manifest.json` (generated with credentials)

## 🚀 For Other Developers

When someone clones your repo:

1. `npm install`
2. Copy `.env.example` to `.env.local`
3. Add their own Google Client ID to `.env.local`
4. `npm run build` (generates their local manifest.json)

## 🛡️ Security Best Practices

- ✅ **Environment Variables** - Keep credentials in `.env.local`
- ✅ **Git Protection** - `.gitignore` prevents accidental commits
- ✅ **Templates** - `.env.example` shows required format
- ✅ **Generation** - Build script inserts credentials at build time

**This approach keeps your Google Client ID completely private while allowing the extension to work properly!**