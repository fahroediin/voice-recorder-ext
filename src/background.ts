// Background service worker for the Voice Recorder extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Voice Recorder Extension installed');
});

// Handle opening side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  // Note: sidePanel.open() must be called in response to user gesture
  chrome.sidePanel.open({ tabId: tab.id });
});

// Handle messages from side panel and offscreen document
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'OPEN_OFFSCREEN':
      createOffscreenDocument()
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open

    case 'START_RECORDING':
    case 'STOP_RECORDING':
    case 'PAUSE_RECORDING':
    case 'RESUME_RECORDING':
      // Forward recording messages to offscreen document
      console.log('Forwarding recording message with audioSource:', message.audioSource, 'micId:', message.microphoneId);
      forwardToOffscreen(message, sendResponse);
      return true; // Keep message channel open

    default:
      return false;
  }
});

// Forward messages to offscreen document
async function forwardToOffscreen(message: any, sendResponse: (response?: any) => void) {
  try {
    const offscreenContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('src/offscreen.html')]
    });

    if (offscreenContexts.length === 0) {
      sendResponse({ success: false, error: 'No offscreen document found' });
      return;
    }

    console.log('Forwarding message to offscreen:', message);

    // Send message to offscreen document using proper target
    chrome.runtime.sendMessage({
      ...message,
      target: 'offscreen'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error in offscreen communication:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('Offscreen response:', response);
        sendResponse(response);
      }
    });

    return true; // Keep message channel open for response
  } catch (error) {
    console.error('Error forwarding to offscreen:', error);
    sendResponse({ success: false, error: 'Failed to forward message' });
    return false;
  }
}

// Create offscreen document for audio recording
async function createOffscreenDocument() {
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('src/offscreen.html')]
    });

    if (existingContexts.length > 0) {
      return; // Already exists
    }

    // Create new offscreen document
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('src/offscreen.html'),
      reasons: ['USER_MEDIA'],
      justification: 'Recording audio for voice notes'
    });

    console.log('Offscreen document created for audio recording');
  } catch (error) {
    console.error('Error creating offscreen document:', error);
    throw error;
  }
}