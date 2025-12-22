/**
 * PatternTester - Test regex patterns against sample text
 */

import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Code2, CheckCircle2, XCircle } from 'lucide-react';
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
        <Dialog open onOpenChange={() => onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Code2 className="h-5 w-5" />
                        Test Pattern: {pattern.name}
                    </DialogTitle>
                    <DialogDescription>
                        Enter test text to see how the pattern matches.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4">
                    {/* Input */}
                    <div className="space-y-2">
                        <Label>Test Text</Label>
                        <Textarea
                            value={testInput}
                            onChange={(e) => {
                                setTestInput(e.target.value);
                                setTested(false);
                            }}
                            rows={10}
                            className="font-mono text-sm"
                            placeholder="Enter text to test the pattern..."
                        />
                    </div>

                    {/* Highlighted Output */}
                    <div className="space-y-2">
                        <Label>Matched Text</Label>
                        <div
                            className="p-3 border rounded-md min-h-[240px] bg-muted/30 font-mono text-sm whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: highlightedText }}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Button onClick={handleTest}>
                        Run Test
                    </Button>
                    {tested && (
                        <div className="flex items-center gap-2">
                            {results.length > 0 ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span className="text-sm text-green-600">
                                        Found {results.length} match{results.length !== 1 ? 'es' : ''}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-4 w-4 text-orange-600" />
                                    <span className="text-sm text-orange-600">No matches found</span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <Separator />

                {/* Results */}
                {tested && results.length > 0 && (
                    <div className="space-y-2">
                        <Label>Match Details</Label>
                        <ScrollArea className="h-[200px]">
                            <div className="space-y-2">
                                {results.map((ref, i) => (
                                    <div key={ref.id} className="p-3 border rounded-lg bg-card">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="outline">{i + 1}</Badge>
                                            <Badge>{ref.kind}</Badge>
                                            <span className="font-medium">{ref.target}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="font-medium">Position:</span>{' '}
                                                {ref.positions[0]?.offset} - {(ref.positions[0]?.offset || 0) + (ref.positions[0]?.length || 0)}
                                            </div>
                                            <div>
                                                <span className="font-medium">Length:</span> {ref.positions[0]?.length}
                                            </div>
                                        </div>
                                        {ref.payload && typeof ref.payload === 'object' && (
                                            <details className="mt-2">
                                                <summary className="text-xs text-muted-foreground cursor-pointer">
                                                    Payload
                                                </summary>
                                                <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto">
                                                    {JSON.stringify(ref.payload, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
