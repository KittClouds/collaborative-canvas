/**
 * WikiPlaceholder Component
 * Generic placeholder for sections still in development.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
    Clock,
    Network,
    Image as ImageIcon,
    ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WIKI_SECTIONS, getSectionById } from '../types/wikiTypes';

// Icon map
const ICON_MAP: Record<string, React.ElementType> = {
    Clock,
    Network,
    Image: ImageIcon,
};

interface WikiPlaceholderProps {
    sectionId: string;
}

export function WikiPlaceholder({ sectionId }: WikiPlaceholderProps) {
    const section = getSectionById(sectionId);

    if (!section) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Section not found.</p>
            </div>
        );
    }

    const Icon = ICON_MAP[section.icon] || Clock;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="relative h-40 shrink-0 overflow-hidden">
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(135deg, ${section.color}30 0%, #0a0a0a 50%, #0a0a0a 100%)`
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end gap-4">
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${section.color}20` }}
                        >
                            <Icon className="h-6 w-6" style={{ color: section.color }} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">{section.label}</h1>
                            <p className="text-sm text-muted-foreground">{section.description}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Coming Soon Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div
                    className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
                    style={{ backgroundColor: `${section.color}10` }}
                >
                    <Icon className="h-12 w-12" style={{ color: `${section.color}40` }} />
                </div>

                <h2 className="text-xl font-semibold text-foreground mb-2">
                    Coming Soon
                </h2>

                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                    We're building something amazing here. The {section.label.toLowerCase()} feature
                    will help you {section.description.toLowerCase()}
                </p>

                <Button variant="outline" asChild>
                    <Link to="/wiki" className="gap-2">
                        Back to Wiki Home
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
        </div>
    );
}

// Specific placeholder exports
export function WikiTimelines() {
    return <WikiPlaceholder sectionId="timelines" />;
}

export function WikiRelationships() {
    return <WikiPlaceholder sectionId="relationships" />;
}

export function WikiMedia() {
    return <WikiPlaceholder sectionId="media" />;
}
