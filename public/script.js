/* Visualização independente: recebe controles do editor via BroadcastChannel. */
import {read as readConfiguration} from './config-store.mjs';
import {watchPublic} from './config-sync.mjs';
const STORAGE='javas-effects-lab-v1';
const CHANNEL='javas-effects-live-v1';
const canal=new BroadcastChannel(CHANNEL);
const root=document.documentElement;
const cortina=document.querySelector('#cortina');
const aviso=document.querySelector('#aviso-webgl');
const botao=document.querySelector('#botao');
const movimentoReduzido=window.matchMedia('(prefers-reduced-motion: reduce)');
const css=(key,value)=>root.style.setProperty(key,value);
let state,defaults,uniforms=null,renderer=null,texture=null;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function merge(base,input) {
  const out=structuredClone(base);
  if (!input || typeof input!=='object') return out;
  for (const group of Object.keys(base)) {
    if (!input[group] || typeof input[group]!=='object') continue;
    for (const [key,original] of Object.entries(base[group])) {
      const value=input[group][key];
      if (typeof value!==typeof original) continue;
      if (typeof value==='number' && !Number.isFinite(value)) continue;
      if (typeof value==='string' && value.length>250) continue;
      out[group][key]=value;
    }
  }
  return out;
}
function apply(next) {
  state=merge(defaults,next);
  const {page,title,paragraphs,button,curtain}=state;
  css('--card-width',state.characters.cardWidth+'px');
  css('--card-radius',state.characters.cardRadius+'px');
  css('--card-opacity',state.characters.cardOpacity);
  css('--hover-member-color',state.characters.hoverColor);
  document.querySelectorAll('.membro-link').forEach(b=>b.disabled=!state.characters.enabled);
  document.querySelector('.pergaminho-folha')?.classList.toggle('borda-lisa',state.scroll?.raggedEdges===false);
  css('--page-bg',page.background);
  css('--page-padding',page.padding+'px');
  css('--title-color',title.color);
  css('--title-size',title.size+'px');
  css('--title-duration',title.duration+'s');
  css('--text-color',paragraphs.color);
  css('--text-size',paragraphs.size+'px');
  css('--button-color1',button.color1);
  css('--button-color2',button.color2);
  css('--button-radius',button.radius+'px');
  css('--button-font-size',button.fontSize+'px');
  css('--button-py',button.paddingY+'px');
  css('--button-px',button.paddingX+'px');
  document.querySelector('#titulo').textContent=title.text;
  document.querySelector('#titulo').style.animation=title.animate&&!movimentoReduzido.matches?'':'none';
  document.querySelector('#paragrafo1').textContent=paragraphs.first;
  document.querySelector('#paragrafo2').textContent=paragraphs.second;
  botao.textContent=button.text;
  cortina.style.display=curtain.enabled?'':'none';
  cortina.style.backgroundSize=(100*curtain.scale)+'% auto';
  cortina.style.backgroundPosition=`${curtain.positionX}% ${curtain.positionY}%`;
  if (uniforms) {
    uniforms.uFoldCount.value=curtain.folds;
    uniforms.uFoldDepth.value=curtain.depth;
    uniforms.uTextureWarp.value=curtain.warp;
    uniforms.uNaturalAmplitude.value=curtain.naturalAmplitude;
    uniforms.uNaturalSpeed.value=curtain.naturalSpeed;
    uniforms.uMouseStrength.value=curtain.mouseStrength;
    uniforms.uMouseRadius.value=curtain.mouseRadius;
    uniforms.uLight.value=curtain.light;
    uniforms.uScale.value=curtain.scale;
    uniforms.uPosition.value.set(curtain.positionX/100,curtain.positionY/100);
    uniforms.uNaturalEnabled.value=curtain.naturalEnabled?1:0;
    uniforms.uCursorEnabled.value=curtain.cursorEnabled?1:0;
  }
  if (renderer) resize();
}
canal.onmessage=(event)=>{
  if (event.data?.type==='settings' && defaults) apply(event.data.settings);
  if(event.data?.type==='rope-action'){
    if(event.data.action==='test') impulsoCordas(2);
    if(event.data.action==='pause') cordPhysics.paused=true;
    if(event.data.action==='resume') cordPhysics.paused=false;
    if(event.data.action==='reset') resetCordas();
  }
};

