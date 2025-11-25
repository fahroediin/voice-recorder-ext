import React, { useEffect, useRef, useState } from 'react';

interface SoundSpectrumProps {
  isRecording: boolean;
  isPaused: boolean;
}

export const SoundSpectrum: React.FC<SoundSpectrumProps> = ({ isRecording, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);

  useEffect(() => {
    if (!isRecording || isPaused) {
      setIsActive(false);
      setVolumeLevel(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      // Clear canvas when not recording
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    setIsActive(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let microphone: MediaStreamAudioSourceNode | null = null;
    let animationId: number | null = null;

    const setupAudioAnalyzer = async () => {
      try {
        console.log('Setting up audio analyzer...');

        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        });

        console.log('Microphone access granted for analyzer, tracks:', stream.getAudioTracks().length);

        // Create audio context
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 64; // Smaller for performance
        analyser.smoothingTimeConstant = 0.3;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        microphone.connect(analyser);
        // Don't connect to destination to avoid feedback

        console.log('Audio analyzer setup complete');

        const draw = () => {
          if (!isRecording || isPaused) {
            return;
          }

          animationId = requestAnimationFrame(draw);

          analyser!.getByteFrequencyData(dataArray);

          // Calculate average volume
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setVolumeLevel(Math.round(average));

          // Clear canvas
          ctx.fillStyle = 'rgb(248, 250, 252)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw frequency bars
          const barWidth = (canvas.width / bufferLength) * 0.8;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

            // Color based on intensity
            if (average > 50) {
              ctx.fillStyle = 'rgb(239, 68, 68)'; // Red for high volume
            } else if (average > 20) {
              ctx.fillStyle = 'rgb(34, 197, 94)'; // Green for medium
            } else {
              ctx.fillStyle = 'rgb(59, 130, 246)'; // Blue for low
            }

            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
          }
        };

        draw();

      } catch (error) {
        console.error('Error setting up audio analyzer:', error);
      }
    };

    setupAudioAnalyzer();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }

      // Cleanup
      if (microphone) {
        try {
          microphone.disconnect();
        } catch (e) {
          console.warn('Error disconnecting microphone:', e);
        }
      }

      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [isRecording, isPaused]);

  return (
    <div className="w-full h-20 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: 'block' }}
        />
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm bg-slate-50">
            {isRecording && !isPaused ? 'Initializing analyzer...' : 'No audio input'}
          </div>
        )}
        {isActive && (
          <div className="absolute top-1 right-1 text-xs text-slate-500 bg-white px-1 rounded">
            Volume: {volumeLevel}
          </div>
        )}
      </div>
    </div>
  );
};