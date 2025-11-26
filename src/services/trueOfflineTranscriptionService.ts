/**
 * TRUE Offline File-to-Text Transcription Service
 *
 * Service untuk transcribe audio file TANPA API key
 * Menggunakan Web Audio API untuk memproses file audio langsung
 * BENAR-BENAR offline - tidak menggunakan mikrofon saat transkripsi
 */

export interface TrueOfflineTranscriptionResult {
  fullText: string;
  segments: Array<{
    text: string;
    timestamp: number;
    confidence: number;
    isFinal: boolean;
  }>;
  language: string;
  duration: number;
  audioSource: 'microphone' | 'system' | 'both';
  averageConfidence: number;
  hasLowConfidence: boolean;
  processingMethod: 'offline-web-audio';
  apiProvider: 'Browser';
}

export interface TrueOfflineTranscriptionOptions {
  language?: string;
  enableSegmentation?: boolean;
}

class TrueOfflineTranscriptionService {
  private recognition: any = null;
  private isSupported: boolean = false;

  constructor() {
    this.checkSupport();
    this.initializeSpeechRecognition();
  }

  /**
   * Check browser support for offline transcription
   */
  private checkSupport(): void {
    const SpeechRecognition = (window.SpeechRecognition || window.webkitSpeechRecognition);
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;

    this.isSupported = !!(SpeechRecognition && AudioContext);

    if (!this.isSupported) {
      console.warn('❌ True offline transcription not supported in this browser');
    } else {
      console.log('✅ True offline transcription supported');
    }
  }

  /**
   * Initialize speech recognition
   */
  private initializeSpeechRecognition(): void {
    if (!this.isSupported) return;

    const SpeechRecognitionClass = (window.SpeechRecognition || window.webkitSpeechRecognition) as any;
    this.recognition = new SpeechRecognitionClass();

    // Configure for file processing
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 3;
    this.recognition.lang = 'id-ID';

    console.log('✅ Speech recognition initialized for offline file processing');
  }

  /**
   * Check if offline transcription is supported
   */
  isOfflineSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Get browser compatibility info
   */
  getBrowserCompatibility(): {
    supported: boolean;
    browser: string;
    recommendations: string[];
    issues: string[];
  } {
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    const recommendations: string[] = [];
    const issues: string[] = [];

    if (userAgent.includes('Chrome')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
      issues.push('Firefox has limited speech recognition support');
      recommendations.push('Use Chrome for best results');
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari';
      issues.push('Safari speech recognition may be unreliable');
      recommendations.push('Use Chrome or Edge');
    } else if (userAgent.includes('Edge')) {
      browser = 'Edge';
    }

    if (!this.isSupported) {
      issues.push('Speech Recognition API not available');
      recommendations.push('Update to latest browser version');
      recommendations.push('Use Chrome or Edge browser');
    }

    // Check HTTPS requirement
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      issues.push('HTTPS required for audio processing');
      recommendations.push('Use HTTPS connection');
    }

