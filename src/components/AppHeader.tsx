import { memo } from 'react';
import { Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBlueprintHub } from '@/features/blueprint-hub/hooks/useBlueprintHub';
import { cn } from '@/lib/utils';

export const AppHeader = memo(function AppHeader() {
    const { toggleHub, isHubOpen } = useBlueprintHub();

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="sm"
                onClick={toggleHub}
                className={cn(
                    "gap-2 text-xs",
                    isHubOpen && "bg-accent text-accent-foreground border-accent-foreground/20"
                )}
                title="Blueprint Hub"
            >
                <Boxes className="h-4 w-4" />
                Blueprint Hub
            </Button>
        </div>
    );
});