// FASE 3.2 — Cordões flexíveis: integração Verlet + restrições de distância.
// Diferente de rotate(), cada ponto da corda possui posição e inércia próprias.
// O Canvas é transparente e acompanha a haste superior (inclusive durante GSAP).
const roloSuperior = document.querySelector('.rolo-superior');
const cordCanvas = document.createElement('canvas');
cordCanvas.className = 'cordas-fisicas';
cordCanvas.setAttribute('aria-hidden','true');
roloSuperior.appendChild(cordCanvas);
const cordCtx = cordCanvas.getContext('2d');
const cordPhysics = {last:performance.now(), paused:false, ropes:[], width:0, height:0, prevAnchor:[], pointerLast:0};
const ropeCount=2, segments=13;
function resetCordas(){
  cordPhysics.ropes=[];
  for(let r=0;r<ropeCount;r++){
    const x=cordPhysics.width*(r===0?.48:.53);
    const points=Array.from({length:segments+1},(_,i)=>({x,y:8+i*4.7,px:x,py:8+i*4.7}));
    cordPhysics.ropes.push({points,anchorX:x,anchorY:8,beadAngle:0,beadVelocity:0});
  }
}
function resizeCordas(){
  const w=Math.max(1,roloSuperior.clientWidth),h=155;
  if(w===cordPhysics.width && h===cordPhysics.height)return;
  cordPhysics.width=w;cordPhysics.height=h;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  cordCanvas.width=Math.round(w*dpr);cordCanvas.height=Math.round(h*dpr);
  cordCanvas.style.width=w+'px';cordCanvas.style.height=h+'px';
  cordCtx.setTransform(dpr,0,0,dpr,0,0);
  resetCordas();
}
function impulsoCordas(forca=1){
  if(movimentoReduzido.matches)return;
  const power=Number(state?.scroll?.ropeImpulse??3)*forca;
  cordPhysics.ropes.forEach((rope,r)=>rope.points.forEach((pt,i)=>{
    if(i===0)return;
    pt.px-=power*(r===0?1:-1)*(i/segments)*1.5;
  }));
}
function desenharCordas(){
  const ctx=cordCtx;
  ctx.clearRect(0,0,cordPhysics.width,cordPhysics.height);
  for(const rope of cordPhysics.ropes){
    const pts=rope.points,tip=pts[segments],prev=pts[segments-1];
    // Sombra e trança: curva contínua, não um objeto rígido.
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const [width,color,offset] of [[9,'#210509',2],[7,'#6e0714',0],[4,'#df2335',-1],[1.5,'#ff6973',-1]]){
      ctx.beginPath();ctx.moveTo(pts[0].x+offset,pts[0].y);
      for(let i=1;i<pts.length-1;i++){
        const midX=(pts[i].x+pts[i+1].x)/2+offset,midY=(pts[i].y+pts[i+1].y)/2;
        ctx.quadraticCurveTo(pts[i].x+offset,pts[i].y,midX,midY);
      }
      ctx.lineTo(tip.x+offset,tip.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
    }
    // Marcas diagonais acompanham a deformação local dos segmentos.
    ctx.strokeStyle='#ff5462';ctx.lineWidth=1.2;
    for(let i=2;i<segments;i+=2){
      const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
      const nx=-dy/len,ny=dx/len;
      ctx.beginPath();ctx.moveTo(b.x+nx*3,b.y+ny*3);ctx.lineTo(b.x-nx*3,b.y-ny*3);ctx.stroke();
    }
    // Conta metálica pesada, com reflexo especular.
    const grad=ctx.createRadialGradient(tip.x-3,tip.y-4,1,tip.x,tip.y,11);
    grad.addColorStop(0,'#f4c47a');grad.addColorStop(.4,'#a16a36');grad.addColorStop(1,'#361708');
    ctx.fillStyle=grad;ctx.beginPath();ctx.arc(tip.x,tip.y,9,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#261009';ctx.lineWidth=1.2;ctx.stroke();
    // Fios do tassel têm inércia secundária (atraso em relação à conta).
    const dx=tip.x-prev.x, angle=Math.atan2(dx,Math.max(1,tip.y-prev.y));
    const spread=Number(state?.scroll?.tasselSpread??1);
    const length=Number(state?.scroll?.tasselLength??29);
    for(let j=-8;j<=8;j++){
      const u=j/8;
      const drift=Math.sin(rope.beadAngle+u*2)*4;
      const endX=tip.x+u*11*spread+Math.sin(angle)*length*.65+drift;
      const endY=tip.y+length*(1-.13*Math.abs(u));
      ctx.beginPath();ctx.moveTo(tip.x+u*2,tip.y+7);
      ctx.quadraticCurveTo(tip.x+u*5+Math.sin(angle)*12,tip.y+length*.55,endX,endY);
      ctx.strokeStyle=j%3===0?'#ff334a':j%2===0?'#650611':'#a00d20';
      ctx.lineWidth=j%3===0?1.7:1.3;ctx.stroke();
    }
    ctx.fillStyle='#720914';ctx.fillRect(tip.x-5,tip.y+5,10,4);
  }
}
function animarCordas(now){
  requestAnimationFrame(animarCordas);
  resizeCordas();
  const dt=Math.min(Math.max((now-cordPhysics.last)/1000,0),.035);
  cordPhysics.last=now;
  if(!state?.scroll)return;
  const p=state.scroll;
  if(!cordPhysics.paused && !movimentoReduzido.matches && dt>0){
    const gravity=Number(p.ropeGravity??1000);
    const damping=clamp(Number(p.ropeDamping??.65),.1,3);
    const drag=Math.exp(-damping*dt*1.7);
    const stiffness=clamp(Number(p.ropeStiffness??.9),.2,1);
    const amplitude=Number(p.ropeAmplitude??1);
    for(const rope of cordPhysics.ropes){
      const pts=rope.points,rest=Number(p.ropeLength??62)/segments;
      pts[0].x=rope.anchorX;pts[0].y=rope.anchorY;
      for(let i=1;i<pts.length;i++){
        const pt=pts[i],vx=(pt.x-pt.px)*drag,vy=(pt.y-pt.py)*drag;
        pt.px=pt.x;pt.py=pt.y;
        pt.x+=vx;pt.y+=vy+gravity*dt*dt*(i===segments?1.6:1);
      }
      for(let iteration=0;iteration<9;iteration++){
        pts[0].x=rope.anchorX;pts[0].y=rope.anchorY;
        for(let i=1;i<pts.length;i++){
          const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||.0001;
          const error=(dist-rest)/dist*stiffness;
          if(i===1){b.x-=dx*error;b.y-=dy*error;}
          else{a.x+=dx*error*.5;a.y+=dy*error*.5;b.x-=dx*error*.5;b.y-=dy*error*.5;}
        }
      }
      rope.beadAngle=rope.beadAngle*.9+(pts[segments].x-pts[segments-1].x)*.1;
    }
  }
  desenharCordas();
}
requestAnimationFrame(animarCordas);
window.addEventListener('pointermove',e=>{
  if(!state?.scroll?.ropeMouse || !pergaminhoAberto || movimentoReduzido.matches)return;
  const rect=pergaminho.getBoundingClientRect();
  if(e.clientX<rect.left-60||e.clientX>rect.right+60||e.clientY<rect.top-60||e.clientY>rect.bottom)return;
  const movement=clamp(e.movementX||0,-25,25)*Number(state.scroll.ropeAmplitude??1)*.23;
  cordPhysics.ropes.forEach(rope=>rope.points.slice(1).forEach((pt,i)=>{pt.px-=movement*(i+1)/segments;}));
},{passive:true});
// A explosão é definitiva. O botão é substituído por um pergaminho.
// Recarregar a página reinicia a experiência; o botão nunca retorna na sessão atual.
const pergaminho=document.querySelector('#pergaminho');
let pergaminhoAberto=false;

function abrirPergaminho() {
  // A estrutura mantém o conteúdo acessível; o papel e os rolos são camadas independentes.
  pergaminho.hidden=false;
  pergaminho.classList.remove('aberto');
  impulsoCordas(1);
  const folha=pergaminho.querySelector('.pergaminho-folha');
  const nomes=pergaminho.querySelectorAll('.lista-membros li');
  const inferior=pergaminho.querySelector('.rolo-inferior');
  const superior=pergaminho.querySelector('.rolo-superior');
  const duracao=Math.max(.4,Number(state?.button?.fadeDuration)||1.5);
  const altura=folha.getBoundingClientRect().height;
  pergaminho.style.setProperty('--scroll-height',altura+'px');
  if (movimentoReduzido.matches || !window.gsap) {
    pergaminho.classList.add('aberto');
    pergaminhoAberto=true;
    folha.style.clipPath='none';
    pergaminhoAberto=true;
    nomes.forEach(li=>li.style.opacity='1');
    return;
  }
  // Papel enrolado: aparece primeiro apenas o cilindro superior.
  gsap.set(pergaminho,{opacity:0,y:-24,rotate:-3,scale:.94});
  gsap.set(folha,{clipPath:'inset(0 0 100% 0)',rotateX:-5});
  gsap.set(inferior,{y:-altura,rotate:-1});
  gsap.set(superior,{rotate:0});
  gsap.set(nomes,{opacity:0,y:8});
  const timeline=gsap.timeline({onComplete:()=>{
    pergaminho.classList.add('aberto');
    pergaminhoAberto=true;
    impulsoCordas(.4);
    gsap.set(pergaminho,{clearProps:'transform'});
    gsap.set(folha,{clearProps:'transform'});
    gsap.set(inferior,{clearProps:'transform'});
  }});
  timeline
    .to(pergaminho,{opacity:1,y:0,rotate:0,scale:1,duration:.7,ease:'back.out(1.25)'})
    .to(superior,{rotate:1.4,duration:.25,yoyo:true,repeat:1,ease:'sine.inOut'},'-=.15')
    .to(folha,{clipPath:'inset(0 0 0% 0)',rotateX:0,duration:duracao,ease:'power2.inOut'})
    .to(inferior,{y:0,rotate:2,duration:duracao,ease:'power2.inOut'},'<')
    .to(inferior,{rotate:0,duration:.6,ease:'elastic.out(1,.5)'})
    .to(nomes,{opacity:1,y:0,stagger:.07,duration:.35,ease:'power1.out'},'-=.5');
}

botao.addEventListener('click',(event)=>{
  if (pergaminhoAberto) return;
  pergaminhoAberto=true;
  botao.disabled=true;
  const animar=Boolean(state?.button?.animate) && !movimentoReduzido.matches && Boolean(window.gsap);
  if (!animar) {
    botao.hidden=true;
    abrirPergaminho();
    return;
  }
  botao.style.transition='box-shadow .3s ease,filter .3s ease';
  const shake=state.button.shake;
  gsap.timeline({onComplete:()=>{
    botao.hidden=true; // Não restaurar nem reativar o botão.
    abrirPergaminho();
  }})
    .to(botao,{x:2*shake,duration:.08,repeat:5,yoyo:true,ease:'none'})
    .to(botao,{x:-6*shake,rotation:-3*shake,duration:.05,repeat:9,yoyo:true,ease:'none'})
    .to(botao,{x:12*shake,rotation:6*shake,duration:.025,repeat:15,yoyo:true,ease:'none'})
    .to(botao,{x:0,rotation:0,scale:state.button.explosion,opacity:0,duration:.25,ease:'power4.out'});
});

/* ===============================================================
   FASE 3 — DOSSIÊS E FECHAMENTO REVERSO DO PERGAMINHO
   Sem trocar de página e sem recriar o botão original.
================================================================ */
const fichas = {
  pain: ['Pain (Nagato)','Amegakure — Vila da Chuva','Rinnegan, Seis Caminhos de Pain, Shinra Tensei e Chibaku Tensei.','Nagato foi um dos fundadores da Akatsuki original, ao lado de Yahiko e Konan. Após a morte de Yahiko, assumiu a liderança sob a identidade de Pain.'],
  konan: ['Konan','Amegakure — Vila da Chuva','Shikigami no Mai, manipulação e multiplicação de papel.','Amiga de infância de Yahiko e Nagato, participou da fundação da Akatsuki e permaneceu leal aos ideais de seus companheiros.'],
  itachi: ['Itachi Uchiha','Konohagakure — Vila da Folha','Sharingan, Mangekyō Sharingan, Tsukuyomi, Amaterasu e Susanoo.','Ninja do clã Uchiha, ingressou na Akatsuki após o massacre de seu clã. Sua história envolve decisões difíceis e segredos ligados à Vila da Folha.'],
  kisame: ['Kisame Hoshigaki','Kirigakure — Vila da Névoa','Espada Samehada, técnicas Suiton e grande reserva de chakra.','Conhecido como o Monstro da Névoa Oculta, formou uma dupla com Itachi e se destacou em confrontos com técnicas aquáticas.'],
  deidara: ['Deidara','Iwagakure — Vila da Pedra','Argila explosiva, criaturas moldadas e explosões de chakra.','Artista que considerava a explosão a expressão máxima de sua arte. Trabalhou com Sasori e depois com Tobi.'],
  sasori: ['Sasori','Sunagakure — Vila da Areia','Marionetes, venenos e transformação do próprio corpo.','Mestre das marionetes conhecido como Sasori da Areia Vermelha. Sua técnica permite controlar armas e marionetes com grande precisão.'],
  hidan: ['Hidan','Yugakure — Vila das Fontes Termais','Imortalidade, foice de três lâminas e ritual de Jashin.','Integrante da dupla com Kakuzu. Seu estilo de combate combina resistência incomum com um ritual de maldição.'],
  kakuzu: ['Kakuzu','Takigakure — Vila da Cachoeira','Jiongu, múltiplos corações e técnicas elementais.','Ninja experiente e obcecado por recompensas financeiras. Lutava ao lado de Hidan e possuía técnicas ligadas a diferentes naturezas de chakra.'],
  zetsu: ['Zetsu','Origem incomum — associado à Akatsuki','Espionagem, infiltração, deslocamento e habilidades de camuflagem.','Atuava principalmente na coleta de informações. Suas duas metades possuíam origens e motivações distintas.'],
  obito: ['Tobi (Obito Uchiha)','Konohagakure — Vila da Folha','Sharingan, Kamui e técnicas espaço-temporais.','Sob a identidade de Tobi, Obito manipulou acontecimentos ligados à Akatsuki e ao Plano Olho da Lua.']
};
const dossie=document.querySelector('#dossie');
let emTransicao=false;
let ultimoFoco=null;
let personagemAtual=null;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function animacao(elemento,vars) {
  return new Promise(resolve=>{
    if (!window.gsap || movimentoReduzido.matches) { resolve(); return; }
    gsap.to(elemento,{...vars,onComplete:resolve});
  });
}
// Menu do dossiê: exibe uma seção por vez, mantendo navegação por teclado.
function montarDossie(id,habilidades,historia){
 const dados=window.JAVAS_DOSSIERS?.[id]||{};
 const assuntos=[...(window.JAVAS_TOPICS||[]),'Mensagem do dia'];
 const menu=document.querySelector('#dossie-menu'), detalhe=document.querySelector('#dossie-detalhe');
 const toggle=document.querySelector('#dossie-menu-toggle'), current=document.querySelector('#dossie-menu-current');
 const setMenu=(open)=>{menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.classList.toggle('aberto',open);};
 toggle.onclick=()=>setMenu(menu.hidden);setMenu(false);
 menu.replaceChildren();
 const conteudo={...dados,'Habilidades':habilidades,'História':historia};
 if(!conteudo['Confrontos na Akatsuki']) conteudo['Confrontos na Akatsuki']='Comparações hipotéticas dependem do terreno, preparo, condições e versão dos personagens; não existe vencedor canônico para todos os confrontos.';
 for(const assunto of assuntos){
   const botao=document.createElement('button'); botao.type='button'; botao.textContent=assunto;
   botao.addEventListener('click',(event)=>{
     for(const outro of menu.children){outro.classList.toggle('ativo',outro===botao);outro.setAttribute('aria-pressed',String(outro===botao));}
     detalhe.replaceChildren();const titulo=document.createElement('h3');titulo.textContent=assunto;
     const p=document.createElement('p');p.textContent=conteudo[assunto]||'Informação não confirmada no material canônico consultado. Campo disponível para pesquisa e atualização.';
     if(assunto==='Mensagem do dia'){const box=document.createElement('div');box.className='audio-message';const play=document.createElement('button');play.type='button';play.textContent='▶ Play';const stop=document.createElement('button');stop.type='button';stop.textContent='■ Stop';const msg=document.createElement('p');msg.setAttribute('role','status');msg.textContent='Selecione Play para ouvir uma mensagem aleatória deste personagem.';play.onclick=()=>window.JAVAS_AUDIO?.playMessage(id,msg);stop.onclick=()=>window.JAVAS_AUDIO?.stopMessage();box.append(play,stop,msg);detalhe.append(titulo,box);}else detalhe.append(titulo,p);current.textContent=assunto;setMenu(false);
     if(event?.isTrusted){detalhe.focus({preventScroll:true});detalhe.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});}
   });menu.append(botao);
 }
 menu.firstElementChild?.click();
}
// Efeitos procedurais por personagem; os controles são independentes.
const fx=document.querySelector('#efeito-personagem');let eyeTimer=null,eyeFrame=null;
function limparEfeito(){cancelAnimationFrame(bloodFrame);pararAmaterasu();clearTimeout(eyeTimer);cancelAnimationFrame(eyeFrame);fx.replaceChildren();fx.className='efeito-personagem';document.body.classList.remove('itachi-amaterasu');dossie.style.removeProperty('--burn-duration');}
function prepararEfeito(id){
 limparEfeito();const c=state[id]||{};if(!c.enabled||movimentoReduzido.matches)return;
 fx.classList.add('fx-'+id);fx.style.setProperty('--fx-intensity',c.effectIntensity);
 fx.style.setProperty('--fx-glow',c.glow);fx.style.setProperty('--fx-duration',c.entryDuration+'s');
 if(id==='itachi'){
   fx.style.setProperty('--eye-opacity',c.eyeOpacity);fx.style.setProperty('--eye-scale',c.eyeScale);
   fx.style.setProperty('--eye-shine',c.eyeShine);
   const olhos=document.createElement('div');olhos.className='itachi-olhos';
   for(let i=0;i<2;i++){const olho=document.createElement('div');olho.className='itachi-olho';
     const iris=document.createElement('div');iris.className='itachi-iris';iris.innerHTML='<span class="mangekyo"></span><span class="eye-reflection"></span>';
     olho.append(iris);const sangue=document.createElement('span');sangue.className='itachi-sangue';sangue.innerHTML='<svg class="sangue-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="blood-gradient-'+i+'"><stop stop-color="#390007"/><stop offset=".38" stop-color="#9e0618"/><stop offset=".66" stop-color="#c01829"/><stop offset="1" stop-color="#400008"/></linearGradient></defs><path class="sangue-path" fill="url(#blood-gradient-'+i+')"/><path class="sangue-brilho" fill="none" stroke="#ff7180" stroke-opacity=".36" stroke-width="1"/><ellipse class="sangue-ponta" fill="#8c0714"/></svg>'; const conjunto=document.createElement('div');conjunto.className='itachi-olho-conjunto';conjunto.append(olho,sangue);olhos.append(conjunto);}
   fx.append(olhos);
   // SVG orgânico: cada rastro é atualizado por uma frente líquida com gravidade.
   olhos.querySelectorAll('.itachi-sangue').forEach((el,i)=>{el.dataset.side=i;});
   // Cada globo ocular acompanha o mesmo alvo na tela. O primeiro olho tem
   // espelhamento CSS, portanto seu deslocamento local X precisa ser invertido.
   // A interpolação dá atraso orgânico e microssacadas evitam olhar congelado.
   let targetX=0,targetY=0,currentX=0,currentY=0,lastTime=performance.now();
   let microX=0,microY=0,nextMicro=0;
   const move=e=>{
     if(personagemAtual!=='itachi'||olhos.classList.contains('olhar-fixo'))return;
     targetX=Math.max(-1,Math.min(1,(e.clientX/innerWidth-.5)*2));
     targetY=Math.max(-1,Math.min(1,(e.clientY/innerHeight-.5)*2));
   };
   window.addEventListener('pointermove',move,{signal:eyeAbort.signal,passive:true});
   window.addEventListener('pointerdown',move,{signal:eyeAbort.signal,passive:true});
   function animarOlhar(now){
     if(!olhos.isConnected)return;
     const dt=Math.min(.06,Math.max(0,(now-lastTime)/1000));lastTime=now;
     const locked=olhos.classList.contains('olhar-fixo');
     const delay=Math.max(.08,Number(c.eyeFollowDelay??.65));
     const alpha=1-Math.exp(-dt*3/delay);
     currentX+=(locked?0:targetX-currentX)*alpha;
     currentY+=(locked?0:targetY-currentY)*alpha;
     if(now>nextMicro){microX=(Math.random()-.5)*1.3;microY=(Math.random()-.5)*.8;nextMicro=now+650+Math.random()*1700;}
     const intensity=Number(c.eyeMicroMotion??.55);
     const dx=(currentX*13*Number(c.eyeTracking??1)+microX*intensity);
     const dy=(currentY*8*Number(c.eyeTracking??1)+microY*intensity);
     const irises=olhos.querySelectorAll('.itachi-iris');
     irises.forEach((iris,i)=>{iris.style.setProperty('--look-x',((i===0?-1:1)*dx).toFixed(2)+'px');iris.style.setProperty('--look-y',dy.toFixed(2)+'px')});
     eyeFrame=requestAnimationFrame(animarOlhar);
   }
   eyeFrame=requestAnimationFrame(animarOlhar);
   const piscar=()=>{if(personagemAtual!=='itachi')return;olhos.classList.add('piscando');setTimeout(()=>olhos.classList.remove('piscando'),210);
      eyeTimer=setTimeout(piscar,(c.blinkInterval*.7+Math.random()*c.blinkInterval*.7)*1000);};
   eyeTimer=setTimeout(piscar,c.blinkInterval*1000);
 }else{
   const simbolo=document.createElement('div');simbolo.className='fx-simbolo';
   simbolo.textContent=({pain:'◎',konan:'❖',kisame:'≋',deidara:'✹',sasori:'⌘',hidan:'☯',kakuzu:'〰',zetsu:'❧',obito:'◉'})[id]||'暁';fx.append(simbolo);
 }
}
let eyeAbort=new AbortController();const oldLimpar=limparEfeito;
limparEfeito=function(){eyeAbort.abort();eyeAbort=new AbortController();oldLimpar();};
// Sangramento SVG com largura variável, curvatura, aceleração e gota volumosa.
// Não usa linhas CSS escaladas: a geometria muda quadro a quadro.
let bloodFrame=0;
function iniciarSangramentoOrganico(olhos,c){
 cancelAnimationFrame(bloodFrame);
 const trails=[...olhos.querySelectorAll('.itachi-sangue')];
 const start=performance.now();
 const amount=Number(c.bloodAmount??.8), width=Number(c.bloodWidth??9);
 const reach=Math.max(5,Math.min(60,Number(c.bloodReach??45)))*innerHeight/100;
 const emergence=Math.max(.15,Number(c.bloodEmergence??.8));
 const initial=Math.max(4,Number(c.bloodInitialSpeed??35));
 const acceleration=Math.max(0,Number(c.bloodAcceleration??180));
 const viscosity=Math.max(0,Math.min(1,Number(c.bloodViscosity??.5)));
 const maxSpeed=Math.max(30,Number(c.bloodMaxSpeed??340));
 olhos.classList.add('sangrando');
 trails.forEach((el,i)=>{
   el.style.opacity=String(amount*(i?0.82:1));
   el.style.width=(width*4)+'px';el.style.height=(reach+35)+'px';
   el.style.left=(i?57:43)+'%';
 });
 function render(now){
   if(!olhos.isConnected||!olhos.classList.contains('sangrando'))return;
   const elapsed=(now-start)/1000;
   trails.forEach((el,i)=>{
     const t=Math.max(0,elapsed-i*.18-emergence);
     const a=acceleration*(1-viscosity*.55);
     const accelerateUntil=Math.max(0,(maxSpeed-initial)/Math.max(1,a));
     const travel=t<accelerateUntil?initial*t+.5*a*t*t:
       initial*accelerateUntil+.5*a*accelerateUntil*accelerateUntil+maxSpeed*(t-accelerateUntil);
     const length=Math.min(reach,travel);
     const path=el.querySelector('.sangue-path'),glint=el.querySelector('.sangue-brilho'),drop=el.querySelector('.sangue-ponta');
     const center=width*2,points=[],left=[],right=[];
     // Uma pequena poça aparece primeiro na margem da pálpebra.
     const pool=Math.min(1,Math.max(0,(elapsed-i*.18)/emergence));
     const h=Math.max(2,length);
     const segments=Math.max(8,Math.ceil(h/9));
     for(let j=0;j<=segments;j++){
       const u=j/segments,y=h*u;
       const curve=Math.sin(u*5.7+i*1.3)*width*.31*u + Math.sin(u*11.2+i)*width*.13*u;
       const taper=.55+.24*Math.sin(u*7+i)+.19*Math.sin(u*16+i*.6);
       const thick=width*(.38+.62*pool)*(u>.94?1.05:taper);
       left.push([center+curve-thick/2,y]);right.push([center+curve+thick/2,y]);
     }
     const shape=[...left,...right.reverse()].map(([x,y],idx)=>(idx?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)).join(' ')+' Z';
     path.setAttribute('d',shape);
     const last=left.at(-1),tipX=center+Math.sin(5.7+i*1.3)*width*.31+Math.sin(11.2+i)*width*.13;
     drop.setAttribute('cx',tipX.toFixed(2));drop.setAttribute('cy',h.toFixed(2));
     drop.setAttribute('rx',(width*(.43+.12*pool)).toFixed(2));
     drop.setAttribute('ry',(width*(.65+.2*pool)).toFixed(2));
     glint.setAttribute('d',`M ${center-width*.12} 2 Q ${center-width*.4} ${h*.45} ${tipX-width*.12} ${h*.83}`);
     drop.style.opacity=String(Math.min(1,Math.max(0,pool)));
   });
   bloodFrame=requestAnimationFrame(render);
 }
 bloodFrame=requestAnimationFrame(render);
}
// Linha do tempo do Amaterasu: todas as etapas recebem valores do editor.
// O estado é removido na limpeza do efeito para permitir abrir o card novamente.
async function encerrarEfeito(id){
 const c=state[id]||{};
 if(!c.enabled||movimentoReduzido.matches)return;
 if(id!=='itachi'){fx.classList.add('fx-saindo');await sleep(c.exitDuration*450);return;}
 const olhos=fx.querySelector('.itachi-olhos');
 if(!olhos)return;
 const wait=async seconds=>{if(seconds>0)await sleep(seconds*1000);};
 // A mira fica imóvel antes da transformação: olhar fixo no card.
 olhos.classList.add('olhar-fixo');
 await wait(c.focusDelay??.4);
 if(c.mangekyoEnabled!==false){
   olhos.classList.add('mangekyo-ativo');
   olhos.style.setProperty('--mangekyo-duration',(c.mangekyoDuration??.5)+'s');
 }
 await wait(c.mangekyoDuration??.5);
 if(c.bloodEnabled!==false){
   iniciarSangramentoOrganico(olhos,c);
 }
 await wait(c.bloodDelay??.3);
 await wait(c.bloodDuration??.6);
 await wait(c.dramaticPause??.4);
 if(c.amaterasuEnabled!==false){
   // Fase 4.4: o renderer controla a máscara irregular e o fogo;
   // não removemos a classe antes de ocultar o dossiê.
   await queimarCardAmaterasu(c);
 }
 await wait(c.eyeHold??.5);
 olhos.style.setProperty('--eye-fade',(c.eyeFade??.5)+'s');
 olhos.classList.add('olhos-desaparecendo');
 await wait(c.eyeFade??.5);
 // A trilha permanece independente dos olhos e se dissolve depois deles.
 await wait(c.bloodAfterEye??1.4);
 olhos.style.setProperty('--blood-fade',(c.bloodFade??1.6)+'s');
 olhos.classList.add('sangue-desaparecendo');
 await wait(c.bloodFade??1.6);
}
async function selecionarPersonagem(id) {
  if (emTransicao || !pergaminhoAberto || !state?.characters?.enabled || !fichas[id]) return;
  emTransicao=true;
  ultimoFoco=document.activeElement;
  const opts=state.characters;
  const folha=pergaminho.querySelector('.pergaminho-folha');
  const inferior=pergaminho.querySelector('.rolo-inferior');
  const nomes=pergaminho.querySelectorAll('.lista-membros li');
  const altura=folha.getBoundingClientRect().height;
  await sleep(movimentoReduzido.matches?0:opts.delay*1000);
  pergaminho.classList.remove('aberto');
  if (window.gsap && !movimentoReduzido.matches) {
    gsap.killTweensOf([folha,inferior,...nomes]);
    await Promise.all([
      animacao(folha,{clipPath:'inset(0 0 100% 0)',duration:opts.closeDuration,ease:'power2.inOut'}),
      animacao(inferior,{y:-altura,rotation:-2,duration:opts.closeDuration,ease:'power2.inOut'}),
      animacao(nomes,{opacity:0,duration:Math.min(.35,opts.closeDuration/2)})
    ]);
  }
  impulsoCordas(.8);
  pergaminho.hidden=true;
  const [nome,origem,habilidades,historia]=fichas[id];
  document.querySelector('#dossie-nome').textContent=nome;
  document.querySelector('#dossie-origem').textContent=origem;
  document.querySelector('#dossie-habilidades').textContent=habilidades;
  document.querySelector('#dossie-historia').textContent=historia;
  personagemAtual=id;
  window.JAVAS_AUDIO?.setCharacter(id);
  montarDossie(id,habilidades,historia);
  prepararEfeito(id);
  dossie.classList.remove('amaterasu-consumido','queimando');
  dossie.style.removeProperty('clip-path');
  dossie.hidden=false;
  if (window.gsap && !movimentoReduzido.matches) {
    gsap.set(dossie,{opacity:0,y:35,scale:.94});
    await animacao(dossie,{opacity:1,y:0,scale:1,duration:opts.cardDuration,ease:'power2.out'});
  }
  document.querySelector('#fechar-dossie').focus();
  emTransicao=false;
}
async function voltarPergaminho() {
  if (emTransicao || dossie.hidden) return;
  emTransicao=true;
  window.JAVAS_AUDIO?.setCharacter(null);
  await encerrarEfeito(personagemAtual);
  // A animação já consumiu o card. Nunca restaurar a opacidade
  // nem executar uma transição que possa fazê-lo reaparecer.
  if (!dossie.classList.contains('amaterasu-consumido') && window.gsap && !movimentoReduzido.matches) {
    await animacao(dossie,{opacity:0,y:15,duration:.3,ease:'power1.in'});
  }
  dossie.hidden=true;
  gsap?.killTweensOf?.(dossie);
  dossie.classList.remove('amaterasu-consumido','queimando');
  dossie.style.removeProperty('clip-path');
  dossie.style.removeProperty('opacity');
  if(window.gsap) gsap.set(dossie,{clearProps:'opacity,transform,clipPath,filter'});
  limparEfeito(); personagemAtual=null;
  pergaminhoAberto=false;
  abrirPergaminho();
  // Reativa o foco no primeiro nome após o retorno visual.
  setTimeout(()=>{
    (ultimoFoco?.isConnected?ultimoFoco:document.querySelector('.membro-link'))?.focus({preventScroll:true});
    emTransicao=false;
  }, movimentoReduzido.matches?0:(Math.max(.4,Number(state.button.fadeDuration)||1.5)+1.3)*1000);
}
document.querySelectorAll('.membro-link').forEach(b=>{
  b.addEventListener('click',()=>selecionarPersonagem(b.dataset.personagem));
});
document.querySelector('#fechar-dossie').addEventListener('click',voltarPergaminho);
document.querySelector('#voltar-pergaminho').addEventListener('click',voltarPergaminho);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!dossie.hidden) voltarPergaminho();
  if(e.key==='Tab'&&!dossie.hidden){
    const els=[...dossie.querySelectorAll('button:not([disabled])')];
    if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1).focus();}
    else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0].focus();}
  }
});

