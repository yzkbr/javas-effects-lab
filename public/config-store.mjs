const DB = 'javas-effects-lab-sync-v1';
let database;
function open() {
  return database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function read(key) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('state').objectStore('state').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
// Read and write share one transaction, including across tabs.
export async function mutate(key, change) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('state', 'readwrite');
    const store = transaction.objectStore('state');
    let result;
    const request = store.get(key);
    request.onsuccess = () => {
      try {
        result = change(request.result);
        if (result === undefined) store.delete(key); else store.put(result, key);
      } catch (error) { transaction.abort(); reject(error); }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Armazenamento interrompido.'));
  });
}
export const write = (key, value) => mutate(key, () => value);
export async function clearConfigurationData() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('state', 'readwrite');
    transaction.objectStore('state').clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
export async function hasDrafts() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('state').objectStore('state').getAllKeys();
    request.onsuccess = () => resolve(request.result.some(key => String(key).startsWith('draft:')));
    request.onerror = () => reject(request.error);
  });
}
