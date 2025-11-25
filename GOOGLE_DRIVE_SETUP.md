# Google Drive API Setup Instructions

## Overview
This Chrome extension requires Google Drive API access to save recordings and notes. Follow these steps to set up the API credentials.

## Prerequisites
- Google Cloud Platform (GCP) account
- Google Chrome browser
- Node.js installed

## Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project selector and create a new project
3. Name your project (e.g., "Voice Recorder Extension")
4. Select your organization or "No organization" for personal use

### 2. Enable Google Drive API

1. In your project dashboard, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and then click "Enable"
4. Wait for the API to be enabled

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" and click "Create"
   - Fill in required fields:
     - App name: "Voice Recorder Extension"
     - User support email: your email
     - Developer contact information: your email
   - Click "SAVE AND CONTINUE" through all steps
   - Return to credentials page
4. Now create the OAuth client ID:
   - Application type: **Chrome Extension**
   - Name: "Voice Recorder Extension"
   - Extension ID: Leave blank for now (we'll add it later)
5. Click "Create"
6. Download the JSON file or copy the **Client ID**

### 4. Configure the Extension

1. Open the extension's `src/manifest.json` file
2. Replace `YOUR_CLIENT_ID_HERE` with your actual Client ID:

```json
{
  "oauth2": {
    "client_id": "YOUR_ACTUAL_CLIENT_ID_HERE",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file"
    ]
  }
}
```

### 5. Get Extension ID

1. Build the extension: `npm run build`
2. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder
3. Copy the Extension ID shown in the extension card
4. Go back to Google Cloud Console → Credentials → OAuth client ID
5. Edit your client ID and add the Extension ID

### 6. Test the Integration

1. Reload the extension
2. Open the extension from Chrome toolbar
3. Try recording and saving to Google Drive
4. First time will prompt for Google authorization

## Permissions Required

The extension requests these Google Drive scopes:

- `https://www.googleapis.com/auth/drive.file`
  - Access to files created by the app
  - Can create, view, and manage files in Google Drive
  - Limited access to files created by this extension only

## Troubleshooting

### "Authentication failed" Error
- Verify Client ID is correctly set in manifest.json
- Ensure Google Drive API is enabled in your GCP project
- Check that extension ID is properly configured in OAuth consent screen

### "No supported audio format found" Error
- Update Chrome to the latest version
- Try a different computer/browser

### File Upload Issues
- Check Google Drive storage space
- Ensure you're signed into the correct Google account
- Verify network connectivity

## Security Notes

- The extension only accesses files it creates
- No third-party data sharing
- Local-only audio processing until user saves to Drive
- Authentication tokens are managed securely by Chrome Identity API

## Alternative: Use Environment Variable

For development, you can also set the Client ID using environment variable:

```bash
# Create .env.local file
echo "VITE_GOOGLE_CLIENT_ID=your_actual_client_id_here" > .env.local
```

Then update the manifest to use the environment variable during build process.

---

**Important**: Never share your Client ID publicly. It's unique to your extension and should be kept confidential.