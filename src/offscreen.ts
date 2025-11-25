// Offscreen document for audio recording
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

interface RecordingMessage {
  target: 'offscreen';
  type: 'START_RECORDING' | 'STOP_RECORDING' | 'PAUSE_RECORDING' | 'RESUME_RECORDING';
  audioSource?: 'microphone' | 'system';
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message: RecordingMessage, _sender, sendResponse) => {
  // Only process messages intended for offscreen document
  if (message.target !== 'offscreen') {
    return false;
  }

  switch (message.type) {
    case 'START_RECORDING':
      console.log('Starting recording with audio source:', message.audioSource);
      startRecording(message.audioSource)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response

    case 'STOP_RECORDING':
      stopRecording()
        .then((audioBlob) => {
          // Convert blob to base64 for transfer
          return blobToBase64(audioBlob);
        })
        .then((base64Audio) => {
          sendResponse({ success: true, audioBlob: base64Audio });
        })
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'PAUSE_RECORDING':
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Not recording' });
      }
      return true;

    case 'RESUME_RECORDING':
      if (mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Not paused' });
      }
      return true;

    default:
      return false;
  }
});

async function startRecording(audioSource: 'microphone' | 'system' = 'microphone'): Promise<void> {
  try {
    // Clean up any existing recording
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      audioChunks = [];
    }

    console.log(`Requesting ${audioSource} audio access...`);
    let stream: MediaStream;

    if (audioSource === 'system') {
      // Get system audio (desktop audio)
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });
    } else {
      // Get microphone audio
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
    }

    console.log(`${audioSource} access granted, audio tracks:`, stream.getAudioTracks().length);

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      throw new Error('No supported audio format found');
    }

    mediaRecorder = new MediaRecorder(stream, {
      mimeType
    });

    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onerror = (event: any) => {
      console.error('MediaRecorder error:', event);
      throw new Error('Recording error occurred');
    };

    mediaRecorder.onstop = () => {
      // Stop all tracks to release the microphone
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
      });
    };

    mediaRecorder.start(1000); // Collect data every second
    console.log('Recording started in offscreen document');
  } catch (error) {
    console.error('Error starting recording:', error);

    // Check for specific permission errors
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Permission dismissed - Microphone access was denied by user');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found - Please connect a microphone');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Microphone is already in use by another application');
      }
    }

    throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function stopRecording(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      reject(new Error('No active recording'));
      return;
    }

    if (mediaRecorder.state === 'inactive') {
      reject(new Error('Recording is already stopped'));
      return;
    }

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      reject(new Error('No supported audio format available'));
      return;
    }

    mediaRecorder.onstop = () => {
      try {
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        console.log('Recording stopped, blob size:', audioBlob.size);

        if (audioBlob.size === 0) {
          reject(new Error('Recording failed: no audio data captured'));
          return;
        }

        resolve(audioBlob);
      } catch (error) {
        reject(new Error(`Failed to create audio blob: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    mediaRecorder.onerror = (event: any) => {
      console.error('MediaRecorder error during stop:', event);
      reject(new Error(`Recording error: ${event?.error || 'Unknown error'}`));
    };

    try {
      mediaRecorder.stop();
    } catch (error) {
      reject(new Error(`Failed to stop recording: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

function getSupportedMimeType(): string | null {
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm;codecs=vp8,opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav'
  ];

  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      console.log(`Using audio format: ${mimeType}`);
      return mimeType;
    }
  }

  console.warn('No supported audio MIME types found');
  return null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}