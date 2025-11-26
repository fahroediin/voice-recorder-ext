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
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private interimTranscript = '';
  private finalTranscript = '';
  private segments: TranscriptionSegment[] = [];
  private startTime = 0;

  constructor() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      // Use type assertion to handle the browser-specific API
      const SpeechRecognitionClass = (window.SpeechRecognition || window.webkitSpeechRecognition) as any;
      this.recognition = new SpeechRecognitionClass();
      this.setupRecognition();
    }
  }

  /**
   * Setup speech recognition
   */
  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'id-ID'; // Default to Indonesian
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.startTime = Date.now();
      console.log('🎤 Speech recognition started');
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          this.finalTranscript += transcript + ' ';
          this.segments.push({
            text: transcript,
            timestamp: Date.now() - this.startTime,
            confidence: result[0].confidence
          });
          console.log('✅ Final transcript:', transcript);
        } else {
          interimTranscript += transcript;
        }
      }

      this.interimTranscript = interimTranscript;
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('🎤 Speech recognition error:', event.error);
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
      console.log('🎤 Speech recognition ended');
    };
  }

  /**
   * Start speech recognition
   */
  async startTranscription(language: string = 'id-ID'): Promise<void> {
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
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      throw new Error('Failed to start speech recognition. Please try again.');
    }
  }

  /**
   * Stop speech recognition
   */
  stopTranscription(): TranscriptionResult {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }

    const result: TranscriptionResult = {
      fullText: this.finalTranscript.trim(),
      segments: [...this.segments],
      language: this.recognition?.lang || 'id-ID'
    };

    console.log('📝 Transcription completed:', result);
    return result;
  }

  /**
   * Get current transcription state
   */
  getCurrentTranscription(): { final: string; interim: string; isListening: boolean } {
    return {
      final: this.finalTranscript,
      interim: this.interimTranscript,
      isListening: this.isListening
    };
  }

  /**
   * Enhance transcription using Gemini AI
   */
  async enhanceTranscription(
    rawTranscript: string,
    context?: string
  ): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

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
   * Reset transcription state
   */
  private reset(): void {
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.segments = [];
    this.startTime = 0;
  }

  /**
   * Check if speech recognition is supported
   */
  isSupported(): boolean {
    return this.recognition !== null;
  }

  /**
   * Check if currently listening
   */
  isActive(): boolean {
    return this.isListening;
  }
}

// Create singleton instance
export const speechToTextService = new SpeechToTextService();

// Type definitions for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechGrammarList {
  length: number;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}