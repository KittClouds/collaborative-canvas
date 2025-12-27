import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
    tags: string[];
    onTagsChange: (tags: string[]) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

/**
 * TagInput - A component for entering multiple string tags (e.g., verb lemmas)
 * 
 * - Press Enter to add a tag
 * - Click X to remove a tag
 * - Tags are automatically lowercased and deduplicated
 */
export function TagInput({
    tags,
    onTagsChange,
    placeholder = 'Type and press Enter',
    className,
    disabled = false,
}: TagInputProps) {
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            const newTag = inputValue.trim().toLowerCase();
            if (!tags.includes(newTag)) {
                onTagsChange([...tags, newTag]);
            }
            setInputValue('');
        }

        // Allow Backspace to remove last tag when input is empty
        if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            onTagsChange(tags.slice(0, -1));
        }
    };

    const removeTag = (tag: string) => {
        onTagsChange(tags.filter(t => t !== tag));
    };

    return (
        <div className={cn('space-y-2', className)}>
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                        <Badge
                            key={tag}
                            variant="secondary"
                            className="gap-1 text-xs font-normal"
                        >
                            {tag}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    className="ml-0.5 hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                                    aria-label={`Remove ${tag}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </Badge>
                    ))}
                </div>
            )}
            <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                className="h-9"
            />
        </div>
    );
}

export default TagInput;
