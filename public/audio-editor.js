/* Biblioteca estática de MP3: caminhos relativos, sem API nem upload. */
(()=>{'use strict';
const KEY='javas-audio-paths-v1', $=s=>document.querySelector(s);
const dest=$('#audio-destino'),cat=$('#audio-categoria'),path=$('#audio-caminho'),status=$('#audio-status'),list=$('#audio-lista');
const ids=['fundo','pain','konan','itachi','kisame','deidara','sasori','hidan','kakuzu','zetsu','obito'];
for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=id==='fundo'?'Fundo geral':id[0].toUpperCase()+id.slice(1);dest.append(option)}
let preview=null;
function load(){try{const value=JSON.parse(localStorage.getItem(KEY));return Array.isArray(value)?value:[]}catch{return []}}
function save(items){localStorage.setItem(KEY,JSON.stringify(items));window.dispatchEvent(new Event('javas-audio-changed'))}
function normalize(value){const clean=value.trim().replaceAll('\\','/').replace(/^\.\//,'');if(!/^audio\/[a-z0-9_\-/ ]+\.mp3$/i.test(clean)||clean.includes('..')||clean.includes('//'))throw Error('Use um caminho relativo: audio/itachi/mensagem-1.mp3');return clean}
function test(url){preview?.pause();preview=new Audio(new URL(url,location.href).href);preview.play().then(()=>status.textContent='▶ Reproduzindo '+url).catch(e=>status.textContent='Não foi possível tocar: '+e.message+' — confira nome e localização do arquivo.')}
function render(){list.replaceChildren();const items=load();for(const item of items){const row=document.createElement('div');row.className='audio-item';const label=document.createElement('span');label.textContent=`${item.dest} / ${item.cat} — ${item.url}`;const play=document.createElement('button');play.type='button';play.textContent='▶ Ouvir';play.onclick=()=>test(item.url);const stop=document.createElement('button');stop.type='button';stop.textContent='■ Parar';stop.onclick=()=>{preview?.pause();if(preview)preview.currentTime=0};const del=document.createElement('button');del.type='button';del.textContent='Remover';del.onclick=()=>{save(load().filter(x=>x.id!==item.id));render()};row.append(label,play,stop,del);list.append(row)}status.textContent=`${items.length} caminho(s) cadastrado(s).`}
$('#audio-enviar').onclick=()=>{try{const url=normalize(path.value),items=load();if(items.some(x=>x.url===url&&x.dest===dest.value&&x.cat===cat.value)){status.textContent='Esse caminho já está cadastrado nesta categoria.';return}items.push({id:'path-'+Date.now()+'-'+Math.random().toString(36).slice(2),dest:dest.value,cat:cat.value,url,name:url.split('/').pop()});save(items);render();path.value=''}catch(e){status.textContent=e.message}};
$('#audio-testar').onclick=()=>{try{test(normalize(path.value))}catch(e){status.textContent=e.message}};
$('#audio-atualizar').onclick=render;
$('#audio-exportar').onclick=()=>{const blob=new Blob([JSON.stringify(load(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='audio-catalog.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.addEventListener('storage',e=>{if(e.key===KEY)render()});window.addEventListener('javas-audio-changed-remote',render);render();
})();