function resize() {
  if (!renderer||!uniforms) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,state.curtain.quality));
  renderer.setSize(innerWidth,innerHeight);
  uniforms.uResolution.value.set(innerWidth,innerHeight);
}
async function startCurtain() {
  const THREE=await import('./vendor/three.module.js');
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10); camera.position.z=1;
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setClearColor(0x000000,1);
  const image=await new THREE.TextureLoader().loadAsync('./imagens/estampa.png');
  texture=image;
  image.colorSpace=THREE.SRGBColorSpace;
  image.wrapS=image.wrapT=THREE.ClampToEdgeWrapping;
  image.minFilter=THREE.LinearMipmapLinearFilter;
  image.magFilter=THREE.LinearFilter;
  image.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  uniforms={
    uTexture:{value:image},uTime:{value:0},uResolution:{value:new THREE.Vector2(innerWidth,innerHeight)},
    uImageSize:{value:new THREE.Vector2(image.image.width,image.image.height)},
    uMouse:{value:new THREE.Vector2(.5,.5)},uMouseForce:{value:0},
    uFoldCount:{value:8},uFoldDepth:{value:.32},uTextureWarp:{value:.003},
    uNaturalAmplitude:{value:.0015},uNaturalSpeed:{value:.6},
    uMouseStrength:{value:.0025},uMouseRadius:{value:.3},uLight:{value:1},
    uScale:{value:1},uPosition:{value:new THREE.Vector2(.5,.5)},
    uNaturalEnabled:{value:1},uCursorEnabled:{value:1}
  };
  const vertexShader=`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
  const fragmentShader=`
    precision highp float;
    uniform sampler2D uTexture;
    uniform float uTime,uMouseForce,uFoldCount,uFoldDepth,uTextureWarp;
    uniform float uNaturalAmplitude,uNaturalSpeed,uMouseStrength,uMouseRadius,uLight,uScale;
    uniform float uNaturalEnabled,uCursorEnabled;
    uniform vec2 uResolution,uImageSize,uMouse,uPosition;
    varying vec2 vUv;
    const float PI=3.141592653589793;
    vec2 cover(vec2 uv){
      float screenAspect=uResolution.x/max(uResolution.y,1.0);
      float imageAspect=uImageSize.x/max(uImageSize.y,1.0);
      if(screenAspect>imageAspect) uv.y=(uv.y-.5)*imageAspect/screenAspect+.5;
      else uv.x=(uv.x-.5)*screenAspect/imageAspect+.5;
      // Escala em torno da posição selecionada; clamp evita repetições.
      uv=(uv-uPosition)/max(uScale,.1)+uPosition;
      return clamp(uv,vec2(.0),vec2(1.0));
    }
    float foldPhase(vec2 uv){
      return uv.x*uFoldCount*2.0*PI+sin(uv.y*3.0+uv.x*4.0)*.08;
    }
    void main(){
      vec2 uv=vUv;
      float phase=foldPhase(uv);
      float fold=sin(phase)*uTextureWarp;
      float natural=(.25+(1.0-uv.y)*.75)*sin(uv.y*5.0+uv.x*3.0+uTime*uNaturalSpeed)*uNaturalAmplitude*uNaturalEnabled;
      vec2 delta=uv-uMouse; delta.x*=uResolution.x/max(uResolution.y,1.0);
      float dist=length(delta);
      float influence=1.0-smoothstep(0.0,uMouseRadius,dist);
      float cursor=sin(dist*12.0-uTime*4.0)*influence*uMouseForce*uMouseStrength*uCursorEnabled;
      vec2 sampleUV=cover(uv+vec2(fold+natural+cursor,0.0));
      vec4 color=texture2D(uTexture,sampleUV);
      // Sombras suaves: não deslocam a estampa de forma exagerada.
      float light=clamp(.82+cos(phase)*uFoldDepth,.58,1.08);
      color.rgb*=mix(1.0,light,clamp(uLight,0.0,1.5));
      gl_FragColor=vec4(color.rgb,1.0);
    }
  `;
  const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader});
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
  apply(state); resize();
  renderer.render(scene,camera);
  cortina.appendChild(renderer.domElement);
  let lastX=.5,lastY=.5,first=true,targetForce=0,mouseTarget=new THREE.Vector2(.5,.5);
  const curtainPointer=(event)=>{
    if (movimentoReduzido.matches||!state.curtain.cursorEnabled) return;
    const x=event.clientX/innerWidth,y=1-event.clientY/innerHeight;
    if(first){first=false;lastX=x;lastY=y;mouseTarget.set(x,y);uniforms.uMouse.value.set(x,y);return;}
    const speed=Math.hypot(x-lastX,y-lastY);
    targetForce=Math.min(1,speed*20);
    mouseTarget.set(x,y);lastX=x;lastY=y;
  };
  window.addEventListener('pointermove',curtainPointer,{passive:true});
  window.addEventListener('pointerdown',(event)=>{first=true;curtainPointer(event);targetForce=Math.max(targetForce,Math.min(1,state.curtain.touchImpulse??.35));},{passive:true});
  document.documentElement.addEventListener('pointerleave',()=>{first=true;targetForce=0;});
  window.addEventListener('resize',resize);
  const clock=new THREE.Clock();
  function frame(){
    requestAnimationFrame(frame);
    const dt=Math.min(clock.getDelta(),.05);
    if(!movimentoReduzido.matches){
      uniforms.uTime.value+=dt;
      const smoothing=1-Math.pow(.92,dt*60);
      uniforms.uMouse.value.lerp(mouseTarget,smoothing);
      uniforms.uMouseForce.value+=(targetForce-uniforms.uMouseForce.value)*smoothing;
      targetForce*=Math.pow(.93,dt*60);
    } else uniforms.uMouseForce.value=0;
    renderer.render(scene,camera);
  }
  frame();
}
async function start(){
  const response=await fetch('./config.json',{cache:'no-store'});
  if(!response.ok) throw new Error('config.json não encontrado');
  defaults=await response.json();
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(STORAGE));}catch{}
  const cached=await readConfiguration('public:site').catch(()=>null);
  apply(cached?.config_value||saved||defaults);
  watchPublic('site',record=>apply(record.config_value));
  canal.postMessage({type:'request'});
  try {await startCurtain();console.log('Cortina WebGL ativa.');}
  catch(err){console.error('WebGL indisponível:',err);aviso.hidden=false;aviso.textContent='A estampa está em modo CSS. Confira o Console (F12) para ver o erro do WebGL.';}
}
start().catch(err=>{console.error(err);aviso.hidden=false;aviso.textContent='Erro de inicialização: '+err.message;});

// FASE 4.4 — Amaterasu procedural. Canvas transparente de labaredas,
// partículas e fumaça + clip-path orgânico que realmente consome o card.
// O canvas fica fora do dossiê para o fogo sobreviver à dissolução do conteúdo.
let amaterasuFrame=0, amaterasuCanvas=null;
function pararAmaterasu(){
  cancelAnimationFrame(amaterasuFrame);amaterasuFrame=0;
  amaterasuCanvas?.remove();amaterasuCanvas=null;
}
const fogoClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function ruidoFogo(x,t){return Math.sin(x*1.7+t*2.3)*.47+Math.sin(x*4.1-t*3.7)*.24+Math.sin(x*9.3+t*1.1)*.12+Math.sin(x*17.9-t*4.4)*.06;}
function frenteFogo(x,t,progress,w,h,c){
  const turbulence=c.fireTurbulence??.65;
  const rough=ruidoFogo(x/w*9,t)*h*.055*turbulence;
  return h*(1-progress)+rough;
}
async function queimarCardAmaterasu(c){
  pararAmaterasu();
  const duration=Math.max(.2,c.amaterasuDuration??1.6)*1000;
  const rect=dossie.getBoundingClientRect();
  const canvas=document.createElement('canvas');canvas.className='amaterasu-canvas';
  canvas.setAttribute('aria-hidden','true');document.body.append(canvas);amaterasuCanvas=canvas;
  const ctx=canvas.getContext('2d');
  const density=Math.min(devicePixelRatio||1,1.5);
  const w=rect.width,h=rect.height;
  canvas.width=Math.ceil(w*density);canvas.height=Math.ceil(h*density);
  canvas.style.left=rect.left+'px';canvas.style.top=rect.top+'px';
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  ctx.scale(density,density);
  const count=Math.round(fogoClamp(c.fireParticles??35,0,110));
  const particles=Array.from({length:count},(_,i)=>({x:Math.random()*w,y:Math.random()*h,seed:Math.random()*20,size:1+Math.random()*3}));
  const start=performance.now();
  dossie.classList.add('queimando');
  // Promise resolve apenas após o último frame; o card fica oculto.
  await new Promise(resolve=>{
    const draw=now=>{
      const p=fogoClamp((now-start)/duration,0,1),t=(now-start)/1000;
      ctx.clearRect(0,0,w,h);
      const step=Math.max(5,w/72), edge=[];
      for(let x=0;x<=w+step;x+=step)edge.push([Math.min(w,x),frenteFogo(x,t,p,w,h,c)]);
      // O polígono cobre somente a área ainda não consumida.
      // Em cada frame a borda é irregular e sobe de baixo para cima.
      const polygon=['0px 0px',`${w}px 0px`,...edge.slice().reverse().map(([x,y])=>`${x.toFixed(1)}px ${fogoClamp(y,0,h).toFixed(1)}px`)];
      dossie.style.clipPath=`polygon(${polygon.join(',')})`;
      const intensity=c.fireIntensity??.9, height=(c.fireHeight??.55)*105;
      const purple=(c.firePurple??.3),red=(c.fireRed??.16),blend=(c.fireGradient??.5);
      // Línguas de fogo: múltiplas fitas curvas com transparência e brilho baixo.
      for(let i=0;i<edge.length-1;i++){
        const [x,y]=edge[i],next=edge[i+1];
        if(y< -height || y>h+height)continue;
        const sway=ruidoFogo(i*.7,t)*height*.3;
        const flameH=height*(.35+.65*Math.abs(ruidoFogo(i*.4+2,t*1.3)));
        const width=step*(1.5+Math.abs(ruidoFogo(i*.6,t)));
        const g=ctx.createLinearGradient(x,y,x+sway,y-flameH);
        const edgeAlpha=fogoClamp(intensity,0,1)*.8;
        g.addColorStop(0,`rgba(5,3,9,${edgeAlpha})`);
        g.addColorStop(.27,`rgba(${Math.round(28+red*58)},${Math.round(2+purple*8)},${Math.round(18+purple*78)},${(.6*intensity*blend).toFixed(3)})`);
        g.addColorStop(.68,`rgba(12,6,19,${(.46*intensity).toFixed(3)})`);
        g.addColorStop(1,'rgba(3,3,8,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-width*.5,y+5);
        ctx.quadraticCurveTo(x-width*.8+sway*.4,y-flameH*.52,x+sway,y-flameH);
        ctx.quadraticCurveTo(x+width*.5+sway*.3,y-flameH*.47,x+width*.5,y+5);
        ctx.closePath();ctx.fill();
        // Faixa de carbonização escura ao longo da borda consumida.
        ctx.strokeStyle=`rgba(5,2,8,${.55*intensity})`;ctx.lineWidth=3+(c.fireChar??.7)*7;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(next[0],next[1]);ctx.stroke();
      }
      // Fumaça ascendente e fragmentos, limitados para mobile.
      for(const particle of particles){
        const yy=(particle.y-t*(25+particle.seed*2))%h;
        const y=yy<0?yy+h:yy;
        const front=frenteFogo(particle.x,t,p,w,h,c);
        if(Math.abs(y-front)>height*1.5)continue;
        const drift=Math.sin(t*1.8+particle.seed)*16;
        const smoke=fogoClamp(c.fireSmoke??.55,0,1);
        ctx.fillStyle=`rgba(17,13,24,${(.11*smoke).toFixed(3)})`;
        ctx.beginPath();ctx.ellipse(particle.x+drift,y-20,particle.size*7,particle.size*12,.3,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=`rgba(32,12,40,${(.5*intensity).toFixed(3)})`;
        ctx.fillRect(particle.x+drift,y,particle.size,particle.size*1.6);
      }
      if(p<1){amaterasuFrame=requestAnimationFrame(draw);}else{
        dossie.classList.add('amaterasu-consumido');
        dossie.style.clipPath='inset(0 0 100% 0)';
        dossie.style.opacity='0';
        pararAmaterasu();resolve();
      }
    };
    amaterasuFrame=requestAnimationFrame(draw);
  });
}
