// Offscreen document for audio recording
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

interface RecordingMessage {
  target: 'offscreen';
  type: 'START_RECORDING' | 'STOP_RECORDING' | 'PAUSE_RECORDING' | 'RESUME_RECORDING';
  audioSource?: 'microphone' | 'system' | 'both';
  microphoneId?: string | null;
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message: RecordingMessage, _sender, sendResponse) => {
  // Only process messages intended for offscreen document
  if (message.target !== 'offscreen') {
    return false;
  }

  switch (message.type) {
    case 'START_RECORDING':
      console.log('🎤 Starting recording with audio source:', message.audioSource);
      console.log('🎤 Microphone ID from message:', message.microphoneId);
      console.log('🎤 Available audio devices before recording:');

      // Log available devices for debugging
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        console.log('🎤 Available microphones:');
        audioInputs.forEach((device, index) => {
          console.log(`  ${index + 1}. ID: ${device.deviceId}, Label: ${device.label || 'Unknown'}`);
        });
      });

      startRecording(message.audioSource, message.microphoneId)
        .then(() => {
          console.log('✅ Recording started successfully');
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('❌ Recording failed to start:', error);
          sendResponse({ success: false, error: error.message });
        });
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

async function startRecording(
  audioSource: 'microphone' | 'system' | 'both' = 'microphone',
  microphoneId: string | null = null
): Promise<void> {
  try {
    // Clean up any existing recording
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      audioChunks = [];
    }

    console.log(`Requesting ${audioSource} audio access...`);
    let combinedStream: MediaStream;
    let tracks: MediaStreamTrack[] = [];

    if (audioSource === 'both') {
      // Get both microphone and system audio
      console.log('Requesting both microphone and system audio...');
      let systemStream: MediaStream | null = null;
      let micStream: MediaStream | null = null;

      try {
        // Get system audio first
        systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Video required for getDisplayMedia to work
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 44100
          }
        });

        // Check if system audio tracks are available
        const systemTracks = systemStream.getAudioTracks();
        if (systemTracks.length === 0) {
          console.warn('System audio tracks not found, stopping system stream...');
          systemStream.getTracks().forEach(track => track.stop());
          systemStream = null;
        } else {
          console.log('System audio granted');
        }
      } catch (systemError) {
        console.warn('System audio access denied:', systemError);
        systemStream = null;
        // Continue with microphone only if system audio fails
      }

      try {
        console.log('🎤 Requesting microphone access...');
        console.log('🎤 Target microphone ID:', microphoneId);

        // First enumerate devices to verify the selected microphone exists
        if (microphoneId) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === 'audioinput');
          const selectedDevice = audioInputs.find(device => device.deviceId === microphoneId);

          console.log('🎤 Available microphones:');
          audioInputs.forEach((device, index) => {
            console.log(`  ${index + 1}. ID: ${device.deviceId}, Label: ${device.label || 'Unknown'}`);
          });

          if (!selectedDevice) {
            console.warn(`⚠️ Selected microphone ID ${microphoneId} not found in available devices`);
            console.warn('⚠️ Falling back to default microphone');
            microphoneId = null;
          } else {
            console.log(`✅ Found selected microphone: ${selectedDevice.label || 'Unknown'}`);
          }
        }

        // Get microphone with specific device ID if provided
        const audioConstraints: MediaStreamConstraints = microphoneId ? {
          audio: {
            deviceId: { exact: microphoneId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        } : {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        };

        console.log('🎤 Audio constraints:', JSON.stringify(audioConstraints, null, 2));

        micStream = await navigator.mediaDevices.getUserMedia(audioConstraints);

        // Verify the actual device used
        const audioTracks = micStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const track = audioTracks[0];
          const settings = track.getSettings();
          console.log('🎤 Microphone access granted!');
          console.log('🎤 Requested device ID:', microphoneId);
          console.log('🎤 Actual device ID used:', settings.deviceId);
          console.log('🎤 Device label:', track.label || 'Unknown');
          console.log('🎤 Device group ID:', settings.groupId);

          // Check if the correct device was used
          if (microphoneId && settings.deviceId !== microphoneId) {
            console.warn('⚠️ WARNING: Different microphone was used than requested!');
            console.warn(`⚠️ Requested: ${microphoneId}, Used: ${settings.deviceId}`);
          } else if (microphoneId) {
            console.log('✅ Correct external microphone is being used');
          } else {
            console.log('ℹ️ Using default microphone');
          }
        }

      } catch (micError) {
        console.error('❌ Microphone access denied:', micError);
        console.error('❌ Error details:', micError instanceof Error ? micError.message : micError);

        // Clean up system audio if mic fails
        if (systemStream) {
          systemStream.getTracks().forEach(track => track.stop());
        }

        // If specific device failed, try fallback to default
        if (microphoneId) {
          console.warn('⚠️ Failed to use selected microphone, trying default...');
          try {
            micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100
              }
            });

            // Log fallback device info
            const audioTracks = micStream.getAudioTracks();
            if (audioTracks.length > 0) {
              const track = audioTracks[0];
              const settings = track.getSettings();
              console.log('🔄 Fallback microphone access granted');
              console.log('🔄 Fallback device ID:', settings.deviceId);
              console.log('🔄 Fallback device label:', track.label || 'Unknown');
            }

          } catch (fallbackError) {
            console.error('❌ Fallback microphone also failed:', fallbackError);
            throw new Error('Microphone access is required for recording. Please allow microphone access.');
          }
        } else {
          throw new Error('Microphone access is required for recording. Please allow microphone access.');
        }
      }

      // Combine both streams, fallback to microphone only if system audio failed
      if (systemStream && micStream) {
        tracks = [...systemStream.getAudioTracks(), ...micStream.getAudioTracks()];
        console.log(`Combined audio tracks: ${tracks.length} (system: ${systemStream.getAudioTracks().length}, mic: ${micStream.getAudioTracks().length})`);
      } else if (micStream) {
        tracks = micStream.getAudioTracks();
        console.log(`Using microphone only (${tracks.length} tracks) - system audio not available`);
      } else {
        throw new Error('Failed to get any audio source');
      }

    } else if (audioSource === 'system') {
      // Enhanced system audio recording with better validation and error handling
      console.log('🎵 Using enhanced system audio recording...');
      tracks = await getEnhancedSystemAudio();

    } else {
      // Get microphone only
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      tracks = micStream.getAudioTracks();
      console.log(`Microphone tracks: ${tracks.length}`);
    }

    // Create combined stream with track metadata
    combinedStream = new MediaStream(tracks);

    // Log track information for debugging
    console.log(`🎤 Total audio tracks combined: ${tracks.length}`);
    tracks.forEach((track, index) => {
      console.log(`🎤 Track ${index + 1}:`, {
        id: track.id,
        kind: track.kind,
        label: track.label || 'Unknown device',
        enabled: track.enabled,
        muted: track.muted,
        settings: track.getSettings()
      });
    });

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      throw new Error('No supported audio format found');
    }

    console.log(`🎤 Using MediaRecorder with mimeType: ${mimeType}`);
    console.log(`🎤 Audio source recording: ${audioSource}`);

    mediaRecorder = new MediaRecorder(combinedStream, {
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
      // Stop all tracks to release all audio sources
      tracks.forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
      });
    };

    mediaRecorder.start(1000); // Collect data every second
    console.log(`✅ Recording started in offscreen document with ${audioSource} audio source`);
    console.log(`🎤 Total audio tracks: ${tracks.length}`);
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

