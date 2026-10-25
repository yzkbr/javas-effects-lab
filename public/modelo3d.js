/* JAVAS EFFECTS LAB — reconstrução procedural 3D, fase 1.
   Usa geometria verdadeira; as imagens fornecidas são referências e texturas.
   Os parâmetros são recebidos do editor via BroadcastChannel. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js';
const KEY='javas-effects-lab-v1', CHANNEL='javas-effects-live-v1';
const channel=new BroadcastChannel(CHANNEL);
const host=document.querySelector('#viewer');
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,100);
camera.position.set(0,0,10.5);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.4;
host.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.06;
controls.minDistance=5;controls.maxDistance=18;
const ambient=new THREE.HemisphereLight(0xffebd3,0x2a171b,1.6);scene.add(ambient);
const keyLight=new THREE.DirectionalLight(0xffe5c1,2.1);keyLight.position.set(-3,5,7);scene.add(keyLight);
const fill=new THREE.DirectionalLight(0x8c9fff,1.0);fill.position.set(4,-1,-2);scene.add(fill);
const model=new THREE.Group();scene.add(model);
const loader=new THREE.TextureLoader();
const load=async url=>{try{const t=await loader.loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t}catch(e){console.warn('Textura não carregada',url,e);return null}};
const [cloudTex,paperTex,capTex]=await Promise.all([
 load('./imagens/estampa.png'),load('./imagens/papel-feudal.jpg'),load('./imagens/08_tampa_akatsuki.png')
]);
const black=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.84,map:cloudTex});
const paper=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,map:paperTex,side:THREE.DoubleSide});
const bronze=new THREE.MeshStandardMaterial({color:0xb77635,metalness:.72,roughness:.42});
const red=new THREE.MeshStandardMaterial({color:0x8b1823,metalness:.35,roughness:.5});
const cord=new THREE.MeshStandardMaterial({color:0x9f1226,roughness:.8});
const medallion=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.15,roughness:.45,map:capTex});
function cylinder(radius,length,material,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,64,1),material);m.rotation.z=Math.PI/2;m.position.set(x,y,z);model.add(m);return m}
function torusRing(x,y,r,mat=bronze){const m=new THREE.Mesh(new THREE.TorusGeometry(r,.045,10,64),mat);m.rotation.y=Math.PI/2;m.position.set(x,y,0);model.add(m)}
function roll(y){
 cylinder(.38,4.55,black,0,y,0);
 for(const side of [-1,1]){
  const x=side*2.34;
  cylinder(.43,.22,red,x,y,0);cylinder(.46,.075,bronze,x+side*.15,y,0);
  cylinder(.29,.16,bronze,x+side*.24,y,0);
  torusRing(x-side*.12,y,.39);torusRing(x+side*.11,y,.4);
 }
 // Fitas trançadas: hélices envolvendo os cilindros.
 for(const side of [-1,1]) for(let strand=0;strand<3;strand++){
  const pts=[];for(let i=0;i<=100;i++){const t=i/100;const x=side*1.85+(t-.5)*.22;const angle=t*Math.PI*8+strand*2*Math.PI/3;pts.push(new THREE.Vector3(x,y+Math.cos(angle)*.405,Math.sin(angle)*.405))}
  const path=new THREE.CatmullRomCurve3(pts);
  model.add(new THREE.Mesh(new THREE.TubeGeometry(path,160,.032,7,false),cord));
 }
}
roll(1.42);roll(-1.42);
// Papel é uma malha subdividida. O atributo position será atualizado durante a animação.
const paperGeometry=new THREE.PlaneGeometry(4.23,2.85,48,48);
const paperMesh=new THREE.Mesh(paperGeometry,paper);paperMesh.position.z=.01;model.add(paperMesh);
// Moldura decorativa de papel, duas linhas finas nas bordas.
const trim=new THREE.MeshStandardMaterial({color:0x6f1820,roughness:.9});
// Moldura lateral removida para deixar a borda do papel livre.
// Cordões 3D: curvas + contas + pingentes, ligados aos rolos.
const ropes=[];
function rope(side,y){const group=new THREE.Group();group.position.set(side*2.1,y,-.06);model.add(group);
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(side*.16,-.18,.08),new THREE.Vector3(side*.14,-.48,.12),new THREE.Vector3(side*.25,-.78,.12)]);
 group.add(new THREE.Mesh(new THREE.TubeGeometry(curve,32,.04,8,false),cord));
 const bead=new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),bronze);bead.position.set(side*.18,-.5,.12);group.add(bead);
 for(let i=0;i<12;i++){const strand=new THREE.Mesh(new THREE.CylinderGeometry(.008,.004,.35,5),cord);strand.position.set(side*.25+(i-5.5)*.018,-.95,.12);strand.rotation.z=(i-5.5)*.025;group.add(strand)}
 ropes.push(group);
}
rope(-1,1.42);rope(1,1.42);
// Medalhão frontal com estampa original em uma superfície real.
const disc=new THREE.Mesh(new THREE.CircleGeometry(.28,64),medallion);disc.position.set(0,1.42,.39);model.add(disc);
let ropeVelocity=[2.2,-1.8],ropeAngle=[0,0];
let state={rotationX:-9,rotationY:-12,rotationZ:0,zoom:1,light:2.1,metalness:.72,roughness:.42,cloudScale:1,ropeSwing:.35,open:0,autoRotate:false};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function apply(settings){if(!settings?.model3d)return;Object.assign(state,settings.model3d);
 keyLight.intensity=state.light;bronze.metalness=state.metalness;bronze.roughness=state.roughness;
 model.scale.setScalar(state.zoom);
 if(cloudTex){cloudTex.wrapS=cloudTex.wrapT=THREE.RepeatWrapping;cloudTex.repeat.set(state.cloudScale,1)}
}
channel.onmessage=e=>{if(e.data?.type==='settings')apply(e.data.settings)};
fetch('./config.json').then(r=>r.json()).then(d=>{let saved;try{saved=JSON.parse(localStorage.getItem(KEY))}catch{}apply({model3d:{...d.model3d,...saved?.model3d}});channel.postMessage({type:'request'})});
const clock=new THREE.Clock();let t=0;
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);t+=dt;
 model.rotation.set(THREE.MathUtils.degToRad(state.rotationX),THREE.MathUtils.degToRad(state.rotationY)+(state.autoRotate?t*.2:0),THREE.MathUtils.degToRad(state.rotationZ));
 // Vincos discretos, modelados em vértices: não alteram as letras HTML.
 const attr=paperGeometry.attributes.position;
 for(let i=0;i<attr.count;i++){
  const x=attr.getX(i),y=attr.getY(i);
  const weight=Math.sin((y+1.425)/2.85*Math.PI);
  const wave=.055*Math.sin(x*5.2+t*.65)*weight;
  attr.setZ(i,.04+wave);
 }
 attr.needsUpdate=true;paperGeometry.computeVertexNormals();
 ropes.forEach((r,i)=>{
  // Pêndulo amortecido independente: pequenas diferenças em cada corda.
  const freq=1.35+i*.11;
  const stiffness=freq*freq*9;
  ropeVelocity[i]+=(-stiffness*ropeAngle[i]-4.8*ropeVelocity[i])*dt;
  ropeAngle[i]+=ropeVelocity[i]*dt;
  r.rotation.z=ropeAngle[i]*state.ropeSwing;
 });
 // Abertura experimental: prévia geométrica, não simulação física definitiva.
 const opening=clamp(state.open,0,1);
 paperMesh.scale.y=Math.max(.03,1-opening*.85);
 controls.update();renderer.render(scene,camera);
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
animate();
