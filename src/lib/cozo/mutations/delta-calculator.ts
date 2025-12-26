export type DeltaOperation =
  | 'FIELD_ADDED'
  | 'FIELD_REMOVED'
  | 'FIELD_MODIFIED'
  | 'ARRAY_ITEM_ADDED'
  | 'ARRAY_ITEM_REMOVED'
  | 'ARRAY_REORDERED'
  | 'OBJECT_REPLACED';

export interface FieldDelta {
  path: string[];
  operation: DeltaOperation;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface RecordDelta {
  recordId: string;
  relation: string;
  timestamp: number;
  deltas: FieldDelta[];
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;

  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  return false;
}

function computeDeltas(
  before: unknown,
  after: unknown,
  path: string[] = []
): FieldDelta[] {
  const deltas: FieldDelta[] = [];

  if (before === undefined && after !== undefined) {
    deltas.push({
      path,
      operation: 'FIELD_ADDED',
      newValue: after,
    });
    return deltas;
  }

  if (before !== undefined && after === undefined) {
    deltas.push({
      path,
      operation: 'FIELD_REMOVED',
      oldValue: before,
    });
    return deltas;
  }

  if (deepEqual(before, after)) {
    return deltas;
  }

  if (isArray(before) && isArray(after)) {
    const added = after.filter(item => !before.some(b => deepEqual(b, item)));
    const removed = before.filter(item => !after.some(a => deepEqual(a, item)));

    for (const item of added) {
      deltas.push({
        path,
        operation: 'ARRAY_ITEM_ADDED',
        newValue: item,
      });
    }

    for (const item of removed) {
      deltas.push({
        path,
        operation: 'ARRAY_ITEM_REMOVED',
        oldValue: item,
      });
    }

    if (added.length === 0 && removed.length === 0 && !deepEqual(before, after)) {
      deltas.push({
        path,
        operation: 'ARRAY_REORDERED',
        oldValue: before,
        newValue: after,
      });
    }

    return deltas;
  }

  if (isObject(before) && isObject(after)) {
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      const nestedDeltas = computeDeltas(before[key], after[key], [...path, key]);
      deltas.push(...nestedDeltas);
    }

    return deltas;
  }

  deltas.push({
    path,
    operation: path.length === 0 ? 'OBJECT_REPLACED' : 'FIELD_MODIFIED',
    oldValue: before,
    newValue: after,
  });

  return deltas;
}

export function calculateDelta(
  recordId: string,
  relation: string,
  before: unknown,
  after: unknown
): RecordDelta {
  return {
    recordId,
    relation,
    timestamp: Date.now(),
    deltas: computeDeltas(before, after),
    beforeSnapshot: before,
    afterSnapshot: after,
  };
}

export function deltasConflict(deltaA: RecordDelta, deltaB: RecordDelta): boolean {
  if (deltaA.recordId !== deltaB.recordId) return false;

  const pathsA = new Set(deltaA.deltas.map(d => d.path.join('.')));
  const pathsB = new Set(deltaB.deltas.map(d => d.path.join('.')));

  for (const pathA of pathsA) {
    if (pathsB.has(pathA)) return true;

    for (const pathB of pathsB) {
      if (pathA.startsWith(pathB + '.') || pathB.startsWith(pathA + '.')) {
        return true;
      }
    }
  }

  return false;
}

export function getConflictingPaths(deltaA: RecordDelta, deltaB: RecordDelta): string[] {
  if (deltaA.recordId !== deltaB.recordId) return [];

  const conflicts: string[] = [];
  const pathsA = deltaA.deltas.map(d => d.path.join('.'));
  const pathsB = new Set(deltaB.deltas.map(d => d.path.join('.')));

  for (const pathA of pathsA) {
    if (pathsB.has(pathA)) {
      conflicts.push(pathA);
      continue;
    }

    for (const pathB of pathsB) {
      if (pathA.startsWith(pathB + '.') || pathB.startsWith(pathA + '.')) {
        conflicts.push(`${pathA} <-> ${pathB}`);
      }
    }
  }

  return conflicts;
}

function setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!isObject(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const finalKey = path[path.length - 1];
  current[finalKey] = value;
}

function deleteNestedValue(obj: Record<string, unknown>, path: string[]): void {
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!isObject(current[key])) return;
    current = current[key] as Record<string, unknown>;
  }

  const finalKey = path[path.length - 1];
  delete current[finalKey];
}

function getNestedValue(obj: unknown, path: string[]): unknown {
  let current = obj;

  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

export function applyDelta(base: unknown, delta: RecordDelta): unknown {
  if (!isObject(base)) {
    if (delta.deltas.length === 1 && delta.deltas[0].path.length === 0) {
      return delta.deltas[0].newValue;
    }
    return delta.afterSnapshot;
  }

  const result = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;

  for (const fieldDelta of delta.deltas) {
    switch (fieldDelta.operation) {
      case 'FIELD_ADDED':
      case 'FIELD_MODIFIED':
        if (fieldDelta.path.length === 0) {
          return fieldDelta.newValue;
        }
        setNestedValue(result, fieldDelta.path, fieldDelta.newValue);
        break;

      case 'FIELD_REMOVED':
        deleteNestedValue(result, fieldDelta.path);
        break;

      case 'ARRAY_ITEM_ADDED': {
        const arr = getNestedValue(result, fieldDelta.path);
        if (isArray(arr)) {
          arr.push(fieldDelta.newValue);
        }
        break;
      }

      case 'ARRAY_ITEM_REMOVED': {
        const arr = getNestedValue(result, fieldDelta.path);
        if (isArray(arr)) {
          const index = arr.findIndex(item => deepEqual(item, fieldDelta.oldValue));
          if (index !== -1) arr.splice(index, 1);
        }
        break;
      }

      case 'ARRAY_REORDERED':
      case 'OBJECT_REPLACED':
        if (fieldDelta.path.length === 0) {
          return fieldDelta.newValue;
        }
        setNestedValue(result, fieldDelta.path, fieldDelta.newValue);
        break;
    }
  }

  return result;
}

export function mergeNonConflictingDeltas(
  base: unknown,
  deltaA: RecordDelta,
  deltaB: RecordDelta
): { merged: unknown; conflicts: string[] } {
  const conflicts = getConflictingPaths(deltaA, deltaB);

  if (conflicts.length > 0) {
    return { merged: base, conflicts };
  }

  let result = applyDelta(base, deltaA);
  result = applyDelta(result, deltaB);

  return { merged: result, conflicts: [] };
}
