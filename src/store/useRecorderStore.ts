import { create } from 'zustand';
import { speechToTextService, type TranscriptionResult } from '../services/speechToTextService';

export interface RecordingSession {
  id: string;
  name: string;
  description: string;
  notes: string;
  audioBlob?: Blob;
  startTime: Date;
  endTime?: Date;
  duration: number;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface RecorderState {
  // Current session data
  currentSession: Partial<RecordingSession>;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;

  // Setup state
  isSetupComplete: boolean;

  // Audio source selection
  audioSource: 'microphone' | 'system' | 'both';

  // Audio devices
  audioDevices: AudioDevice[];
  selectedMicrophoneId: string | null;

  // Speech-to-text state
  isTranscribing: boolean;
  transcription: string;
  interimTranscription: string;
  transcriptionEnabled: boolean;
  transcriptionLanguage: 'id-ID' | 'en-US';
  realTimeTranscriptionEnabled: boolean;

  // Actions
  setActivityName: (name: string) => void;
  setDescription: (description: string) => void;
  setNotes: (notes: string) => void;
  startRecording: () => void;
  pauseRecording: () => void;
  stopRecording: () => void;
  resetSession: () => void;
  incrementRecordingTime: () => void;
  setAudioBlob: (blob: Blob) => void;
  getFormattedSession: () => Partial<RecordingSession> & { duration: number };
  setSetupComplete: (complete: boolean) => void;
  loadSetupStatus: () => Promise<void>;
  setAudioSource: (source: 'microphone' | 'system' | 'both') => void;
  loadAudioDevices: () => Promise<void>;
  setSelectedMicrophoneId: (deviceId: string | null) => void;
  transcribeAudio: (audioBlob: Blob) => Promise<TranscriptionResult>;
  startRealTimeTranscription: () => void;
  stopRealTimeTranscription: () => void;
  setTranscription: (text: string) => void;
  setInterimTranscription: (text: string) => void;
  setTranscriptionEnabled: (enabled: boolean) => void;
  setTranscriptionLanguage: (language: 'id-ID' | 'en-US') => void;
  setRealTimeTranscriptionEnabled: (enabled: boolean) => void;
}

export const useRecorderStore = create<RecorderState>((set, get) => ({
  // Initial state
  currentSession: {
    id: '',
    name: '',
    description: '',
    notes: '',
    startTime: new Date(),
    duration: 0,
  },
  isRecording: false,
  isPaused: false,
  recordingTime: 0,
  isSetupComplete: false,
  audioSource: 'microphone',
  audioDevices: [],
  selectedMicrophoneId: null,
  isTranscribing: false,
  transcription: '',
  interimTranscription: '',
  transcriptionEnabled: false,
  transcriptionLanguage: 'id-ID',
  realTimeTranscriptionEnabled: false,

  // Actions
  setActivityName: (name: string) =>
    set((state) => ({
      currentSession: { ...state.currentSession, name }
    })),

  setDescription: (description: string) =>
    set((state) => ({
      currentSession: { ...state.currentSession, description }
    })),

  setNotes: (notes: string) =>
    set((state) => ({
      currentSession: { ...state.currentSession, notes }
    })),

  startRecording: () =>
    set((state) => ({
      isRecording: true,
      isPaused: false,
      recordingTime: 0,
      currentSession: {
        ...state.currentSession,
        id: crypto.randomUUID(),
        startTime: new Date(),
      }
    })),

  pauseRecording: () =>
    set((state) => ({
      isPaused: !state.isPaused
    })),

  stopRecording: () =>
    set((state) => ({
      isRecording: false,
      isPaused: false,
      currentSession: {
        ...state.currentSession,
        endTime: new Date(),
      }
    })),

  resetSession: () =>
    set({
      currentSession: {
        id: '',
        name: '',
        description: '',
        notes: '',
        startTime: new Date(),
        duration: 0,
      },
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
    }),

  incrementRecordingTime: () =>
    set((state) => {
      if (state.isRecording && !state.isPaused) {
        return { recordingTime: state.recordingTime + 1 };
      }
      return state;
    }),

  // Add utility action to format session data
  getFormattedSession: () => {
    const state = get();
    return {
      ...state.currentSession,
      duration: state.recordingTime
    };
  },

  setAudioBlob: (audioBlob: Blob) =>
    set((state) => ({
      currentSession: { ...state.currentSession, audioBlob }
    })),

  setSetupComplete: (complete: boolean) =>
    set({ isSetupComplete: complete }),

  loadSetupStatus: async () => {
    try {
      const result = await chrome.storage.local.get(['googleClientId']);
      const hasClientId = !!result.googleClientId;
      set({ isSetupComplete: hasClientId });
    } catch (error) {
      console.error('Failed to load setup status:', error);
      set({ isSetupComplete: false });
    }
  },

  setAudioSource: (source: 'microphone' | 'system' | 'both') =>
    set({ audioSource: source }),

  loadAudioDevices: async () => {
    try {
      // First request microphone access to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices: AudioDevice[] = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          kind: device.kind
        }));

      set({ audioDevices });

      // Auto-select the first external microphone if available, otherwise the default
      const externalMic = audioDevices.find(device =>
        device.label.toLowerCase().includes('external') ||
        device.label.toLowerCase().includes('usb') ||
        device.label.toLowerCase().includes('headset')
      );

      const defaultMic = audioDevices.find(device =>
        device.deviceId === 'default' ||
        device.label.toLowerCase().includes('default')
      );

      set({
        selectedMicrophoneId: externalMic?.deviceId || defaultMic?.deviceId || audioDevices[0]?.deviceId || null
      });

      console.log('Available audio devices:', audioDevices);
      console.log('Selected microphone ID:', externalMic?.deviceId || defaultMic?.deviceId || audioDevices[0]?.deviceId || null);

    } catch (error) {
      console.error('Failed to load audio devices:', error);
      set({ audioDevices: [], selectedMicrophoneId: null });
    }
  },

