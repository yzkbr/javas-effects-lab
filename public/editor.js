/* Controles existentes; persistência remota exige autorização RLS. */
import {ConfigurationSync, latestPublic, watchPublic} from './config-sync.mjs';
import * as store from './config-store.mjs';
let synchronizer, versions={}, persistence=Promise.resolve();
function persist(name,value) {
  const copy=structuredClone(value);
  persistence=persistence.catch(()=>{}).then(()=>synchronizer.stage(name,copy,versions[name]));
  persistence.catch(error=>{status.textContent='Falha ao guardar rascunho: '+error.message;});
}
const STORAGE = 'javas-effects-lab-v1';
const CHANNEL = 'javas-effects-live-v1';
const canal = new BroadcastChannel(CHANNEL);
const $ = (s) => document.querySelector(s);
const status = $('#status');

// O esquema define quais propriedades o usuário pode alterar e seus limites.
const sections = [
  {id:'audio',title:'Áudio — reprodução',description:'Volumes, transições e mensagens; gerenciamento de arquivos na seção abaixo.',fields:[['enabled','Ativar áudio','checkbox'],['masterVolume','Volume geral','range',0,1,.05],['ambientVolume','Volume ambiente','range',0,1,.05],['messageVolume','Volume das mensagens','range',0,1,.05],['fadeSeconds','Tempo do fade (s)','range',0,3,.1],['avoidRepeat','Evitar repetição consecutiva','checkbox'],['dailyMode','Mensagem fixa por dia','checkbox'],['autoplayAfterGesture','Iniciar após interação','checkbox']]},
  { id:'curtain', title:'Cortina e tecido', description:'Dobras, oscilação, resposta ao cursor e desempenho.', fields:[
    ['enabled','Exibir cortina','checkbox'],['folds','Quantidade de dobras','range',1,24,1],['depth','Profundidade / sombra','range',0,0.65,.01],['warp','Deformação da estampa','range',0,.015,.0005],
    ['naturalEnabled','Movimento natural','checkbox'],['naturalAmplitude','Amplitude natural','range',0,.01,.0005],['naturalSpeed','Velocidade natural','range',0,3,.05],
    ['cursorEnabled','Reação ao cursor','checkbox'],['mouseStrength','Força do cursor','range',0,.02,.0005],['mouseRadius','Raio do cursor','range',.05,.8,.01],['touchImpulse','Impulso do toque (mobile)','range',0,1,.05],
    ['light','Intensidade da iluminação','range',0,1.5,.05],['quality','Qualidade de renderização','range',.5,2,.25]
  ]},
  { id:'curtain', anchor:'pattern', title:'Estampa', description:'Enquadramento da imagem sem alterar o arquivo original.', fields:[
    ['scale','Escala da estampa','range',.5,2,.05],['positionX','Posição horizontal (%)','range',0,100,1],['positionY','Posição vertical (%)','range',0,100,1]
  ]},
  { id:'model3d', title:'Pergaminho 3D — modelagem', description:'Fase 1: modelo tridimensional inspecionável. Abra modelo.html para observar as alterações.', fields:[
    ['rotationX','Inclinação vertical (°)','range',-90,90,1],['rotationY','Rotação lateral (°)','range',-180,180,1],['rotationZ','Rotação frontal (°)','range',-180,180,1],
    ['zoom','Escala do modelo','range',.5,1.8,.05],['light','Intensidade da luz','range',.2,5,.1],
    ['metalness','Metal das ponteiras','range',0,1,.05],['roughness','Rugosidade do metal','range',.05,1,.05],
    ['cloudScale','Escala das nuvens','range',.5,3,.1],['ropeSwing','Oscilação das cordas','range',0,1,.05],
    ['open','Abertura experimental','range',0,1,.01],['autoRotate','Rotação automática','checkbox']
  ]},
  { id:'scroll', title:'Pergaminho — cordas e papel', description:'Movimento pendular amortecido e bordas rasgadas transparentes.', fields:[['ropeAmplitude','Amplitude do balanço','range',0,3,.1],['ropeFrequency','Frequência do pêndulo','range',.3,4,.1],['ropeDamping','Amortecimento','range',.1,3,.05],['ropeImpulse','Impulso na abertura','range',0,8,.25],['ropeGravity','Gravidade','range',100,2200,50],['ropeStiffness','Rigidez dos segmentos','range',.2,1,.05],['ropeLength','Comprimento da corda (px)','range',30,105,1],['tasselLength','Comprimento dos fios (px)','range',10,55,1],['tasselSpread','Abertura dos fios','range',.3,2,.1],['ropeMouse','Interagir com o mouse','checkbox'],['raggedEdges','Bordas vazadas','checkbox']]},
  { id:'characters', title:'Personagens e cards', description:'Clique nos nomes para fechar o pergaminho e revelar um dossiê.', fields:[
    ['enabled','Habilitar nomes interativos','checkbox'],['hoverColor','Cor do nome ao passar o mouse','color'],
    ['delay','Espera antes do fechamento (s)','range',0,4,.1],['closeDuration','Duração do fechamento (s)','range',.3,5,.1],
    ['cardDuration','Entrada do card (s)','range',.1,3,.1],['cardWidth','Largura do card (px)','range',320,800,10],
    ['cardRadius','Arredondamento (px)','range',0,60,1],['cardOpacity','Opacidade do card','range',.6,1,.01]
  ]},
  { id:'pain', title:'Pain — efeitos', description:'Configurações independentes para o personagem Pain.', fields:[['enabled','Ativar efeitos','checkbox'],['effectIntensity','Intensidade','range',0,1,.01],['entryDuration','Duração da entrada (s)','range',.1,5,.1],['exitDuration','Duração da saída (s)','range',.1,5,.1],['glow','Brilho','range',0,1,.01],['particles','Partículas','range',0,80,1],['eyeOpacity','Opacidade dos olhos (Itachi)','range',0,1,.01],['eyeTracking','Acompanhamento do olhar (Itachi)','range',0,1,.01],['eyeFollowDelay','Atraso natural do olhar (s)','range',.1,3,.05],['eyeMicroMotion','Micromovimentos involuntários','range',0,2,.05],['blinkInterval','Intervalo médio das piscadas (Itachi)','range',1,12,.2],['eyeScale','Escala dos olhos (Itachi)','range',.5,2,.05],['eyeShine','Reflexos (Itachi)','range',0,1,.01],['fireHeight','Altura das chamas (Itachi)','range',.1,1,.05]]},
  { id:'konan', title:'Konan — efeitos', description:'Configurações independentes para o personagem Konan.', fields:[['enabled','Ativar efeitos','checkbox'],['effectIntensity','Intensidade','range',0,1,.01],['entryDuration','Duração da entrada (s)','range',.1,5,.1],['exitDuration','Duração da saída (s)','range',.1,5,.1],['glow','Brilho','range',0,1,.01],['particles','Partículas','range',0,80,1],['eyeOpacity','Opacidade dos olhos (Itachi)','range',0,1,.01],['eyeTracking','Acompanhamento do olhar (Itachi)','range',0,1,.01],['eyeFollowDelay','Atraso natural do olhar (s)','range',.1,3,.05],['eyeMicroMotion','Micromovimentos involuntários','range',0,2,.05],['blinkInterval','Intervalo médio das piscadas (Itachi)','range',1,12,.2],['eyeScale','Escala dos olhos (Itachi)','range',.5,2,.05],['eyeShine','Reflexos (Itachi)','range',0,1,.01],['fireHeight','Altura das chamas (Itachi)','range',.1,1,.05]]},
  { id:'itachi', title:'Itachi — efeitos', description:'Configurações independentes para o personagem Itachi.', fields:[['enabled','Ativar efeitos','checkbox'],['effectIntensity','Intensidade','range',0,1,.01],['entryDuration','Duração da entrada (s)','range',.1,5,.1],['exitDuration','Duração da saída (s)','range',.1,5,.1],['glow','Brilho','range',0,1,.01],['particles','Partículas','range',0,80,1],['eyeOpacity','Opacidade dos olhos (Itachi)','range',0,1,.01],['eyeTracking','Acompanhamento do olhar (Itachi)','range',0,1,.01],['eyeFollowDelay','Atraso natural do olhar (s)','range',.1,3,.05],['eyeMicroMotion','Micromovimentos involuntários','range',0,2,.05],['blinkInterval','Intervalo médio das piscadas (Itachi)','range',1,12,.2],['eyeScale','Escala dos olhos (Itachi)','range',.5,2,.05],['eyeShine','Reflexos (Itachi)','range',0,1,.01],['fireHeight','Altura das chamas (Itachi)','range',.1,1,.05],['focusDelay','Tempo de fixação do olhar (s)','range',0,2,.1],['mangekyoEnabled','Ativar Mangekyō','checkbox'],['mangekyoDuration','Transformação Mangekyō (s)','range',.1,3,.1],['bloodEnabled','Ativar sangramento','checkbox'],['bloodDelay','Espera após surgir sangue (s)','range',0,3,.1],['bloodDuration','Escorrimento do sangue (s)','range',.1,4,.1],['bloodAmount','Intensidade do sangue','range',0,1,.05],['bloodReach','Alcance vertical do sangue (% da tela)','range',5,60,1],['bloodWidth','Espessura do sangue (px)','range',2,18,1],['bloodViscosity','Viscosidade do sangue','range',0,1,.05],['bloodEmergence','Tempo de formação da gota (s)','range',.1,4,.1],['bloodInitialSpeed','Velocidade inicial (px/s)','range',4,180,2],['bloodAcceleration','Aceleração gradual (px/s²)','range',0,500,10],['bloodMaxSpeed','Velocidade máxima (px/s)','range',30,800,10],['bloodAfterEye','Persistência após olhos sumirem (s)','range',0,5,.1],['bloodFade','Dissolução do sangue (s)','range',.2,6,.1],['dramaticPause','Pausa antes do Amaterasu (s)','range',0,3,.1],['amaterasuEnabled','Ativar Amaterasu','checkbox'],['amaterasuDuration','Queima do card (s)','range',.2,5,.1],['fireIntensity','Intensidade do fogo negro','range',0,1,.05],['fireTurbulence','Turbulência das labaredas','range',0,2,.05],['firePurple','Roxo do degradê','range',0,1,.05],['fireRed','Vermelho do degradê','range',0,1,.05],['fireGradient','Intensidade do degradê opcional','range',0,1,.05],['fireSmoke','Densidade da fumaça','range',0,1,.05],['fireChar','Carbonização das bordas','range',0,1,.05],['fireParticles','Partículas do Amaterasu','range',0,110,1],['eyeHold','Olhos após a queima (s)','range',0,3,.1],['eyeFade','Desaparecimento dos olhos (s)','range',.1,3,.1]]},
  { id:'kisame', title:'Kisame — efeitos', description:'Configurações independentes para o personagem Kisame.', fields:[['enabled','Ativar efeitos','checkbox'],['effectIntensity','Intensidade','range',0,1,.01],['entryDuration','Duração da entrada (s)','range',.1,5,.1],['exitDuration','Duração da saída (s)','range',.1,5,.1],['glow','Brilho','range',0,1,.01],['particles','Partículas','range',0,80,1],['eyeOpacity','Opacidade dos olhos (Itachi)','range',0,1,.01],['eyeTracking','Acompanhamento do olhar (Itachi)','range',0,1,.01],['eyeFollowDelay','Atraso natural do olhar (s)','range',.1,3,.05],['eyeMicroMotion','Micromovimentos involuntários','range',0,2,.05],['blinkInterval','Intervalo médio das piscadas (Itachi)','range',1,12,.2],['eyeScale','Escala dos olhos (Itachi)','range',.5,2,.05],['eyeShine','Reflexos (Itachi)','range',0,1,.01],['fireHeight','Altura das chamas (Itachi)','range',.1,1,.05]]},
  { id:'deidara', title:'Deidara — efeitos', description:'Configurações independentes para o personagem Deidara.', fields:[['enabled','Ativar efeitos','checkbox'],['effectIntensity','Intensidade','range',0,1,.01],['entryDuration','Duração da entrada (s)','range',.1,5,.1],['exitDuration','Duração da saída (s)','range',.1,5,.1],['glow','Brilho','range',0,1,.01],['particles','Partículas','range',0,80,1],['eyeOpacity','Opacidade dos olhos (Itachi)','range',0,1,.01],['eyeTracking','Acompanhamento do olhar (Itachi)','range',0,1,.01],['eyeFollowDelay','Atraso natural do olhar (s)','range',.1,3,.05],['eyeMicroMotion','Micromovimentos involuntários','range',0,2,.05],['blinkInterval','Intervalo médio das piscadas (Itachi)','range',1,12,.2],['eyeScale','Escala dos olhos (Itachi)','range',.5,2,.05],['eyeShine','Reflexos (Itachi)','range',0,1,.01],['fireHeight','Altura das chamas (Itachi)','range',.1,1,.05]]},
  { id:'sasori', title:'Sasori — efeitos', description:'Configurações independentes para o personagem Sasori.', fields:[['enabled','Ativar efeitos','checkbox'],['effectIntensity','Intensidade','range',0,1,.01],['entryDuration','Duração da entrada (s)','range',.1,5,.1],['exitDuration','Duração da saída (s)','range',.1,5,.1],['glow','Brilho','range',0,1,.01],['particles','Partículas','range',0,80,1],['eyeOpacity','Opacidade dos olhos (Itachi)','range',0,1,.01],['eyeTracking','Acompanhamento do olhar (Itachi)','range',0,1,.01],['eyeFollowDelay','Atraso natural do olhar (s)','range',.1,3,.05],['eyeMicroMotion','Micromovimentos involuntários','range',0,2,.05],['blinkInterval','Intervalo médio das piscadas (Itachi)','range',1,12,.2],['eyeScale','Escala dos olhos (Itachi)','range',.5,2,.05],['eyeShine','Reflexos (Itachi)','range',0,1,.01],['fireHeight','Altura das chamas (Itachi)','range',.1,1,.05]]},
  { id:'hidan', title:'Hidan — efeitos', description:'Configurações independentes para o personagem Hidan.', fields:[['enabled','Ativar efeitos','checkbox'],['effectIntensity','Intensidade','range',0,1,.01],['entryDuration','Duração da entrada (s)','range',.1,5,.1],['exitDuration','Duração da saída (s)','range',.1,5,.1],['glow','Brilho','range',0,1,.01],['particles','Partículas','range',0,80,1],['eyeOpacity','Opacidade dos olhos (Itachi)','range',0,1,.01],['eyeTracking','Acompanhamento do olhar (Itachi)','range',0,1,.01],['eyeFollowDelay','Atraso natural do olhar (s)','range',.1,3,.05],['eyeMicroMotion','Micromovimentos involuntários','range',0,2,.05],['blinkInterval','Intervalo médio das piscadas (Itachi)','range',1,12,.2],['eyeScale','Escala dos olhos (Itachi)','range',.5,2,.05],['eyeShine','Reflexos (Itachi)','range',0,1,.01],['fireHeight','Altura das chamas (Itachi)','range',.1,1,.05]]},
  { id:'kakuzu', title:'Kakuzu — efeitos', description:'Configurações independentes para o personagem Kakuzu.', fields:[['enabled','Ativar efeitos','checkbox'],['effectIntensity','Intensidade','range',0,1,.01],['entryDuration','Duração da entrada (s)','range',.1,5,.1],['exitDuration','Duração da saída (s)','range',.1,5,.1],['glow','Brilho','range',0,1,.01],['particles','Partículas','range',0,80,1],['eyeOpacity','Opacidade dos olhos (Itachi)','range',0,1,.01],['eyeTracking','Acompanhamento do olhar (Itachi)','range',0,1,.01],['eyeFollowDelay','Atraso natural do olhar (s)','range',.1,3,.05],['eyeMicroMotion','Micromovimentos involuntários','range',0,2,.05],['blinkInterval','Intervalo médio das piscadas (Itachi)','range',1,12,.2],['eyeScale','Escala dos olhos (Itachi)','range',.5,2,.05],['eyeShine','Reflexos (Itachi)','range',0,1,.01],['fireHeight','Altura das chamas (Itachi)','range',.1,1,.05]]},
  { id:'zetsu', title:'Zetsu — efeitos', description:'Configurações independentes para o personagem Zetsu.', fields:[['enabled','Ativar efeitos','checkbox'],['effectIntensity','Intensidade','range',0,1,.01],['entryDuration','Duração da entrada (s)','range',.1,5,.1],['exitDuration','Duração da saída (s)','range',.1,5,.1],['glow','Brilho','range',0,1,.01],['particles','Partículas','range',0,80,1],['eyeOpacity','Opacidade dos olhos (Itachi)','range',0,1,.01],['eyeTracking','Acompanhamento do olhar (Itachi)','range',0,1,.01],['eyeFollowDelay','Atraso natural do olhar (s)','range',.1,3,.05],['eyeMicroMotion','Micromovimentos involuntários','range',0,2,.05],['blinkInterval','Intervalo médio das piscadas (Itachi)','range',1,12,.2],['eyeScale','Escala dos olhos (Itachi)','range',.5,2,.05],['eyeShine','Reflexos (Itachi)','range',0,1,.01],['fireHeight','Altura das chamas (Itachi)','range',.1,1,.05]]},
  { id:'obito', title:'Obito — efeitos', description:'Configurações independentes para o personagem Obito.', fields:[['enabled','Ativar efeitos','checkbox'],['effectIntensity','Intensidade','range',0,1,.01],['entryDuration','Duração da entrada (s)','range',.1,5,.1],['exitDuration','Duração da saída (s)','range',.1,5,.1],['glow','Brilho','range',0,1,.01],['particles','Partículas','range',0,80,1],['eyeOpacity','Opacidade dos olhos (Itachi)','range',0,1,.01],['eyeTracking','Acompanhamento do olhar (Itachi)','range',0,1,.01],['eyeFollowDelay','Atraso natural do olhar (s)','range',.1,3,.05],['eyeMicroMotion','Micromovimentos involuntários','range',0,2,.05],['blinkInterval','Intervalo médio das piscadas (Itachi)','range',1,12,.2],['eyeScale','Escala dos olhos (Itachi)','range',.5,2,.05],['eyeShine','Reflexos (Itachi)','range',0,1,.01],['fireHeight','Altura das chamas (Itachi)','range',.1,1,.05]]},
  { id:'page', title:'Página', description:'Cor de fundo e espaçamento.', fields:[['background','Cor de fundo','color'],['padding','Espaçamento interno (px)','range',0,100,1]]},
  { id:'title', title:'Título', description:'Texto, aparência e entrada animada.', fields:[['text','Texto do título','text'],['color','Cor do título','color'],['size','Tamanho (px)','range',18,110,1],['duration','Duração da entrada (s)','range',.1,5,.1],['animate','Animação de entrada','checkbox']]},
  { id:'paragraphs', title:'Parágrafos', description:'Textos e tipografia.', fields:[['first','Primeiro parágrafo','text'],['second','Segundo parágrafo','text'],['color','Cor do texto','color'],['size','Tamanho (px)','range',12,36,1]]},
  { id:'button', title:'Botão', description:'Aparência, tremor, explosão definitiva e abertura do pergaminho.', fields:[['text','Texto do botão','text'],['color1','Cor inicial do gradiente','color'],['color2','Cor final do gradiente','color'],['radius','Arredondamento (px)','range',0,60,1],['fontSize','Tamanho da fonte (px)','range',12,36,1],['paddingY','Espaçamento vertical (px)','range',4,45,1],['paddingX','Espaçamento horizontal (px)','range',8,90,1],['animate','Animar ao clicar','checkbox'],['shake','Intensidade do tremor','range',0,3,.1],['explosion','Escala da explosão','range',1,5,.1],['fadeDuration','Abertura do pergaminho (s)','range',.2,5,.1]]}
];

