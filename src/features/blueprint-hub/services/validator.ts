// Blueprint Entity Validator Service
import type { FieldDef, CompiledEntityType } from '../types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates entity data against its entity type definition
 */
export function validateEntity(
  entityType: CompiledEntityType,
  data: Record<string, any>
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const field of entityType.fields) {
    const value = data[field.field_name];
    const fieldErrors = validateField(field, value);
    
    if (fieldErrors.length > 0) {
      errors[field.field_name] = fieldErrors[0]; // Take first error
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates a single field value
 */
function validateField(field: FieldDef, value: any): string[] {
  const errors: string[] = [];

  // Required field validation
  if (field.is_required && (value === null || value === undefined || value === '')) {
    errors.push(`${field.display_label} is required`);
    return errors; // Stop here if required field is missing
  }

  // Skip further validation if value is empty and not required
  if (value === null || value === undefined || value === '') {
    return errors;
  }

  // Data type validation
  const typeError = validateDataType(field, value);
  if (typeError) {
    errors.push(typeError);
  }

  // Validation rules
  if (field.validation_rules) {
    for (const rule of field.validation_rules) {
      const ruleError = validateRule(field, value, rule);
      if (ruleError) {
        errors.push(ruleError);
      }
    }
  }

  return errors;
}

/**
 * Validates data type
 */
function validateDataType(field: FieldDef, value: any): string | null {
  switch (field.data_type) {
    case 'string':
    case 'text':
    case 'richtext':
      if (typeof value !== 'string') {
        return `${field.display_label} must be a text value`;
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `${field.display_label} must be a number`;
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `${field.display_label} must be true or false`;
      }
      break;

    case 'date':
    case 'datetime':
      // Accept string or Date object
      if (typeof value !== 'string' && !(value instanceof Date)) {
        return `${field.display_label} must be a valid date`;
      }
      break;

    case 'enum':
      const options = field.ui_hints?.options || [];
      const validValues = options.map(o => String(o.value));
      if (!validValues.includes(String(value))) {
        return `${field.display_label} must be one of: ${options.map(o => o.label).join(', ')}`;
      }
      break;

    case 'json':
      if (typeof value !== 'object') {
        return `${field.display_label} must be a valid JSON object`;
      }
      break;
  }

  return null;
}

/**
 * Validates a specific validation rule
 */
function validateRule(field: FieldDef, value: any, rule: any): string | null {
  switch (rule.type) {
    case 'min':
      if (typeof value === 'number' && value < rule.value) {
        return rule.message || `${field.display_label} must be at least ${rule.value}`;
      }
      if (typeof value === 'string' && value.length < rule.value) {
        return rule.message || `${field.display_label} must be at least ${rule.value} characters`;
      }
      break;

    case 'max':
      if (typeof value === 'number' && value > rule.value) {
        return rule.message || `${field.display_label} must be at most ${rule.value}`;
      }
      if (typeof value === 'string' && value.length > rule.value) {
        return rule.message || `${field.display_label} must be at most ${rule.value} characters`;
      }
      break;

    case 'pattern':
      if (typeof value === 'string') {
        const regex = new RegExp(rule.value);
        if (!regex.test(value)) {
          return rule.message || `${field.display_label} format is invalid`;
        }
      }
      break;

    case 'custom':
      // Custom validation would need to be implemented based on customValidator reference
      // For now, skip custom validation
      break;
  }

  return null;
}
