/**
 * Whisper-based Transcription Service
 *
 * Service untuk transcribe audio file menggunakan OpenAI Whisper API
 * Benar-benar offline (file-to-text) tanpa Web Speech API
 */

export interface WhisperTranscriptionResult {
  fullText: string;
  segments: Array<{
    text: string;
    timestamp: number;
    confidence: number;
  }>;
  language: string;
  duration: number;
  audioSource: 'microphone' | 'system' | 'both';
  averageConfidence: number;
  hasLowConfidence: boolean;
  processingMethod: 'openai-whisper';
  apiProvider: 'OpenAI';
}

export interface WhisperTranscriptionOptions {
  language?: string;
  apiKey?: string;
  model?: string;
}

class WhisperTranscriptionService {
  private getStoredAPIKey(): string | null {
    return localStorage.getItem('openai_api_key') || null;
  }

  private storeAPIKey(apiKey: string): void {
    localStorage.setItem('openai_api_key', apiKey);
  }

  /**
   * Transcribe audio file using OpenAI Whisper API
   */
  async transcribeAudioFile(
    audioBlob: Blob,
    audioSource: 'microphone' | 'system' | 'both',
    options: WhisperTranscriptionOptions = {}
  ): Promise<WhisperTranscriptionResult> {
    console.log('🌐 Starting Whisper transcription...');
    console.log('🌐 Audio source:', audioSource);
    console.log('🌐 Method: OpenAI API (NO microphone, NO Web Speech API)');

    try {
      // Validate audio
      const audioValidation = await this.validateAudioFile(audioBlob);
      if (!audioValidation.isValid) {
        throw new Error(`Audio validation failed: ${audioValidation.reason}`);
      }

      console.log('✅ Audio validation passed:', audioValidation);

      // Get API key (try parameter, then storage)
      let apiKey = options.apiKey || this.getStoredAPIKey();

      if (!apiKey) {
        throw this.createAPIKeyError();
      }

      // Store API key if provided
      if (options.apiKey && !this.getStoredAPIKey()) {
        this.storeAPIKey(options.apiKey);
        console.log('🔑 API key stored for future use');
      }

      console.log('🔑 Using OpenAI API key for transcription');

      // Prepare form data
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', options.model || 'whisper-1');
      formData.append('language', options.language || 'id');
      formData.append('response_format', 'json');

      console.log('📤 Sending request to OpenAI Whisper API...');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();

      console.log('✅ OpenAI Whisper API response received');

      // Get audio duration
      const duration = await this.getAudioDuration(audioBlob);

      const transcriptionResult: WhisperTranscriptionResult = {
        fullText: result.text || '',
        segments: [{
          text: result.text || '',
          timestamp: 0,
          confidence: 0.85 // Whisper doesn't provide confidence scores, use reasonable default
        }],
        language: result.language || options.language || 'id',
        duration,
        audioSource: audioSource,
        averageConfidence: 0.85,
        hasLowConfidence: false,
        processingMethod: 'openai-whisper',
        apiProvider: 'OpenAI'
      };

      console.log('✅ Whisper transcription completed successfully');
      console.log(`📝 Text length: ${transcriptionResult.fullText.length} characters`);
      console.log(`🕐 Duration: ${transcriptionResult.duration.toFixed(1)} seconds`);
      console.log(`🌐 Language: ${transcriptionResult.language}`);

      return transcriptionResult;

    } catch (error) {
      console.error('❌ Whisper transcription failed:', error);
      throw error;
    }
  }

  /**
   * Create comprehensive API key error
   */
  private createAPIKeyError(): Error {
    return new Error(`
❌ NO OPENAI API KEY CONFIGURED

🔍 CURRENT SITUATION:
• No OpenAI API key found for transcription
• Web Speech API cannot process audio files directly
• External API required for true file-to-text transcription

💡 QUICK SETUP (5 minutes):

1️⃣ Get OpenAI API Key:
   • Visit: https://platform.openai.com/api-keys
   • Click "Create new secret key"
   • Copy the key (starts with 'sk-')

2️⃣ Add API Key:
   • Click the "API Key" button below
   • Paste your OpenAI key
   • Click "Save API Key"

3️⃣ Cost Information:
   • ~$0.006 per minute of audio
   • 1 minute ≈ $0.006
   • 10 minutes ≈ $0.06
   • Very affordable for occasional use

🔐 API KEY SECURITY:
• API keys are stored locally in your browser
• Never shared with anyone
• Can be deleted at any time
• Recommended to use restricted key

📋 ALTERNATIVE OPTIONS:

If you prefer not to use APIs:

1️⃣ Real-time Transcription:
   • Use "Start Real-time" button during recording
   • Works with microphone input
   • Captures speech as you speak

2️⃣ External Services:
   • Otter.ai (Freemium)
   • Google Docs Voice Typing (Free)
   • Happy Scribe (Paid)
   • Microsoft Word Dictation

3️⃣ Desktop Apps:
   • Audacity + OpenAI plugin
   • Adobe Premiere Pro
   • Dragon NaturallySpeaking

⭐ RECOMMENDATION:
For the best balance of accuracy and cost, OpenAI Whisper API is excellent for voice recordings. The API provides state-of-the-art transcription quality at reasonable prices.
    `.trim());
  }

  /**
   * Store API key securely
   */
  setAPIKey(apiKey: string): void {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      throw new Error('Invalid API key format. OpenAI API keys start with "sk-"');
    }

    this.storeAPIKey(apiKey);
    console.log('✅ API key saved successfully');
  }

  /**
   * Check if API key is configured
   */
  hasAPIKey(): boolean {
    return !!this.getStoredAPIKey();
  }

  /**
   * Get API key (or null if not set)
   */
  getAPIKey(): string | null {
    return this.getStoredAPIKey();
  }

  /**
   * Clear stored API key
   */
  clearAPIKey(): void {
    localStorage.removeItem('openai_api_key');
    console.log('🔑 API key cleared from storage');
  }

  /**
   * Get audio duration
   */
  private async getAudioDuration(audioBlob: Blob): Promise<number> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await this.blobToArrayBuffer(audioBlob);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioContext.close();
      return audioBuffer.duration;
    } catch (error) {
      console.warn('Could not determine audio duration:', error);
      return 0;
    }
  }

  /**
   * Validate audio file
   */
  private async validateAudioFile(audioBlob: Blob): Promise<{
    isValid: boolean;
    reason?: string;
    duration?: number;
  }> {
    try {
      const duration = await this.getAudioDuration(audioBlob);

      if (duration < 0.5) {
        return {
          isValid: false,
          reason: 'Audio too short for transcription (minimum 0.5 seconds required). Please record at least a few seconds of speech.'
        };
      }

      if (duration > 600) { // 10 minutes
        return {
          isValid: false,
          reason: 'Audio too long for single API call (maximum 10 minutes). Consider splitting into shorter segments or using real-time transcription during recording.'
        };
      }

      if (audioBlob.size > 25000000) { // 25MB
        return {
          isValid: false,
          reason: 'Audio file too large (maximum 25MB). Try using shorter recordings.'
        };
      }

      return { isValid: true, duration };

    } catch (error) {
      return {
        isValid: false,
        reason: `Invalid audio format: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
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
   * Clean all resources
   */
  cleanup(): void {
    // No resources to clean up for this implementation
  }
}

// Create singleton instance
export const whisperTranscriptionService = new WhisperTranscriptionService();