  setSelectedMicrophoneId: (deviceId: string | null) =>
    set({ selectedMicrophoneId: deviceId }),

  transcribeAudio: async (audioBlob: Blob) => {
    try {
      set({ isTranscribing: true, transcription: '' });

      const state = get();
      const result = await speechToTextService.transcribeAudioFile(
        audioBlob,
        state.transcriptionLanguage,
        state.audioSource
      );

      set({
        isTranscribing: false,
        transcription: result.fullText
      });

      return result;
    } catch (error) {
      set({ isTranscribing: false });
      throw error;
    }
  },

  setTranscription: (text: string) =>
    set({ transcription: text }),

  setInterimTranscription: (text: string) =>
    set({ interimTranscription: text }),

  setTranscriptionEnabled: (enabled: boolean) =>
    set({ transcriptionEnabled: enabled }),

  setTranscriptionLanguage: (language: 'id-ID' | 'en-US') =>
    set({ transcriptionLanguage: language }),

  setRealTimeTranscriptionEnabled: (enabled: boolean) =>
    set({ realTimeTranscriptionEnabled: enabled }),

  startRealTimeTranscription: () => {
    try {
      const state = get();
      speechToTextService.startRealTimeTranscription(state.transcriptionLanguage);
      set({
        isTranscribing: true,
        realTimeTranscriptionEnabled: true,
        transcription: '',
        interimTranscription: ''
      });

      // Start polling for real-time updates
      const pollInterval = setInterval(() => {
        const current = speechToTextService.getRealTimeTranscription();
        if (current.isListening) {
          set({
            transcription: current.final,
            interimTranscription: current.interim
          });
        } else {
          clearInterval(pollInterval);
          set({
            isTranscribing: false,
            interimTranscription: ''
          });
        }
      }, 100);

    } catch (error) {
      console.error('Failed to start real-time transcription:', error);
      set({ isTranscribing: false });
      throw error;
    }
  },

  stopRealTimeTranscription: () => {
    try {
      const result = speechToTextService.stopRealTimeTranscription();
      set({
        isTranscribing: false,
        realTimeTranscriptionEnabled: false,
        transcription: result.fullText,
        interimTranscription: ''
      });
    } catch (error) {
      console.error('Failed to stop real-time transcription:', error);
      set({ isTranscribing: false });
      throw error;
    }
  },
}));