/**
 * ExplicitParser - Character-by-character parsing for structured patterns
 * 
 * Replaces regex capture groups with explicit scanning.
 * No backtracking, O(n) parsing with early exit on invalid syntax.
 */

export interface ParseResult {
    success: boolean;
    endIndex: number;       // Index after last character of match
    fullMatch: string;      // Complete matched text
    captures: Record<string, string>;
}

/**
 * Character scanning helpers
 */
function isUpperAlphaOrUnderscore(c: string): boolean {
    return (c >= 'A' && c <= 'Z') || c === '_';
}

function isWordChar(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9') || c === '_';
}

/**
 * ExplicitParser - Parses each pattern type without regex
 */
export class ExplicitParser {

    /**
     * Parse [KIND|Label] or [KIND:SUBTYPE|Label] or [KIND|Label|{attrs}]
     */
    parseEntity(text: string, start: number): ParseResult | null {
        if (text[start] !== '[') return null;

        let i = start + 1;
        const len = text.length;

        // Check if this might be a wikilink [[
        if (text[i] === '[') return null;

        // Parse KIND: must be [A-Z_]+
        const kindStart = i;
        while (i < len && isUpperAlphaOrUnderscore(text[i])) {
            i++;
        }

        if (i === kindStart) return null; // No KIND found
        const entityKind = text.slice(kindStart, i);

        // Check for optional SUBTYPE (:SUBTYPE)
        let subtype: string | undefined;
        if (text[i] === ':') {
            i++; // skip ':'
            const subtypeStart = i;
            while (i < len && isUpperAlphaOrUnderscore(text[i])) {
                i++;
            }
            if (i === subtypeStart) return null; // Empty subtype
            subtype = text.slice(subtypeStart, i);
        }

        // Must have pipe separator
        if (text[i] !== '|') return null;
        i++; // skip '|'

        // Parse LABEL: everything until '|' or ']' or '->'
        const labelStart = i;
        while (i < len && text[i] !== '|' && text[i] !== ']') {
            // Check for inline triple arrow
            if (text[i] === '-' && text[i + 1] === '>') {
                // This might be an inline triple, let parseInlineTriple handle it
                return null;
            }
            i++;
        }

        if (i === labelStart) return null; // Empty label
        const label = text.slice(labelStart, i).trim();

        // Check for optional attributes |{attrs}
        let attributes: string | undefined;
        if (text[i] === '|') {
            i++; // skip '|'

            if (text[i] !== '{') {
                // Not attributes, might be something else
                // For now, we'll fail - could extend to handle other pipes
                return null;
            }

            const attrStart = i;
            let braceDepth = 0;

            // Scan with brace-depth tracking
            while (i < len) {
                if (text[i] === '{') braceDepth++;
                else if (text[i] === '}') {
                    braceDepth--;
                    if (braceDepth === 0) {
                        i++; // include closing brace
                        break;
                    }
                }
                i++;
            }

            if (braceDepth !== 0) return null; // Unbalanced braces
            attributes = text.slice(attrStart, i);
        }

        // Must end with ]
        if (text[i] !== ']') return null;
        i++; // skip ']'

        const fullMatch = text.slice(start, i);
        const captures: Record<string, string> = {
            entityKind: entityKind.toUpperCase(),
            label: label.trim(),
        };

        if (subtype) {
            captures.subtype = subtype.toUpperCase();
        }
        if (attributes) {
            captures.attributes = attributes;
        }

        return {
            success: true,
            endIndex: i,
            fullMatch,
            captures,
        };
    }

    /**
     * Parse [[Target]] or [[Target|Display]]
     */
    parseWikilink(text: string, start: number): ParseResult | null {
        if (text[start] !== '[' || text[start + 1] !== '[') return null;

        let i = start + 2; // skip '[['
        const len = text.length;

        // Parse target: everything until '|' or ']]'
        const targetStart = i;
        while (i < len && text[i] !== '|' && !(text[i] === ']' && text[i + 1] === ']')) {
            i++;
        }

        if (i === targetStart) return null; // Empty target
        const target = text.slice(targetStart, i).trim();

        // Check for optional display text
        let displayText: string | undefined;
        if (text[i] === '|') {
            i++; // skip '|'
            const displayStart = i;
            while (i < len && !(text[i] === ']' && text[i + 1] === ']')) {
                i++;
            }
            displayText = text.slice(displayStart, i).trim();
        }

        // Must end with ]]
        if (text[i] !== ']' || text[i + 1] !== ']') return null;
        i += 2; // skip ']]'

        const fullMatch = text.slice(start, i);
        const captures: Record<string, string> = { target };
        if (displayText) {
            captures.displayText = displayText;
        }

        return {
            success: true,
            endIndex: i,
            fullMatch,
            captures,
        };
    }

    /**
     * Parse <<Target>> or <<Target|Display>>
     */
    parseBacklink(text: string, start: number): ParseResult | null {
        if (text[start] !== '<' || text[start + 1] !== '<') return null;

        let i = start + 2; // skip '<<'
        const len = text.length;

        // Parse target: everything until '|' or '>>'
        const targetStart = i;
        while (i < len && text[i] !== '|' && !(text[i] === '>' && text[i + 1] === '>')) {
            i++;
        }

        if (i === targetStart) return null; // Empty target
        const target = text.slice(targetStart, i).trim();

        // Check for optional display text
        let displayText: string | undefined;
        if (text[i] === '|') {
            i++; // skip '|'
            const displayStart = i;
            while (i < len && !(text[i] === '>' && text[i + 1] === '>')) {
                i++;
            }
            displayText = text.slice(displayStart, i).trim();
        }

        // Must end with >>
        if (text[i] !== '>' || text[i + 1] !== '>') return null;
        i += 2; // skip '>>'

        const fullMatch = text.slice(start, i);
        const captures: Record<string, string> = { target };
        if (displayText) {
            captures.displayText = displayText;
        }

        return {
            success: true,
            endIndex: i,
            fullMatch,
            captures,
        };
    }

