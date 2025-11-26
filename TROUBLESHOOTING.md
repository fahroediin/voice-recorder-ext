# Recording Issues Troubleshooting Guide

## Common Recording Start Issues and Solutions

### 1. Microphone Permissions
**Issue**: Browser denies microphone access
**Solution**:
- Click the microphone icon in the browser address bar
- Select "Allow" for microphone access
- Reload the extension page

### 2. Offscreen Document Issues
**Issue**: "Failed to create offscreen document"
**Solution**:
- Open Chrome Developer Tools (F12)
- Check Console for specific error messages
- Ensure Chrome is updated to latest version

### 3. HTTPS/Localhost Requirements
**Issue**: Recording doesn't work on HTTP pages
**Solution**:
- Use HTTPS websites
- For local development, use https://localhost
- Extension pages should work automatically

### 4. Chrome Extension Permissions
**Issue**: Missing required permissions
**Solution**:
- Go to `chrome://extensions/`
- Find "Voice Recorder & Notes"
- Click "Details"
- Ensure "Site access" allows access to all sites or specific sites

### 5. System Audio Recording Issues
**Issue**: System audio not working
**Solution**:
- When Chrome asks to share screen, CHECK "Share audio" checkbox
- Ensure system volume is audible
- Some systems may not support system audio sharing

## Debug Steps

1. **Open Chrome Developer Tools**:
   - Right-click the extension side panel
   - Select "Inspect"
   - Check Console tab for error messages

2. **Check Extension Background Page**:
   - Go to `chrome://extensions/`
   - Click "Service worker" link for this extension
   - Check Console for background script errors

3. **Verify Microphone Access**:
   - Test microphone on https://webcammictest.com/
   - Ensure browser microphone permissions are granted

## Error Messages and What They Mean

### "Failed to start recording. Please check your browser settings and try again."
- **Most likely**: Microphone permission denied
- **Check**: Browser microphone permissions, try different microphone

### "Failed to create offscreen document"
- **Most likely**: Chrome version issue or extension permissions
- **Check**: Chrome version, extension is enabled, no conflicts

### "No audio tracks found"
- **Most likely**: System audio sharing not enabled
- **Check**: "Share audio" checkbox in screen sharing dialog

## Testing Different Audio Sources

1. **Microphone Only**:
   - Should work on most systems
   - Basic microphone permission required

2. **System Audio**:
   - Requires screen sharing with audio
   - Not all systems support this

3. **Both**:
   - Most complex, combines both challenges
   - Best for online meetings

## Browser Compatibility

- **✅ Chrome**: Full support (recommended)
- **✅ Edge**: Good support
- **⚠️ Firefox**: Limited support
- **❌ Safari**: Not supported

## If Issues Persist

1. Restart Chrome completely
2. Disable and re-enable the extension
3. Try a different microphone
4. Test on a different HTTPS website
5. Check Chrome version is up to date