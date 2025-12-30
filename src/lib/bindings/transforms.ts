/**
 * Transform Functions
 * 
 * Functions that modify values during binding resolution.
 */

import type { Transform, TransformType } from './types';

// ============================================
// TRANSFORM REGISTRY
// ============================================

type TransformFn = (value: any, params?: Record<string, any>) => any;

const transformRegistry: Record<TransformType, TransformFn> = {
    none: (value) => value,

    // Numeric transforms
    multiply: (value, params) => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? value : num * (params?.value ?? 1);
    },

    add: (value, params) => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? value : num + (params?.value ?? 0);
    },

    subtract: (value, params) => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? value : num - (params?.value ?? 0);
    },

    divide: (value, params) => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        const divisor = params?.value ?? 1;
        if (divisor === 0) return value; // Prevent division by zero
        return isNaN(num) ? value : num / divisor;
    },

    round: (value, params) => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(num)) return value;
        const precision = params?.value ?? 0;
        const factor = Math.pow(10, precision);
        return Math.round(num * factor) / factor;
    },

    floor: (value) => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? value : Math.floor(num);
    },

    ceil: (value) => {
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? value : Math.ceil(num);
    },

    negate: (value) => {
        if (typeof value === 'boolean') return !value;
        const num = typeof value === 'number' ? value : parseFloat(value);
        return isNaN(num) ? value : -num;
    },

    // String transforms
    uppercase: (value) => {
        return typeof value === 'string' ? value.toUpperCase() : String(value).toUpperCase();
    },

    lowercase: (value) => {
        return typeof value === 'string' ? value.toLowerCase() : String(value).toLowerCase();
    },

    prefix: (value, params) => {
        const prefix = params?.text ?? '';
        return `${prefix}${value}`;
    },

    suffix: (value, params) => {
        const suffix = params?.text ?? '';
        return `${value}${suffix}`;
    },
};

// ============================================
// TRANSFORM EXECUTION
// ============================================

/**
 * Apply a transform to a value
 */
export function applyTransform(value: any, transform: Transform | undefined): any {
    if (!transform) return value;

    const fn = transformRegistry[transform.type];
    if (!fn) {
        console.warn(`[Transforms] Unknown transform type: ${transform.type}`);
        return value;
    }

    try {
        return fn(value, transform.params);
    } catch (error) {
        console.error(`[Transforms] Error applying transform ${transform.type}:`, error);
        return value;
    }
}

/**
 * Apply a chain of transforms to a value
 */
export function applyTransformChain(value: any, transforms: Transform[]): any {
    return transforms.reduce((v, t) => applyTransform(v, t), value);
}

/**
 * Validate that a transform can be applied to a given field type
 */
export function isTransformValidForType(
    transformType: TransformType,
    fieldType: string
): boolean {
    const numericTransforms: TransformType[] = [
        'multiply', 'add', 'subtract', 'divide', 'round', 'floor', 'ceil'
    ];

    const stringTransforms: TransformType[] = [
        'uppercase', 'lowercase', 'prefix', 'suffix'
    ];

    const numericFieldTypes = ['number', 'slider', 'counter', 'rating', 'progress'];
    const stringFieldTypes = ['text', 'rich-text'];

    if (numericTransforms.includes(transformType)) {
        return numericFieldTypes.includes(fieldType);
    }

    if (stringTransforms.includes(transformType)) {
        return stringFieldTypes.includes(fieldType);
    }

    // 'none' and 'negate' work on anything
    return true;
}

/**
 * Get available transforms for a given field type
 */
export function getAvailableTransforms(fieldType: string): TransformType[] {
    const base: TransformType[] = ['none', 'negate'];

    const numericFieldTypes = ['number', 'slider', 'counter', 'rating', 'progress'];
    const stringFieldTypes = ['text', 'rich-text'];

    if (numericFieldTypes.includes(fieldType)) {
        return [...base, 'multiply', 'add', 'subtract', 'divide', 'round', 'floor', 'ceil'];
    }

    if (stringFieldTypes.includes(fieldType)) {
        return [...base, 'uppercase', 'lowercase', 'prefix', 'suffix'];
    }

    return base;
}
