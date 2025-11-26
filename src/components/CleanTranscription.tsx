import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { type CleanTranscriptionResult } from '../services/cleanTranscriptionService';
import { whisperTranscriptionService, type WhisperTranscriptionOptions } from '../services/whisperTranscriptionService';
import {
  Mic,
  Monitor,
  Layers,
  Play,
  Square,
  Download,
  Copy,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Volume2
} from 'lucide-react';

interface CleanTranscriptionProps {
  audioBlob?: Blob;
  audioSource: 'microphone' | 'system' | 'both';
}

export const CleanTranscription: React.FC<CleanTranscriptionProps> = ({
  audioBlob,
  audioSource
}) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<CleanTranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'id-ID' | 'en-US'>('id-ID');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Audio playback state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // API Key state
  const [showAPIKeyInput, setShowAPIKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioBlob]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (isRealTimeTranscribing) {
        cleanTranscriptionService.cleanup();
      }
    };
  }, []);

  const transcribeAudio = async () => {
    if (!audioBlob) {
      setError('No audio available for transcription');
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setTranscriptionResult(null);

    try {
      console.log(`🌐 Starting Whisper transcription for ${audioSource} audio...`);
      console.log('🌐 Method: OpenAI Whisper API (NO Web Speech API, NO microphone input)');
      console.log('🌐 Processing audio file directly...');

      // Check if API key is available
      if (!whisperTranscriptionService.hasAPIKey()) {
        throw new Error(`
❌ NO OPENAI API KEY CONFIGURED

🌐 SOLUTION: Configure OpenAI Whisper API

1️⃣ QUICK SETUP (5 minutes):
• Get OpenAI API key: https://platform.openai.com/api-keys
• Add to browser storage or environment
• Cost: ~$0.006 per minute of audio

🔐 API Key Security:
• API keys are stored locally in your browser
• Never shared with anyone
• Can be deleted at any time
        `);
      }

      const whisperOptions: WhisperTranscriptionOptions = {
        language: language === 'id-ID' ? 'id' : 'en'
      };

      const whisperResult = await whisperTranscriptionService.transcribeAudioFile(
        audioBlob,
        audioSource,
        whisperOptions
      );

      // Convert to standard format for UI compatibility
      const result: CleanTranscriptionResult = {
        fullText: whisperResult.fullText,
        segments: whisperResult.segments.map((seg: any) => ({
          ...seg,
          isFinal: true
        })),
        language: whisperResult.language === 'id' ? 'id-ID' : 'en-US',
        duration: whisperResult.duration,
        audioSource: whisperResult.audioSource,
        averageConfidence: whisperResult.averageConfidence,
        hasLowConfidence: whisperResult.hasLowConfidence
      };

      setTranscriptionResult(result);
      console.log('✅ Whisper transcription completed:', whisperResult);
      console.log('🌐 Processing method:', whisperResult.processingMethod);
      console.log('🏭 API Provider:', whisperResult.apiProvider);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('❌ Whisper transcription failed:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      const textToCopy = transcriptionResult?.fullText;
      if (!textToCopy) {
        setError('No text to copy');
        return;
      }

      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const downloadAsText = () => {
    const textToDownload = transcriptionResult?.fullText;
    if (!textToDownload) {
      setError('No text to download');
      return;
    }

    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getAudioSourceIcon = () => {
    switch (audioSource) {
      case 'system':
        return <Monitor className="w-4 h-4" />;
      case 'both':
        return <Layers className="w-4 h-4" />;
      default:
        return <Mic className="w-4 h-4" />;
    }
  };

  const getAudioSourceLabel = () => {
    switch (audioSource) {
      case 'system':
        return 'System Audio';
      case 'both':
        return 'Combined Audio';
      default:
        return 'Microphone';
    }
  };

  const handleSetAPIKey = () => {
    if (!apiKeyInput.trim()) {
      setError('Please enter a valid API key');
      return;
    }

    try {
      whisperTranscriptionService.setAPIKey(apiKeyInput.trim());
      setShowAPIKeyInput(false);
      setApiKeyInput('');
      setError(null);
      console.log('✅ OpenAI API key configured successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set API key';
      setError(errorMessage);
    }
  };

  const handleClearAPIKey = () => {
    whisperTranscriptionService.clearAPIKey();
    setError(null);
    console.log('🔑 OpenAI API key cleared');
  };

  const hasAPIKey = whisperTranscriptionService.hasAPIKey();

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-4">
      <div className="bg-white border rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          {getAudioSourceIcon()}
          <h2 className="text-xl font-semibold">Clean Transcription - {getAudioSourceLabel()}</h2>
        </div>

        <div className="space-y-4">
          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'id-ID' | 'en-US')}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="id-ID">Indonesian</option>
                <option value="en-US">English</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">OpenAI API Status</label>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  hasAPIKey
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {hasAPIKey ? 'API Key Configured' : 'No API Key'}
                </span>
                {!showAPIKeyInput && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAPIKeyInput(true)}
                  >
                    {hasAPIKey ? 'Change API Key' : 'Set API Key'}
                  </Button>
                )}
                {hasAPIKey && !showAPIKeyInput && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAPIKey}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* API Key Input */}
          {showAPIKeyInput && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <h4 className="font-medium">Configure OpenAI API Key</h4>
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key (starts with 'sk-')</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSetAPIKey}
                  disabled={!apiKeyInput.trim() || !apiKeyInput.trim().startsWith('sk-')}
                  size="sm"
                >
                  Save API Key
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAPIKeyInput(false);
                    setApiKeyInput('');
                  }}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
              <div className="text-xs text-gray-600">
                <p>• Get your API key from: https://platform.openai.com/api-keys</p>
                <p>• Cost: ~$0.006 per minute of audio</p>
                <p>• Key stored locally in your browser</p>
              </div>
            </div>
          )}

          {/* Audio Controls */}
          {audioUrl && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const audio = new Audio(audioUrl);
                  if (isPlaying) {
                    audio.pause();
                    setIsPlaying(false);
                  } else {
                    audio.play();
                    setIsPlaying(true);
                    audio.addEventListener('ended', () => setIsPlaying(false));
                  }
                }}
                disabled={!audioUrl}
              >
                {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pause' : 'Play'} Audio
              </Button>
              <Volume2 className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {audioSource === 'system' ? 'System audio' : audioSource === 'both' ? 'Combined audio' : 'Microphone audio'} available
              </span>
            </div>
          )}

          {/* Transcription Controls */}
          <div className="flex flex-wrap gap-2">
            {audioBlob && (
              <Button
                onClick={transcribeAudio}
                disabled={isTranscribing}
                className="flex items-center gap-2"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Transcribe Audio File (Whisper API)
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
              </div>
            </div>
          )}

          
          {/* Transcription Results */}
          {transcriptionResult && (
            <div className="bg-white border rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Transcription Results</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    transcriptionResult.hasLowConfidence
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    Confidence: {(transcriptionResult.averageConfidence * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {transcriptionResult.duration.toFixed(1)}s
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Language:</span>
                    <p className="font-medium">{transcriptionResult.language === 'id-ID' ? 'Indonesian' : 'English'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Segments:</span>
                    <p className="font-medium">{transcriptionResult.segments.length}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <p className="font-medium">{transcriptionResult.duration.toFixed(1)}s</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg Confidence:</span>
                    <p className={`font-medium ${
                      transcriptionResult.averageConfidence >= 0.8
                        ? 'text-green-600'
                        : transcriptionResult.averageConfidence >= 0.6
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}>
                      {(transcriptionResult.averageConfidence * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Transcribed Text */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Transcribed Text</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyToClipboard}
                        disabled={copyStatus === 'success'}
                      >
                        {copyStatus === 'success' ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadAsText}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={transcriptionResult.fullText}
                    readOnly
                    className="min-h-[200px] bg-gray-50"
                    placeholder="No transcription available"
                  />
                </div>

                {/* Segments with Confidence */}
                {transcriptionResult.segments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Segment Details</h4>
                    <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                      {transcriptionResult.segments.map((segment, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-gray-500 min-w-[80px]">
                            {(segment.timestamp / 1000).toFixed(1)}s
                          </span>
                          <span className="flex-1">{segment.text}</span>
                          <span className={`text-xs px-1 py-0.5 rounded ${
                            (segment.confidence || 0) >= 0.8
                              ? 'bg-green-100 text-green-800'
                              : (segment.confidence || 0) >= 0.6
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {((segment.confidence || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};