    /**
     * Parse #tagname
     */
    parseTag(text: string, start: number): ParseResult | null {
        if (text[start] !== '#') return null;

        let i = start + 1; // skip '#'
        const len = text.length;

        // Tag name: \w+ (alphanumeric + underscore)
        const tagStart = i;
        while (i < len && isWordChar(text[i])) {
            i++;
        }

        if (i === tagStart) return null; // Empty tag name
        const tagName = text.slice(tagStart, i);

        const fullMatch = text.slice(start, i);

        return {
            success: true,
            endIndex: i,
            fullMatch,
            captures: { tagName },
        };
    }

    /**
     * Parse @username
     */
    parseMention(text: string, start: number): ParseResult | null {
        if (text[start] !== '@') return null;

        let i = start + 1; // skip '@'
        const len = text.length;

        // Username: \w+ (alphanumeric + underscore)
        const usernameStart = i;
        while (i < len && isWordChar(text[i])) {
            i++;
        }

        if (i === usernameStart) return null; // Empty username
        const username = text.slice(usernameStart, i);

        const fullMatch = text.slice(start, i);

        return {
            success: true,
            endIndex: i,
            fullMatch,
            captures: { username },
        };
    }

    /**
     * Parse [KIND|Label] ->PRED-> [KIND|Label]
     * Full triple pattern with two entities
     */
    parseTriple(text: string, start: number): ParseResult | null {
        // First, try to parse subject entity
        const subjectResult = this.parseEntity(text, start);
        if (!subjectResult) return null;

        let i = subjectResult.endIndex;
        const len = text.length;

        // Skip whitespace
        while (i < len && (text[i] === ' ' || text[i] === '\t')) {
            i++;
        }

        // Look for ->PRED->
        if (text[i] !== '-' || text[i + 1] !== '>') return null;
        i += 2; // skip '->'

        // Parse predicate: [A-Z_]+
        const predStart = i;
        while (i < len && isUpperAlphaOrUnderscore(text[i])) {
            i++;
        }
        if (i === predStart) return null;
        const predicate = text.slice(predStart, i);

        // Expect ->
        if (text[i] !== '-' || text[i + 1] !== '>') return null;
        i += 2; // skip '->'

        // Skip whitespace
        while (i < len && (text[i] === ' ' || text[i] === '\t')) {
            i++;
        }

        // Parse object entity
        const objectResult = this.parseEntity(text, i);
        if (!objectResult) return null;

        i = objectResult.endIndex;

        const fullMatch = text.slice(start, i);

        return {
            success: true,
            endIndex: i,
            fullMatch,
            captures: {
                subjectKind: subjectResult.captures.entityKind,
                subjectSubtype: subjectResult.captures.subtype || '',
                subjectLabel: subjectResult.captures.label,
                predicate: predicate.toUpperCase(),
                objectKind: objectResult.captures.entityKind,
                objectSubtype: objectResult.captures.subtype || '',
                objectLabel: objectResult.captures.label,
            },
        };
    }

    /**
     * Parse [KIND|Label->PRED->Target]
     * Inline/compact triple pattern
     */
    parseInlineTriple(text: string, start: number): ParseResult | null {
        if (text[start] !== '[') return null;

        let i = start + 1;
        const len = text.length;

        // Check not a wikilink
        if (text[i] === '[') return null;

        // Parse KIND
        const kindStart = i;
        while (i < len && isUpperAlphaOrUnderscore(text[i])) {
            i++;
        }
        if (i === kindStart) return null;
        const subjectKind = text.slice(kindStart, i);

        // Optional subtype
        let subjectSubtype = '';
        if (text[i] === ':') {
            i++;
            const subtypeStart = i;
            while (i < len && isUpperAlphaOrUnderscore(text[i])) {
                i++;
            }
            if (i === subtypeStart) return null;
            subjectSubtype = text.slice(subtypeStart, i);
        }

        // Pipe separator
        if (text[i] !== '|') return null;
        i++;

        // Parse subject label until ->
        const labelStart = i;
        while (i < len && !(text[i] === '-' && text[i + 1] === '>')) {
            if (text[i] === ']') return null; // Hit end without finding arrow
            i++;
        }
        if (i === labelStart) return null;
        const subjectLabel = text.slice(labelStart, i).trim();

        // Skip ->
        if (text[i] !== '-' || text[i + 1] !== '>') return null;
        i += 2;

        // Parse predicate
        const predStart = i;
        while (i < len && isUpperAlphaOrUnderscore(text[i])) {
            i++;
        }
        if (i === predStart) return null;
        const predicate = text.slice(predStart, i);

        // Expect ->
        if (text[i] !== '-' || text[i + 1] !== '>') return null;
        i += 2;

        // Parse object label until ]
        const objStart = i;
        while (i < len && text[i] !== ']') {
            i++;
        }
        if (i === objStart) return null;
        const objectLabel = text.slice(objStart, i).trim();

        // Must end with ]
        if (text[i] !== ']') return null;
        i++;

        const fullMatch = text.slice(start, i);

        return {
            success: true,
            endIndex: i,
            fullMatch,
            captures: {
                subjectKind: subjectKind.toUpperCase(),
                subjectSubtype: subjectSubtype.toUpperCase(),
                subjectLabel,
                predicate: predicate.toUpperCase(),
                objectLabel,
            },
        };
    }
}

// Singleton instance
export const explicitParser = new ExplicitParser();
