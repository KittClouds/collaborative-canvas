import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface EntityPanelErrorProps {
    error: Error;
    onRetry?: () => void;
    onFallback?: () => void;
}

export function EntityPanelError({ error, onRetry, onFallback }: EntityPanelErrorProps) {
    return (
        <Card className="h-full flex flex-col border-0 bg-transparent shadow-none">
            <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4 max-w-xs">
                    <AlertCircle className="h-12 w-12 mx-auto text-destructive/70" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">
                            Registry Initialization Failed
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {error.message || 'Unable to load entity registry'}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        {onRetry && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRetry}
                                className="gap-2"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Retry
                            </Button>
                        )}
                        {onFallback && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onFallback}
                            >
                                Use Basic Mode
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default EntityPanelError;
