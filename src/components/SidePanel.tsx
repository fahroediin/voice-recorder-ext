import React, { useEffect, useState } from 'react';
import { useRecorderStore } from '../store/useRecorderStore';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { PlainTextEditor } from './PlainTextEditor';
import { SoundSpectrum } from './SoundSpectrum';
import { SetupDialog } from './SetupDialog';
import { Mic, Pause, Play, Square, Upload, Loader2, CheckCircle, Volume2, Monitor, Headphones, Layers, RotateCcw, Sparkles } from 'lucide-react';
import { formatTime, formatErrorMessage } from '../lib/utils';
import { googleDriveService } from '../services/googleDriveService';
import { cn } from '../lib/utils';
import { trueOfflineTranscriptionService, type TrueOfflineTranscriptionResult } from '../services/trueOfflineTranscriptionService';

// Base64 to Blob conversion utility
const base64ToBlob = (base64: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      // Remove data URL prefix if present
      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

      // Convert base64 to binary string
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'audio/webm' });
      resolve(blob);
    } catch (error) {
      reject(new Error(`Failed to convert base64 to blob: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
};

export const SidePanel: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  // Auto-transcription states
  const [isAutoTranscribing, setIsAutoTranscribing] = useState(false);
  const [autoTranscriptionResult, setAutoTranscriptionResult] = useState<TrueOfflineTranscriptionResult | null>(null);
  const [autoTranscriptionError, setAutoTranscriptionError] = useState<string | null>(null);

  const {
    currentSession,
    isRecording,
    isPaused,
    recordingTime,
    isSetupComplete,
    audioSource,
    audioDevices,
    selectedMicrophoneId,
    transcriptionLanguage,
    realTimeTranscriptionEnabled,
    setTranscriptionLanguage,
    setActivityName,
    setDescription,
    setNotes,
    startRecording,
    pauseRecording,
    stopRecording,
    resetSession,
    incrementRecordingTime,
    setAudioBlob,
    getFormattedSession,
    setSetupComplete,
    loadSetupStatus,
    setAudioSource,
    loadAudioDevices,
    setSelectedMicrophoneId,
    startRealTimeTranscription,
    stopRealTimeTranscription
  } = useRecorderStore();

  useEffect(() => {
    loadSetupStatus();
    loadAudioDevices();
  }, [loadSetupStatus, loadAudioDevices]);

  // Auto-start real-time transcription when recording starts with microphone
  useEffect(() => {
    if (isRecording && (audioSource === 'microphone' || audioSource === 'both') && !realTimeTranscriptionEnabled) {
      console.log('🎤 Auto-starting real-time transcription for recording');
      startRealTimeTranscription();
    }

    // Stop real-time transcription when recording stops
    if (!isRecording && realTimeTranscriptionEnabled) {
      console.log('🔇 Auto-stopping real-time transcription');
      stopRealTimeTranscription();
    }
  }, [isRecording, audioSource, realTimeTranscriptionEnabled, startRealTimeTranscription, stopRealTimeTranscription]);

  // Debug logging for state changes
  useEffect(() => {
    console.log('Current session updated:', currentSession);
    console.log('Has audio blob:', !!currentSession.audioBlob);
  }, [currentSession]);

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        incrementRecordingTime();
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording, isPaused, incrementRecordingTime]);

  const handleStartRecording = async () => {
    try {
      console.log('🎤 Starting recording...');
      startRecording();

      // First ensure offscreen document exists
      console.log('🔧 Ensuring offscreen document exists...');
      const offscreenResponse = await chrome.runtime.sendMessage({
        type: 'OPEN_OFFSCREEN'
      });

      if (!offscreenResponse?.success) {
        throw new Error('Failed to create offscreen document: ' + (offscreenResponse?.error || 'Unknown error'));
      }

      console.log('✅ Offscreen document ready');

      // Now start recording
      console.log('🎤 Sending START_RECORDING message...');
      const startResponse = await chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        audioSource: audioSource,
        microphoneId: selectedMicrophoneId
      });
      console.log('Start recording response:', startResponse);

      if (!startResponse?.success) {
        throw new Error(startResponse.error || 'Failed to start recording');
      }

      console.log('✅ Recording started successfully');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      alert(`❌ Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStopRecording = async () => {
    try {
      console.log('Stopping recording...');
      stopRecording();

      // Stop recording and get audio blob
      console.log('Sending STOP_RECORDING message...');
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_RECORDING'
      });

      console.log('Stop recording response:', response);
      console.log('Response success:', response?.success);
      console.log('Has audioBlob:', !!response?.audioBlob);

      if (response?.success && response?.audioBlob) {
        console.log('Converting base64 to blob...');
        // Convert base64 back to blob
        const audioBlob = await base64ToBlob(response.audioBlob);
        console.log('Audio blob created, size:', audioBlob.size);

        if (audioBlob.size > 0) {
          console.log('Setting audio blob to store...');
          setAudioBlob(audioBlob);
          console.log('Audio blob set successfully');

          // 🔄 AUTOMATIC TRANSCRIPTION START
          console.log('🔄 Starting automatic transcription...');
          performAutoTranscription(audioBlob);
        } else {
          console.error('Audio blob is empty');
        }
      } else {
        console.error('No audio blob received from recording');
        console.error('Response:', response);
        console.error('Success:', response?.success);
        console.error('AudioBlob exists:', !!response?.audioBlob);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);
    }
  };

  const performAutoTranscription = async (audioBlob: Blob) => {
    console.log('🔄 Starting automatic transcription for recorded audio...');
    console.log('🔄 Audio blob size:', audioBlob.size, 'bytes');
    console.log('🔄 Audio blob type:', audioBlob.type);

    // Check if offline transcription is supported
    if (!trueOfflineTranscriptionService.isOfflineSupported()) {
      console.warn('⚠️ Simplified offline transcription not supported, trying alternative method...');
      setAutoTranscriptionError('Offline transcription not supported in this browser');
      return;
    }

    setIsAutoTranscribing(true);
    setAutoTranscriptionError(null);
    setAutoTranscriptionResult(null);

    try {
      console.log(`🔄 Auto-transcribing ${audioSource} audio in ${transcriptionLanguage}...`);

      const options = {
        language: transcriptionLanguage
      };

      console.log('🎯 Starting simplified transcription service...');
      const result = await trueOfflineTranscriptionService.transcribeAudioFile(
        audioBlob,
        audioSource,
        options
      );

      console.log('✅ Auto-transcription completed successfully!');
      console.log('📝 Result:', result);

      setAutoTranscriptionResult(result);

      // Auto-add transcription to notes
      if (result.fullText.trim()) {
        // Clean and validate the transcription text
        const cleanedText = result.fullText
          .replace(/^[^a-zA-Z\u00C0-\u017F]*/, '') // Remove non-letter characters from start (including accented letters)
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        if (cleanedText.length > 5) { // Only add if meaningful text
          const currentNotes = currentSession.notes || '';
          const transcriptionText = `\n\n--- Auto Transcription (${new Date().toLocaleString()}) ---\nLanguage: ${transcriptionLanguage}\nDuration: ${result.duration.toFixed(1)}s\nConfidence: ${(result.averageConfidence * 100).toFixed(1)}%\n\n${cleanedText}`;

          // Add to session notes
          setNotes(currentNotes + transcriptionText);

          console.log('✅ Auto-transcription added to session notes');
          console.log('📝 Transcribed text:', cleanedText);
        } else {
          console.warn('⚠️ Transcription text too short or invalid:', cleanedText);
          setAutoTranscriptionError('Transcription resulted in text that was too short or unclear');
        }
      } else {
        console.warn('⚠️ No transcription text generated');
        setAutoTranscriptionError('No speech was detected in the audio recording');
      }

    } catch (error) {
      console.error('❌ Auto-transcription failed:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error details:', error instanceof Error ? error.stack : error);

      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide more helpful error messages
        if (errorMessage.includes('Maximum call stack size exceeded')) {
          errorMessage = 'Transcription service encountered an error. Please try recording again.';
        } else if (errorMessage.includes('not supported')) {
          errorMessage = 'Browser does not support offline transcription. Try Chrome or Edge browser.';
        } else if (errorMessage.includes('no-speech')) {
          errorMessage = 'No speech detected in the recording. Please record with clear speech and check microphone.';
        } else if (errorMessage.includes('audio-capture')) {
          errorMessage = 'Microphone permission required. Please allow microphone access and try again.';
        }
      }

      setAutoTranscriptionError(errorMessage);
    } finally {
      setIsAutoTranscribing(false);
    }
  };

  const handlePauseResume = async () => {
    pauseRecording();
    try {
      const response = await chrome.runtime.sendMessage({
        type: isPaused ? 'RESUME_RECORDING' : 'PAUSE_RECORDING'
      });

      console.log('Pause/Resume response:', response);

      if (!response?.success) {
        throw new Error(response.error || 'Failed to pause/resume recording');
      }
    } catch (error) {
      console.error('Failed to pause/resume recording:', error);
      alert('❌ Failed to pause/resume recording. Please try again.');
    }
  };

  
  const handleSaveToDrive = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      console.log('💾 Saving to Google Drive...');

      const sessionData = getFormattedSession();

      if (!sessionData.name || !sessionData.startTime || !currentSession.audioBlob) {
        setSaveStatus('error');
        setSaveMessage('Please fill in the activity name and record some audio first.');
        return;
      }

      await googleDriveService.saveSession(
        sessionData.name || '',
        sessionData.description || '',
        sessionData.notes || '',
        currentSession.audioBlob,
        sessionData.duration || 0
      );

      setSaveStatus('success');
      setSaveMessage(`✅ Saved "${sessionData.name}" to Google Drive`);

      // Auto-reset after successful save
      setTimeout(() => {
        resetSession();
        setSaveStatus('idle');
        setSaveMessage('');
      }, 3000);

    } catch (error) {
      console.error('Failed to save to Google Drive:', error);
      setSaveStatus('error');
      setSaveMessage(formatErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSession = () => {
    const confirmReset = window.confirm('Clear all data and start fresh? This cannot be undone.');
    if (confirmReset) {
      resetSession();
      setIsAutoTranscribing(false);
      setAutoTranscriptionResult(null);
      setAutoTranscriptionError(null);
    }
  };

  // Auto-transcription status display
  const getAutoTranscriptionStatus = () => {
    if (isAutoTranscribing) {
      return '🔄 Auto-transcribing...';
    } else if (autoTranscriptionError) {
      return '❌ Auto-transcription failed';
    } else if (autoTranscriptionResult) {
      return `✅ Transcribed ${autoTranscriptionResult.segments.length} segments`;
    } else {
      return '';
    }
  };

  return (
    <>
      {/* Setup Dialog */}
      {!isSetupComplete && <SetupDialog onComplete={() => setSetupComplete(true)} />}

      <div className="w-96 min-h-[600px] bg-background p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Voice Recorder & Notes
          </h1>
          <p className="text-sm text-muted-foreground">
            Record meetings, auto-transcribe to text, then save to Google Drive
            {!isSetupComplete && (
              <span className="text-amber-600 ml-1">• Setup required</span>
            )}
            {trueOfflineTranscriptionService.isOfflineSupported() && (
              <span className="text-green-600 ml-1">• ✨ Auto-transcription enabled</span>
            )}
          </p>
        </div>

      {/* Activity Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div>
            <label htmlFor="activity-name" className="text-sm font-medium">
              Activity Name
            </label>
            <Input
              id="activity-name"
              placeholder="e.g., Team Standup, Client Meeting"
              value={currentSession.name || ''}
              onChange={(e) => setActivityName(e.target.value)}
              disabled={isRecording}
            />
          </div>

          <div>
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              placeholder="Brief description of the activity..."
              value={currentSession.description || ''}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isRecording}
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="space-y-4">
        {/* Audio Source Selection */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm text-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4" />
              <span className="font-medium">Recording Settings</span>
            </div>

            {/* Language Selection */}
            <div className="mb-3">
              <label className="text-xs font-medium text-blue-800 block mb-1">
                🌐 Transcription Language:
              </label>
              <select
                value={transcriptionLanguage}
                onChange={(e) => setTranscriptionLanguage(e.target.value as 'id-ID' | 'en-US')}
                disabled={isRecording}
                className="w-full px-2 py-1 text-xs border border-blue-300 rounded bg-white text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="id-ID">🇮🇩 Bahasa Indonesia</option>
                <option value="en-US">🇺🇸 English</option>
              </select>
              <p className="text-xs text-blue-600 mt-1">
                Language for automatic transcription after recording
              </p>
            </div>

            {/* Audio Source Selection */}
            <div className="mb-2">
              <label className="text-xs font-medium text-blue-800 block mb-1">
                🎙️ Audio Source:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setAudioSource('microphone')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors ${
                    audioSource === 'microphone'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <Headphones className="w-4 h-4" />
                  Microphone
                </button>
                <button
                  onClick={() => setAudioSource('system')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors ${
                    audioSource === 'system'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  System
                </button>
                <button
                  onClick={() => setAudioSource('both')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded text-xs font-medium transition-colors ${
                    audioSource === 'both'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Both
                </button>
              </div>
              <p className="text-xs mb-1">
                {audioSource === 'microphone' && '🎤 Records your voice only (for meetings, voice notes)'}
                {audioSource === 'system' && '🔊 Records system audio only (music, videos, sounds)'}
                {audioSource === 'both' && '🎤+🔊 Records both voice and system audio (perfect for online meetings)'}
              </p>
              <p className="text-xs text-blue-600">
                ✨ Auto-transcription will start automatically after recording stops
              </p>
              {(audioSource === 'system' || audioSource === 'both') && (
                <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mt-2">
                  <p className="text-xs text-yellow-800">
                    <strong>⚠️ Screen Sharing Required:</strong> Chrome will ask you to select a screen/window to share. <strong>Important:</strong> Check the "Share audio" checkbox at the bottom.
                  </p>

                  {/* Step-by-step instructions */}
                  <div className="mt-2 text-xs text-yellow-700">
                    <strong>📋 Steps:</strong>
                    <ol className="ml-3 mt-1 list-decimal">
                      <li>When Chrome asks, select a screen or window</li>
                      <li>Check the "Share audio" checkbox at the bottom</li>
                      <li>Click "Share" button</li>
                    </ol>
                  </div>

                  {/* Troubleshooting */}
                  <div className="mt-2">
                    <details className="text-xs text-yellow-700">
                      <summary className="font-medium cursor-pointer">💡 Troubleshooting Tips</summary>
                      <div className="mt-2 space-y-1">
                        <div>• Check "Share audio" in the screen sharing dialog</div>
                        <div>• Ensure system volume is audible</div>
                        <div>• Some systems don't allow audio sharing</div>
                        <div>• Consider using "Microphone" mode instead</div>
                      </div>
                    </details>
                  </div>

                  {audioSource === 'system' && (
                    <div className="mt-2">
                      <p className="text-xs text-yellow-700">
                        💡 Records: Music, videos, games, system sounds
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        🔇 <strong>No microphone audio</strong> - only system audio
                      </p>
                    </div>
                  )}
                  {audioSource === 'both' && (
                    <p className="text-xs text-yellow-700 mt-2">
                      💡 Perfect for: Online meetings, calls with screen sharing
                    </p>
                  )}
                </div>
              )}

              {/* Microphone Selection */}
              {(audioSource === 'microphone' || audioSource === 'both') && audioDevices.length > 0 && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-blue-800 block mb-1">
                    🎤 Microphone Device:
                  </label>
                  <select
                    value={selectedMicrophoneId || ''}
                    onChange={(e) => setSelectedMicrophoneId(e.target.value || null)}
                    className="w-full text-xs border border-blue-300 rounded px-2 py-1 bg-white text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Default Microphone</option>
                    {audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Auto-Transcription Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-center">
              <Sparkles className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <h4 className="text-sm font-medium text-green-800 mb-1">✨ Automatic Transcription</h4>
              <p className="text-xs text-green-700">
                Recording will be automatically transcribed after stopping
              </p>
              <div className="flex items-center justify-center gap-3 mt-2 text-xs text-green-600">
                <span>🌐 {transcriptionLanguage === 'id-ID' ? 'Indonesian' : 'English'}</span>
                <span>🔄 Offline</span>
                <span>🔒 Private</span>
              </div>

              {/* Auto-Transcription Status Messages */}
              {getAutoTranscriptionStatus() && (
                <div className="mt-2 text-center text-xs">
                  {isAutoTranscribing && (
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>{getAutoTranscriptionStatus()}</span>
                    </div>
                  )}
                  {autoTranscriptionError && (
                    <div className="text-red-600">
                      <span>{getAutoTranscriptionStatus()}</span>
                    </div>
                  )}
                  {autoTranscriptionResult && !isAutoTranscribing && (
                    <div className="text-green-600">
                      <span>{getAutoTranscriptionStatus()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sound Spectrum Visualizer */}
        {isRecording && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Volume2 className="w-4 h-4" />
              Audio Input Level
            </div>
            <SoundSpectrum isRecording={isRecording} isPaused={isPaused} />
          </div>
        )}

        {/* Timer Display */}
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-primary">
            {formatTime(recordingTime)}
          </div>
          {isRecording && (
            <div className="text-sm text-muted-foreground">
              {isPaused ? 'Paused' : 'Recording...'}
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center gap-2">
          {!isRecording ? (
            <Button
              onClick={handleStartRecording}
              size="lg"
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Mic className="w-5 h-5 mr-2" />
              Start Recording
            </Button>
          ) : (
            <>
              <Button
                onClick={handlePauseResume}
                size="lg"
                variant={isPaused ? 'default' : 'secondary'}
                className={isPaused ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}
              >
                {isPaused ? (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                onClick={handleStopRecording}
                size="lg"
                variant="destructive"
              >
                <Square className="w-5 h-5 mr-2" />
                Stop Recording
              </Button>
            </>
          )}
        </div>

        {/* Auto-Transcription Processing Status */}
        {isAutoTranscribing && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-blue-800">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-medium">🔄 Auto-transcribing audio...</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Converting your recording to text automatically
            </p>
            <div className="text-xs text-blue-500 mt-2">
              {transcriptionLanguage === 'id-ID' ? 'Memproses: Bahasa Indonesia' : 'Processing: English'}
            </div>
          </div>
        )}

        {/* Auto-Transcription Result */}
        {autoTranscriptionResult && !isAutoTranscribing && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-center gap-2 text-sm text-green-800 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="font-medium">✅ Auto-transcription completed!</span>
            </div>
            <div className="text-xs text-green-700 space-y-1">
              <p>📝 {autoTranscriptionResult.segments.length} segments transcribed</p>
              <p>🎯 {(autoTranscriptionResult.averageConfidence * 100).toFixed(1)}% confidence</p>
              <p>⏱️ {autoTranscriptionResult.duration.toFixed(1)}s duration</p>
            </div>
            <p className="text-xs text-green-600 mt-2">
              ✨ Text automatically added to your notes below
            </p>
          </div>
        )}

        {/* Auto-Transcription Error */}
        {autoTranscriptionError && !isAutoTranscribing && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center justify-center gap-2 text-sm text-red-800">
              <Volume2 className="w-4 h-4 text-red-600" />
              <span className="font-medium">❌ Auto-transcription failed</span>
            </div>
            <p className="text-xs text-red-600 mt-1">
              Try manual transcription or check browser compatibility
            </p>
          </div>
        )}
      </div>

      {/* Meeting Notes */}
      <div>
        <label htmlFor="notes" className="text-sm font-medium">
          Meeting Notes
        </label>
        <PlainTextEditor
          content={currentSession.notes || ''}
          onChange={setNotes}
          placeholder="Take your meeting notes here..."
        />
      </div>

      {/* Save Button */}
      {!isRecording && currentSession.audioBlob && (
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleSaveToDrive}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white w-full"
            disabled={isSaving || saveStatus === 'success'}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {saveStatus === 'success' ? 'Saving...' : 'Loading...'}
              </>
            ) : saveStatus === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Saved to Drive
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Save to Google Drive
              </>
            )}
          </Button>
          {saveStatus && (
            <div className={cn(
              'text-sm font-medium px-3 py-1 rounded-lg text-center',
              saveStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
              saveStatus === 'error' && 'animate-pulse'
            )}>
              {saveMessage}
            </div>
          )}
        </div>
      )}

      {/* Reset Button */}
      {!isRecording && (
        <div className="flex justify-center">
          <Button
            onClick={handleResetSession}
            variant="ghost"
            size="sm"
            title="Clear all data and start fresh"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset Session
          </Button>
        </div>
      )}
      </div>
    </>
  );
};