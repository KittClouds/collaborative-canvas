/**
 * Aggregation Functions
 * 
 * Functions for combining values from multiple entities.
 */

import type { AggregationFunction } from './types';

// ============================================
// AGGREGATION REGISTRY
// ============================================

type AggregationFn = (values: any[]) => any;

const aggregationRegistry: Record<AggregationFunction, AggregationFn> = {
    sum: (values) => {
        const nums = values
            .map(v => typeof v === 'number' ? v : parseFloat(v))
            .filter(n => !isNaN(n));
        return nums.reduce((acc, n) => acc + n, 0);
    },

    avg: (values) => {
        const nums = values
            .map(v => typeof v === 'number' ? v : parseFloat(v))
            .filter(n => !isNaN(n));
        if (nums.length === 0) return 0;
        return nums.reduce((acc, n) => acc + n, 0) / nums.length;
    },

    count: (values) => {
        return values.filter(v => v !== null && v !== undefined).length;
    },

    min: (values) => {
        const nums = values
            .map(v => typeof v === 'number' ? v : parseFloat(v))
            .filter(n => !isNaN(n));
        if (nums.length === 0) return null;
        return Math.min(...nums);
    },

    max: (values) => {
        const nums = values
            .map(v => typeof v === 'number' ? v : parseFloat(v))
            .filter(n => !isNaN(n));
        if (nums.length === 0) return null;
        return Math.max(...nums);
    },

    concat: (values) => {
        return values
            .filter(v => v !== null && v !== undefined)
            .map(v => String(v))
            .join(', ');
    },
};

// ============================================
// AGGREGATION EXECUTION
// ============================================

/**
 * Apply an aggregation function to a list of values
 */
export function applyAggregation(
    values: any[],
    fn: AggregationFunction
): any {
    const aggregator = aggregationRegistry[fn];
    if (!aggregator) {
        console.warn(`[Aggregations] Unknown aggregation function: ${fn}`);
        return null;
    }

    try {
        return aggregator(values);
    } catch (error) {
        console.error(`[Aggregations] Error applying aggregation ${fn}:`, error);
        return null;
    }
}

/**
 * Check if an aggregation function is valid for a given field type
 */
export function isAggregationValidForType(
    fn: AggregationFunction,
    fieldType: string
): boolean {
    const numericFunctions: AggregationFunction[] = ['sum', 'avg', 'min', 'max'];
    const numericFieldTypes = ['number', 'slider', 'counter', 'rating', 'progress'];

    if (numericFunctions.includes(fn)) {
        return numericFieldTypes.includes(fieldType);
    }

    // count and concat work on anything
    return true;
}

/**
 * Get available aggregation functions for a given field type
 */
export function getAvailableAggregations(fieldType: string): AggregationFunction[] {
    const base: AggregationFunction[] = ['count', 'concat'];

    const numericFieldTypes = ['number', 'slider', 'counter', 'rating', 'progress'];

    if (numericFieldTypes.includes(fieldType)) {
        return ['sum', 'avg', 'min', 'max', ...base];
    }

    return base;
}

/**
 * Get a human-readable description for an aggregation function
 */
export function getAggregationDescription(fn: AggregationFunction): string {
    const descriptions: Record<AggregationFunction, string> = {
        sum: 'Sum of all values',
        avg: 'Average of all values',
        count: 'Count of non-empty values',
        min: 'Minimum value',
        max: 'Maximum value',
        concat: 'All values joined as text',
    };
    return descriptions[fn] || fn;
}
