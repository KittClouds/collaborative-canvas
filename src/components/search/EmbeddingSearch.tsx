// src/components/search/EmbeddingSearch.tsx

'use client';

import { useState } from 'react';
import { searchService, SEARCH_MODES } from '@/lib/db/search';
import type { SearchResult } from '@/lib/db/search';
import styles from './EmbeddingSearch.module.css';

export function EmbeddingSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [mode, setMode] = useState<'semantic' | 'hybrid'>('semantic');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Advanced options
    const [model, setModel] = useState<'small' | 'medium'>('small');
    const [vectorWeight, setVectorWeight] = useState(0.4);
    const [graphWeight, setGraphWeight] = useState(0.4);
    const [lexicalWeight, setLexicalWeight] = useState(0.2);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const searchOptions: any = {
                query,
                k: 20,
                mode,
                semanticOptions: {
                    model,
                    threshold: 0.5,
                },
                ...(mode === 'hybrid' && {
                    hybridOptions: {
                        vectorWeight,
                        graphWeight,
                        lexicalWeight,
                        maxHops: 2,
                        boostConnected: true,
                    },
                }),
            };

            const results = await searchService.search(searchOptions);
            setResults(results);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const modeConfig = SEARCH_MODES[mode];

    return (
        <div className={styles.embeddingSearch}>
            <div className={styles.searchHeader}>
                <h3>Embedding Search</h3>

                {/* Mode Toggle */}
                <div className={styles.modeToggle}>
                    <button
                        className={mode === 'semantic' ? styles.active : ''}
                        onClick={() => setMode('semantic')}
                    >
                        {SEARCH_MODES.semantic.icon} Semantic
                    </button>
                    <button
                        className={mode === 'hybrid' ? styles.active : ''}
                        onClick={() => setMode('hybrid')}
                    >
                        {SEARCH_MODES.hybrid.icon} Hybrid
                    </button>
                </div>
            </div>

            {/* Mode Description */}
            <div className={styles.modeInfo}>
                <p>{modeConfig.description}</p>
            </div>

            {/* Search Input */}
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={`${modeConfig.icon} ${modeConfig.description}`}
                className={styles.searchInput}
            />

            {/* Advanced Options (Hybrid only) */}
            {mode === 'hybrid' && (
                <div className={styles.advancedOptions}>
                    <button
                        className={styles.toggleAdvanced}
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        ⚙️ {showAdvanced ? 'Hide' : 'Show'} Advanced
                    </button>

                    {showAdvanced && (
                        <div className={styles.weightControls}>
                            <div className={styles.weightSlider}>
                                <label>Vector Weight: {vectorWeight.toFixed(2)}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={vectorWeight}
                                    onChange={(e) => setVectorWeight(parseFloat(e.target.value))}
                                />
                            </div>

                            <div className={styles.weightSlider}>
                                <label>Graph Weight: {graphWeight.toFixed(2)}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={graphWeight}
                                    onChange={(e) => setGraphWeight(parseFloat(e.target.value))}
                                />
                            </div>

                            <div className={styles.weightSlider}>
                                <label>Lexical Weight: {lexicalWeight.toFixed(2)}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={lexicalWeight}
                                    onChange={(e) => setLexicalWeight(parseFloat(e.target.value))}
                                />
                            </div>

                            <div className={styles.modelSelect}>
                                <label>Model:</label>
                                <select value={model} onChange={(e) => setModel(e.target.value as any)}>
                                    <option value="small">Small (256d, fast)</option>
                                    <option value="medium">Medium (768d, accurate)</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <button
                onClick={handleSearch}
                disabled={isSearching}
                className={styles.searchButton}
            >
                {isSearching ? 'Searching...' : `Search ${mode}`}
            </button>

            {/* Results */}
            {results.length > 0 && (
                <div className={styles.searchResults}>
                    <div className={styles.resultsHeader}>
                        Found {results.length} results
                    </div>

                    {results.map(result => (
                        <div key={result.node_id} className={styles.searchResult}>
                            <div className={styles.resultHeader}>
                                <div className={styles.resultTitle}>{result.label}</div>
                                <div className={styles.resultBadge}>{result.source}</div>
                            </div>

                            <div className={styles.resultContent}>{result.content.slice(0, 150)}...</div>

                            <div className={styles.resultFooter}>
                                <span className={styles.resultScore}>
                                    {(result.score * 100).toFixed(1)}%
                                </span>

                                {mode === 'hybrid' && (result as any).metadata?.breakdown && (
                                    <div className={styles.scoreBreakdown}>
                                        <span>L: {((result as any).metadata.breakdown.lexical * 100).toFixed(0)}%</span>
                                        <span>V: {((result as any).metadata.breakdown.vector * 100).toFixed(0)}%</span>
                                        <span>G: {((result as any).metadata.breakdown.graph * 100).toFixed(0)}%</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
