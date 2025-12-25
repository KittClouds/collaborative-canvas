import { cozoDb } from './cozo/db';
import { initCozoGraphSchema } from './cozo/schema/init';

// Verify imports work (don't run logic yet)
console.log('CozoDB imports successful', {
    cozoDb,
    initCozoGraphSchema,
});

export { cozoDb, initCozoGraphSchema };
