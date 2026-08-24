const DB_NAME = 'billqo-offline';
const DB_VERSION = 1;
const STORE_NAME = 'state';

export type OfflineScope = 'finance' | 'billing';

export interface OfflineOperation<T = unknown> {
  id: string;
  scope: OfflineScope;
  action: string;
  createdAt: string;
  payload: T;
}

const memoryFallback = new Map<string, unknown>();
let databasePromise: Promise<IDBDatabase | undefined> | undefined;

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase | undefined> {
  if (!hasIndexedDb()) return Promise.resolve(undefined);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(undefined);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
    request.onblocked = () => resolve(undefined);
  });

  return databasePromise;
}

async function readValue<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  if (!db) return memoryFallback.get(key) as T | undefined;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => resolve(memoryFallback.get(key) as T | undefined);
    } catch {
      resolve(memoryFallback.get(key) as T | undefined);
    }
  });
}

async function writeValue<T>(key: string, value: T): Promise<void> {
  memoryFallback.set(key, value);
  const db = await openDatabase();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteValue(key: string): Promise<void> {
  memoryFallback.delete(key);
  const db = await openDatabase();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function scopedKey(uid: string, key: string): string {
  return `${uid}:${key}`;
}

export const getOfflineValue = <T>(uid: string, key: string): Promise<T | undefined> =>
  readValue<T>(scopedKey(uid, key));

export const setOfflineValue = <T>(uid: string, key: string, value: T): Promise<void> =>
  writeValue(scopedKey(uid, key), value);

export const removeOfflineValue = (uid: string, key: string): Promise<void> =>
  deleteValue(scopedKey(uid, key));

export async function getOfflineQueue(uid: string, scope: OfflineScope): Promise<OfflineOperation[]> {
  return (await getOfflineValue<OfflineOperation[]>(uid, `queue:${scope}`)) ?? [];
}

export async function setOfflineQueue(uid: string, scope: OfflineScope, queue: OfflineOperation[]): Promise<void> {
  await setOfflineValue(uid, `queue:${scope}`, queue);
}

export async function mutateOfflineQueue(
  uid: string,
  scope: OfflineScope,
  mutate: (queue: OfflineOperation[]) => OfflineOperation[],
): Promise<OfflineOperation[]> {
  const current = await getOfflineQueue(uid, scope);
  const next = mutate(current);
  await setOfflineQueue(uid, scope, next);
  return next;
}

export function offlineOperation(scope: OfflineScope, action: string, payload: unknown): OfflineOperation {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id: `${scope}:${random}`,
    scope,
    action,
    createdAt: new Date().toISOString(),
    payload,
  };
}
