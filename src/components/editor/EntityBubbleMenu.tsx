import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { 
  User, MapPin, Users, Package, Shield, 
  Clapperboard, Calendar, Lightbulb, X,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { EntityKind, ENTITY_COLORS } from '@/lib/entities/entityTypes';

interface EntityBubbleMenuProps {
  editor: Editor;
}

const ENTITY_ICONS: Record<EntityKind, React.ElementType> = {
  CHARACTER: User,
  LOCATION: MapPin,
  NPC: Users,
  ITEM: Package,
  FACTION: Shield,
  SCENE: Clapperboard,
  EVENT: Calendar,
  CONCEPT: Lightbulb,
};

const ENTITY_LABELS: Record<EntityKind, string> = {
  CHARACTER: 'Character',
  LOCATION: 'Location',
  NPC: 'NPC',
  ITEM: 'Item',
  FACTION: 'Faction',
  SCENE: 'Scene',
  EVENT: 'Event',
  CONCEPT: 'Concept',
};

export function EntityBubbleMenu({ editor }: EntityBubbleMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!editor) return;
    
    const { from, to, empty } = editor.state.selection;
    
    // Only show for non-empty selections
    if (empty || from === to) {
      setIsVisible(false);
      return;
    }

    const view = editor.view;
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);

    // Calculate center position above selection
    const centerX = (start.left + end.right) / 2;
    const top = start.top - 50; // 50px above the selection

    setPosition({
      top: Math.max(10, top),
      left: centerX,
    });
    setIsVisible(true);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      updatePosition();
    };

    const handleBlur = () => {
      // Small delay to allow dropdown clicks
      setTimeout(() => {
        if (!menuRef.current?.contains(document.activeElement)) {
          setIsVisible(false);
        }
      }, 150);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('blur', handleBlur);
    };
  }, [editor, updatePosition]);

  if (!editor || !isVisible) return null;

  const handleSetEntity = (kind: EntityKind) => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '');
    
    editor.chain().focus().setMark('entity', { kind, label: selectedText }).run();
    setIsOpen(false);
  };

  const handleRemoveEntity = () => {
    editor.chain().focus().unsetMark('entity').run();
    setIsOpen(false);
  };

  const hasEntityMark = editor.isActive('entity');
  const activeKind = hasEntityMark ? editor.getAttributes('entity').kind as EntityKind : null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 flex items-center gap-1 p-1.5 bg-popover border border-border rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Standard formatting buttons */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-accent text-accent-foreground' : ''}`}
      >
        <span className="font-bold text-sm">B</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-accent text-accent-foreground' : ''}`}
      >
        <span className="italic text-sm">I</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`h-8 w-8 p-0 ${editor.isActive('strike') ? 'bg-accent text-accent-foreground' : ''}`}
      >
        <span className="line-through text-sm">S</span>
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Entity Dropdown */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-2 gap-1 ${hasEntityMark ? 'bg-accent text-accent-foreground' : ''}`}
          >
            {activeKind ? (
              <>
                {React.createElement(ENTITY_ICONS[activeKind], { 
                  className: 'h-4 w-4',
                  style: { color: ENTITY_COLORS[activeKind] }
                })}
                <span className="text-xs">{ENTITY_LABELS[activeKind]}</span>
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4" />
                <span className="text-xs">Entity</span>
              </>
            )}
            <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-48 bg-popover border-border z-[100]"
          sideOffset={8}
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Mark as Entity
          </div>
          <DropdownMenuSeparator />
          
          {(Object.keys(ENTITY_ICONS) as EntityKind[]).map((kind) => {
            const Icon = ENTITY_ICONS[kind];
            const color = ENTITY_COLORS[kind];
            const isActive = activeKind === kind;
            
            return (
              <DropdownMenuItem
                key={kind}
                onClick={() => handleSetEntity(kind)}
                className={`flex items-center gap-2 cursor-pointer ${isActive ? 'bg-accent' : ''}`}
              >
                <Icon 
                  className="h-4 w-4" 
                  style={{ color }}
                />
                <span className="flex-1">{ENTITY_LABELS[kind]}</span>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
              </DropdownMenuItem>
            );
          })}

          {hasEntityMark && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleRemoveEntity}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <X className="h-4 w-4 mr-2" />
                Remove Entity
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
