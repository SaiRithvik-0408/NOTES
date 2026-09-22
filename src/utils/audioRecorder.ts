import { useState, useRef, useCallback, useEffect } from 'react';
import { formatSpokenPunctuation, isSpeechRecognitionSupported } from './speechRecognition';

export function isAudioRecordingSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return Boolean(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder === 'function'
  );
}

export function formatAudioDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert audio blob to base64 data URI.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

export interface AudioRecordingResult {
  audioData: string; // Base64 data URI
  duration: number; // in seconds
  transcript: string;
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevels: number[];
  liveTranscript: string;
  error: string | null;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<AudioRecordingResult | null>;
  cancelRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(24).fill(0.08));
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isSupported = isAudioRecordingSupported();

  // Internal refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedDurationRef = useRef<number>(0);

  // Web Audio Analyser
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Concurrent Speech Recognition for live transcription
  const recognitionRef = useRef<any>(null);
  const fullTranscriptRef = useRef<string>('');

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
  };

  // Visualizer loop extracting 24 frequency levels
  const updateVisualizer = () => {
    if (!analyserRef.current || !isRecording) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Sample 24 evenly spaced bins
    const numBars = 24;
    const step = Math.floor(bufferLength / numBars);
    const levels: number[] = [];

    for (let i = 0; i < numBars; i++) {
      const idx = i * step;
      const val = dataArray[idx] || 0;
      // Normalize to 0.08 (min baseline) -> 1.0
      const normalized = Math.max(0.08, Math.min(1.0, val / 255));
      levels.push(normalized);
    }

    setAudioLevels(levels);
    animFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser.');
      return;
    }

    setError(null);
    audioChunksRef.current = [];
    fullTranscriptRef.current = '';
    setLiveTranscript('');
    setDuration(0);
    accumulatedDurationRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Initialize Web Audio Context & Analyser
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Choose supported mimeType
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // Concurrent Speech Recognition
      if (isSpeechRecognitionSupported()) {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentFinal = fullTranscriptRef.current;
          let currentInterim = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const part = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              currentFinal = `${currentFinal} ${part}`.trim();
              fullTranscriptRef.current = formatSpokenPunctuation(currentFinal);
            } else {
              currentInterim += part;
            }
          }

          const combined = `${fullTranscriptRef.current} ${currentInterim}`.trim();
          setLiveTranscript(combined);
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch {}
      }

      recorder.start(250); // Collect slice every 250ms
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setIsPaused(false);

      // Start duration timer
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Start visualizer animation
      animFrameRef.current = requestAnimationFrame(updateVisualizer);
    } catch (err: any) {
      cleanup();
      setError(err?.message || 'Could not access microphone. Please allow microphone permissions.');
    }
  }, [isSupported]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setIsPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      animFrameRef.current = requestAnimationFrame(updateVisualizer);
      setIsPaused(false);
    }
  }, []);

  const stopRecording = useCallback((): Promise<AudioRecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanup();
        setIsRecording(false);
        setIsPaused(false);
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const finalDuration = duration;
        const finalTranscript = fullTranscriptRef.current || liveTranscript || 'No speech detected';

        cleanup();
        setIsRecording(false);
        setIsPaused(false);
        setAudioLevels(new Array(24).fill(0.08));

        try {
          const base64Audio = await blobToBase64(finalBlob);
          resolve({
            audioData: base64Audio,
            duration: finalDuration,
            transcript: finalTranscript,
          });
        } catch {
          resolve(null);
        }
      };

      try {
        recorder.stop();
      } catch {
        cleanup();
        setIsRecording(false);
        resolve(null);
      }
    });
  }, [duration, liveTranscript]);

  const cancelRecording = useCallback(() => {
    cleanup();
    setIsRecording(false);
    setIsPaused(false);
    setAudioLevels(new Array(24).fill(0.08));
    setLiveTranscript('');
    setDuration(0);
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    audioLevels,
    liveTranscript,
    error,
    isSupported,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
  };
}
