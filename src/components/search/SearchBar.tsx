// src/components/search/SearchBar.tsx

'use client';

import { useState } from 'react';
import { searchService } from '@/lib/db/search';
import type { SearchResult } from '@/lib/db/search';

export function SearchBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const results = await searchService.search({
                query,
                k: 20,
                mode: 'lexical', // Main search bar is ALWAYS lexical
            });
            setResults(results);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="search-bar">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search notes... (⚡ Fast keyword search)"
                className="search-input"
                style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid var(--border-color, #ccc)',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    marginBottom: '1rem'
                }}
            />

            {isSearching && <div className="spinner" />}

            {results.length > 0 && (
                <div className="search-results" style={{
                    marginTop: '1rem',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color, #ccc)',
                    borderRadius: '6px',
                    padding: '0.5rem'
                }}>
                    {results.map(result => (
                        <div key={result.node_id} className="search-result" style={{
                            padding: '0.75rem',
                            borderBottom: '1px solid var(--border-color, #eee)',
                            cursor: 'pointer'
                        }}>
                            <div className="result-title" style={{ fontWeight: 600 }}>{result.label}</div>
                            <div className="result-score" style={{ fontSize: '0.8rem', color: 'var(--accent-color, #007bff)' }}>
                                Score: {(result.score * 100).toFixed(1)}%
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
