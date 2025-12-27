import { memo } from 'react';
import { Boxes, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBlueprintHub } from '@/features/blueprint-hub/hooks/useBlueprintHub';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';

export const AppHeader = memo(function AppHeader() {
    const { toggleHub, isHubOpen } = useBlueprintHub();
    const navigate = useNavigate();
    const location = useLocation();
    const isGraphPage = location.pathname === '/graph';

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/graph')}
                className={cn(
                    "gap-2 text-xs",
                    isGraphPage && "bg-accent text-accent-foreground"
                )}
                title="Graph Explorer"
            >
                <Network className="h-4 w-4" />
                Graph
            </Button>
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
