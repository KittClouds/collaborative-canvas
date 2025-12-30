/**
 * Fact Sheet Library
 * 
 * First-class entity metadata system.
 */

// Field Schema Registry
export {
    FieldSchemaRegistry,
    SYSTEM_FIELD_SCHEMAS,
    type FieldSchemaDefinition,
} from './FieldSchemaRegistry';

// Fact Sheet API
export {
    FactSheetAPI,
    type FieldUpdate,
    type MetaCardCreate,
    type MetaCardUpdate,
    type EntitySubscription,
} from './api';
