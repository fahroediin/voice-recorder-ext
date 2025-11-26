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
  constructor() {
    // Constructor is now simplified since we're doing post-recording processing
  }

  /**
   * Transcribe audio file using direct Gemini approach
   * This method processes recorded audio files directly
   */
  async transcribeAudioFile(
    audioBlob: Blob,
    language: string = 'id-ID',
    audioSource?: 'microphone' | 'system' | 'both'
  ): Promise<TranscriptionResult> {
    try {
      console.log('🎙️ Starting audio file transcription...');
      console.log('🎙️ Audio blob size:', audioBlob.size);
      console.log('🎙️ Audio blob type:', audioBlob.type);
      console.log('🎙️ Target language:', language);
      console.log('🎙️ Audio source:', audioSource || 'unknown');

      // Try multiple approaches
      const approaches = [
        () => this.transcribeWithDirectGemini(audioBlob, language, audioSource),
        () => this.transcribeWithWhisperApi(audioBlob, language),
        () => this.transcribeWithAudioContext(audioBlob, language)
      ];

      let lastError: Error | null = null;

      for (let i = 0; i < approaches.length; i++) {
        try {
          console.log(`🔄 Trying approach ${i + 1}/${approaches.length}...`);
          const result = await approaches[i]();

          if (result.fullText.trim()) {
            console.log('✅ Transcription successful with approach', i + 1);
            return result;
          } else {
            console.log(`⚠️ Approach ${i + 1} returned empty result`);
          }
        } catch (error) {
          console.error(`❌ Approach ${i + 1} failed:`, error);
          lastError = error instanceof Error ? error : new Error('Unknown error');
        }
      }

      // If all approaches failed, provide a helpful error message
      throw lastError || new Error('All transcription approaches failed');

    } catch (error) {
      console.error('Failed to transcribe audio file:', error);

      // Provide specific troubleshooting tips
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
Transcription failed. Please try the following:

1. 🎤 Check audio quality: Ensure clear speech recording
2. 🔊 Volume check: Make sure the audio has sufficient volume
3. 🎯 Language match: Ensure you selected the correct language
4. ⏱️ Duration: Record at least 10-15 seconds of speech
${sourceSpecificTips}
Technical error: ${errorMessage}
      `.trim());
    }
  }

  /**
   * Direct Gemini transcription approach
   */
  private async transcribeWithDirectGemini(
    audioBlob: Blob,
    language: string,
    audioSource?: 'microphone' | 'system' | 'both'
  ): Promise<TranscriptionResult> {
    console.log('🤖 Attempting direct Gemini transcription...');
    console.log('🤖 Audio source for transcription:', audioSource);

    const audioBase64 = await this.blobToBase64(audioBlob);
    const languageName = language === 'id-ID' ? 'Indonesian' : 'English';

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
TRANSCRIBE THIS AUDIO FILE - ${languageName.toUpperCase()} LANGUAGE

You are receiving a WebM audio file that needs to be transcribed. This is a Chrome extension recording.

TASK: Transcribe the speech content from the provided base64-encoded WebM audio.

AUDIO DETAILS:
- File Type: WebM audio recording
- File Size: ${audioBlob.size} bytes (${(audioBlob.size / 1024 / 1024).toFixed(2)} MB)
- Target Language: ${languageName}
- Audio Source: ${audioSource || 'unknown'} (${audioSource === 'system' ? 'System audio capture' : audioSource === 'both' ? 'Combined microphone + system audio' : 'Microphone recording'})
- Source: Chrome extension voice recording

${audioSource === 'system' ? `
IMPORTANT - SYSTEM AUDIO:
This recording captures system audio (music, videos, application sounds, system notifications, etc.).
The speech may be from videos, online meetings, system notifications, or any audio playing on the computer.
Listen carefully for any spoken content, dialogue, or speech in the system audio.
` : audioSource === 'both' ? `
IMPORTANT - COMBINED AUDIO:
This recording contains both microphone input and system audio simultaneously.
You may hear spoken content from the microphone overlaid with system sounds.
Focus on transcribing the human speech content.
` : ''}

CRITICAL INSTRUCTIONS:
1. The audio data is encoded in base64 and represents a WebM audio file
2. This audio contains human speech that needs to be transcribed EXACTLY as spoken
3. Transcribe ALL spoken words in ${languageName} EXACTLY as they appear in the audio
4. DO NOT modify, paraphrase, summarize, or "clean up" the transcription
5. DO NOT remove filler words (um, uh, like, you know) - transcribe them exactly
6. DO NOT change punctuation or capitalization unless you are 100% certain from the audio
7. DO NOT combine or merge similar sentences - keep the exact flow
8. DO NOT correct grammar or spelling errors unless clearly spoken correctly
9. Include ALL hesitation words, false starts, and natural speech patterns
10. If multiple people are speaking, transcribe each speaker exactly as they speak
11. ${audioSource === 'system' ? 'Transcribe ALL speech content from videos, meetings, notifications, or any spoken audio in the system exactly as heard' : 'Transcribe ALL spoken content exactly as heard in the recording'}

IMPORTANT: Your task is to be a faithful transcriber, NOT an editor or summarizer. The user wants 100% accurate transcription, not an improved version.

IMPORTANT: This is NOT text data - this is actual audio data that needs to be "listened to" and transcribed.

RESPONSE FORMAT:
If you detect speech:
---
TRANSCRIPTION:
[Write the complete transcription here in ${languageName}]
---

If you absolutely cannot detect any speech or process the audio:
---
NO_SPEECH_DETECTED
---

Begin transcribing:

data:audio/webm;base64,${audioBase64}
    `.trim();

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const transcript = response.text();

    console.log('🤖 Gemini response length:', transcript.length);
    console.log('🤖 Gemini response preview:', transcript.substring(0, 200) + '...');

    if (transcript.includes('NO_SPEECH_DETECTED')) {
      throw new Error('No speech detected in audio');
    }

    // Extract transcription using the specified format
    const transcriptionMatch = transcript.match(/TRANSCRIPTION:\s*\n([\s\S]*?)(?:\n---|$)/);
    const finalText = transcriptionMatch ? transcriptionMatch[1].trim() : transcript.trim();

    // Clean up the result - remove any remaining markers
    const cleanedText = finalText
      .replace(/^---+|---+$/gm, '') // Remove markdown dashes
      .replace(/^TRANSCRIPTION:$/im, '') // Remove label if present
      .trim();

    console.log('🤖 Extracted transcription length:', cleanedText.length);
    console.log('🤖 Extracted transcription preview:', cleanedText.substring(0, 100) + '...');

    if (!cleanedText || cleanedText.length < 5) {
      console.log('⚠️ Transcription result too short or empty');
      throw new Error('Transcription too short or empty. Audio may not contain clear speech.');
    }

    const transcriptionResult: TranscriptionResult = {
      fullText: cleanedText,
      segments: [{
        text: cleanedText,
        timestamp: 0,
        confidence: 0.85
      }],
      language
    };

    console.log('🤖 Direct Gemini transcription completed');
    return transcriptionResult;
  }

  /**
   * Placeholder for Whisper API approach
   */
  private async transcribeWithWhisperApi(
    _audioBlob: Blob,
    _language: string
  ): Promise<TranscriptionResult> {
    console.log('🎙️ Whisper API not configured, skipping...');
    throw new Error('Whisper API not available');
  }

  /**
   * Placeholder for future audio processing methods
   */
  private async transcribeWithAudioContext(
    _audioBlob: Blob,
    _language: string
  ): Promise<TranscriptionResult> {
    console.log('🎵 Audio context analysis not yet implemented...');
    throw new Error('Audio context approach not yet implemented');
  }

  
  /**
   * Convert blob to base64 (with chunking for large files)
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Get the full data URL
          const dataUrl = reader.result;
          console.log('📎 Audio data URL length:', dataUrl.length);

          // Extract base64 part (remove data URL prefix)
          const base64 = dataUrl.split(',')[1];
          if (base64) {
            console.log('📎 Base64 audio length:', base64.length);
            resolve(base64);
          } else {
            // Fallback: use full data URL if split doesn't work
            resolve(dataUrl);
          }
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = (error) => {
        console.error('❌ FileReader error:', error);
        reject(new Error('Failed to read audio file'));
      };

      console.log('📎 Converting blob to base64, size:', blob.size);
      reader.readAsDataURL(blob);
    });
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
}

// Create singleton instance
export const speechToTextService = new SpeechToTextService();

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}