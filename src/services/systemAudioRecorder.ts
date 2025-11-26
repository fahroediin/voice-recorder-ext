/**
 * Enhanced System Audio Recorder
 *
 * Service untuk merekam system audio dengan validasi yang lebih baik
 * dan debugging yang lebih komprehensif
 */

export interface SystemAudioValidationResult {
  isValid: boolean;
  hasAudio: boolean;
  audioTrackCount: number;
  sampleRate?: number;
  errorMessage?: string;
  suggestions: string[];
}

class SystemAudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;

  /**
   * Request system audio dengan validasi yang lebih baik
   */
  async requestSystemAudio(): Promise<MediaStream> {
    console.log('🎵 Requesting system audio access...');

    try {
      // Request system audio dengan screen sharing
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Video diperlukan untuk getDisplayMedia
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      console.log('📱 Display media obtained');
      console.log('📱 Video tracks:', displayStream.getVideoTracks().length);
      console.log('📱 Audio tracks:', displayStream.getAudioTracks().length);

      // Validasi audio tracks
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        displayStream.getTracks().forEach(track => track.stop());
        throw new Error('No audio tracks found. Please check "Share audio" in the screen sharing dialog.');
      }

      // Buat audio context untuk validasi lebih lanjut
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(displayStream);
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();

      source.connect(gainNode);
      gainNode.connect(analyser);
      gainNode.gain.value = 0; // Mute untuk prevent feedback

      // Monitor audio levels
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let audioDetected = false;
      let checkCount = 0;
      const maxChecks = 10;

      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

        if (average > 1) { // Threshold untuk audio detection
          audioDetected = true;
          console.log(`🔊 Audio detected! Level: ${average.toFixed(2)}`);
        }

        checkCount++;
        if (checkCount < maxChecks && !audioDetected) {
          setTimeout(checkAudio, 100);
        }
      };

      // Mulai monitoring
      checkAudio();

      // Tunggu beberapa saat untuk deteksi audio
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Cleanup audio context
      source.disconnect();
      gainNode.disconnect();
      audioContext.close();

      if (!audioDetected) {
        console.warn('⚠️ No audio detected during validation period');
        console.warn('⚠️ This could mean:');
        console.warn('   - No audio is playing on your system');
        console.warn('   - "Share audio" was not properly checked');
        console.warn('   - Audio output device is not shared');
      }

      this.stream = displayStream;
      console.log('✅ System audio access granted');

      return displayStream;

    } catch (error) {
      console.error('❌ System audio request failed:', error);

      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            throw new Error('Screen sharing permission denied. Please allow screen sharing and check "Share audio".');
          case 'NotSupportedError':
            throw new Error('System audio recording not supported in this browser. Please use Chrome or Edge.');
          case 'AbortError':
            throw new Error('Screen sharing was cancelled. Please try again.');
          case 'NotFoundError':
            throw new Error('No audio output device found. Please check your audio settings.');
          default:
            throw new Error(`Failed to access system audio: ${error.message}`);
        }
      }

      throw new Error('Unknown error occurred while accessing system audio');
    }
  }

  /**
   * Validasi system audio stream
   */
  async validateSystemAudio(stream: MediaStream): Promise<SystemAudioValidationResult> {
    const audioTracks = stream.getAudioTracks();

    const result: SystemAudioValidationResult = {
      isValid: false,
      hasAudio: false,
      audioTrackCount: audioTracks.length,
      suggestions: []
    };

    if (audioTracks.length === 0) {
      result.errorMessage = 'No audio tracks found in the stream';
      result.suggestions = [
        'Check "Share audio" in the screen sharing dialog',
        'Make sure audio is playing on your system',
        'Try refreshing the page and trying again'
      ];
      return result;
    }

    // Get first audio track for analysis
    const audioTrack = audioTracks[0];
    const settings = audioTrack.getSettings();

    result.sampleRate = settings.sampleRate;
    console.log('🎵 Audio track settings:', settings);

    // Test audio levels
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      source.connect(analyser);
      analyser.fftSize = 256;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Monitor for 3 seconds
      let maxLevel = 0;
      const duration = 3000; // 3 seconds
      const interval = 100;
      const samples = duration / interval;

      for (let i = 0; i < samples; i++) {
        await new Promise(resolve => setTimeout(resolve, interval));
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        maxLevel = Math.max(maxLevel, average);
      }

      source.disconnect();
      audioContext.close();

      result.hasAudio = maxLevel > 1;

      if (result.hasAudio) {
        result.isValid = true;
        console.log(`✅ Audio validation passed. Max level: ${maxLevel.toFixed(2)}`);
      } else {
        result.errorMessage = 'No audio signal detected during validation';
        result.suggestions = [
          'Make sure audio is playing loudly on your system',
          'Check system volume is not muted',
          'Verify "Share audio" was selected in screen sharing',
          'Try playing audio from a different application',
          'Check if your browser has permission to access system audio'
        ];
        console.warn(`⚠️ Audio validation failed. Max level: ${maxLevel.toFixed(2)}`);
      }

    } catch (validationError) {
      console.error('Audio validation error:', validationError);
      result.errorMessage = `Audio validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`;
      result.suggestions = [
        'Try refreshing the page',
        'Check browser permissions',
        'Try a different browser (Chrome/Edge recommended)'
      ];
    }

    return result;
  }

  /**
   * Hentikan stream dan cleanup
   */
  stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Dapatkan stream yang sedang aktif
   */
  getActiveStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Cek apakah browser mendukung system audio recording
   */
  isSystemAudioSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  /**
   * Dapatkan informasi detail tentang audio tracks
   */
  getAudioTrackInfo(stream: MediaStream): any[] {
    const audioTracks = stream.getAudioTracks();

    return audioTracks.map((track, index) => {
      const settings = track.getSettings();
      const capabilities = track.getCapabilities?.() || {};

      return {
        index,
        id: track.id,
        label: track.label || 'Unknown',
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: {
          deviceId: settings.deviceId,
          groupId: settings.groupId,
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl
        },
        capabilities
      };
    });
  }
}

// Export singleton instance
export const systemAudioRecorder = new SystemAudioRecorder();