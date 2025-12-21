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

/**
 * Validate UUIDv7 format
 */
export function isValidUUIDv7(id: string): boolean {
  const uuidv7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv7Pattern.test(id);
}

/**
 * Extract timestamp from UUIDv7
 */
export function getTimestampFromUUID(id: string): Date | null {
  if (!isValidUUIDv7(id)) return null;

  const hex = id.replace(/-/g, '').slice(0, 12);
  const timestamp = parseInt(hex, 16);

  return new Date(timestamp);
}
