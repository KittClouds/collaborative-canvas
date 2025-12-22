/**
 * Pattern Token Types
 * 
 * Defines the token-based pattern building system
 */

export type TokenType = 'prefix' | 'wrapper' | 'separator' | 'capture' | 'literal';

export type CaptureRole = 'kind' | 'label' | 'subtype' | 'attributes' | 'predicate' | 'target' | 'displayText';

export interface PatternToken {
    id: string;
    type: TokenType;
    value: string | [string, string]; // string for most, tuple for wrapper
    captureAs?: CaptureRole;
    optional?: boolean;
}

export interface TokenPatternDefinition {
    id: string;
    name: string;
    description?: string;
    kind: string;
    enabled: boolean;
    priority: number;
    tokens: PatternToken[];
    compiledPattern?: string;
    createdAt?: number;
    updatedAt?: number;
}

// Predefined capture patterns for each role
export const CAPTURE_PATTERNS: Record<CaptureRole, string> = {
    kind: '[A-Z_]+',
    label: '[^\\]|]+',
    subtype: '[A-Z_]+',
    attributes: '\\{[^}]+\\}',
    predicate: '[A-Z_]+',
    target: '[^\\]|>]+',
    displayText: '[^\\]|>]+',
};

// Wrapper mappings
export const WRAPPER_MAP: Record<string, [string, string]> = {
    'square': ['[', ']'],
    'curly': ['{', '}'],
    'round': ['(', ')'],
    'angle': ['<', '>'],
    'double-square': ['[[', ']]'],
    'double-angle': ['<<', '>>'],
};

// Escape special regex characters
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile tokens to a regex string
 */
export function compileTokensToRegex(tokens: PatternToken[]): string {
    let regex = '';
    let captureIndex = 0;

    for (const token of tokens) {
        let part = '';

        switch (token.type) {
            case 'prefix':
                part = escapeRegex(token.value as string);
                break;

            case 'wrapper':
                const [open, close] = token.value as [string, string];
                part = escapeRegex(open);
                // Note: wrapper close is handled at the end or by next tokens
                break;

            case 'separator':
                part = escapeRegex(token.value as string);
                break;

            case 'capture':
                const pattern = token.captureAs ? CAPTURE_PATTERNS[token.captureAs] || '.+' : '.+';
                part = `(${pattern})`;
                captureIndex++;
                break;

            case 'literal':
                part = escapeRegex(token.value as string);
                break;
        }

        if (token.optional) {
            part = `(?:${part})?`;
        }

        regex += part;
    }

    return regex;
}

/**
 * Extract captured data from a regex match based on tokens
 */
export function extractCapturedData(
    match: RegExpExecArray,
    tokens: PatternToken[]
): Record<string, string> {
    const result: Record<string, string> = {};
    let captureIndex = 1; // Match groups are 1-indexed

    for (const token of tokens) {
        if (token.type === 'capture' && token.captureAs) {
            if (match[captureIndex]) {
                result[token.captureAs] = match[captureIndex];
            }
            captureIndex++;
        }
    }

    return result;
}

/**
 * Render a human-readable example of the pattern
 */
export function renderPatternExample(tokens: PatternToken[]): string {
    let example = '';

    for (const token of tokens) {
        switch (token.type) {
            case 'prefix':
                example += token.value;
                break;
            case 'wrapper':
                const [open, close] = token.value as [string, string];
                example += open;
                break;
            case 'separator':
                example += token.value;
                break;
            case 'capture':
                example += `{${token.captureAs?.toUpperCase() || 'CAPTURE'}}`;
                break;
            case 'literal':
                example += token.value;
                break;
        }
    }

    // Close any open wrappers
    const wrappers = tokens.filter(t => t.type === 'wrapper');
    for (const wrapper of wrappers.reverse()) {
        const [, close] = wrapper.value as [string, string];
        example += close;
    }

    return example;
}
