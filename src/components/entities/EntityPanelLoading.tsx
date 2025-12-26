import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Database } from 'lucide-react';

export function EntityPanelLoading() {
    return (
        <Card className="h-full flex flex-col border-0 bg-transparent shadow-none">
            <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="relative">
                        <Database className="h-12 w-12 mx-auto text-muted-foreground/30" />
                        <Loader2 className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-primary" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Initializing Entity Registry</p>
                        <p className="text-xs text-muted-foreground">
                            Loading knowledge graph...
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default EntityPanelLoading;
