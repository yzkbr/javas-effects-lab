const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(status=200){
 const nodes=new Map(),data=new Map();let requests=0;
 const element=()=>({value:'',textContent:'',disabled:false,append(){},replaceChildren(){},click(){}});
 const node=key=>{if(!nodes.has(key))nodes.set(key,element());return nodes.get(key);};
 const context={document:{querySelector:node,createElement:element},localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)},window:{addEventListener(){},dispatchEvent(){}},Event:class{},URL,AbortSignal,location:{href:'https://yzkbr.github.io/javas-effects-lab/editor.html'},fetch:async()=>{requests++;return {ok:status===200,status};},setTimeout,Blob,Audio:class{}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/audio-editor.js'),'utf8'),context);
 node('#audio-destino').value='pain';node('#audio-categoria').value='mensagens';
 return {node,data,get requests(){return requests;}};
}
test('trailing space in a folder is rejected before registration',async()=>{const x=fixture();x.node('#audio-caminho').value='audio/pain/mensagens /mensagem-1.mp3';await x.node('#audio-enviar').onclick();assert.match(x.node('#audio-status').textContent,/espaços/);assert.equal(x.data.size,0);assert.equal(x.requests,0);});
test('missing published file is not registered',async()=>{const x=fixture(404);x.node('#audio-caminho').value='audio/pain/mensagens/missing.mp3';await x.node('#audio-enviar').onclick();assert.match(x.node('#audio-status').textContent,/404/);assert.equal(x.data.size,0);assert.equal(x.node('#audio-enviar').disabled,false);});
test('published file registers once and requests explicit Save',async()=>{const x=fixture();x.node('#audio-caminho').value='audio/pain/mensagens/mensagem-1.mp3';await x.node('#audio-enviar').onclick();const saved=JSON.parse(x.data.get('javas-audio-paths-v1'));assert.equal(saved.length,1);assert.equal(saved[0].url,'audio/pain/mensagens/mensagem-1.mp3');assert.match(x.node('#audio-status').textContent,/Salvar/);});
