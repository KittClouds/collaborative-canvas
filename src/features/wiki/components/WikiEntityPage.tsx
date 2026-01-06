/**
 * WikiEntityPage Component
 * Detailed view for a single entity with tabs for Overview, Facts, Relationships, etc.
 */
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft,
    FileText,
    Info,
    Link2,
    Image as ImageIcon,
    AtSign,
    User,
    Flag,
    MapPin,
    Package,
    BookOpen,
    Edit,
    ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useWikiData } from '../hooks/useWikiData';
import { getCategoryByKind } from '../types/wikiTypes';
import { getDisplayName } from '@/lib/utils/titleParser';

// Icon map
const ICON_MAP: Record<string, React.ElementType> = {
    User,
    Flag,
    MapPin,
    Package,
    BookOpen,
    FileText,
};

type EntityTab = 'overview' | 'facts' | 'relationships' | 'media' | 'mentions';

export function WikiEntityPage() {
    const { entityId } = useParams<{ entityId: string }>();
    const navigate = useNavigate();
    const { getEntityById } = useWikiData();
    const [activeTab, setActiveTab] = useState<EntityTab>('overview');

    const entity = getEntityById(entityId || '');
    const category = entity?.entityKind ? getCategoryByKind(entity.entityKind) : undefined;
    const Icon = category ? (ICON_MAP[category.icon] || FileText) : FileText;
    const displayName = entity ? getDisplayName(entity.title) : 'Unknown';

    if (!entity) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <FileText className="h-16 w-16 text-muted-foreground/30" />
                <p className="text-muted-foreground">Entity not found.</p>
                <Button variant="outline" onClick={() => navigate('/wiki')}>
                    Back to Wiki
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header with Cover */}
            <div className="relative shrink-0">
                {/* Cover Gradient */}
                <div
                    className="h-32 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900"
                    style={{
                        background: category
                            ? `linear-gradient(135deg, ${category.color}30 0%, ${category.color}05 50%, transparent 100%), linear-gradient(to br, #0f172a, #134e4a)`
                            : undefined
                    }}
                />

                {/* Back Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 left-4 h-8 w-8 bg-background/50 backdrop-blur hover:bg-background/80"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>

                {/* Entity Info Card */}
                <div className="absolute -bottom-12 left-6 flex items-end gap-4">
                    {/* Avatar */}
                    <div
                        className="w-24 h-24 rounded-xl border-4 border-background bg-card flex items-center justify-center text-2xl font-bold shadow-lg"
                        style={{ color: category?.color }}
                    >
                        {displayName.charAt(0).toUpperCase()}
                    </div>

                    {/* Name & Badge */}
                    <div className="mb-2">
                        <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            {category && (
                                <Badge
                                    variant="outline"
                                    style={{ borderColor: category.color, color: category.color }}
                                >
                                    <Icon className="h-3 w-3 mr-1" />
                                    {category.label}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Edit Button */}
                <div className="absolute bottom-4 right-6">
                    <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <Link to="/" onClick={() => {
                            // TODO: Navigate to editor with this note selected
                        }}>
                            <Edit className="h-3.5 w-3.5" />
                            Edit in Editor
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Spacer for overlapping card */}
            <div className="h-14 shrink-0" />

            {/* Tabs */}
            <div className="border-b border-border px-6 shrink-0">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EntityTab)}>
                    <TabsList className="h-10 bg-transparent border-none p-0 gap-4">
                        <TabsTrigger
                            value="overview"
                            className="h-10 px-1 pb-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            <Info className="h-4 w-4 mr-1.5" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger
                            value="facts"
                            className="h-10 px-1 pb-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            <FileText className="h-4 w-4 mr-1.5" />
                            Facts
                        </TabsTrigger>
                        <TabsTrigger
                            value="relationships"
                            className="h-10 px-1 pb-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            <Link2 className="h-4 w-4 mr-1.5" />
                            Relationships
                        </TabsTrigger>
                        <TabsTrigger
                            value="media"
                            className="h-10 px-1 pb-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            <ImageIcon className="h-4 w-4 mr-1.5" />
                            Media
                        </TabsTrigger>
                        <TabsTrigger
                            value="mentions"
                            className="h-10 px-1 pb-0 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            <AtSign className="h-4 w-4 mr-1.5" />
                            Mentions
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Tab Content */}
            <ScrollArea className="flex-1">
                <div className="p-6">
                    {activeTab === 'overview' && (
                        <div className="prose prose-invert max-w-none">
                            {entity.content ? (
                                <div className="text-sm text-foreground whitespace-pre-wrap">
                                    {entity.content.replace(/<[^>]*>/g, '')}
                                </div>
                            ) : (
                                <p className="text-muted-foreground italic">
                                    No content yet. Edit this entity in the editor to add details.
                                </p>
                            )}
                        </div>
                    )}

                    {activeTab === 'facts' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Fact sheets will display structured metadata here.
                            </p>
                            {/* Placeholder for fact sheet data */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg border border-border bg-card/50">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Type</p>
                                    <p className="font-medium">{entity.entityKind || 'Unknown'}</p>
                                </div>
                                <div className="p-4 rounded-lg border border-border bg-card/50">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                                    <p className="font-medium">
                                        {new Date(entity.created_at || entity.createdAt || 0).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'relationships' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Relationship data will be displayed here once extracted from note content.
                            </p>
                        </div>
                    )}

                    {activeTab === 'media' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Media gallery for images and attachments.
                            </p>
                        </div>
                    )}

                    {activeTab === 'mentions' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Backlinks and mentions will be listed here.
                            </p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

export default WikiEntityPage;
