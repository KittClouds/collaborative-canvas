import { v7 as uuidv7 } from 'uuid';

/**
 * Generates a unique ID using UUID v7 (time-ordered).
 * Replaces previous random string and UUID v4 implementations.
 */
export function generateId(): string {
  return uuidv7();
}

/**
 * @deprecated Use generateId() instead. Kept for temporary compatibility during refactor.
 */
export function generateNodeId(): string {
  return generateId();
}
