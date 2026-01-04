/**
 * Highlighting Mode Toggle
 * 
 * A compact toggle for switching between highlighting modes.
 * Designed to sit next to "Reset to Defaults" in EntityThemeTab.
 */

import { useAtom } from 'jotai';
import { Sparkles, Eye, Focus, EyeOff, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    highlightSettingsAtom,
    type HighlightMode,
    HIGHLIGHT_MODE_LABELS,
    HIGHLIGHT_MODE_DESCRIPTIONS,
} from '@/atoms/highlightingAtoms';
import { ENTITY_KINDS, type EntityKind } from '@/lib/types/entityTypes';
import { cn } from '@/lib/utils';

/** Icon for each mode */
const MODE_ICONS: Record<HighlightMode, React.ReactNode> = {
    clean: <Eye className="w-4 h-4" />,
    vivid: <Sparkles className="w-4 h-4" />,
    focus: <Focus className="w-4 h-4" />,
    off: <EyeOff className="w-4 h-4" />,
};

/** Color classes for mode buttons */
const MODE_COLORS: Record<HighlightMode, string> = {
    clean: 'text-teal-400',
    vivid: 'text-violet-400',
    focus: 'text-amber-400',
    off: 'text-muted-foreground',
};

export function HighlightingModeToggle() {
    const [settings, setSettings] = useAtom(highlightSettingsAtom);
    const { mode, focusEntityKinds } = settings;

    const setMode = (newMode: HighlightMode) => {
        setSettings({ ...settings, mode: newMode });
    };

    const toggleFocusKind = (kind: EntityKind) => {
        const newKinds = focusEntityKinds.includes(kind)
            ? focusEntityKinds.filter((k) => k !== kind)
            : [...focusEntityKinds, kind];
        setSettings({ ...settings, focusEntityKinds: newKinds });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn('gap-2', MODE_COLORS[mode])}
                >
                    {MODE_ICONS[mode]}
                    {HIGHLIGHT_MODE_LABELS[mode]}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 z-[100]">
                <DropdownMenuLabel>Highlighting Mode</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {(Object.keys(HIGHLIGHT_MODE_LABELS) as HighlightMode[]).map((m) => (
                    <DropdownMenuItem
                        key={m}
                        onClick={() => setMode(m)}
                        className={cn(
                            'gap-2 cursor-pointer',
                            mode === m && 'bg-muted'
                        )}
                    >
                        <span className={MODE_COLORS[m]}>{MODE_ICONS[m]}</span>
                        <div className="flex-1">
                            <div className="font-medium">{HIGHLIGHT_MODE_LABELS[m]}</div>
                            <div className="text-xs text-muted-foreground">
                                {HIGHLIGHT_MODE_DESCRIPTIONS[m]}
                            </div>
                        </div>
                    </DropdownMenuItem>
                ))}

                {/* Focus mode entity selection */}
                {mode === 'focus' && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs">
                            Focus on Entity Types
                        </DropdownMenuLabel>
                        <div className="max-h-48 overflow-y-auto">
                            {[...ENTITY_KINDS].sort().map((kind) => (
                                <DropdownMenuCheckboxItem
                                    key={kind}
                                    checked={focusEntityKinds.includes(kind)}
                                    onCheckedChange={() => toggleFocusKind(kind)}
                                    className="text-xs"
                                >
                                    {kind}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
