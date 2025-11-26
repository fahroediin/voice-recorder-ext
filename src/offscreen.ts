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
          console.log('🎤 Actual device settings:', settings);
          console.log('🎤 Device ID used:', settings.deviceId);
          console.log('🎤 Device label:', track.label || 'Unknown');
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
      // Get system audio ONLY - no microphone fallback allowed
      let systemStream: MediaStream;
      try {
        // First try with detailed audio constraints
        systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 44100
          }
        });

        // Get only audio tracks, ignore video tracks
        tracks = systemStream.getAudioTracks();
        console.log(`System audio tracks: ${tracks.length}`);

        if (tracks.length === 0) {
          console.warn('No audio tracks found with detailed constraints, trying simpler method...');
          systemStream.getTracks().forEach(track => track.stop());

          // Try alternative method with simple audio constraint
          try {
            console.log('Trying alternative method for system audio...');
            systemStream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: true  // Simple audio constraint
            });

            tracks = systemStream.getAudioTracks();
            console.log(`Alternative method - System audio tracks: ${tracks.length}`);

            if (tracks.length === 0) {
              systemStream.getTracks().forEach(track => track.stop());
              throw new Error('No system audio found. This happens when:\n• "Share audio" was not checked in the screen sharing dialog\n• No audio is currently playing on your system\n• Your system doesn\'t allow audio sharing\n\nPlease try again with "Share audio" checked while audio is playing.');
            } else {
              console.log('✅ System audio access granted via alternative method');
            }
          } catch (alternativeError) {
            console.error('Alternative method failed:', alternativeError);
            throw new Error('Failed to capture system audio. Please ensure:\n• You check "Share audio" in the screen sharing dialog\n• Audio is playing on your system\n• Your system allows audio sharing\n\nIf this continues to fail, consider using "Microphone" mode instead.');
          }
        } else {
          console.log('✅ System audio access granted');
        }

        // IMPORTANT: Disable ALL microphone-like processing for system audio
        tracks.forEach(track => {
          const constraints = track.getConstraints();
          console.log('Original track constraints:', constraints);

          // Try to disable echo cancellation, noise suppression, etc for system audio
          track.applyConstraints({
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }).catch(e => console.warn('Could not apply constraints to system audio track:', e));
        });

      } catch (systemError) {
        console.error('System audio access failed:', systemError);

        if (systemError instanceof Error) {
          if (systemError.name === 'NotAllowedError') {
            throw new Error('Screen sharing was cancelled. Please allow screen sharing and check "Share audio".');
          } else if (systemError.name === 'NotSupportedError') {
            throw new Error('System audio recording is not supported in this browser or environment.');
          } else if (systemError.name === 'AbortError') {
            throw new Error('Screen sharing was cancelled. Please try again.');
          } else {
            throw new Error(`Failed to access system audio: ${systemError.message}`);
          }
        } else {
          throw new Error('Failed to access system audio. Please try again.');
        }
      }

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