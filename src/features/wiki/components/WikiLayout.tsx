/**
 * WikiLayout Component
 * The main shell for the Wiki feature with sidebar navigation and content area.
 * Phase 2A: Added new sections (Worldbuilding, Story Beats, Timelines, Relationships, Media Gallery)
 */
import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    Home,
    User,
    Flag,
    MapPin,
    Package,
    BookOpen,
    FileText,
    Search,
    Command,
    Globe,
    Clapperboard,
    Clock,
    Network,
    Image as ImageIcon,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { WIKI_CATEGORIES, WIKI_SECTIONS } from '../types/wikiTypes';

// Icon map for dynamic rendering
const ICON_MAP: Record<string, React.ElementType> = {
    User,
    Flag,
    MapPin,
    Package,
    BookOpen,
    FileText,
    Globe,
    Clapperboard,
    Clock,
    Network,
    Image: ImageIcon,
};

export function WikiLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const handleBackToEditor = () => {
        navigate('/');
    };

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Wiki Sidebar */}
            <aside className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0">
                {/* Sidebar Header */}
                <div className="h-14 border-b border-border flex items-center gap-3 px-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={handleBackToEditor}
                        title="Back to Editor"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-lg">Story Wiki</span>
                </div>

                {/* Navigation */}
                <ScrollArea className="flex-1">
                    <nav className="py-4 px-3 space-y-1">
                        {/* Home */}
                        <NavLink
                            to="/wiki"
                            end
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                        >
                            <Home className="h-4 w-4" />
                            <span>Home</span>
                        </NavLink>

                        {/* Collections Section */}
                        <div className="pt-5">
                            <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Collections
                            </p>
                            {WIKI_CATEGORIES.map(category => {
                                const Icon = ICON_MAP[category.icon] || FileText;
                                return (
                                    <NavLink
                                        key={category.id}
                                        to={`/wiki/collections/${category.id}`}
                                        className={({ isActive }) => cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group",
                                            isActive
                                                ? "bg-accent text-accent-foreground"
                                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" style={{ color: category.color }} />
                                        <span className="flex-1">{category.pluralLabel}</span>
                                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                    </NavLink>
                                );
                            })}
                        </div>

                        {/* Special Sections */}
                        <div className="pt-5">
                            <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Tools
                            </p>
                            {WIKI_SECTIONS.map(section => {
                                const Icon = ICON_MAP[section.icon] || FileText;
                                const isActive = location.pathname.startsWith(section.href);
                                return (
                                    <NavLink
                                        key={section.id}
                                        to={section.href}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group",
                                            isActive
                                                ? "bg-accent text-accent-foreground"
                                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" style={{ color: section.color }} />
                                        <span className="flex-1">{section.label}</span>
                                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                    </NavLink>
                                );
                            })}
                        </div>
                    </nav>
                </ScrollArea>

                {/* Sidebar Footer */}
                <div className="p-3 border-t border-border">
                    <Button variant="outline" className="w-full gap-2 text-muted-foreground h-9">
                        <Search className="h-4 w-4" />
                        <span className="flex-1 text-left text-sm">Quick search...</span>
                        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            <Command className="h-3 w-3" />K
                        </kbd>
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}

export default WikiLayout;
