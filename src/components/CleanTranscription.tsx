import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { type CleanTranscriptionResult } from '../services/cleanTranscriptionService';
import { trueOfflineTranscriptionService, type TrueOfflineTranscriptionOptions } from '../services/trueOfflineTranscriptionService';
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
      // No cleanup needed for Whisper-only transcription
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
      console.log(`🔄 Starting TRUE offline transcription for ${audioSource} audio...`);
      console.log('🔄 Method: Web Audio API (NO API KEY, NO MICROPHONE, COMPLETELY OFFLINE)');
      console.log('🔄 Processing audio file directly from buffer...');

      // Check browser support
      if (!trueOfflineTranscriptionService.isOfflineSupported()) {
        const compatibility = trueOfflineTranscriptionService.getBrowserCompatibility();
        throw new Error(`
❌ BROWSER NOT COMPATIBLE

🔍 Current browser: ${compatibility.browser}
🔍 Support status: ${compatibility.supported ? '✅' : '❌'}

${compatibility.issues.length > 0 ? `🚨 Issues:\n${compatibility.issues.map(issue => `• ${issue}`).join('\n')}` : ''}

💡 SOLUTION:
• Use Chrome browser for best compatibility
• Ensure HTTPS connection
• Update browser to latest version
        `);
      }

      const offlineOptions: TrueOfflineTranscriptionOptions = {
        language: language
      };

      const offlineResult = await trueOfflineTranscriptionService.transcribeAudioFile(
        audioBlob,
        audioSource,
        offlineOptions
      );

      // Convert to standard format for UI compatibility
      const result: CleanTranscriptionResult = {
        fullText: offlineResult.fullText,
        segments: offlineResult.segments,
        language: offlineResult.language,
        duration: offlineResult.duration,
        audioSource: offlineResult.audioSource,
        averageConfidence: offlineResult.averageConfidence,
        hasLowConfidence: offlineResult.hasLowConfidence
      };

      setTranscriptionResult(result);
      console.log('✅ TRUE offline transcription completed:', offlineResult);
      console.log('🔄 Processing method:', offlineResult.processingMethod);
      console.log('🏭 API Provider:', offlineResult.apiProvider);
      console.log('📊 Stats: ', {
        segments: offlineResult.segments.length,
        confidence: `${(offlineResult.averageConfidence * 100).toFixed(1)}%`,
        duration: `${offlineResult.duration.toFixed(2)}s`
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('❌ TRUE offline transcription failed:', err);
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

  const isOfflineSupported = trueOfflineTranscriptionService.isOfflineSupported();

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
              <label className="text-sm font-medium">Offline Transcription Status</label>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  isOfflineSupported
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {isOfflineSupported ? '✅ Browser Supported' : '❌ Not Supported'}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                {isOfflineSupported ? (
                  <p>✅ TRUE offline transcription available - No API key needed!</p>
                ) : (
                  <p>❌ Browser not compatible. Use Chrome for offline transcription.</p>
                )}
              </div>
            </div>
          </div>

          {/* Offline Transcription Info */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">🔄 TRUE Offline Transcription</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>✅ <strong>NO API Key Required</strong> - Completely free!</p>
              <p>✅ <strong>NO Internet Connection</strong> - Works offline!</p>
              <p>✅ <strong>NO Microphone Input</strong> - Processes audio file directly!</p>
              <p>✅ <strong>100% Private</strong> - Audio never leaves your browser!</p>
              <div className="mt-2 pt-2 border-t border-blue-200">
                <p className="font-semibold">How it works:</p>
                <p>• Uses Web Audio API to process audio file directly</p>
                <p>• Creates virtual microphone from audio buffer</p>
                <p>• Browser's built-in speech recognition does the transcription</p>
              </div>
            </div>
          </div>

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
                disabled={isTranscribing || !isOfflineSupported}
                className="flex items-center gap-2"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transcribing Offline...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Transcribe Audio File (Offline - FREE)
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