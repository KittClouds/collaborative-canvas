import React from 'react';
import { Volume2, VolumeX, Pause, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTTS } from '@/hooks/useTTS';
import { cn } from '@/lib/utils';

interface TTSButtonProps {
    getText: () => string;
    className?: string;
}

/**
 * Text-to-speech button for reading text aloud.
 * Uses the Web Speech API via useTTS hook.
 */
export function TTSButton({ getText, className }: TTSButtonProps) {
    const { speak, stop, pause, resume, isLoading, isSpeaking, isPaused } = useTTS();

    const handleClick = () => {
        if (isSpeaking) {
            if (isPaused) {
                resume();
            } else {
                pause();
            }
        } else {
            const text = getText();
            if (text.trim()) {
                speak(text);
            }
        }
    };

    const handleStop = (e: React.MouseEvent) => {
        e.stopPropagation();
        stop();
    };

    return (
        <div className={cn("flex items-center gap-1", className)}>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleClick}
                disabled={isLoading}
                title={isSpeaking ? (isPaused ? "Resume" : "Pause") : "Read aloud"}
            >
                {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSpeaking ? (
                    isPaused ? (
                        <Play className="h-4 w-4" />
                    ) : (
                        <Pause className="h-4 w-4" />
                    )
                ) : (
                    <Volume2 className="h-4 w-4" />
                )}
            </Button>

            {isSpeaking && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleStop}
                    title="Stop"
                >
                    <VolumeX className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}

export default TTSButton;
