import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export interface TranscriptionSegment {
  text: string;
  timestamp: number;
  confidence?: number;
}

export interface TranscriptionResult {
  fullText: string;
  segments: TranscriptionSegment[];
  language: string;
}

class SpeechToTextService {
  private recognition: any = null;
  private isListening = false;
  private interimTranscript = '';
  private finalTranscript = '';
  private segments: TranscriptionSegment[] = [];
  private startTime = 0;

  constructor() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognitionClass = (window.SpeechRecognition || window.webkitSpeechRecognition) as any;
      this.recognition = new SpeechRecognitionClass();
      this.setupRecognition();
    }
  }

  /**
   * Setup speech recognition for real-time transcription
   */
  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true; // Allow interim results
    this.recognition.lang = 'id-ID'; // Default to Indonesian
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.startTime = Date.now();
      console.log('🎤 Real-time speech recognition started');
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          this.finalTranscript += transcript + ' ';
          this.segments.push({
            text: transcript,
            timestamp: Date.now() - this.startTime,
            confidence: result[0].confidence || 1.0
          });
          console.log('✅ Final transcript:', transcript);
        } else {
          interimTranscript += transcript;
        }
      }

      this.interimTranscript = interimTranscript;
    };

    this.recognition.onerror = (event: any) => {
      console.error('🎤 Real-time speech recognition error:', event.error);
      this.isListening = false;

      let errorMessage = 'Speech recognition error';
      switch (event.error) {
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'no-speech':
          errorMessage = 'No speech detected. Please speak clearly.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service not allowed. Please try again.';
          break;
      }

      throw new Error(errorMessage);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('🎤 Real-time speech recognition ended');
    };
  }

  /**
   * Start real-time speech recognition
   */
  startRealTimeTranscription(language: string = 'id-ID'): void {
    if (!this.recognition) {
      throw new Error('Speech recognition is not supported in this browser. Please use Chrome.');
    }

    if (this.isListening) {
      console.log('Speech recognition is already running');
      return;
    }

    try {
      this.reset();
      this.recognition.lang = language;
      this.recognition.start();
      console.log('🎤 Starting real-time speech recognition in', language);
    } catch (error) {
      console.error('Failed to start real-time speech recognition:', error);
      throw new Error('Failed to start speech recognition. Please try again.');
    }
  }

  /**
   * Stop real-time speech recognition
   */
  stopRealTimeTranscription(): TranscriptionResult {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }

    const result: TranscriptionResult = {
      fullText: this.finalTranscript.trim(),
      segments: [...this.segments],
      language: this.recognition?.lang || 'id-ID'
    };

    console.log('📝 Real-time transcription completed:', result);
    return result;
  }

  /**
   * Get current real-time transcription state
   */
  getRealTimeTranscription(): { final: string; interim: string; isListening: boolean } {
    return {
      final: this.finalTranscript,
      interim: this.interimTranscript,
      isListening: this.isListening
    };
  }

  /**
   * Reset transcription state
   */
  private reset(): void {
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.segments = [];
    this.startTime = 0;
  }

  /**
   * Check if real-time transcription is active
   */
  isRealTimeTranscribing(): boolean {
    return this.isListening;
  }

  /**
   * Transcribe audio file using Web Speech API playback method
   * This plays the recorded audio and captures it with speech recognition
   */
  async transcribeAudioFile(
    audioBlob: Blob,
    language: string = 'id-ID',
    audioSource?: 'microphone' | 'system' | 'both'
  ): Promise<TranscriptionResult> {
    try {
      console.log('🎙️ Starting audio file transcription with Web Speech API...');
      console.log('🎙️ Audio blob size:', audioBlob.size);
      console.log('🎙️ Audio blob type:', audioBlob.type);
      console.log('🎙️ Target language:', language);
      console.log('🎙️ Audio source:', audioSource || 'unknown');

      if (!this.isSupported()) {
        throw new Error('Speech recognition is not supported in this browser. Please use Chrome.');
      }

      return await this.transcribeWithSpeechPlayback(audioBlob, language);

    } catch (error) {
      console.error('Failed to transcribe audio file:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Customize troubleshooting tips based on audio source
      const sourceSpecificTips = audioSource === 'system' ? `
6. 🎵 System Audio: Ensure audio was playing during recording
7. 📺 Share Audio: Check "Share audio" was selected in screen sharing
8. 🔊 System Volume: Make sure system audio volume is audible
` : `
6. 🎙️ Microphone: Verify your microphone is working properly
`;

      throw new Error(`
Speech transcription failed. Please try the following:

1. 🎤 Audio Quality: Ensure clear, loud speech in the recording
2. 🔊 Volume: Make sure speech is clearly audible
3. 🎯 Language: Select correct language (Indonesian/English)
4. ⏱️ Duration: Record at least 10-15 seconds of clear speech
5. 🎧 Environment: Quiet room without background noise
${sourceSpecificTips}
Technical error: ${errorMessage}
      `.trim());
    }
  }

  /**
   * Transcribe using Web Speech API with AudioContext (more reliable)
   */
  private async transcribeWithSpeechPlayback(
    audioBlob: Blob,
    language: string
  ): Promise<TranscriptionResult> {
    console.log('🎵 Transcribing using AudioContext + Web Speech API method...');

    try {
      // First, decode audio to get basic info
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await this.blobToArrayBuffer(audioBlob);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      console.log('📊 Audio info:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels
      });

      if (audioBuffer.duration < 1) {
        throw new Error('Audio too short for transcription (minimum 1 second required)');
      }

      audioContext.close();

    } catch (audioError) {
      console.warn('⚠️ Audio analysis failed, trying direct transcription:', audioError);
    }

    // Now try the speech recognition with playback
    return await this.attemptSpeechRecognition(audioBlob, language);

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
   * Attempt speech recognition with multiple fallback strategies
   */
  private async attemptSpeechRecognition(
    audioBlob: Blob,
    language: string
  ): Promise<TranscriptionResult> {
    console.log('🎤 Attempting Web Speech API transcription...');

    const strategies = [
      () => this.transcribeWithAudioElement(audioBlob, language),
      () => this.transcribeWithAudioBuffer(audioBlob, language),
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`🔄 Trying strategy ${i + 1}/${strategies.length}...`);
        const result = await strategies[i]();

        if (result.fullText.trim()) {
          console.log('✅ Transcription successful with strategy', i + 1);
          return result;
        } else {
          console.log(`⚠️ Strategy ${i + 1} returned empty result`);
        }
      } catch (error) {
        console.error(`❌ Strategy ${i + 1} failed:`, error);
        if (i === strategies.length - 1) {
          // Last strategy failed, throw the error
          throw error;
        }
      }
    }

    throw new Error('All transcription strategies failed');
  }

  /**
   * Strategy 1: Use Audio Element with very low volume
   */
  private async transcribeWithAudioElement(
    audioBlob: Blob,
    language: string
  ): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      const SpeechRecognitionClass = (window.SpeechRecognition || window.webkitSpeechRecognition) as any;
      const recognition = new SpeechRecognitionClass();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      let finalTranscript = '';
      const segments: TranscriptionSegment[] = [];

      recognition.onresult = (event: any) => {
        console.log('🎯 AudioElement recognition result received');
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const transcript = result[0].transcript;
            const confidence = result[0].confidence;

            console.log('✅ Transcript:', transcript, 'Confidence:', confidence);

            finalTranscript += transcript + ' ';
            segments.push({
              text: transcript,
              timestamp: Date.now(),
              confidence: confidence
            });
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('❌ AudioElement recognition error:', event.error);
        URL.revokeObjectURL(audioUrl);
        reject(new Error(this.getRecognitionErrorMessage(event.error)));
      };

      recognition.onend = () => {
        console.log('🏁 AudioElement recognition ended');
        URL.revokeObjectURL(audioUrl);

        if (!finalTranscript.trim()) {
          reject(new Error('No speech detected. Please record clear speech and try again.'));
        } else {
          resolve({
            fullText: finalTranscript.trim(),
            segments,
            language
          });
        }
      };

      try {
        recognition.start();
        console.log('🎤 AudioElement recognition started');

        // Try to play audio at minimal volume
        audio.volume = 0.001;
        audio.muted = false;

        audio.play().then(() => {
          console.log('🔊 Audio playback started at minimal volume');
        }).catch(playError => {
          console.warn('⚠️ Audio playback failed:', playError);
          // Give time for recognition to potentially capture something
          setTimeout(() => recognition.stop(), 3000);
        });

        // Stop when audio ends
        audio.addEventListener('ended', () => {
          console.log('🔇 Audio playback ended');
          setTimeout(() => recognition.stop(), 2000);
        });

      } catch (startError) {
        console.error('❌ Failed to start recognition:', startError);
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Failed to start speech recognition: ' + (startError instanceof Error ? startError.message : String(startError))));
      }
    });
  }

  /**
   * Strategy 2: Try without playback (may work with some audio)
   */
  private async transcribeWithAudioBuffer(
    _audioBlob: Blob,
    language: string
  ): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      const SpeechRecognitionClass = (window.SpeechRecognition || window.webkitSpeechRecognition) as any;
      const recognition = new SpeechRecognitionClass();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      let finalTranscript = '';
      const segments: TranscriptionSegment[] = [];

      recognition.onresult = (event: any) => {
        console.log('🎯 AudioBuffer recognition result received');
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const transcript = result[0].transcript;
            const confidence = result[0].confidence;

            console.log('✅ Transcript:', transcript, 'Confidence:', confidence);

            finalTranscript += transcript + ' ';
            segments.push({
              text: transcript,
              timestamp: Date.now(),
              confidence: confidence
            });
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('❌ AudioBuffer recognition error:', event.error);
        reject(new Error(this.getRecognitionErrorMessage(event.error)));
      };

      recognition.onend = () => {
        console.log('🏁 AudioBuffer recognition ended');

        if (!finalTranscript.trim()) {
          reject(new Error('No speech detected. Please record clear speech and try again.'));
        } else {
          resolve({
            fullText: finalTranscript.trim(),
            segments,
            language
          });
        }
      };

      try {
        recognition.start();
        console.log('🎤 AudioBuffer recognition started (no playback)');

        // Stop after a reasonable timeout
        setTimeout(() => {
          if (recognition) {
            recognition.stop();
          }
        }, 10000); // 10 seconds timeout

      } catch (startError) {
        console.error('❌ Failed to start AudioBuffer recognition:', startError);
        reject(new Error('Failed to start speech recognition: ' + (startError instanceof Error ? startError.message : String(startError))));
      }
    });
  }

  /**
   * Get user-friendly error message from speech recognition error
   */
  private getRecognitionErrorMessage(error: string): string {
    const errorMessages: { [key: string]: string } = {
      'no-speech': 'No speech detected in the audio. Please record clear, audible speech.',
      'audio-capture': 'Microphone access denied. Please allow microphone access when prompted.',
      'not-allowed': 'Microphone permission denied. Please allow microphone access.',
      'network': 'Network error. Please check your internet connection.',
      'service-not-allowed': 'Speech recognition service not available. Please try again.',
      'aborted': 'Speech recognition was aborted. Please try again.',
      'language-not-supported': `Language not supported. Please ensure you selected Indonesian or English.`,
    };

    return errorMessages[error] || `Speech recognition error: ${error}. Please try recording again with clearer speech.`;
  }

  
  
  
  
  /**
   * Enhance transcription using Gemini AI
   */
  async enhanceTranscription(
    rawTranscript: string,
    context?: string
  ): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-fash' });

      const prompt = `
Please clean up and format this speech-to-text transcript. The transcript may contain:
- Speech recognition errors
- Filler words (um, uh, like, you know)
- Repetitions
- Incomplete sentences

Context: ${context || 'Meeting or conversation recording'}

Raw transcript:
"${rawTranscript}"

Please provide a clean, readable version that:
1. Fixes obvious speech recognition errors
2. Removes filler words and repetitions
3. Properly formats sentences
4. Maintains the original meaning and important details
5. Uses proper punctuation and capitalization

Return only the cleaned transcript without any additional commentary.
      `.trim();

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const enhancedText = response.text();

      console.log('✨ Transcription enhanced with Gemini AI');
      return enhancedText.trim();
    } catch (error) {
      console.error('Failed to enhance transcription with Gemini:', error);
      // Fallback to original transcript if enhancement fails
      return rawTranscript;
    }
  }

  /**
   * Generate meeting summary using Gemini AI
   */
  async generateMeetingSummary(
    transcript: string,
    meetingTitle?: string,
    description?: string
  ): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `
Please create a concise summary of this meeting transcript.

Meeting Details:
- Title: ${meetingTitle || 'Untitled Meeting'}
- Description: ${description || 'No description provided'}
- Transcript: "${transcript}"

Please provide:
1. A brief executive summary (2-3 sentences)
2. Key discussion points (bullet points)
3. Action items or decisions made (if any)
4. Important takeaways

Format the summary clearly with headings and make it professional and easy to read.
      `.trim();

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      console.log('📋 Meeting summary generated with Gemini AI');
      return summary.trim();
    } catch (error) {
      console.error('Failed to generate meeting summary:', error);
      return 'Failed to generate AI summary. Please review the transcript manually.';
    }
  }

  /**
   * Check if speech recognition is supported
   */
  isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Check if currently listening (real-time)
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Update real-time transcription language
   */
  updateLanguage(language: string): void {
    if (this.recognition && !this.isListening) {
      this.recognition.lang = language;
    }
  }
}

// Create singleton instance
export const speechToTextService = new SpeechToTextService();

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}