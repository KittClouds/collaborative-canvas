/**
 * NetworkMembershipBadge - Shows network membership badges for relationships
 * 
 * Displays small colored badges indicating which networks a relationship belongs to.
 * Used in Fact Sheets and relationship lists.
 */

import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Users,
    Building,
    Flag,
    Handshake,
    Hammer,
    Heart,
    Swords,
    Wrench,
    Network,
} from 'lucide-react';
import type { NetworkKind } from '@/lib/networks/types';

// Icon mapping for network kinds
const NETWORK_ICONS: Record<NetworkKind, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    FAMILY: Users,
    ORGANIZATION: Building,
    FACTION: Flag,
    ALLIANCE: Handshake,
    GUILD: Hammer,
    FRIENDSHIP: Heart,
    RIVALRY: Swords,
    CUSTOM: Wrench,
};

export interface NetworkMembership {
    networkId: string;
    networkName: string;
    schemaName: string;
    relationshipCode: string;
    networkRelationshipId: string;
    color?: string;
}

interface NetworkMembershipBadgeProps {
    memberships: NetworkMembership[];
    maxVisible?: number;
    size?: 'sm' | 'md';
}

export function NetworkMembershipBadge({
    memberships,
    maxVisible = 2,
    size = 'sm',
}: NetworkMembershipBadgeProps) {
    if (!memberships || memberships.length === 0) {
        return null;
    }

    const visible = memberships.slice(0, maxVisible);
    const hidden = memberships.slice(maxVisible);

    const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
    const badgeSize = size === 'sm' ? 'text-[9px] px-1.5 py-0' : 'text-xs px-2 py-0.5';

    return (
        <TooltipProvider>
            <div className="flex items-center gap-1">
                {visible.map((membership) => (
                    <Tooltip key={membership.networkRelationshipId}>
                        <TooltipTrigger asChild>
                            <Badge
                                variant="outline"
                                className={`${badgeSize} gap-1 cursor-default`}
                                style={{
                                    borderColor: membership.color || '#9333ea',
                                    color: membership.color || '#9333ea',
                                }}
                            >
                                <Network className={iconSize} />
                                {size === 'md' && membership.networkName}
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-xs">
                                <div className="font-medium">{membership.networkName}</div>
                                <div className="text-muted-foreground">
                                    {membership.schemaName} • {membership.relationshipCode.replace(/_/g, ' ')}
                                </div>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                ))}

                {hidden.length > 0 && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge
                                variant="secondary"
                                className={`${badgeSize} cursor-default`}
                            >
                                +{hidden.length}
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-xs space-y-1">
                                {hidden.map((m) => (
                                    <div key={m.networkRelationshipId}>
                                        <span className="font-medium">{m.networkName}</span>
                                        <span className="text-muted-foreground"> • {m.relationshipCode.replace(/_/g, ' ')}</span>
                                    </div>
                                ))}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    );
}

/**
 * Compact network indicator (just an icon with a badge count)
 */
interface NetworkIndicatorProps {
    count: number;
    color?: string;
}

export function NetworkIndicator({ count, color = '#9333ea' }: NetworkIndicatorProps) {
    if (count === 0) return null;

    return (
        <div className="relative">
            <Network className="h-4 w-4" style={{ color }} />
            {count > 1 && (
                <span
                    className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary text-[8px] text-primary-foreground flex items-center justify-center font-medium"
                >
                    {count}
                </span>
            )}
        </div>
    );
}

export default NetworkMembershipBadge;
