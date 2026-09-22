import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Normalizes spoken speech command words into written punctuation.
 * e.g. "hello world period" -> "hello world."
 */
export function formatSpokenPunctuation(text: string): string {
  if (!text) return '';

  let formatted = text;

  const replacements: [RegExp, string][] = [
    [/\s+(?:period|full stop)\b/gi, '.'],
    [/\s+(?:comma)\b/gi, ','],
    [/\s+(?:question mark)\b/gi, '?'],
    [/\s+(?:exclamation mark|exclamation point)\b/gi, '!'],
    [/\s+(?:colon)\b/gi, ':'],
    [/\s+(?:semicolon)\b/gi, ';'],
    [/\s+(?:dash|hyphen)\b/gi, ' - '],
    [/\s+(?:new line|newline)\b/gi, '\n'],
    [/\s+(?:new paragraph|next paragraph)\b/gi, '\n\n'],
  ];

  for (const [regex, replacement] of replacements) {
    formatted = formatted.replace(regex, replacement);
  }

  // Auto-capitalize after sentence endings (. ! ? \n)
  formatted = formatted.replace(/([.!?\n]\s*)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());

  return formatted;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

export interface UseSpeechDictationOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (errorMessage: string) => void;
  lang?: string;
}

export interface UseSpeechDictationReturn {
  isListening: boolean;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

export function useSpeechDictation({
  onTranscript,
  onError,
  lang = 'en-US',
}: UseSpeechDictationOptions): UseSpeechDictationReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef<boolean>(false);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  const isSupported = isSpeechRecognitionSupported();

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += transcript;
        } else {
          interim += transcript;
        }
      }

      if (finalChunk.trim()) {
        const processed = formatSpokenPunctuation(finalChunk);
        onTranscriptRef.current(processed, true);
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
        onTranscriptRef.current(interim, false);
      }
    };

    recognition.onerror = (event: any) => {
      // 'no-speech' is common when user pauses; do not treat as fatal error
      if (event.error === 'no-speech') {
        return;
      }

      let errorMsg = `Speech recognition error: ${event.error}`;
      if (event.error === 'not-allowed') {
        errorMsg = 'Microphone access was denied. Please allow microphone permissions.';
      } else if (event.error === 'audio-capture') {
        errorMsg = 'No microphone was detected on this device.';
      } else if (event.error === 'network') {
        errorMsg = 'Speech network error occurred.';
      }

      setError(errorMsg);
      if (onErrorRef.current) onErrorRef.current(errorMsg);
    };

    recognition.onend = () => {
      // If the user did not manually stop dictation, restart continuously
      if (shouldBeListeningRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
          shouldBeListeningRef.current = false;
        }
      } else {
        setIsListening(false);
        setInterimTranscript('');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldBeListeningRef.current = false;
      try {
        recognition.stop();
      } catch {
        // Ignore stop error on unmount
      }
    };
  }, [isSupported, lang]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      const msg = 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.';
      setError(msg);
      if (onErrorRef.current) onErrorRef.current(msg);
      return;
    }

    if (recognitionRef.current) {
      try {
        shouldBeListeningRef.current = true;
        setError(null);
        setInterimTranscript('');
        recognitionRef.current.start();
      } catch (err: any) {
        // If already started, ignore error
        if (err.name !== 'InvalidStateError') {
          setError(err.message || 'Failed to start microphone');
        }
      }
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
