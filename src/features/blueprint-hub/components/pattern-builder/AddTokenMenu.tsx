/**
 * AddTokenMenu - Unified grid showing all token options at once
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateId } from '@/lib/utils/ids';
import type { PatternToken, CaptureRole } from './types';
import { CAPTURE_PATTERNS, WRAPPER_MAP } from './types';

interface AddTokenMenuProps {
    onAdd: (token: PatternToken) => void;
    onAddMultiple: (tokens: PatternToken[]) => void;
    onClose: () => void;
}

interface TokenButtonProps {
    icon: React.ReactNode;
    label: string;
    description: string;
    variant?: 'default' | 'primary' | 'secondary';
    onClick: () => void;
}

function TokenButton({ icon, label, description, variant = 'default', onClick }: TokenButtonProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all hover:scale-105',
                variant === 'primary' && 'border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary',
                variant === 'secondary' && 'border-muted-foreground/20 bg-muted/50 hover:bg-muted',
                variant === 'default' && 'border-border hover:border-foreground/30 hover:bg-muted/50'
            )}
        >
            <div className="mb-1">{icon}</div>
            <div className="text-xs font-semibold">{label}</div>
            <div className="text-[10px] text-muted-foreground text-center">{description}</div>
        </button>
    );
}

export function AddTokenMenu({ onAdd, onAddMultiple, onClose }: AddTokenMenuProps) {
    const addPrefix = (value: string) => {
        onAdd({ id: generateId(), type: 'prefix', value });
    };

    const addWrapper = (key: string) => {
        onAdd({ id: generateId(), type: 'wrapper', value: WRAPPER_MAP[key] });
    };

    const addSeparator = (value: string) => {
        onAdd({ id: generateId(), type: 'separator', value });
    };

    const addCapture = (captureAs: CaptureRole, optional = false) => {
        onAdd({
            id: generateId(),
            type: 'capture',
            value: CAPTURE_PATTERNS[captureAs] || '.+',
            captureAs,
            optional,
        });
    };

    const addLiteral = () => {
        const text = prompt('Enter fixed text:');
        if (text) {
            onAdd({ id: generateId(), type: 'literal', value: text });
        }
    };

    // Quick templates that add multiple tokens at once
    const addEntityTemplate = () => {
        onAddMultiple([
            { id: generateId(), type: 'wrapper', value: ['[', ']'] },
            { id: generateId(), type: 'capture', value: '[A-Z_]+', captureAs: 'kind' },
            { id: generateId(), type: 'separator', value: '|' },
            { id: generateId(), type: 'capture', value: '[^\\]|]+', captureAs: 'label' },
        ]);
    };

    const addHashtagEntityTemplate = () => {
        onAddMultiple([
            { id: generateId(), type: 'prefix', value: '#' },
            { id: generateId(), type: 'capture', value: '[A-Z_]+', captureAs: 'kind' },
            { id: generateId(), type: 'separator', value: '|' },
            { id: generateId(), type: 'capture', value: '[^\\s|]+', captureAs: 'label' },
        ]);
    };

    const addWikilinkTemplate = () => {
        onAddMultiple([
            { id: generateId(), type: 'wrapper', value: ['[[', ']]'] },
            { id: generateId(), type: 'capture', value: '[^\\]|]+', captureAs: 'label' },
        ]);
    };

    const addSimpleTagTemplate = () => {
        onAddMultiple([
            { id: generateId(), type: 'prefix', value: '#' },
            { id: generateId(), type: 'capture', value: '\\w+', captureAs: 'label' },
        ]);
    };

    return (
        <div className="p-4">
            <div className="text-sm font-semibold mb-3 text-muted-foreground">
                Choose a token type
            </div>

            {/* MAIN GRID: All options visible */}
            <div className="grid grid-cols-6 gap-2">
                {/* PREFIXES */}
                <TokenButton
                    icon={<span className="text-2xl font-bold">#</span>}
                    label="Hashtag"
                    description="# prefix"
                    onClick={() => addPrefix('#')}
                />
                <TokenButton
                    icon={<span className="text-2xl font-bold">@</span>}
                    label="At Sign"
                    description="@ prefix"
                    onClick={() => addPrefix('@')}
                />
                <TokenButton
                    icon={<span className="text-2xl font-bold">$</span>}
                    label="Dollar"
                    description="$ prefix"
                    onClick={() => addPrefix('$')}
                />
                <TokenButton
                    icon={<span className="text-2xl font-bold">%</span>}
                    label="Percent"
                    description="% prefix"
                    onClick={() => addPrefix('%')}
                />
                <TokenButton
                    icon={<span className="text-2xl font-bold">~</span>}
                    label="Tilde"
                    description="~ prefix"
                    onClick={() => addPrefix('~')}
                />
                <TokenButton
                    icon={<span className="text-2xl font-bold">*</span>}
                    label="Asterisk"
                    description="* prefix"
                    onClick={() => addPrefix('*')}
                />

                {/* WRAPPERS */}
                <TokenButton
                    icon={<span className="text-xl font-mono">[ ]</span>}
                    label="Square"
                    description="[content]"
                    onClick={() => addWrapper('square')}
                />
                <TokenButton
                    icon={<span className="text-xl font-mono">{`{ }`}</span>}
                    label="Curly"
                    description="{content}"
                    onClick={() => addWrapper('curly')}
                />
                <TokenButton
                    icon={<span className="text-xl font-mono">( )</span>}
                    label="Round"
                    description="(content)"
                    onClick={() => addWrapper('round')}
                />
                <TokenButton
                    icon={<span className="text-xl font-mono">&lt; &gt;</span>}
                    label="Angle"
                    description="<content>"
                    onClick={() => addWrapper('angle')}
                />
                <TokenButton
                    icon={<span className="text-xl font-mono">[[ ]]</span>}
                    label="Double Square"
                    description="[[wikilink]]"
                    onClick={() => addWrapper('double-square')}
                />
                <TokenButton
                    icon={<span className="text-xl font-mono">&lt;&lt; &gt;&gt;</span>}
                    label="Double Angle"
                    description="<<backlink>>"
                    onClick={() => addWrapper('double-angle')}
                />

                {/* SEPARATORS */}
                <TokenButton
                    icon={<span className="text-2xl font-mono">|</span>}
                    label="Pipe"
                    description="| separator"
                    onClick={() => addSeparator('|')}
                />
                <TokenButton
                    icon={<span className="text-2xl font-mono">-</span>}
                    label="Dash"
                    description="- separator"
                    onClick={() => addSeparator('-')}
                />
                <TokenButton
                    icon={<span className="text-2xl font-mono">_</span>}
                    label="Underscore"
                    description="_ separator"
                    onClick={() => addSeparator('_')}
                />
                <TokenButton
                    icon={<span className="text-2xl font-mono">.</span>}
                    label="Dot"
                    description=". separator"
                    onClick={() => addSeparator('.')}
                />
                <TokenButton
                    icon={<span className="text-2xl font-mono">:</span>}
                    label="Colon"
                    description=": separator"
                    onClick={() => addSeparator(':')}
                />
                <TokenButton
                    icon={<span className="text-xl font-mono">::</span>}
                    label="Double Colon"
                    description=":: separator"
                    onClick={() => addSeparator('::')}
                />
                <TokenButton
                    icon={<span className="text-xl font-mono">-&gt;</span>}
                    label="Arrow"
                    description="-> separator"
                    onClick={() => addSeparator('->')}
                />
                <TokenButton
                    icon={<span className="text-xl font-mono">=&gt;</span>}
                    label="Fat Arrow"
                    description="=> separator"
                    onClick={() => addSeparator('=>')}
                />

                {/* CAPTURES */}
                <TokenButton
                    icon={<Badge className="text-xs">KIND</Badge>}
                    label="Entity Type"
                    description="CHARACTER, LOCATION"
                    variant="primary"
                    onClick={() => addCapture('kind')}
                />
                <TokenButton
                    icon={<Badge className="text-xs">LABEL</Badge>}
                    label="Content"
                    description="Any text"
                    variant="primary"
                    onClick={() => addCapture('label')}
                />
                <TokenButton
                    icon={<Badge className="text-xs">SUB</Badge>}
                    label="Subtype"
                    description="Optional type"
                    variant="primary"
                    onClick={() => addCapture('subtype', true)}
                />
                <TokenButton
                    icon={<Badge className="text-xs">ATTR</Badge>}
                    label="Attributes"
                    description="JSON metadata"
                    variant="primary"
                    onClick={() => addCapture('attributes', true)}
                />

                {/* LITERAL */}
                <TokenButton
                    icon={<Type className="h-5 w-5" />}
                    label="Fixed Text"
                    description="Custom literal"
                    variant="secondary"
                    onClick={addLiteral}
                />
            </div>

            {/* QUICK TEMPLATES */}
            <div className="mt-4 pt-4 border-t">
                <div className="text-sm font-semibold mb-3 text-muted-foreground">
                    Or start with a template
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={addEntityTemplate}
                    >
                        <div className="text-left">
                            <div className="font-semibold">Entity Bracket</div>
                            <div className="text-xs text-muted-foreground font-mono">[KIND|Label]</div>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={addHashtagEntityTemplate}
                    >
                        <div className="text-left">
                            <div className="font-semibold">Hashtag Entity</div>
                            <div className="text-xs text-muted-foreground font-mono">#KIND|Label</div>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={addWikilinkTemplate}
                    >
                        <div className="text-left">
                            <div className="font-semibold">Wikilink</div>
                            <div className="text-xs text-muted-foreground font-mono">[[Page Title]]</div>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={addSimpleTagTemplate}
                    >
                        <div className="text-left">
                            <div className="font-semibold">Simple Tag</div>
                            <div className="text-xs text-muted-foreground font-mono">#tag</div>
                        </div>
                    </Button>
                </div>
            </div>
        </div>
    );
}
