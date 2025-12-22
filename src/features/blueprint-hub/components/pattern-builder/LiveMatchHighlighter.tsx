/**
 * LiveMatchHighlighter - Real-time test results with match highlighting
 */

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { PatternToken } from './types';
import { compileTokensToRegex, extractCapturedData } from './types';

interface Match {
    start: number;
    end: number;
    text: string;
    captured: Record<string, string>;
}

interface LiveMatchHighlighterProps {
    tokens: PatternToken[];
    input: string;
}

export function LiveMatchHighlighter({ tokens, input }: LiveMatchHighlighterProps) {
    const [matches, setMatches] = useState<Match[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!input || tokens.length === 0) {
            setMatches([]);
            setError(null);
            return;
        }

        try {
            const compiled = compileTokensToRegex(tokens);
            if (!compiled) {
                setMatches([]);
                return;
            }

            const regex = new RegExp(compiled, 'g');
            const found: Match[] = [];

            let match;
            while ((match = regex.exec(input)) !== null) {
                // Prevent infinite loops with zero-length matches
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }

                found.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0],
                    captured: extractCapturedData(match, tokens),
                });
            }

            setMatches(found);
            setError(null);
        } catch (e) {
            console.error('Pattern test failed:', e);
            setError(e instanceof Error ? e.message : 'Pattern test failed');
            setMatches([]);
        }
    }, [tokens, input]);

    if (!input || tokens.length === 0) return null;

    if (error) {
        return (
            <div className="mt-3 p-4 border border-destructive/30 rounded-lg bg-destructive/5">
                <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Error</span>
                </div>
                <p className="text-xs text-destructive/80 mt-1">{error}</p>
            </div>
        );
    }

    if (matches.length === 0) {
        return (
            <div className="mt-3 p-4 border border-orange-500/30 rounded-lg bg-orange-500/5">
                <div className="flex items-center gap-2 text-orange-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">No matches found</span>
                </div>
                <p className="text-xs text-orange-600/80 mt-1">
                    Try adjusting your pattern or test text
                </p>
            </div>
        );
    }

    return (
        <div className="mt-3 p-4 border border-green-500/30 rounded-lg bg-green-500/5">
            <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">
                    {matches.length} match{matches.length !== 1 ? 'es' : ''} found
                </span>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {matches.map((match, i) => (
                    <div key={i} className="bg-background border rounded p-3">
                        <div className="font-mono text-sm mb-2 bg-green-500/10 p-2 rounded">
                            {match.text}
                        </div>
                        {Object.keys(match.captured).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(match.captured).map(([key, value]) => (
                                    <div key={key} className="flex items-center gap-1">
                                        <Badge variant="outline" className="text-[10px]">{key}</Badge>
                                        <span className="text-xs text-muted-foreground">{value}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
