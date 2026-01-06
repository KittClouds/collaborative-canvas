/**
 * WikiRelationships Placeholder
 * Skipped for Phase 2C - needs narrative-focused design, not another graph.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Network, ArrowLeft, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export function WikiRelationships() {
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="relative h-40 shrink-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-slate-900 to-slate-800" />
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)',
                        backgroundSize: '30px 30px'
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Network className="h-6 w-6 text-purple-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Relationships</h1>
                            <p className="text-sm text-muted-foreground">
                                Narrative connections between characters
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
                        <Lightbulb className="h-10 w-10 text-purple-500/40" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                        Coming Soon
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-md mb-6">
                        Relationships will show narrative connections between characters —
                        allies, enemies, family ties, and story arcs that bind them together.
                        <br /><br />
                        <span className="text-purple-400">
                            This is not another graph view — it's story-first.
                        </span>
                    </p>
                    <Link to="/wiki">
                        <Button variant="outline" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Wiki
                        </Button>
                    </Link>
                </div>
            </ScrollArea>
        </div>
    );
}

export default WikiRelationships;
