# 🎙️ Voice Recorder & Notes Chrome Extension

A powerful Chrome extension that allows you to record audio meetings, take notes, and save everything directly to Google Drive with automatically formatted meeting notes.

## ✨ Features

- 🎙️ **High-Quality Audio Recording**: Record meetings with echo cancellation and noise suppression
- 📝 **Rich Text Editor**: Take notes with formatting options (bold, italic, lists)
- ☁️ **Google Drive Integration**: Save recordings and notes directly to your Google Drive
- 📊 **Automatic Organization**: Creates date-stamped folders for each recording session
- ⏱️ **Recording Timer**: Keep track of recording duration with pause/resume functionality
- 🎨 **Modern UI**: Clean, responsive interface built with React and Tailwind CSS
- 🔄 **Real-time Updates**: Live recording status and timer display

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Shadcn/ui components
- **State Management**: Zustand
- **Text Editor**: TipTap
- **Icons**: Lucide React
- **Extension APIs**: Chrome Extension Manifest V3
- **Audio Processing**: Web MediaRecorder API
- **Cloud Storage**: Google Drive API

## 📦 Installation

### Prerequisites

- Node.js 18+ installed
- Google account for Drive integration

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd voice-recorder-ext
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked" and select the `dist` folder
   - The extension icon should appear in your toolbar

## 🚀 Usage

### Recording Audio

1. Click the extension icon in your Chrome toolbar
2. Enter an activity name (e.g., "Team Standup", "Client Meeting")
3. Add an optional description
4. Click "Start Recording" to begin
5. Use Pause/Resume as needed during recording
6. Click "Stop" when finished

### Taking Notes

- Use the rich text editor to take notes during or after recording
- Format options include:
  - **Bold**: `Ctrl/Cmd + B`
  - **Italic**: `Ctrl/Cmd + I`
  - **Bullet Lists**: Toggle bullet points
  - **Numbered Lists**: Toggle numbered lists

### Saving to Google Drive

1. After stopping recording, click "Save to Google Drive"
2. Sign in to your Google account if prompted
3. The extension will automatically:
   - Create a folder with date prefix (e.g., "2024-01-15 - Team Meeting")
   - Upload the audio recording with proper file extension
   - Generate and upload formatted HTML meeting notes
   - Open the Drive folder for easy access

## 📁 File Structure

```
voice-recorder-ext/
├── src/
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   ├── RichTextEditor.tsx  # TipTap-based text editor
│   │   └── SidePanel.tsx       # Main extension interface
│   ├── services/
│   │   └── googleDriveService.ts # Google Drive API integration
│   ├── store/
│   │   └── useRecorderStore.ts  # Zustand state management
│   ├── types/
│   │   └── chrome.d.ts          # Chrome API type definitions
│   ├── lib/
│   │   └── utils.ts            # Utility functions
│   ├── background.ts            # Background service worker
│   ├── offscreen.ts            # Offscreen document for recording
│   ├── offscreen.html          # Offscreen HTML page
│   ├── App.tsx                 # Main React component
│   └── main.tsx               # React entry point
├── dist/                       # Built extension files
└── manifest.json              # Extension manifest
```

## ⚙️ Configuration

### Google Drive API

The extension uses Google Drive API with the following scopes:
- `https://www.googleapis.com/auth/drive.file` - Access to files created by the app

### Chrome Extension Permissions

- `storage`: Store extension data locally
- `offscreen`: Create offscreen documents for audio recording
- `identity`: Authenticate with Google services
- `sidePanel`: Display extension in side panel

## 🔧 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview built extension
npm run preview
```

### Environment Variables

Create a `.env.local` file for development (if needed):

```env
VITE_GOOGLE_API_KEY=your_google_api_key
```

### Chrome Extension Debugging

1. **Background Script**: Open Chrome DevTools in `chrome://extensions/` and click "Service worker"
2. **Offscreen Document**: Check console logs in the extension's background page
3. **Side Panel**: Use Chrome DevTools while the side panel is open

## 🎯 Key Features Explained

### Audio Recording

- Uses Web MediaRecorder API for high-quality recording
- Supports multiple audio formats (WebM, MP4, OGG, WAV)
- Automatic echo cancellation and noise suppression
- Real-time recording with pause/resume functionality

### State Management

- Zustand store manages recording state, timer, and session data
- Persistent data storage for recording sessions
- Real-time UI updates based on recording state

### Google Drive Integration

- Automatic folder creation with date stamps
- HTML-formatted meeting notes with embedded metadata
- Direct file upload using Google Drive API v3
- Proper MIME type handling and file extensions

## 🛡️ Security & Privacy

- All recordings are processed locally
- Google Drive access limited to files created by the app
- No third-party data sharing
- Local-only audio processing until user saves to Drive

## 🔍 Troubleshooting

### Common Issues

1. **Extension not loading**: Ensure Developer mode is enabled in `chrome://extensions/`
2. **Audio recording not working**: Check microphone permissions in Chrome settings
3. **Google Drive authentication**: Clear extension data and re-authenticate
4. **Build errors**: Run `npm install` to ensure all dependencies are up to date

### Error Messages

- **"No supported audio format found":** Your browser doesn't support required audio formats
- **"Authentication failed":** Google Drive authentication issue, try re-authenticating
- **"Recording error occurred":** Microphone access denied or hardware issue

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and feature requests, please use the GitHub Issues page.

---

Built with ❤️ using React, TypeScript, and modern web technologies.
# voice-recorder-ext
