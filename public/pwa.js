/* Persistência local do catálogo e manutenção dos dados deste aplicativo. */
(() => {
  'use strict';
  const databaseName = 'javas-effects-lab-pages-v1';
  const database = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('catalog');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.catch(() => {});
  window.JAVAS_CATALOG = {
    async read() {
      const db = await database;
      return new Promise((resolve, reject) => {
        const request = db.transaction('catalog').objectStore('catalog').get('published');
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    },
    async write(items) {
      const db = await database;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('catalog', 'readwrite');
        transaction.objectStore('catalog').put(items, 'published');
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    }
  };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', {scope: './'}).catch(console.error);
  }
  document.querySelector('#reset-app-data').addEventListener('click', async () => {
    const sync = await import('./config-store.mjs');
    if (await sync.hasDrafts() && !confirm('Existem rascunhos ainda não sincronizados. Esta limpeza irá apagá-los. Deseja continuar mesmo assim?')) return;
    if (!confirm('Apagar os dados e o conteúdo offline deste aplicativo? Será necessário estar online para carregar novamente.')) return;
    const button = document.querySelector('#reset-app-data');
    button.disabled = true;
    try {
      await sync.clearConfigurationData();
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('jel-auth-ljjdxwbcysxkowymomql')) localStorage.removeItem(key);
      }
      for (const key of Object.keys(localStorage)) {
        if (key === 'javas-effects-lab-v1' || key === 'javas-audio-paths-v1' || key.startsWith('javas-audio-day-')) localStorage.removeItem(key);
      }
      (await database.catch(() => null))?.close();
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Feche as outras abas deste aplicativo e tente novamente.'));
      });
      const scope = new URL('./', location.href).href;
      for (const registration of await navigator.serviceWorker?.getRegistrations() || []) {
        if (registration.scope === scope) await registration.unregister();
      }
      for (const name of await caches.keys()) {
        if (name.startsWith('jel-pages-' + new URL('./', location.href).pathname + '-')) await caches.delete(name);
      }
      location.reload();
    } catch (error) {
      alert('Não foi possível concluir a limpeza: ' + error.message);
      button.disabled = false;
    }
  });
})();
