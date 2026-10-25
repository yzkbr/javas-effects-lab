'use strict';
const BASE = new URL('./', self.location.href);
const PREFIX = 'jel-pages-' + BASE.pathname + '-';
const CACHE = PREFIX + 'v4-touch-selection';
const FILES = ["./","./audio/itachi/mensagem-1.mp3","./audio-catalog.json","./audio-editor.js","./audio-player.js","./cloud-settings.mjs","./config-store.mjs","./config-sync.mjs","./config.json","./editor.css","./editor.js","./icons/icon-192.png","./icons/icon-512.png","./imagens/08_cordao_vermelho.png","./imagens/estampa.png","./imagens/mangekyo-itachi.png","./imagens/mascara-borda.png","./imagens/olhos-itachi-referencia.png","./imagens/papel-feudal.jpg","./imagens/rolo-akatsuki.png","./imagens/rolo-sem-pingente.png","./index.html","./manifest.webmanifest","./personagens.js","./pwa.js","./script.js","./style.css","./vendor/gsap.min.js","./vendor/supabase-2.118.0.js","./vendor/three.module.js"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(name => new URL(name,BASE).href))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname) || url.search) return;
  const relative = url.pathname.slice(BASE.pathname.length);
  if (!FILES.some(name => new URL(name, BASE).pathname === url.pathname)) return;
  if (event.request.headers.has('range')) {
    event.respondWith((async()=>{
      const response = await caches.match(url.href);
      const range = /^bytes=(\d*)-(\d*)$/.exec(event.request.headers.get('range'));
      if(!response || !range) return fetch(event.request);
      const bytes = await response.arrayBuffer();
      const length = bytes.byteLength;
      const start = range[1] ? Number(range[1]) : Math.max(0,length-Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]),length-1) : length-1;
      if(start>end || start>=length) return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+length}});
      return new Response(bytes.slice(start,end+1),{status:206,headers:{'Content-Type':response.headers.get('Content-Type')||'audio/mpeg','Content-Range':'bytes '+start+'-'+end+'/'+length,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
    })());
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    if(response.ok && response.type==='basic') {
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));
    }
    return response;
  }).catch(async()=> (await caches.match(event.request)) || Response.error()));
});
