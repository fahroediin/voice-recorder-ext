import React, { useEffect, useState } from 'react';
import { useRecorderStore } from '../store/useRecorderStore';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { RichTextEditor } from './RichTextEditor';
import { SoundSpectrum } from './SoundSpectrum';
import { SetupDialog } from './SetupDialog';
import { Mic, Pause, Play, Square, Upload, Loader2, CheckCircle, Volume2 } from 'lucide-react';
import { formatTime, isValidAudioBlob, formatErrorMessage } from '../lib/utils';
import { googleDriveService } from '../services/googleDriveService';
import { cn } from '../lib/utils';

// Base64 to Blob conversion utility
const base64ToBlob = (base64: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      // Remove data URL prefix if present
      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

      // Decode base64
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob with appropriate MIME type
      const blob = new Blob([bytes], { type: 'audio/webm' });
      resolve(blob);
    } catch (error) {
      reject(error);
    }
  });
};

export const SidePanel: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const {
    currentSession,
    isRecording,
    isPaused,
    recordingTime,
    isSetupComplete,
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
    loadSetupStatus,
    setSetupComplete,
  } = useRecorderStore();

  // Load setup status on component mount
  useEffect(() => {
    loadSetupStatus();
  }, [loadSetupStatus]);

  // Debug logging for state changes
  useEffect(() => {
    console.log('Current session updated:', currentSession);
    console.log('Has audio blob:', !!currentSession.audioBlob);
    console.log('Audio blob size:', currentSession.audioBlob?.size);
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

      // First, check microphone permission directly
      console.log('Checking microphone permission...');
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('Permission state:', permission.state);

      if (permission.state === 'denied') {
        alert('🎤 Microphone permission is blocked!\n\nTo fix this:\n1. Click the extension icon in Chrome toolbar\n2. Click "Site settings" or "Permissions"\n3. Set "Microphone" to "Allow"\n4. Reload this extension and try again');
        return;
      }

      if (permission.state === 'prompt') {
        console.log('Permission will be requested...');
      }

      // Request microphone access directly first
      console.log('Requesting microphone access...');
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted successfully');
      testStream.getTracks().forEach(track => track.stop());

      // Now proceed with recording
      const createResponse = await chrome.runtime.sendMessage({ type: 'OPEN_OFFSCREEN' });
      console.log('Create offscreen response:', createResponse);

      startRecording();

      const startResponse = await chrome.runtime.sendMessage({
        type: 'START_RECORDING'
      });
      console.log('Start recording response:', startResponse);

      if (!startResponse?.success) {
        console.error('Recording failed to start:', startResponse?.error);

        if (startResponse?.error?.includes('Permission') || startResponse?.error?.includes('dismissed')) {
          alert('🎤 Microphone permission was denied!\n\nPlease:\n1. Click the permission popup that appears\n2. Select "Allow" for microphone access\n3. Try recording again');
        } else {
          alert(`🎤 Recording failed: ${startResponse?.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Failed to start recording:', error);

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          alert('🎤 Microphone permission denied!\n\nPlease allow microphone access when Chrome asks for it.\n\nIf you accidentally blocked it:\n1. Go to Chrome Settings → Privacy and security → Site Settings → Microphone\n2. Remove this extension from "Not allowed to use"\n3. Try recording again');
        } else if (error.name === 'NotFoundError') {
          alert('🎤 No microphone found!\n\nPlease connect a microphone and try again.');
        } else {
          alert(`🎤 Failed to start recording: ${error.message}`);
        }
      } else {
        alert('🎤 Failed to start recording. Please try again.');
      }
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

  const handlePauseResume = async () => {
    pauseRecording();
    try {
      const response = await chrome.runtime.sendMessage({
        type: isPaused ? 'RESUME_RECORDING' : 'PAUSE_RECORDING'
      });
      console.log('Pause/Resume response:', response);
    } catch (error) {
      console.error('Failed to pause/resume recording:', error);
    }
  };

  const handleSaveToDrive = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const session = getFormattedSession();

      if (!session.name) {
        setSaveStatus('error');
        setSaveMessage('Please enter an activity name');
        setTimeout(() => setSaveStatus('idle'), 3000);
        return;
      }

      if (!isValidAudioBlob(session.audioBlob)) {
        setSaveStatus('error');
        setSaveMessage('No valid audio recording to save');
        setTimeout(() => setSaveStatus('idle'), 3000);
        return;
      }

      const result = await googleDriveService.saveSession(
        session.name,
        session.description || '',
        session.notes || '',
        session.audioBlob!,
        session.duration
      );

      setSaveStatus('success');
      setSaveMessage(`Successfully saved to Google Drive! Folder: ${result.audioFile.name}`);

      // Open the folder in Google Drive
      if (result.folderLink) {
        chrome.tabs.create({ url: result.folderLink });
      }

      // Reset session after successful save
      setTimeout(() => {
        resetSession();
        setSaveStatus('idle');
        setSaveMessage('');
      }, 3000);

    } catch (error) {
      console.error('Failed to save to Drive:', error);
      setSaveStatus('error');
      setSaveMessage(formatErrorMessage(error));
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setIsSaving(false);
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
            Record meetings and take notes, then save to Google Drive
            {!isSetupComplete && (
              <span className="text-amber-600 ml-1">• Setup required</span>
            )}
          </p>
        </div>

      {/* Activity Form */}
      <div className="space-y-4">
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

      {/* Meeting Notes */}
      <div>
        <label htmlFor="notes" className="text-sm font-medium">
          Meeting Notes
        </label>
        <RichTextEditor
          content={currentSession.notes || ''}
          onChange={setNotes}
          placeholder="Take your meeting notes here..."
        />
      </div>

      {/* Recording Controls */}
      <div className="space-y-4">
        {/* Microphone Permission Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm text-blue-800">
            <div className="flex items-center gap-2 mb-1">
              <Volume2 className="w-4 h-4" />
              <span className="font-medium">Microphone Access Required</span>
            </div>
            <p className="text-xs">
              Click "Start Recording" to grant microphone permission. Chrome will ask for permission before recording begins.
            </p>
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
              <Mic className="w-4 h-4 mr-2" />
              Start Recording
            </Button>
          ) : (
            <>
              <Button
                onClick={handlePauseResume}
                variant="outline"
                size="lg"
              >
                {isPaused ? (
                  <Play className="w-4 h-4 mr-2" />
                ) : (
                  <Pause className="w-4 h-4 mr-2" />
                )}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>

              <Button
                onClick={handleStopRecording}
                variant="destructive"
                size="lg"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            </>
          )}
        </div>

                                {/* Save Button */}
        {!isRecording && currentSession.audioBlob && (
          <div className="flex flex-col items-center gap-3">
            <Button
              onClick={handleSaveToDrive}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {isSaving ? 'Saving...' : 'Save to Google Drive'}
            </Button>

            {/* Status Message */}
            {saveStatus !== 'idle' && (
              <div className={cn(
                'flex items-center gap-2 text-sm px-3 py-2 rounded-md',
                saveStatus === 'success' && 'bg-green-100 text-green-800',
                saveStatus === 'error' && 'bg-red-100 text-red-800'
              )}>
                {saveStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                {saveStatus === 'error' && <div className="w-4 h-4 bg-red-500 rounded-full" />}
                {saveMessage}
              </div>
            )}
          </div>
        )}

        {/* Reset Button */}
        {!isRecording && (
          <div className="flex justify-center">
            <Button
              onClick={resetSession}
              variant="ghost"
              size="sm"
            >
              Reset Session
            </Button>
          </div>
        )}
      </div>
    </div>
    </>
  );
};