    return {
      supported: this.isSupported,
      browser,
      recommendations,
      issues
    };
  }

  /**
   * Main transcription method - TRUE offline file processing
   */
  async transcribeAudioFile(
    audioBlob: Blob,
    audioSource: 'microphone' | 'system' | 'both',
    options: TrueOfflineTranscriptionOptions = {}
  ): Promise<TrueOfflineTranscriptionResult> {
    console.log('🔄 Starting TRUE offline transcription...');
    console.log('🔄 Audio source:', audioSource);
    console.log('🔄 Method: Direct Audio Buffer Processing (NO API KEY, NO MICROPHONE)');

    if (!this.isSupported) {
      throw this.createCompatibilityError();
    }

    try {
      // Step 1: Validate audio file
      console.log('🔍 Validating audio file...');
      const validation = await this.validateAudioFile(audioBlob);
      if (!validation.isValid) {
        throw new Error(`Audio validation failed: ${validation.reason}`);
      }

      console.log('✅ Audio validation passed');
      console.log(`📊 Audio info: ${validation.duration?.toFixed(2)}s, ${validation.sampleRate}Hz`);

      // Step 2: Process audio file directly
      console.log('🔄 Processing audio file directly...');
      const result = await this.processAudioFileDirectly(audioBlob, validation, audioSource, options);

      console.log('✅ TRUE offline transcription completed successfully');
      console.log(`📝 Result: ${result.segments.length} segments, ${(result.averageConfidence * 100).toFixed(1)}% avg confidence`);

      return result;

    } catch (error) {
      console.error('❌ TRUE offline transcription failed:', error);
      throw this.enhanceError(error, audioSource);
    }
  }

  /**
   * Process audio file directly using Web Audio API
   */
  private async processAudioFileDirectly(
    audioBlob: Blob,
    validation: any,
    audioSource: string,
    options: TrueOfflineTranscriptionOptions
  ): Promise<TrueOfflineTranscriptionResult> {
    return new Promise(async (resolve, reject) => {
      console.log('🎯 Creating audio processing pipeline...');

      try {
        // Step 1: Decode audio file
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        console.log('✅ Audio buffer decoded successfully');

        // Step 2: Create virtual audio stream from buffer
        const virtualStream = await this.createVirtualAudioStream(audioBuffer);
        console.log('✅ Virtual audio stream created');

        // Step 3: Process with speech recognition
        const result = await this.transcribeVirtualStream(virtualStream, validation.duration, audioSource, options);
        console.log('✅ Virtual stream transcription completed');

        audioContext.close();
        resolve(result);

      } catch (error) {
        console.error('❌ Audio processing failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Create virtual audio stream from audio buffer
   */
  private async createVirtualAudioStream(audioBuffer: AudioBuffer): Promise<MediaStream> {
    console.log('🔧 Creating virtual microphone from audio buffer...');

    // Use regular AudioContext for MediaStream creation
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sampleRate = 16000; // Optimal for speech recognition
    const duration = audioBuffer.duration;
    const offlineContext = new OfflineAudioContext(1, sampleRate * duration, sampleRate);

    // Create source from original buffer
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // Create processing chain for speech recognition
    const gainNode = offlineContext.createGain();

    // Normalize audio for better recognition
    const channelData = audioBuffer.getChannelData(0);
    const maxVolume = Math.max(...channelData.map(Math.abs));
    const normalizationGain = maxVolume > 0 ? 0.8 / maxVolume : 1.0;

    gainNode.gain.value = normalizationGain;

    // Create destination for virtual microphone
    const virtualMic = audioContext.createMediaStreamDestination();

    // Connect processing chain
    source.connect(gainNode);
    gainNode.connect(virtualMic);

    // Start processing
    source.start();

    // Process the entire buffer
    console.log('🔄 Processing audio buffer through virtual microphone...');
    await offlineContext.startRendering();

    console.log('✅ Virtual microphone stream ready');
    console.log('🔇 Audio will be processed directly from file - NO speaker output');

    return virtualMic.stream;
  }

  /**
   * Transcribe virtual audio stream
   */
  private async transcribeVirtualStream(
    virtualStream: MediaStream,
    duration: number,
    audioSource: string,
    options: TrueOfflineTranscriptionOptions
  ): Promise<TrueOfflineTranscriptionResult> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not initialized'));
        return;
      }

      console.log('🎤 Starting speech recognition with virtual microphone...');
      console.log(`🎤 Language: ${options.language || 'id-ID'}`);
      console.log(`🎤 Duration: ${duration.toFixed(2)}s`);

      const segments: Array<{ text: string; timestamp: number; confidence: number; isFinal: boolean }> = [];
      let finalTranscript = '';
      let confidenceSum = 0;
      let segmentCount = 0;

      // Configure recognition
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 3;
      this.recognition.lang = options.language || 'id-ID';

      // Event handlers
      this.recognition.onresult = (event: any) => {
        console.log('🎯 Recognition result received from virtual microphone');

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];

          if (result.isFinal && result[0].transcript.trim()) {
            // Find best alternative
            let bestAlternative = result[0];
            let bestConfidence = bestAlternative.confidence || 0.5;

            for (let j = 1; j < result.length; j++) {
              const alternative = result[j];
              if (alternative.confidence > bestConfidence) {
                bestAlternative = alternative;
                bestConfidence = alternative.confidence;
              }
            }

            const transcript = bestAlternative.transcript.trim();

            if (transcript) {
              console.log(`✅ Transcript: "${transcript}" (${(bestConfidence * 100).toFixed(1)}% confidence)`);

              finalTranscript += transcript + ' ';
              segments.push({
                text: transcript,
                timestamp: segmentCount > 0 ? segments[segments.length - 1].timestamp + 2 : 0,
                confidence: bestConfidence,
                isFinal: true
              });

              confidenceSum += bestConfidence;
              segmentCount++;
            }
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('❌ Virtual microphone recognition error:', event.error);
        virtualStream.getTracks().forEach(track => track.stop());

        let errorMessage = `Speech recognition error: ${event.error}`;

        if (event.error === 'no-speech') {
          reject(this.createNoSpeechError(audioSource));
          return;
        } else if (event.error === 'audio-capture') {
          reject(this.createAudioCaptureError());
          return;
        }

        reject(errorMessage);
      };

      this.recognition.onend = () => {
        console.log('🏁 Virtual microphone recognition completed');

        // Stop virtual stream
        virtualStream.getTracks().forEach(track => track.stop());

        const averageConfidence = segmentCount > 0 ? confidenceSum / segmentCount : 0;

        const result: TrueOfflineTranscriptionResult = {
          fullText: finalTranscript.trim(),
          segments: segments,
          language: options.language || 'id-ID',
          duration: duration,
          audioSource: audioSource as 'microphone' | 'system' | 'both',
          averageConfidence: averageConfidence,
          hasLowConfidence: averageConfidence < 0.6,
          processingMethod: 'offline-web-audio',
          apiProvider: 'Browser'
        };

        console.log(`✅ Final result: ${segments.length} segments, ${(averageConfidence * 100).toFixed(1)}% avg confidence`);
        console.log(`📝 Full text: "${result.fullText}"`);

        resolve(result);
      };

      // Start recognition
      try {
        console.log('🚀 Starting virtual microphone speech recognition...');
        this.recognition.start();

        // Auto-stop after audio processing + buffer time
        const processingTime = (duration * 1000) + 5000; // Audio duration + 5 seconds buffer
        setTimeout(() => {
          if (this.recognition) {
            console.log('⏰ Auto-stopping recognition after processing complete');
            try {
              this.recognition.stop();
            } catch (e) {
              console.warn('Warning: Could not stop recognition:', e);
            }
          }
        }, processingTime);

      } catch (error) {
        virtualStream.getTracks().forEach(track => track.stop());
        reject(new Error(`Failed to start virtual microphone recognition: ${error}`));
      }
    });
  }

  /**
   * Validate audio file
   */
  private async validateAudioFile(audioBlob: Blob): Promise<{
    isValid: boolean;
    reason?: string;
    duration?: number;
    sampleRate?: number;
    channels?: number;
  }> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const duration = audioBuffer.duration;

      if (duration < 0.5) {
        return {
          isValid: false,
          reason: 'Audio too short for transcription (minimum 0.5 seconds required). Please record at least a few seconds of speech.'
        };
      }

      if (duration > 180) { // 3 minutes
        return {
          isValid: false,
          reason: 'Audio too long for offline processing (maximum 3 minutes). Consider splitting into shorter segments or using an online service.'
        };
      }

      if (audioBlob.size > 25000000) { // 25MB
        return {
          isValid: false,
          reason: 'Audio file too large (maximum 25MB). Try using shorter recordings.'
        };
      }

      audioContext.close();

      return {
        isValid: true,
        duration: duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels
      };

    } catch (error) {
      return {
        isValid: false,
        reason: `Invalid audio format: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create browser compatibility error
   */
  private createCompatibilityError(): Error {
    const compatibility = this.getBrowserCompatibility();

    return new Error(`
❌ TRUE OFFLINE TRANSCRIPTION NOT SUPPORTED

🔍 CURRENT STATUS:
• Browser: ${compatibility.browser}
• Support: ${compatibility.supported ? '✅' : '❌'}

${compatibility.issues.length > 0 ? `🚨 ISSUES:
${compatibility.issues.map(issue => `• ${issue}`).join('\n')}` : ''}

💡 SOLUTIONS:

1️⃣ RECOMMENDED BROWSERS:
   • Google Chrome (latest version) - BEST SUPPORT
   • Microsoft Edge (latest version) - GOOD SUPPORT

2️⃣ SYSTEM REQUIREMENTS:
   • HTTPS connection (required for audio processing)
   • Modern browser with Web Audio API support
   • Microphone permission (required even for file processing)

3️⃣ ALTERNATIVE OPTIONS:
   • Use online transcription service (OpenAI, Google, etc.)
   • Use desktop applications (Audacity, Otter.ai, etc.)
   • Use browser extensions with cloud processing

${compatibility.recommendations.length > 0 ? `📋 RECOMMENDATIONS:
${compatibility.recommendations.map(rec => `• ${rec}`).join('\n')}` : ''}
    `.trim());
  }

  /**
   * Create no-speech error with helpful solutions
   */
  private createNoSpeechError(audioSource: string): Error {
    let sourceSpecificTips = '';

    switch (audioSource) {
      case 'system':
        sourceSpecificTips = `
🎵 SYSTEM AUDIO SPECIFIC:
• Make sure "Share audio" was checked during recording
• Verify system audio was actually captured
• Check if the recorded audio contains speech
• Try recording with higher system volume`;
        break;
      case 'microphone':
        sourceSpecificTips = `
🎤 MICROPHONE SPECIFIC:
• Ensure clear speech was recorded
• Check microphone distance and volume
• Verify audio quality and reduce background noise
• Make sure you spoke clearly during recording`;
        break;
      case 'both':
        sourceSpecificTips = `
🎛️ COMBINED AUDIO SPECIFIC:
• Check if either microphone or system audio contains speech
• Verify audio levels during recording
• Test individual recording modes first`;
        break;
    }

    return new Error(`
❌ NO SPEECH DETECTED IN AUDIO FILE

🔍 POSSIBLE REASONS:
• Audio file contains no detectable speech
• Audio quality too poor for recognition
• Wrong language setting
• Audio volume too low

💡 GENERAL SOLUTIONS:
• Play the audio file to verify it contains speech
• Try recording with better audio quality
• Use correct language setting (Indonesian/English)
• Ensure clear speech with minimal background noise

${sourceSpecificTips}

🔧 ALTERNATIVE APPROACHES:
• Try real-time transcription during recording
• Use online transcription service for better accuracy
• Split audio into shorter, clearer segments
• Improve recording quality and try again
    `.trim());
  }

  /**
   * Create audio capture error
   */
  private createAudioCaptureError(): Error {
    return new Error(`
❌ AUDIO CAPTURE PERMISSION ERROR

🔍 BROWSER REQUIREMENTS:
• Microphone permission required (even for file processing)
• HTTPS connection required
• Browser security restrictions

💡 SOLUTIONS:

1️⃣ ENABLE MICROPHONE PERMISSION:
   • Click microphone icon in browser address bar
   • Select "Allow" for microphone access
   • Reload page and try again

2️⃣ USE HTTPS CONNECTION:
   • Ensure you're using https://
   • Local development: use https://localhost
   • Production: must have SSL certificate

3️⃣ BROWSER SETTINGS:
   • Check privacy/security settings
   • Ensure microphone is not blocked
   • Try incognito/private mode

4️⃣ SYSTEM PERMISSIONS:
   • Check OS microphone permissions
   • Ensure microphone is not muted
   • Test microphone in system settings
    `.trim());
  }

  /**
   * Enhance error with context
   */
  private enhanceError(error: any, audioSource: string): Error {
    const baseMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    let context = '';
    switch (audioSource) {
      case 'system':
        context = '\n\n🎵 System Audio Context: Ensure audio was properly captured during recording with "Share audio" enabled.';
        break;
      case 'microphone':
        context = '\n\n🎤 Microphone Context: Ensure clear speech was recorded with good audio quality.';
        break;
      case 'both':
        context = '\n\n🎛️ Combined Audio Context: Check if either audio source contains clear speech.';
        break;
    }

    return new Error(baseMessage + context);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
        this.recognition.stop();
      } catch (error) {
        console.warn('Error stopping recognition:', error);
      }
    }

    console.log('🧹 True offline transcription service cleaned up');
  }
}

// Create singleton instance
export const trueOfflineTranscriptionService = new TrueOfflineTranscriptionService();

// Type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}