// Vault Database — IndexedDB wrapper
// Stores all personal data locally in the browser.
// Personal data NEVER leaves the device to the backend.

const DB_NAME = "PDFW_LOCAL";
const DB_VERSION = 1;

export const STORES = {
  VAULT: "vault",
  DISCLOSURE_EVENTS: "disclosureEvents",
  COMPANIES: "companies",
  SETTINGS: "settings",
} as const;

let db: IDBDatabase | null = null;

export async function openDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORES.VAULT)) {
        database.createObjectStore(STORES.VAULT, { keyPath: "key" });
      }

      if (!database.objectStoreNames.contains(STORES.DISCLOSURE_EVENTS)) {
        const store = database.createObjectStore(STORES.DISCLOSURE_EVENTS, { keyPath: "id" });
        store.createIndex("domain", "domain", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.COMPANIES)) {
        database.createObjectStore(STORES.COMPANIES, { keyPath: "domain" });
      }

      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(request.result);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut<T>(store: string, value: T): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(store: string, key: string): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbClear(store: string): Promise<void> {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