/**
 * Enhanced system audio recording with better validation
 */
async function getEnhancedSystemAudio(): Promise<MediaStreamTrack[]> {
  console.log('🎵 Starting enhanced system audio recording...');

  let systemStream: MediaStream;

  try {
    // Request system audio with better error handling
    console.log('📱 Requesting display media with audio...');
    console.log('💡 IMPORTANT: Make sure to check "Share audio" in the dialog!');

    systemStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 44100
      }
    });

    console.log('✅ Display media obtained successfully');

    // Get audio tracks only
    const audioTracks = systemStream.getAudioTracks();
    console.log(`🎵 System audio tracks found: ${audioTracks.length}`);

    // Detailed logging for each track
    audioTracks.forEach((track, index) => {
      const settings = track.getSettings();
      console.log(`🎵 Track ${index + 1}:`, {
        id: track.id,
        label: track.label || 'System Audio',
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount
      });
    });

    if (audioTracks.length === 0) {
      // Cleanup stream before throwing error
      systemStream.getTracks().forEach(track => track.stop());

      throw new Error(`
❌ NO AUDIO TRACKS FOUND - SOLUTION BELOW:

PROBLEM: System audio recording failed because no audio tracks were captured.

REASON: "Share audio" was NOT checked in the screen sharing dialog.

SOLUTION:
1. Try recording again
2. In the screen sharing dialog, CHECK the "Share audio" checkbox
3. Make sure audio is playing on your system (YouTube, Spotify, etc.)
4. Click "Share" button

STEP-BY-STEP:
✅ Click "Record" button
✅ Select "System Audio" mode
✅ When dialog appears, CHECK "Share audio" box
✅ Select window/tab to share
✅ Click "Share" button
✅ Start playing audio

If this continues to fail, try "Microphone" mode instead.
      `.trim());
    }

    // Enhanced validation
    console.log('🔍 Validating audio capture...');
    await validateAudioCapture(systemStream);

    // Optimize tracks
    audioTracks.forEach(track => {
      console.log(`🎛️ Optimizing track: ${track.label}`);
      track.enabled = true;

      try {
        track.applyConstraints({
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }).catch(e => console.warn('Could not apply constraints:', e));
      } catch (e) {
        console.warn('Constraint application failed:', e);
      }
    });

    console.log('✅ System audio setup completed successfully');
    return audioTracks;

  } catch (error) {
    console.error('❌ System audio access failed:', error);

    if (error instanceof Error) {
      let message = '';

      switch (error.name) {
        case 'NotAllowedError':
          message = `
❌ PERMISSION DENIED

PROBLEM: You cancelled the screen sharing or didn't allow audio sharing.

SOLUTION:
✅ Click "Allow" when prompted for screen sharing
✅ CHECK the "Share audio" checkbox in the dialog
✅ Try again if you accidentally cancelled

TIPS:
• Don't press Escape or click outside the dialog
• Make sure to check "Share audio" box
• Grant browser audio permissions if asked
          `.trim();
          break;

        case 'NotSupportedError':
          message = `
❌ BROWSER NOT SUPPORTED

PROBLEM: Your browser doesn't support system audio recording.

SOLUTION:
✅ Use Chrome or Edge browser
✅ Update browser to latest version
✅ Try "Microphone" mode as alternative

COMPATIBLE BROWSERS:
• Chrome 88+
• Edge 88+
• Opera 75+
          `.trim();
          break;

        case 'AbortError':
          message = `
❌ SCREEN SHARING CANCELLED

PROBLEM: The screen sharing dialog was cancelled.

SOLUTION:
✅ Try again and keep the dialog open
✅ Select window/tab/screen to share
✅ CHECK "Share audio" checkbox
✅ Click "Share" button

IMPORTANT: Don't forget to check "Share audio"!
          `.trim();
          break;

        default:
          message = `
❌ SYSTEM AUDIO ERROR: ${error.message}

GENERAL SOLUTIONS:
✅ Refresh the page and try again
✅ Restart your browser
✅ Check browser audio permissions
✅ Try "Microphone" mode
✅ Update browser
          `.trim();
      }

      throw new Error(message);
    }

    throw new Error('Unknown error occurred while accessing system audio');
  }
}

/**
 * Validate audio capture
 */
async function validateAudioCapture(stream: MediaStream): Promise<void> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();

  source.connect(analyser);
  analyser.fftSize = 256;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  let maxLevel = 0;
  let audioDetected = false;
  const checks = 20; // Check for 2 seconds

  console.log('🔊 Monitoring audio levels for 2 seconds...');

  for (let i = 0; i < checks; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
    maxLevel = Math.max(maxLevel, average);

    if (average > 1) {
      audioDetected = true;
      console.log(`🔊 Audio detected! Level: ${average.toFixed(2)}`);
    }
  }

  source.disconnect();
  audioContext.close();

  console.log(`🔊 Validation: Max level: ${maxLevel.toFixed(2)}, Audio detected: ${audioDetected}`);

  if (!audioDetected && maxLevel < 1) {
    console.warn(`
⚠️ WARNING: NO AUDIO DETECTED

This is normal if no audio is playing yet.

RECOMMENDATIONS:
• Start playing audio now (YouTube, Spotify, etc.)
• Make sure system volume is audible
• Recording will work once audio starts

This doesn't mean recording failed - just that no audio is currently playing!
    `.trim());
  } else {
    console.log('✅ Audio validation passed!');
  }
}