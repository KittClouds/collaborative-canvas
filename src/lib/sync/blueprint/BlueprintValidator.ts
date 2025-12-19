import type { FieldDef, FieldDataType, ValidationRule } from '@/features/blueprint-hub/types';

export interface FieldValidationResult {
  isValid: boolean;
  field: string;
  message?: string;
  code?: string;
  coercedValue?: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string; code: string }>;
  warnings: Array<{ field: string; message: string }>;
  coercedData?: Record<string, unknown>;
}

export class BlueprintValidator {
  validateField(fieldDef: FieldDef, value: unknown): FieldValidationResult {
    const { field_name, data_type, is_required, validation_rules } = fieldDef;

    if (value === undefined || value === null || value === '') {
      if (is_required) {
        return {
          isValid: false,
          field: field_name,
          message: `${fieldDef.display_label} is required`,
          code: 'REQUIRED',
        };
      }
      return { isValid: true, field: field_name };
    }

    const typeResult = this.validateType(field_name, data_type, value);
    if (!typeResult.isValid) return typeResult;

    if (validation_rules && validation_rules.length > 0) {
      for (const rule of validation_rules) {
        const ruleResult = this.validateRule(field_name, rule, value, data_type);
        if (!ruleResult.isValid) return ruleResult;
      }
    }

    return {
      isValid: true,
      field: field_name,
      coercedValue: this.coerceValue(data_type, value),
    };
  }

  private validateType(field: string, dataType: FieldDataType, value: unknown): FieldValidationResult {
    switch (dataType) {
      case 'string':
      case 'text':
        if (typeof value !== 'string') {
          return { isValid: false, field, message: 'Must be a string', code: 'TYPE_STRING' };
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { isValid: false, field, message: 'Must be a number', code: 'TYPE_NUMBER' };
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return { isValid: false, field, message: 'Must be a boolean', code: 'TYPE_BOOLEAN' };
        }
        break;
      case 'date':
      case 'datetime':
        if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
          return { isValid: false, field, message: 'Must be a valid date', code: 'TYPE_DATE' };
        }
        break;
      case 'json':
        if (typeof value !== 'object') {
          return { isValid: false, field, message: 'Must be a JSON object', code: 'TYPE_JSON' };
        }
        break;
      case 'uuid':
        if (typeof value !== 'string' || !this.isValidUUID(value)) {
          return { isValid: false, field, message: 'Must be a valid UUID', code: 'TYPE_UUID' };
        }
        break;
      case 'enum':
        break;
      case 'reference':
        if (typeof value !== 'string') {
          return { isValid: false, field, message: 'Must be a valid reference ID', code: 'TYPE_REFERENCE' };
        }
        break;
    }

    return { isValid: true, field };
  }

  private validateRule(
    field: string,
    rule: ValidationRule,
    value: unknown,
    dataType: FieldDataType
  ): FieldValidationResult {
    switch (rule.type) {
      case 'min':
        if (dataType === 'number' && typeof value === 'number') {
          if (value < (rule.value as number)) {
            return {
              isValid: false,
              field,
              message: rule.message || `Must be at least ${rule.value}`,
              code: 'MIN',
            };
          }
        }
        if ((dataType === 'string' || dataType === 'text') && typeof value === 'string') {
          if (value.length < (rule.value as number)) {
            return {
              isValid: false,
              field,
              message: rule.message || `Must be at least ${rule.value} characters`,
              code: 'MIN_LENGTH',
            };
          }
        }
        break;

      case 'max':
        if (dataType === 'number' && typeof value === 'number') {
          if (value > (rule.value as number)) {
            return {
              isValid: false,
              field,
              message: rule.message || `Must be at most ${rule.value}`,
              code: 'MAX',
            };
          }
        }
        if ((dataType === 'string' || dataType === 'text') && typeof value === 'string') {
          if (value.length > (rule.value as number)) {
            return {
              isValid: false,
              field,
              message: rule.message || `Must be at most ${rule.value} characters`,
              code: 'MAX_LENGTH',
            };
          }
        }
        break;

      case 'pattern':
        if (typeof value === 'string' && typeof rule.value === 'string') {
          const regex = new RegExp(rule.value);
          if (!regex.test(value)) {
            return {
              isValid: false,
              field,
              message: rule.message || 'Invalid format',
              code: 'PATTERN',
            };
          }
        }
        break;
    }

    return { isValid: true, field };
  }

  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  coerceValue(dataType: FieldDataType, value: unknown): unknown {
    if (value === undefined || value === null) return value;

    switch (dataType) {
      case 'string':
      case 'text':
        return String(value);
      case 'number':
        const num = Number(value);
        return isNaN(num) ? value : num;
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);
      case 'date':
      case 'datetime':
        if (value instanceof Date) return value;
        if (typeof value === 'string' || typeof value === 'number') {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date;
        }
        return value;
      default:
        return value;
    }
  }

  validateAllFields(
    fields: FieldDef[],
    data: Record<string, unknown>
  ): ValidationResult {
    const errors: Array<{ field: string; message: string; code: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    const coercedData: Record<string, unknown> = { ...data };

    for (const fieldDef of fields) {
      const value = data[fieldDef.field_name];
      const result = this.validateField(fieldDef, value);

      if (!result.isValid && result.message && result.code) {
        errors.push({
          field: result.field,
          message: result.message,
          code: result.code,
        });
      } else if (result.coercedValue !== undefined) {
        coercedData[fieldDef.field_name] = result.coercedValue;
      }
    }

    const knownFields = new Set(fields.map(f => f.field_name));
    for (const key of Object.keys(data)) {
      if (!knownFields.has(key)) {
        warnings.push({
          field: key,
          message: `Unknown field: ${key}`,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      coercedData: errors.length === 0 ? coercedData : undefined,
    };
  }

  checkRequiredFields(fields: FieldDef[], data: Record<string, unknown>): string[] {
    const missing: string[] = [];

    for (const fieldDef of fields) {
      if (fieldDef.is_required) {
        const value = data[fieldDef.field_name];
        if (value === undefined || value === null || value === '') {
          missing.push(fieldDef.field_name);
        }
      }
    }

    return missing;
  }
}

export const blueprintValidator = new BlueprintValidator();
