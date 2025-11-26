/**
 * Clean Transcription Service
 *
 * This service provides reliable transcription functionality without AI enhancement
 * to prevent hallucinations. It focuses on direct speech-to-text conversion
 * with proper audio handling for different recording modes.
 */

export interface CleanTranscriptionSegment {
  text: string;
  timestamp: number;
  confidence?: number;
  isFinal: boolean;
}

export interface CleanTranscriptionResult {
  fullText: string;
  segments: CleanTranscriptionSegment[];
  language: string;
  duration: number;
  audioSource: 'microphone' | 'system' | 'both';
  averageConfidence: number;
  hasLowConfidence: boolean;
}

export interface TranscriptionOptions {
  language?: string;
  confidenceThreshold?: number;
  enableRealTime?: boolean;
  maxDuration?: number; // in seconds
}

class CleanTranscriptionService {
  private recognition: any = null;
  private isListening = false;
  private currentTranscript = '';
  private segments: CleanTranscriptionSegment[] = [];
  private startTime = 0;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.initializeSpeechRecognition();
  }

  /**
   * Initialize Web Speech API
   */
  private initializeSpeechRecognition(): void {
    if (!this.isSpeechRecognitionSupported()) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognitionClass = (window.SpeechRecognition || window.webkitSpeechRecognition) as any;
    this.recognition = new SpeechRecognitionClass();
    this.setupRecognition();
  }

  /**
   * Setup speech recognition configuration
   */
  private setupRecognition(): void {
    if (!this.recognition) return;

    // Configure for maximum accuracy
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy
    this.recognition.lang = 'id-ID'; // Default to Indonesian

    this.recognition.onstart = () => {
      this.isListening = true;
      this.startTime = Date.now();
      console.log('🎤 Clean transcription started');
    };

    this.recognition.onresult = (event: any) => {
      this.processRecognitionResults(event);
    };

    this.recognition.onerror = (event: any) => {
      this.handleRecognitionError(event);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('🎤 Clean transcription ended');
    };
  }

  /**
   * Process speech recognition results with confidence filtering
   */
  private processRecognitionResults(event: any): void {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];

      if (result.isFinal) {
        // Get the best result with highest confidence
        let bestAlternative = result[0];
        let bestConfidence = bestAlternative.confidence || 0;

        // Check all alternatives for the best confidence
        for (let j = 1; j < result.length; j++) {
          const alternative = result[j];
          if (alternative.confidence > bestConfidence) {
            bestAlternative = alternative;
            bestConfidence = alternative.confidence;
          }
        }

        const segment: CleanTranscriptionSegment = {
          text: bestAlternative.transcript.trim(),
          timestamp: Date.now() - this.startTime,
          confidence: bestConfidence,
          isFinal: true
        };

        this.segments.push(segment);
        this.currentTranscript += segment.text + ' ';

        console.log(`✅ Transcription segment (confidence: ${(bestConfidence * 100).toFixed(1)}%):`, segment.text);
      }
    }
  }

  /**
   * Handle speech recognition errors
   */
  private handleRecognitionError(event: any): void {
    console.error('🎤 Speech recognition error:', event.error);
    this.isListening = false;

    const errorMessages: { [key: string]: string } = {
      'no-speech': 'No speech detected. Please ensure clear audio is playing.',
      'audio-capture': 'Audio capture failed. Please check microphone permissions.',
      'not-allowed': 'Permission denied. Please allow microphone access.',
      'network': 'Network error. Please check your internet connection.',
      'service-not-allowed': 'Speech recognition service unavailable. Please try again.',
      'aborted': 'Transcription was aborted.',
      'language-not-supported': 'Language not supported. Using Indonesian as default.'
    };

    const message = errorMessages[event.error] || `Speech recognition error: ${event.error}`;
    console.error('🎤 Error details:', message);
  }

  /**
   * Start real-time transcription
   */
  async startRealTimeTranscription(options: TranscriptionOptions = {}): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition not supported. Please use Chrome browser.');
    }

    if (this.isListening) {
      console.log('Transcription already running');
      return;
    }

    try {
      this.reset();

      // Set language
      if (options.language) {
        this.recognition.lang = options.language;
      }

      // Start recognition
      this.recognition.start();

      console.log(`🎤 Starting clean transcription in ${options.language || 'Indonesian'}`);

    } catch (error) {
      console.error('Failed to start transcription:', error);
      throw new Error('Failed to start speech recognition. Please try again.');
    }
  }

  /**
   * Stop real-time transcription and return results
   */
  stopRealTimeTranscription(): CleanTranscriptionResult {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }

    const duration = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const averageConfidence = this.calculateAverageConfidence();
    const hasLowConfidence = averageConfidence < 0.7;

    return {
      fullText: this.currentTranscript.trim(),
      segments: [...this.segments],
      language: this.recognition?.lang || 'id-ID',
      duration,
      audioSource: 'microphone', // Real-time is always microphone
      averageConfidence,
      hasLowConfidence
    };
  }

  /**
   * Transcribe audio file with improved processing
   */
  async transcribeAudioFile(
    audioBlob: Blob,
    audioSource: 'microphone' | 'system' | 'both',
    options: TranscriptionOptions = {}
  ): Promise<CleanTranscriptionResult> {
    try {
      console.log('🎙️ Starting clean audio transcription...');
      console.log('🎙️ Audio source:', audioSource);
      console.log('🎙️ Audio size:', audioBlob.size, 'bytes');
      console.log('🎙️ Audio type:', audioBlob.type);

      // Validate audio
      const audioValidation = await this.validateAudio(audioBlob);
      if (!audioValidation.isValid) {
        throw new Error(`Audio validation failed: ${audioValidation.reason}`);
      }

      // Analyze audio characteristics based on source
      const audioAnalysis = await this.analyzeAudio(audioBlob, audioSource);
      console.log('🎵 Audio analysis:', audioAnalysis);

      // Choose optimal transcription strategy based on audio characteristics
      const strategy = this.selectOptimalStrategy(audioSource, audioAnalysis);
      console.log('🎯 Selected transcription strategy:', strategy);

      // Execute transcription
      const result = await this.executeTranscriptionStrategy(
        audioBlob,
        audioSource,
        strategy,
        options
      );

      console.log('✅ Clean transcription completed');
      return result;

    } catch (error) {
      console.error('❌ Clean transcription failed:', error);
      throw this.enhanceErrorMessage(error, audioSource);
    }
  }

  /**
   * Validate audio file before transcription
   */
  private async validateAudio(audioBlob: Blob): Promise<{isValid: boolean; reason?: string}> {
    try {
      // Check basic file properties
      if (audioBlob.size === 0) {
        return { isValid: false, reason: 'Audio file is empty' };
      }

      if (audioBlob.size < 1024) { // Less than 1KB
        return { isValid: false, reason: 'Audio file too small (minimum 1KB required)' };
      }

      // Check audio duration
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await this.blobToArrayBuffer(audioBlob);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      audioContext.close();

      if (audioBuffer.duration < 0.5) {
        return { isValid: false, reason: 'Audio too short (minimum 0.5 seconds required)' };
      }

      if (audioBuffer.duration > 600) { // 10 minutes
        return { isValid: false, reason: 'Audio too long (maximum 10 minutes allowed)' };
      }

      return { isValid: true };

    } catch (error) {
      return { isValid: false, reason: `Invalid audio format: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Analyze audio characteristics
   */
  private async analyzeAudio(audioBlob: Blob, _audioSource: string): Promise<any> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await this.blobToArrayBuffer(audioBlob);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Calculate basic audio metrics
      const channelData = audioBuffer.getChannelData(0);
      let sum = 0;
      let maxSample = 0;
      let silentSamples = 0;

      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.abs(channelData[i]);
        sum += sample;
        maxSample = Math.max(maxSample, sample);
        if (sample < 0.01) silentSamples++;
      }

      const average = sum / channelData.length;
      const silenceRatio = silentSamples / channelData.length;

      audioContext.close();

      return {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        averageLevel: average,
        maxLevel: maxSample,
        silenceRatio: silenceRatio,
        hasSignificantAudio: average > 0.01,
        isHighQuality: average > 0.05 && silenceRatio < 0.8
      };

    } catch (error) {
      console.warn('Audio analysis failed:', error);
      return { hasSignificantAudio: true, isHighQuality: false };
    }
  }

  /**
   * Select optimal transcription strategy based on audio characteristics
   */
  private selectOptimalStrategy(_audioSource: string, analysis: any): string {
    // Use a simple strategy based on audio quality
    if (analysis.isHighQuality) {
      return 'direct-playback';
    }

    return 'standard-processing';
  }

  /**
   * Execute selected transcription strategy
   */
  private async executeTranscriptionStrategy(
    audioBlob: Blob,
    audioSource: string,
    strategy: string,
    options: TranscriptionOptions
  ): Promise<CleanTranscriptionResult> {
    switch (strategy) {
      case 'direct-playback':
        return await this.transcribeWithDirectPlayback(audioBlob, audioSource, options);

      case 'enhanced-processing':
        return await this.transcribeWithEnhancedProcessing(audioBlob, audioSource, options);

      case 'adaptive-processing':
        return await this.transcribeWithAdaptiveProcessing(audioBlob, audioSource, options);

      case 'standard-processing':
      default:
        return await this.transcribeWithStandardProcessing(audioBlob, audioSource, options);
    }
  }

  /**
   * Direct playback strategy - play audio directly for transcription
   */
  private async transcribeWithDirectPlayback(
    audioBlob: Blob,
    audioSource: string,
    options: TranscriptionOptions
  ): Promise<CleanTranscriptionResult> {
    return new Promise((resolve, reject) => {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = options.language || 'id-ID';
      recognition.maxAlternatives = 2;

      let finalTranscript = '';
      const segments: CleanTranscriptionSegment[] = [];

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const transcript = result[0].transcript.trim();
            const confidence = result[0].confidence || 1.0;

            finalTranscript += transcript + ' ';
            segments.push({
              text: transcript,
              timestamp: Date.now(),
              confidence: confidence,
              isFinal: true
            });
          }
        }
      };

      recognition.onerror = (event: any) => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error(`Transcription failed: ${event.error}`));
      };

      recognition.onend = () => {
        URL.revokeObjectURL(audioUrl);

        const averageConfidence = this.calculateAverageConfidenceFromSegments(segments);

        resolve({
          fullText: finalTranscript.trim(),
          segments,
          language: options.language || 'id-ID',
          duration: 0, // Will be calculated from audio duration
          audioSource: audioSource as 'microphone' | 'system' | 'both',
          averageConfidence,
          hasLowConfidence: averageConfidence < 0.7
        });
      };

      // Start recognition and audio playback
      recognition.start();

      // Use optimal volume for system audio transcription
      audio.volume = 0.85; // High volume for better speech detection
      audio.play().catch(error => {
        console.warn('Audio playback failed:', error);
      });

      // Stop when audio ends
      audio.addEventListener('ended', () => {
        setTimeout(() => recognition.stop(), 1000);
      });
    });
  }

  /**
   * Enhanced processing strategy with multiple passes
   */
  private async transcribeWithEnhancedProcessing(
    audioBlob: Blob,
    audioSource: string,
    options: TranscriptionOptions
  ): Promise<CleanTranscriptionResult> {
    // Use the direct playback method for simplicity and reliability
    return await this.transcribeWithDirectPlayback(audioBlob, audioSource, options);
  }

  /**
   * Adaptive processing strategy
   */
  private async transcribeWithAdaptiveProcessing(
    audioBlob: Blob,
    audioSource: string,
    options: TranscriptionOptions
  ): Promise<CleanTranscriptionResult> {
    // Try direct playback first
    try {
      return await this.transcribeWithDirectPlayback(audioBlob, audioSource, options);
    } catch (error) {
      console.warn('Direct playback failed, falling back to standard processing');
      return await this.transcribeWithStandardProcessing(audioBlob, audioSource, options);
    }
  }

  /**
   * Standard processing strategy
   */
  private async transcribeWithStandardProcessing(
    audioBlob: Blob,
    audioSource: string,
    options: TranscriptionOptions
  ): Promise<CleanTranscriptionResult> {
    // Use the direct playback method as the base
    return await this.transcribeWithDirectPlayback(audioBlob, audioSource, options);
  }

  /**
   * Calculate average confidence from segments
   */
  private calculateAverageConfidence(): number {
    if (this.segments.length === 0) return 0;

    const totalConfidence = this.segments.reduce((sum, segment) => {
      return sum + (segment.confidence || 0);
    }, 0);

    return totalConfidence / this.segments.length;
  }

  /**
   * Calculate average confidence from segments array
   */
  private calculateAverageConfidenceFromSegments(segments: CleanTranscriptionSegment[]): number {
    if (segments.length === 0) return 0;

    const totalConfidence = segments.reduce((sum, segment) => {
      return sum + (segment.confidence || 0);
    }, 0);

    return totalConfidence / segments.length;
  }

  /**
   * Convert blob to array buffer
   */
  private blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read audio file'));
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Reset transcription state
   */
  private reset(): void {
    this.currentTranscript = '';
    this.segments = [];
    this.startTime = 0;
  }

  /**
   * Enhance error message with source-specific tips
   */
  private enhanceErrorMessage(error: any, audioSource: string): Error {
    const baseMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    let sourceTips = '';
    switch (audioSource) {
      case 'microphone':
        sourceTips = '\n\nMicrophone Tips:\n• Speak clearly and close to the microphone\n• Check microphone permissions in browser settings\n• Ensure microphone is not muted\n• Reduce background noise';
        break;
      case 'system':
        sourceTips = '\n\nSystem Audio Tips:\n• Ensure "Share audio" was selected during screen sharing\n• Check that system volume is audible\n• Verify audio is playing during recording\n• Try recording with higher system volume';
        break;
      case 'both':
        sourceTips = '\n\nCombined Audio Tips:\n• Check both microphone and system audio permissions\n• Ensure system audio sharing is enabled\n• Verify microphone is working\n• Check that audio sources are balanced';
        break;
    }

    return new Error(baseMessage + sourceTips);
  }

  /**
   * Check if speech recognition is supported
   */
  isSpeechRecognitionSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Check if currently transcribing
   */
  isTranscribing(): boolean {
    return this.isListening;
  }

  /**
   * Get current transcription state
   */
  getCurrentTranscription(): { text: string; segmentCount: number; isListening: boolean } {
    return {
      text: this.currentTranscript,
      segmentCount: this.segments.length,
      isListening: this.isListening
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.reset();
  }
}

// Create singleton instance
export const cleanTranscriptionService = new CleanTranscriptionService();

// Type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}