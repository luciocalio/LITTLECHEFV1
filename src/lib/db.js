// ══════════════════════════════════════════════════════════════
//  LITTLECHEF · IndexedDB layer
//  Storage primario per dati che devono sopravvivere al cambio tab.
//
//  Stores: pantry | dishes | fixed | beverage | mise | preparazioni | settings
//  Schema: ogni store usa { keyPath: 'id' } tranne 'settings' (key-value)
// ══════════════════════════════════════════════════════════════

const DB_NAME    = 'littlechef_v1';
const DB_VERSION = 4;
const STORES     = ['pantry', 'dishes', 'fixed', 'beverage', 'mise', 'preparazioni', 'ingredients', 'preparations', 'fixed_costs', 'menus', 'sections'];

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };

    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = () => reject(req.error);
    req.onblocked  = () => reject(new Error('IndexedDB blocked'));
  });
}

export async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const r  = tx.objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror   = () => reject(r.error);
  });
}

export async function dbSetAll(store, items) {
  if (!Array.isArray(items)) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s  = tx.objectStore(store);
    const clearReq = s.clear();
    clearReq.onsuccess = () => {
      items.forEach(item => s.put(item));
    };
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function dbGetSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const r  = tx.objectStore('settings').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror   = () => reject(r.error);
  });
}

export async function dbSetSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Nuove API uniformi per V7.0 ──

export async function getAllFromDB(store) {
  return dbGetAll(store);
}

export async function saveToDB(store, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function deleteFromDB(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
