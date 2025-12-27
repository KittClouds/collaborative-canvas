import React from 'react';
import { X, ExternalLink, Target } from 'lucide-react';
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";

interface NodeInfoPanelProps {
    nodeId: string;
    nodeData: any;
    onClose: () => void;
    onFocus?: () => void;
}

export default function NodeInfoPanel({ nodeId, nodeData, onClose, onFocus }: NodeInfoPanelProps) {
    if (!nodeData) return null;

    return (
        <div className="absolute right-4 top-16 bottom-20 w-80 bg-background/95 backdrop-blur border rounded-lg shadow-lg z-20 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b flex items-start justify-between bg-muted/30">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" style={{ borderColor: nodeData.color, color: nodeData.color }}>
                            {nodeData.type || 'UNKNOWN'}
                        </Badge>
                    </div>
                    <h3 className="font-bold text-lg leading-tight break-words">{nodeData.label}</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 -mt-2" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">

                    {/* Metadata Stats */}
                    {nodeData.metadata && (
                        <div className="grid grid-cols-2 gap-4">
                            {Object.entries(nodeData.metadata).map(([k, v]) => (
                                <div key={k} className="bg-muted/50 p-2 rounded text-center">
                                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">{k.replace('_', ' ')}</div>
                                    <div className="text-sm font-mono truncate" title={String(v)}>{String(v)}</div>
                                </div>
                            ))}
                            {nodeData.weight && (
                                <div className="bg-muted/50 p-2 rounded text-center">
                                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Weight</div>
                                    <div className="text-sm font-mono">{Number(nodeData.weight).toFixed(2)}</div>
                                </div>
                            )}
                        </div>
                    )}

                    <Separator />

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        <Button size="sm" variant="secondary" onClick={onFocus} className="w-full justify-start">
                            <Target className="h-4 w-4 mr-2" />
                            Focus on Node
                        </Button>
                        {/* Link to Editor - Placeholder until router integrated deeply */}
                        <Button size="sm" variant="outline" className="w-full justify-start">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open in Editor
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