let defaults;
let state;
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function merge(base, input) {
  const out = clone(base);
  if (!input || typeof input !== 'object') return out;
  for (const section of sections) {
    for (const field of section.fields) {
      const [key, , type] = field;
      const incoming = input?.[section.id]?.[key];
      if (incoming === undefined || typeof incoming !== typeof base[section.id][key]) continue;
      if (type === 'range') {
        const [, , , min, max] = field;
        if (!Number.isFinite(incoming)) continue;
        out[section.id][key] = Math.max(min,Math.min(max,incoming));
      } else if (type === 'color') {
        if (/^#[0-9a-f]{6}$/i.test(incoming)) out[section.id][key] = incoming;
      } else if (type === 'text') {
        out[section.id][key] = incoming.slice(0,250);
      } else out[section.id][key] = incoming;
    }
  }
  return out;
}
function emit(dirty=true) {
  canal.postMessage({type:'settings', settings:state});
  if(dirty&&synchronizer){persist('site',state);status.textContent='Alterações locais • clique Salvar para publicar';}
}
// Abas: apenas uma categoria visível por vez. A biblioteca de MP3 é uma aba própria.
let activeTab = 'gerenciador-audio';
function showTab(id) {
  activeTab = id;
  document.querySelectorAll('[data-editor-tab], #gerenciador-audio, #ferramentas').forEach(el => {
    el.hidden = (el.dataset.editorTab || el.id) !== id;
  });
  document.querySelectorAll('#navegacao button[data-target]').forEach(button => {
    const selected = button.dataset.target === id;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  const selectedTitle = document.querySelector('#navegacao button.active');
  if (selectedTitle) document.querySelector('.intro h1').textContent = selectedTitle.textContent;
  window.scrollTo({top: 0, behavior: 'instant'});
}
function addTab(nav, id, label) {
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.target = id;
  button.setAttribute('role', 'tab'); button.textContent = label;
  button.addEventListener('click', () => showTab(id));
  nav.append(button);
}
function render() {
  const nav = $('#navegacao');
  const root = $('#categorias');
  nav.replaceChildren(); root.replaceChildren();
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-orientation', 'vertical');
  addTab(nav, 'gerenciador-audio', '🎵 Adicionar MP3');
  addTab(nav, 'audio', '🔊 Configurar áudio');
  for (const section of sections) {
    const anchor = section.anchor || section.id;
    if (section.id !== 'audio') addTab(nav, anchor, section.title);
    const card = document.createElement('section');
    card.className='card'; card.id=anchor; card.dataset.editorTab=anchor;
    const h = document.createElement('h2'); h.textContent=section.title;
    const p = document.createElement('p'); p.textContent=section.description;
    const grid = document.createElement('div'); grid.className='grid';
    for (const [key,label,type,min,max,step] of section.fields) {
      const wrapper = document.createElement('div'); wrapper.className='control' + (type==='checkbox'?' check':'');
      const id = `field-${section.id}-${key}`;
      const name = document.createElement('label'); name.htmlFor=id; name.textContent=label;
      const input = document.createElement('input'); input.id=id; input.type=type;
      const value = state[section.id][key];
      if (type==='range') { input.min=min; input.max=max; input.step=step; input.value=value; }
      else if (type==='checkbox') input.checked=value;
      else input.value=value;
      const output = document.createElement('span'); output.className='value';
      if (type==='range') output.textContent=String(value);
      wrapper.append(name,input);
      if (type==='range') wrapper.append(output);
      input.addEventListener('input', () => {
        state[section.id][key] = type==='checkbox' ? input.checked : type==='range' ? Number(input.value) : input.value;
        if (type==='range') output.textContent=input.value;
        emit();
      });
      grid.append(wrapper);
    }
    card.append(h,p,grid);
    if(section.id==='scroll'){
      const actions=document.createElement('div'); actions.className='rope-actions';
      for(const [label,action] of [['▶ Testar cordão','test'],['⏸ Pausar','pause'],['▶ Continuar','resume'],['↺ Reiniciar','reset']]){
        const button=document.createElement('button');button.type='button';button.textContent=label;
        button.addEventListener('click',()=>canal.postMessage({type:'rope-action',action}));
        actions.appendChild(button);
      }
      card.append(actions);
    }
    root.append(card);
  }
  addTab(nav, 'ferramentas', '⚙ Importar / Exportar');
  showTab(activeTab);
}
export async function startEditor(client,uid) {
  synchronizer=new ConfigurationSync(uid,client);
  const response = await fetch('./config.json', {cache:'no-store'});
  if (!response.ok) throw new Error('config.json não encontrado');
  defaults = await response.json();
  for(const name of ['site','audio_catalog']) {
    let record=await store.read('public:'+name);
    try {record=await latestPublic(name);} catch {if(!record)throw Error('Conecte-se para carregar a configuração inicial.');}
    versions[name]=record.version;
    let pending=await synchronizer.draft(name);
    let legacy=null;
    try{legacy=JSON.parse(localStorage.getItem(name==='site'?STORAGE:'javas-audio-paths-v1'));}catch{}
    const migrationKey='legacy-migrated:'+uid+':'+name;
    if(!await store.read(migrationKey)){
      if(legacy&&JSON.stringify(legacy)!==JSON.stringify(record.config_value)){
        await store.write('legacy-backup:'+uid+':'+name,legacy);
        // Only unmodified initial seed data can be replaced by legacy migration.
        // Later remote revisions are authoritative; real edits live in UID-scoped drafts.
        if(!pending&&record.version===1)pending=await synchronizer.stage(name,legacy,record.version);
      }
      await store.write(migrationKey,true);
    }
    const value=pending?.value??record.config_value;
    if(name==='site')state=merge(defaults,value);
    else localStorage.setItem('javas-audio-paths-v1',JSON.stringify(value));
  }
  render();
  emit(false);
  const backupButton=document.createElement('button');
  backupButton.type='button';backupButton.textContent='Exportar cópia local anterior';
  backupButton.addEventListener('click',async()=>{
    const site=await store.read('legacy-backup:'+uid+':site');
    const audio_catalog=await store.read('legacy-backup:'+uid+':audio_catalog');
    const url=URL.createObjectURL(new Blob([JSON.stringify({site,audio_catalog},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='recuperacao-local-javas.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  if(await store.read('legacy-backup:'+uid+':site')||await store.read('legacy-backup:'+uid+':audio_catalog'))document.querySelector('#ferramentas .tool-buttons').append(backupButton);
  status.textContent=(await synchronizer.draft('site')||await synchronizer.draft('audio_catalog'))?'Rascunho local recuperado • não publicado':'Configurações sincronizadas';
  window.addEventListener('javas-audio-changed',()=>{
    try{persist('audio_catalog',JSON.parse(localStorage.getItem('javas-audio-paths-v1'))||[]);status.textContent='Biblioteca alterada • clique Salvar para publicar';}
    catch(error){status.textContent=error.message;}
  });
  window.addEventListener('online',()=>publish(false));
  document.querySelector('#load-remote').addEventListener('click',async()=>{
    if(!confirm('Carregar a versão remota e descartar os rascunhos locais? Exporte primeiro as configurações e a biblioteca se quiser preservá-las.'))return;
    try{
      await persistence;
      const records=await Promise.all(['site','audio_catalog'].map(latestPublic));
      for(const record of records){await store.write(synchronizer.key(record.config_key),undefined);versions[record.config_key]=record.version;}
      state=merge(defaults,records[0].config_value);
      localStorage.setItem('javas-audio-paths-v1',JSON.stringify(records[1].config_value));
      localStorage.removeItem(STORAGE);
      render();emit(false);window.dispatchEvent(new Event('javas-audio-changed-remote'));
      status.textContent='Versão remota carregada.';
    }catch(error){status.textContent='Erro: '+error.message;}
  });
  watchPublic('site',async record=>{
    if(await synchronizer.draft('site'))return;
    versions.site=record.version;state=merge(defaults,record.config_value);render();emit(false);
    status.textContent='Configuração atualizada de outro dispositivo.';
  });
  await publish(false);
}
$('#abrir-preview').addEventListener('click', () => window.open('./index.html','_blank'));
let publishing=false;
async function publish(explicit=true) {
  if(publishing)return;
  publishing=true;$('#salvar').disabled=true;
  try {
    await persistence;
    if(explicit)for(const name of ['site','audio_catalog'])await synchronizer.queue(name);
    if(!navigator.onLine){status.textContent='Offline • alterações pendentes neste dispositivo';return;}
    status.textContent='Salvando…';
    for(const name of ['site','audio_catalog']){
      const result=await synchronizer.flush(name);
      if(result.status==='conflict'){status.textContent='Conflito: outro dispositivo publicou alterações. Exporte seu rascunho antes de carregar a versão remota.';return;}
      if(result.record)versions[name]=result.record.version;
    }
    const pending=await synchronizer.draft('site')||await synchronizer.draft('audio_catalog');
    status.textContent=pending?'Há alterações locais ainda não publicadas.':'Salvo no Supabase • dispositivos sincronizados';
  }catch(error){status.textContent='Não sincronizado; rascunho preservado: '+error.message;}
  finally{publishing=false;$('#salvar').disabled=false;}
}
$('#salvar').addEventListener('click',()=>publish(true));
$('#restaurar').addEventListener('click', () => {
  if (!confirm('Restaurar todos os valores padrão?')) return;
  state=clone(defaults); localStorage.removeItem(STORAGE); render(); emit();
  status.textContent='Padrões restaurados';
});
$('#exportar').addEventListener('click', () => {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download='configuracoes-javas.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('#importar').addEventListener('click',()=>$('#arquivo-importacao').click());
$('#arquivo-importacao').addEventListener('change',async(event)=>{
  const file=event.target.files?.[0]; if (!file) return;
  try { state=merge(defaults,JSON.parse(await file.text())); render(); emit(); status.textContent='JSON importado'; }
  catch(err) { alert('Arquivo JSON inválido: '+err.message); }
  event.target.value='';
});
canal.onmessage = (event) => {
  if (event.data?.type==='request') emit(false);
};
