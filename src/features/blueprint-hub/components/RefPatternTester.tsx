/**
 * PatternTester - Test regex patterns against sample text
 */

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Code2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type PatternDefinition, PatternRegistry, RefParser, type Ref } from '@/lib/refs';

interface PatternTesterProps {
    pattern: PatternDefinition;
    onClose: () => void;
}

// Sample texts for different pattern types
const SAMPLE_TEXTS: Record<string, string> = {
    entity: `[CHARACTER|Jon Snow] is the protagonist of the story.
He knows [CHARACTER|Daenerys Targaryen] and [LOCATION|Winterfell].
[ITEM:WEAPON|Longclaw] is his sword.`,

    wikilink: `This connects to [[My Other Note]] and also to [[Projects/Secret Project|The Secret]].
Don't forget about [[Ideas]] for later.`,

    backlink: `Referenced from <<Previous Chapter>> and also <<Characters/Jon|Jon>>.`,

    tag: `This is #important and also #todo for later.
Remember to check #project-alpha.`,

    mention: `@alice worked on this with @bob.
Ask @charlie for review.`,

    triple: `[PERSON|Jon] ->KNOWS-> [PERSON|Arya]
[LOCATION|Winterfell] ->CONTAINS-> [BUILDING|Great Hall]`,

    temporal: `Two days later, he arrived. The next morning was cold.
Yesterday was better. Meanwhile, the others waited.`,

    custom: `Your custom pattern test text here.`,
};

export function PatternTester({ pattern, onClose }: PatternTesterProps) {
    const [testInput, setTestInput] = useState(SAMPLE_TEXTS[pattern.kind] || SAMPLE_TEXTS.custom);
    const [results, setResults] = useState<Ref[]>([]);
    const [tested, setTested] = useState(false);

    // Create a temporary registry with just this pattern
    const handleTest = () => {
        try {
            const tempRegistry = new PatternRegistry();
            tempRegistry.reset(); // Clear defaults
            // Re-register just this pattern
            tempRegistry.register({ ...pattern, enabled: true });

            const parser = new RefParser(tempRegistry);
            const refs = parser.parse(testInput, {
                noteId: 'test',
                fullText: testInput,
                position: 0,
            });

            setResults(refs);
            setTested(true);
        } catch (error) {
            console.error('Pattern test failed:', error);
            setResults([]);
            setTested(true);
        }
    };

    // Highlight matches in the text
    const highlightedText = useMemo(() => {
        if (!tested || results.length === 0) return testInput;

        // Sort by position descending so we can replace from end to start
        const sortedResults = [...results].sort((a, b) =>
            (b.positions[0]?.offset || 0) - (a.positions[0]?.offset || 0)
        );

        let highlighted = testInput;
        for (const ref of sortedResults) {
            const pos = ref.positions[0];
            if (!pos) continue;

            const before = highlighted.slice(0, pos.offset);
            const match = highlighted.slice(pos.offset, pos.offset + pos.length);
            const after = highlighted.slice(pos.offset + pos.length);

            highlighted = `${before}<mark class="bg-yellow-200 dark:bg-yellow-900">${match}</mark>${after}`;
        }

        return highlighted;
    }, [testInput, results, tested]);

    return (
        <div className="h-full flex flex-col bg-background animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center gap-3 p-4 border-b">
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Code2 className="h-5 w-5" />
                        Test Pattern: {pattern.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Enter test text to see how the pattern matches.
                    </p>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="grid grid-cols-2 gap-6 max-w-6xl mx-auto">
                    {/* Input */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Test Text</Label>
                            <Textarea
                                value={testInput}
                                onChange={(e) => {
                                    setTestInput(e.target.value);
                                    setTested(false);
                                }}
                                rows={12}
                                className="font-mono text-sm resize-none"
                                placeholder="Enter text to test the pattern..."
                            />
                        </div>

                        <div className="flex items-center gap-4">
                            <Button onClick={handleTest} size="lg" className="px-8">
                                Run Test
                            </Button>
                            {tested && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border">
                                    {results.length > 0 ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            <span className="text-sm font-medium text-green-600">
                                                Found {results.length} match{results.length !== 1 ? 'es' : ''}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="h-4 w-4 text-orange-600" />
                                            <span className="text-sm font-medium text-orange-600">No matches found</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Highlighted Output */}
                    <div className="space-y-2">
                        <Label>Matched Results</Label>
                        <div
                            className="p-4 border rounded-md min-h-[300px] bg-muted/20 font-mono text-sm whitespace-pre-wrap shadow-inner"
                            dangerouslySetInnerHTML={{ __html: highlightedText }}
                        />
                    </div>
                </div>

                <Separator className="my-8 max-w-6xl mx-auto" />

                {/* Results Table/List */}
                {tested && results.length > 0 && (
                    <div className="max-w-6xl mx-auto space-y-4 pb-8">
                        <div className="flex items-center justify-between">
                            <Label className="text-base">Match Details</Label>
                            <Badge variant="outline">{results.length} matches total</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {results.map((ref, i) => (
                                <div key={ref.id} className="p-4 border rounded-xl bg-card hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center p-0">
                                            {i + 1}
                                        </Badge>
                                        <Badge variant="secondary">{ref.kind}</Badge>
                                        <span className="font-semibold text-sm truncate">{ref.target}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                        <div className="flex justify-between">
                                            <span>Position:</span>
                                            <span className="font-mono">{ref.positions[0]?.offset} - {(ref.positions[0]?.offset || 0) + (ref.positions[0]?.length || 0)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Length:</span>
                                            <span className="font-mono">{ref.positions[0]?.length}</span>
                                        </div>
                                    </div>
                                    {ref.payload && typeof ref.payload === 'object' && Object.keys(ref.payload).length > 0 && (
                                        <div className="mt-3 pt-3 border-t">
                                            <details className="group">
                                                <summary className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer list-none flex items-center gap-1">
                                                    <span className="transition-transform group-open:rotate-90">▶</span>
                                                    Payload Data
                                                </summary>
                                                <pre className="text-[10px] mt-2 p-2 bg-muted/50 rounded-lg overflow-auto max-h-32 scrollbar-none">
                                                    {JSON.stringify(ref.payload, null, 2)}
                                                </pre>
                                            </details>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
