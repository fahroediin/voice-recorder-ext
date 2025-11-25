import { create } from 'zustand';

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

interface RecorderState {
  // Current session data
  currentSession: Partial<RecordingSession>;
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;

  // Setup state
  isSetupComplete: boolean;

  // Audio source selection
  audioSource: 'microphone' | 'system';

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
  setAudioSource: (source: 'microphone' | 'system') => void;
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

  setAudioSource: (source: 'microphone' | 'system') =>
    set({ audioSource: source }),
}));