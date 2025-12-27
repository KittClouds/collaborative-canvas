import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';

export interface SearchBarProps {
    onSearch: (query: string) => void;
    className?: string;
}

export default function SearchBar({ onSearch, className }: SearchBarProps) {
    const [value, setValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSearch(value);
        }
    };

    return (
        <div className={className}>
            <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search nodes..."
                    className="pl-8 h-9 bg-background/80 backdrop-blur w-64"
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        // Optional: live search
                        // onSearch(e.target.value); 
                    }}
                    onKeyDown={handleKeyDown}
                />
            </div>
        </div>
    );
}
