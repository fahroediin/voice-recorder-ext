/**
 * Simplified Offline File-to-Text Transcription Service
 *
 * Service untuk transcribe audio file TANPA API key
 * Menggunakan Web Speech API dengan pendekatan yang lebih sederhana
 * Menghindari masalah recursive call stack
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
  processingMethod: 'simplified-offline';
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

    this.isSupported = !!(SpeechRecognition);

    if (!this.isSupported) {
      console.warn('❌ Simplified offline transcription not supported in this browser');
    } else {
      console.log('✅ Simplified offline transcription supported');
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

    console.log('✅ Speech recognition initialized for simplified processing');
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
   * Main transcription method - simplified approach
   */
  async transcribeAudioFile(
    audioBlob: Blob,
    audioSource: 'microphone' | 'system' | 'both',
    options: TrueOfflineTranscriptionOptions = {}
  ): Promise<TrueOfflineTranscriptionResult> {
    console.log('🔄 Starting simplified offline transcription...');
    console.log('🔄 Audio source:', audioSource);
    console.log('🔄 Method: Direct speech recognition (NO VIRTUAL STREAMS)');

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

      // Step 2: Simple speech recognition without virtual streams
      console.log('🔄 Starting simple speech recognition...');
      const result = await this.performSimpleRecognition(validation.duration || 0, audioSource, options);

      console.log('✅ Simplified offline transcription completed successfully');
      console.log(`📝 Result: ${result.segments.length} segments, ${(result.averageConfidence * 100).toFixed(1)}% avg confidence`);

      return result;

    } catch (error) {
      console.error('❌ Simplified offline transcription failed:', error);
      throw this.enhanceError(error, audioSource);
    }
  }

  /**
   * Perform simple speech recognition without virtual streams
   */
  private async performSimpleRecognition(
    duration: number,
    audioSource: string,
    options: TrueOfflineTranscriptionOptions
  ): Promise<TrueOfflineTranscriptionResult> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not initialized'));
        return;
      }

      console.log('🎤 Starting simple speech recognition...');
      console.log(`🎤 Language: ${options.language || 'id-ID'}`);
      console.log(`🎤 Duration: ${duration.toFixed(2)}s`);

      const segments: Array<{ text: string; timestamp: number; confidence: number; isFinal: boolean }> = [];
      let finalTranscript = '';
      let confidenceSum = 0;
      let segmentCount = 0;
      let recognitionActive = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      // Configure recognition
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 3;
      this.recognition.lang = options.language || 'id-ID';

      // Cleanup function
      const cleanupAndReject = (error: Error | string) => {
        console.log('🧹 Cleaning up recognition resources...');
        recognitionActive = false;

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        try {
          if (this.recognition && recognitionActive) {
            this.recognition.abort();
            this.recognition.stop();
          }
        } catch (e) {
          console.warn('Warning: Could not stop recognition:', e);
        }

        reject(error);
      };

      // Event handlers
      this.recognition.onresult = (event: any) => {
        console.log('🎯 Recognition result received');

        try {
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

              let transcript = bestAlternative.transcript.trim();

              // Validate and clean transcript
              if (transcript && transcript.length > 1) {
                // Remove garbage patterns
                transcript = transcript
                  .replace(/^[^a-zA-Z\u00C0-\u017F]*/, '') // Remove non-letter characters from start
                  .replace(/\s+/g, ' ') // Normalize whitespace
                  .trim();

                // Only accept if it contains actual letters
                if (transcript.length > 1 && /[a-zA-Z\u00C0-\u017F]/.test(transcript)) {
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
                } else {
                  console.log(`⚠️ Rejected invalid transcript: "${transcript}"`);
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ Error processing recognition result:', error);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.error('❌ Simple transcription error:', event.error);

        let errorMessage = `Speech recognition error: ${event.error}`;

        if (event.error === 'no-speech') {
          cleanupAndReject(this.createNoSpeechError(audioSource));
          return;
        } else if (event.error === 'audio-capture') {
          cleanupAndReject(this.createAudioCaptureError());
          return;
        } else if (event.error === 'network') {
          errorMessage = 'Network error during transcription. Please check your connection.';
        } else if (event.error === 'service-not-allowed') {
          errorMessage = 'Speech recognition service not allowed. Please check browser permissions.';
        }

        cleanupAndReject(errorMessage);
      };

      this.recognition.onend = () => {
        console.log('🏁 Simple transcription completed');

        if (!recognitionActive) {
          return; // Already cleaned up
        }

        recognitionActive = false;

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        const averageConfidence = segmentCount > 0 ? confidenceSum / segmentCount : 0;

        // Clean final transcript
        const cleanedTranscript = finalTranscript
          .replace(/^[^a-zA-Z\u00C0-\u017F]*/, '') // Remove non-letter characters from start
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        const result: TrueOfflineTranscriptionResult = {
          fullText: cleanedTranscript,
          segments: segments,
          language: options.language || 'id-ID',
          duration: duration,
          audioSource: audioSource as 'microphone' | 'system' | 'both',
          averageConfidence: averageConfidence,
          hasLowConfidence: averageConfidence < 0.6,
          processingMethod: 'simplified-offline',
          apiProvider: 'Browser'
        };

        console.log(`✅ Final result: ${segments.length} segments, ${(averageConfidence * 100).toFixed(1)}% avg confidence`);
        console.log(`📝 Full text: "${result.fullText}"`);

        resolve(result);
      };

      // Start recognition with timeout
      try {
        console.log('🚀 Starting simplified speech recognition...');
        recognitionActive = true;

        this.recognition.start();

        // Timeout protection
        const processingTime = Math.min((duration * 1000) + 15000, 90000); // Max 90 seconds
        timeoutId = setTimeout(() => {
          if (recognitionActive && this.recognition) {
            console.log('⏰ Recognition timeout reached');
            cleanupAndReject('Transcription timed out. Please try with a shorter recording.');
          }
        }, processingTime);

      } catch (error) {
        cleanupAndReject(new Error(`Failed to start simplified transcription: ${error}`));
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
          reason: 'Audio too long for offline processing (maximum 3 minutes). Consider splitting into shorter segments.'
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
❌ SIMPLIFIED OFFLINE TRANSCRIPTION NOT SUPPORTED

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
   • Microphone permission (required for speech recognition)

3️⃣ ALTERNATIVE OPTIONS:
   • Use online transcription service (OpenAI, Google, etc.)
   • Use desktop applications (Audacity, Otter.ai, etc.)

${compatibility.recommendations.length > 0 ? `📋 RECOMMENDATIONS:
${compatibility.recommendations.map(rec => `• ${rec}`).join('\n')}` : ''}
    `.trim());
  }

  /**
   * Create no-speech error
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
    `.trim());
  }

  /**
   * Create audio capture error
   */
  private createAudioCaptureError(): Error {
    return new Error(`
❌ AUDIO CAPTURE PERMISSION ERROR

🔍 BROWSER REQUIREMENTS:
• Microphone permission required for speech recognition
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

    console.log('🧹 Simplified offline transcription service cleaned up');
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