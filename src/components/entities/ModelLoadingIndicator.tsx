import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Download, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoadingStage = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';

interface ModelLoadingIndicatorProps {
    modelName: string;
    task: string;
    isVisible: boolean;
    onComplete?: () => void;
    onDismiss?: () => void;
    className?: string;
}

export function ModelLoadingIndicator({
    modelName,
    task,
    isVisible,
    onComplete,
    onDismiss,
    className,
}: ModelLoadingIndicatorProps) {
    const [loadingStage, setLoadingStage] = useState<LoadingStage>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const loadModel = useCallback(async () => {
        try {
            setLoadingStage('downloading');
            setProgress(0);
            setError(null);

            const { pipeline, env } = await import('@huggingface/transformers');

            env.allowLocalModels = false;
            env.useBrowserCache = true;

            setLoadingStage('loading');

            await pipeline(task as 'token-classification', modelName, {
                progress_callback: (data: { status: string; loaded?: number; total?: number }) => {
                    if (data.status === 'progress' && data.total) {
                        const percent = Math.round((data.loaded! / data.total) * 100);
                        setProgress(percent);
                    }
                },
            });

            setLoadingStage('ready');
            setProgress(100);
            onComplete?.();

            console.log('[ModelLoadingIndicator] Model loaded:', modelName);
        } catch (err) {
            console.error('[ModelLoadingIndicator] Model loading failed:', err);
            setLoadingStage('error');
            setError(err instanceof Error ? err.message : 'Failed to load model');
        }
    }, [modelName, task, onComplete]);

    useEffect(() => {
        if (isVisible && loadingStage === 'idle') {
            loadModel();
        }
    }, [isVisible, loadingStage, loadModel]);

    if (!isVisible) return null;

    const stageConfig = {
        idle: {
            icon: Loader2,
            label: 'Preparing...',
            color: 'text-muted-foreground',
            animate: true,
        },
        downloading: {
            icon: Download,
            label: 'Downloading model',
            color: 'text-blue-500',
            animate: false,
        },
        loading: {
            icon: Loader2,
            label: 'Loading into memory',
            color: 'text-purple-500',
            animate: true,
        },
        ready: {
            icon: CheckCircle2,
            label: 'Ready',
            color: 'text-green-500',
            animate: false,
        },
        error: {
            icon: AlertTriangle,
            label: 'Failed',
            color: 'text-destructive',
            animate: false,
        },
    };

    const config = stageConfig[loadingStage];
    const Icon = config.icon;

    return (
        <Card className={cn('border-dashed', className)}>
            <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon
                            className={cn(
                                'h-4 w-4',
                                config.color,
                                config.animate && 'animate-spin'
                            )}
                        />
                        <span className="text-sm font-medium">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                            {task}
                        </Badge>
                        {onDismiss && loadingStage !== 'loading' && loadingStage !== 'downloading' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={onDismiss}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </div>

                {(loadingStage === 'downloading' || loadingStage === 'loading') && (
                    <>
                        <Progress value={progress} className="h-1" />
                        <p className="text-xs text-muted-foreground truncate">
                            {modelName}
                        </p>
                    </>
                )}

                {loadingStage === 'ready' && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                        Model ready for entity extraction
                    </p>
                )}

                {loadingStage === 'error' && error && (
                    <div className="space-y-2">
                        <p className="text-xs text-destructive">{error}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setLoadingStage('idle');
                                loadModel();
                            }}
                        >
                            Retry
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default ModelLoadingIndicator;
