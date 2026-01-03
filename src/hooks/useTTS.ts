import { useState, useCallback, useRef, useEffect } from 'react';

interface UseTTSOptions {
    voice?: string;
    rate?: number;
    pitch?: number;
}

interface UseTTSReturn {
    speak: (text: string) => void;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    isLoading: boolean;
    isSpeaking: boolean;
    isPaused: boolean;
    voices: SpeechSynthesisVoice[];
}

/**
 * Hook for text-to-speech using the Web Speech API.
 */
export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
    const { voice, rate = 1, pitch = 1 } = options;

    const [isLoading, setIsLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Load available voices
    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = speechSynthesis.getVoices();
            setVoices(availableVoices);
        };

        loadVoices();
        speechSynthesis.addEventListener('voiceschanged', loadVoices);

        return () => {
            speechSynthesis.removeEventListener('voiceschanged', loadVoices);
        };
    }, []);

    const speak = useCallback((text: string) => {
        if (!text.trim()) return;

        // Stop any current speech
        speechSynthesis.cancel();

        setIsLoading(true);

        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        // Set voice if specified
        if (voice) {
            const selectedVoice = voices.find(v => v.name === voice);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
        } else {
            // Use first English voice if available
            const englishVoice = voices.find(v => v.lang.startsWith('en'));
            if (englishVoice) {
                utterance.voice = englishVoice;
            }
        }

        utterance.rate = rate;
        utterance.pitch = pitch;

        utterance.onstart = () => {
            setIsLoading(false);
            setIsSpeaking(true);
            setIsPaused(false);
        };

        utterance.onend = () => {
            setIsSpeaking(false);
            setIsPaused(false);
        };

        utterance.onerror = (event) => {
            console.error('TTS error:', event.error);
            setIsLoading(false);
            setIsSpeaking(false);
            setIsPaused(false);
        };

        utterance.onpause = () => {
            setIsPaused(true);
        };

        utterance.onresume = () => {
            setIsPaused(false);
        };

        speechSynthesis.speak(utterance);
    }, [voice, rate, pitch, voices]);

    const stop = useCallback(() => {
        speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
        setIsLoading(false);
    }, []);

    const pause = useCallback(() => {
        if (isSpeaking && !isPaused) {
            speechSynthesis.pause();
        }
    }, [isSpeaking, isPaused]);

    const resume = useCallback(() => {
        if (isSpeaking && isPaused) {
            speechSynthesis.resume();
        }
    }, [isSpeaking, isPaused]);

    return {
        speak,
        stop,
        pause,
        resume,
        isLoading,
        isSpeaking,
        isPaused,
        voices,
    };
}
