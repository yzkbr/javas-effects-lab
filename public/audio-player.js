import {read as readConfiguration} from './config-store.mjs';
import {latestPublic, watchPublic} from './config-sync.mjs';
/* Trilha geral, trilhas por personagem e mensagens com prioridade exclusiva.
   Autoplay é iniciado apenas após interação permitida pelo navegador. */
(()=>{'use strict';
const PATH_KEY='javas-audio-paths-v1',KEY='javas-effects-lab-v1',btn=document.querySelector('#audio-toggle');let items=[],character=null,message=null,ambient=null,muted=false,activated=false,last={},fadeId=0;
const defaults={enabled:true,masterVolume:.7,ambientVolume:.35,messageVolume:.85,fadeSeconds:.7,avoidRepeat:true,dailyMode:false,autoplayAfterGesture:true};
function settings(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY))?.audio}}catch{return defaults}}
function pick(pool,key){if(!pool.length)return null;const s=settings();if(s.dailyMode){const day=new Date().toLocaleDateString('en-CA');const storeKey=`javas-audio-day-${key}-${day}`;let id=localStorage.getItem(storeKey),chosen=pool.find(x=>x.id===id);if(!chosen){chosen=pool[Math.floor(Math.random()*pool.length)];localStorage.setItem(storeKey,chosen.id)}return chosen}let choices=pool.filter(x=>!s.avoidRepeat||x.id!==last[key]);if(!choices.length)choices=pool;const chosen=choices[Math.floor(Math.random()*choices.length)];last[key]=chosen.id;return chosen}
function volume(type){const s=settings();return Math.min(1,Math.max(0,s.masterVolume*(type==='message'?s.messageVolume:s.ambientVolume)))}
function fadeOut(audio,done){if(!audio){done?.();return}const token=++fadeId,seconds=settings().fadeSeconds;if(seconds<=0){audio.pause();done?.();return}const start=performance.now(),v=audio.volume;function tick(now){if(token!==fadeId)return;const t=Math.min(1,(now-start)/(seconds*1000));audio.volume=v*(1-t);if(t<1)requestAnimationFrame(tick);else{audio.pause();done?.()}}requestAnimationFrame(tick)}
function stopAmbient(){const old=ambient;ambient=null;if(old)fadeOut(old)}
function startAmbient(){if(!activated||muted||message||!settings().enabled)return;stopAmbient();const dest=character||'fundo',track=pick(items.filter(x=>x.dest===dest&&x.cat==='ambiente'),`ambient-${dest}`);if(!track)return;const a=new Audio(track.url);a.loop=false;a.volume=0;ambient=a;const target=volume('ambient');a.addEventListener('ended',()=>{if(ambient===a)startAmbient()});a.play().then(()=>{const ms=Math.max(1,settings().fadeSeconds*1000),begin=performance.now();function step(t){if(ambient!==a||muted)return;a.volume=target*Math.min(1,(t-begin)/ms);if(a.volume<target)requestAnimationFrame(step)}requestAnimationFrame(step)}).catch(()=>{if(ambient===a)ambient=null})}
function stopMessage(){if(message){message.pause();message.currentTime=0;message=null}if(activated)startAmbient()}
async function playMessage(id,label){activated=true;stopAmbient();if(message){message.pause();message=null}const pool=items.filter(x=>x.dest===id&&x.cat==='mensagens'),track=pick(pool,`message-${id}`);if(!track){label.textContent='Nenhuma mensagem MP3 cadastrada para este personagem.';startAmbient();return}const a=new Audio(track.url);message=a;a.volume=volume('message');label.textContent=`Reproduzindo: ${track.name}`;a.addEventListener('ended',()=>{if(message!==a)return;message=null;label.textContent='Mensagem finalizada.';startAmbient()});try{await a.play()}catch(e){label.textContent='Toque em Play novamente para liberar o áudio.';message=null;startAmbient()}}
function setCharacter(id){if(message){message.pause();message=null}character=id;startAmbient()}
async function reload(){
  // O catálogo exportado funciona em hospedagem estática (inclusive GitHub Pages).
  let published=[];try{published=await window.JAVAS_CATALOG.read()}catch{}
  let remote=await readConfiguration('public:audio_catalog').catch(()=>null);
  try{remote=await latestPublic('audio_catalog')}catch{}
  try{const r=await fetch('./audio-catalog.json',{cache:'no-store'});if(r.ok){const data=await r.json();if(Array.isArray(data)){published=data;try{await window.JAVAS_CATALOG.write(data)}catch{}}}}catch{}
  if(remote)published=remote.config_value;
  let local=[];try{const data=JSON.parse(localStorage.getItem(PATH_KEY));if(!remote&&Array.isArray(data))local=data}catch{}
  // Prioriza o cadastro local; não depende de /api/audio.
  const merged=new Map();for(const item of [...published,...local]){
    if(item&&typeof item.url==='string'&&/^audio\/[a-z0-9_\-/ ]+\.mp3$/i.test(item.url)&&!item.url.includes('..')){
      merged.set(item.dest+'|'+item.cat+'|'+item.url,item);
    }
  }
  items=[...merged.values()];if(activated&&!ambient&&!message)startAmbient();
}
btn.onclick=()=>{muted=!muted;activated=true;btn.setAttribute('aria-pressed',String(!muted));btn.textContent=muted?'♪ Ativar áudio':'♫ Silenciar áudio';if(muted){message?.pause();if(message)message=null;stopAmbient()}else startAmbient()};
window.addEventListener('pointerdown',()=>{if(!activated&&settings().autoplayAfterGesture){activated=true;btn.textContent='♫ Silenciar áudio';btn.setAttribute('aria-pressed','true');startAmbient()}},{once:true});
window.addEventListener('storage',e=>{if(e.key===KEY){if(ambient)ambient.volume=volume('ambient');if(message)message.volume=volume('message')}});
window.addEventListener('focus',reload);window.addEventListener('storage',e=>{if(e.key===PATH_KEY)reload()});document.addEventListener('visibilitychange',()=>{if(document.hidden){ambient?.pause()}else if(ambient&&!message&&!muted)ambient.play().catch(()=>{})});
window.JAVAS_AUDIO={playMessage,stopMessage,setCharacter,reload};reload();watchPublic('audio_catalog',reload);
})();
