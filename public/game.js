import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── ARABA KATALOĞU (gerçek GLB modeller) ───────────────────────────────────
const CAR_CATALOG = [
  { id:'taxi',          name:'Taksi',         emoji:'🚕', price:0,     owned:true,
    glb:'models/taxi.glb',          scale:1.0, yOff:0,
    maxSpeed:0.28, acc:0.012, handling:0.046, brake:0.020,
    stats:{hiz:55,ivme:50,kontrol:65} },
  { id:'sedan',         name:'Sedan',         emoji:'🚗', price:2000,  owned:false,
    glb:'models/sedan.glb',         scale:1.0, yOff:0,
    maxSpeed:0.32, acc:0.014, handling:0.050, brake:0.022,
    stats:{hiz:60,ivme:55,kontrol:70} },
  { id:'sedan-sports',  name:'Spor Sedan',    emoji:'🏎️', price:5000,  owned:false,
    glb:'models/sedan-sports.glb',  scale:1.0, yOff:0,
    maxSpeed:0.44, acc:0.019, handling:0.058, brake:0.026,
    stats:{hiz:80,ivme:75,kontrol:80} },
  { id:'hatchback-sports',name:'Hatchback',   emoji:'⚡', price:4000,  owned:false,
    glb:'models/hatchback-sports.glb',scale:1.0,yOff:0,
    maxSpeed:0.40, acc:0.017, handling:0.060, brake:0.024,
    stats:{hiz:75,ivme:70,kontrol:85} },
  { id:'suv-luxury',    name:'Lüks SUV',      emoji:'💎', price:8000,  owned:false,
    glb:'models/suv-luxury.glb',    scale:1.0, yOff:0,
    maxSpeed:0.38, acc:0.015, handling:0.042, brake:0.023,
    stats:{hiz:70,ivme:60,kontrol:60} },
  { id:'race',          name:'Yarış Arabası', emoji:'🔥', price:12000, owned:false,
    glb:'models/race.glb',          scale:1.0, yOff:0,
    maxSpeed:0.60, acc:0.028, handling:0.065, brake:0.032,
    stats:{hiz:95,ivme:92,kontrol:88} },
  { id:'race-future',   name:'Fütüristik',    emoji:'🚀', price:15000, owned:false,
    glb:'models/race-future.glb',   scale:1.0, yOff:0,
    maxSpeed:0.68, acc:0.032, handling:0.062, brake:0.035,
    stats:{hiz:99,ivme:99,kontrol:82} },
  { id:'police',        name:'Polis',         emoji:'🚔', price:6000,  owned:false,
    glb:'models/police.glb',        scale:1.0, yOff:0,
    maxSpeed:0.50, acc:0.022, handling:0.055, brake:0.028,
    stats:{hiz:88,ivme:80,kontrol:78} },
];

// ─── SAVE / LOAD ─────────────────────────────────────────────────────────────
let money = 0, selectedCarId = 'taxi';
function saveGame() {
  localStorage.setItem('igt2_money', money);
  localStorage.setItem('igt2_owned', JSON.stringify(CAR_CATALOG.filter(c=>c.owned).map(c=>c.id)));
  localStorage.setItem('igt2_car', selectedCarId);
}
function loadGame() {
  money = parseInt(localStorage.getItem('igt2_money')||'0');
  const owned = JSON.parse(localStorage.getItem('igt2_owned')||'["taxi"]');
  CAR_CATALOG.forEach(c=>{ c.owned = owned.includes(c.id); });
  selectedCarId = localStorage.getItem('igt2_car')||'taxi';
}
loadGame();

// ─── THREE.JS ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0xc9e8f5, 0.0035);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 0.1, 600);
camera.position.set(0,6,14);

window.addEventListener('resize',()=>{
  renderer.setSize(window.innerWidth,window.innerHeight);
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
});

// Işıklar
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sun = new THREE.DirectionalLight(0xfff5e0, 1.3);
sun.position.set(80,120,60); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near=1; sun.shadow.camera.far=400;
sun.shadow.camera.left=sun.shadow.camera.bottom=-200;
sun.shadow.camera.right=sun.shadow.camera.top=200;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x87CEEB,0x3a7d44,0.4));

// ─── GLB LOADER ──────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
const carCache = {};

function loadCarGLB(carData) {
  return new Promise((resolve) => {
    if (carCache[carData.id]) { resolve(carCache[carData.id].clone()); return; }
    loader.load(carData.glb, (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(carData.scale);
      model.position.y = carData.yOff;
      model.traverse(n => {
        if (n.isMesh) { n.castShadow=true; n.receiveShadow=true; }
      });
      // Kenney araçlarının tekerleklerini bul
      model.userData.wheels = [];
      model.traverse(n => {
        if (n.name && (n.name.toLowerCase().includes('wheel') || n.name.toLowerCase().includes('tire'))) {
          model.userData.wheels.push(n);
        }
      });
      carCache[carData.id] = model;
      resolve(model.clone());
    }, undefined, () => {
      // Fallback: basit araba
      resolve(buildFallbackCar(carData));
    });
  });
}

function buildFallbackCar(carData) {
  const g = new THREE.Group();
  const col = carData.fallbackColor || 0xe74c3c;
  const bMat = new THREE.MeshPhongMaterial({color:col,shininess:150});
  const body = new THREE.Mesh(new THREE.BoxGeometry(2,0.5,4.2),bMat);
  body.position.y=0.45; body.castShadow=true; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7,0.55,2.2),bMat);
  cab.position.set(0,0.95,-0.1); g.add(cab);
  const tireMat = new THREE.MeshPhongMaterial({color:0x111111});
  [[-1.05,0.38,1.4],[1.05,0.38,1.4],[-1.05,0.38,-1.4],[1.05,0.38,-1.4]].forEach(([x,y,z])=>{
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.38,0.26,16),tireMat);
    w.rotation.z=Math.PI/2; w.position.set(x,y,z); g.add(w);
  });
  g.userData.wheels=[];
  return g;
}

// ─── İSTANBUL DÜNYASI ────────────────────────────────────────────────────────
function buildWorld() {
  // Zemin
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(800,800),
    new THREE.MeshLambertMaterial({color:0x3a7d44}));
  gnd.rotation.x=-Math.PI/2; gnd.receiveShadow=true; scene.add(gnd);

  const asfalt = new THREE.MeshLambertMaterial({color:0x1c1c1c});
  const swMat  = new THREE.MeshLambertMaterial({color:0x999999});
  const lineMat= new THREE.MeshLambertMaterial({color:0xffffff});
  const yLine  = new THREE.MeshLambertMaterial({color:0xf1c40f});

  // Ana yatay cadde
  addRoad(0,0,700,18,asfalt,swMat);
  // Ana dikey cadde
  addRoadV(0,0,18,700,asfalt,swMat);
  // Yan caddeler
  [-80,-40,40,80].forEach(o=>{
    addRoad(0,o,700,12,asfalt,swMat);
    addRoadV(o,0,12,700,asfalt,swMat);
  });

  // Yol çizgileri
  for(let x=-340;x<340;x+=14){
    const l=new THREE.Mesh(new THREE.PlaneGeometry(0.25,7),lineMat);
    l.rotation.x=-Math.PI/2; l.position.set(x,0.03,0); scene.add(l);
  }
  for(let z=-340;z<340;z+=14){
    const l=new THREE.Mesh(new THREE.PlaneGeometry(7,0.25),lineMat);
    l.rotation.x=-Math.PI/2; l.position.set(0,0.03,z); scene.add(l);
  }
  // Orta sarı çizgi
  const yc1=new THREE.Mesh(new THREE.PlaneGeometry(700,0.3),yLine);
  yc1.rotation.x=-Math.PI/2; yc1.position.set(0,0.04,0); scene.add(yc1);
  const yc2=new THREE.Mesh(new THREE.PlaneGeometry(0.3,700),yLine);
  yc2.rotation.x=-Math.PI/2; yc2.position.set(0,0.04,0); scene.add(yc2);

  buildBuildings();
  buildLandmarks();
  buildTrees();
  buildStreetLights();
  buildSky();
}

function addRoad(cx,cz,w,d,mat,sw){
  const r=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);
  r.rotation.x=-Math.PI/2; r.position.set(cx,0.02,cz); r.receiveShadow=true; scene.add(r);
  [-d/2-1.5,d/2+1.5].forEach(o=>{
    const s=new THREE.Mesh(new THREE.PlaneGeometry(w,3),sw);
    s.rotation.x=-Math.PI/2; s.position.set(cx,0.03,cz+o); scene.add(s);
  });
}
function addRoadV(cx,cz,w,d,mat,sw){
  const r=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);
  r.rotation.x=-Math.PI/2; r.position.set(cx,0.02,cz); r.receiveShadow=true; scene.add(r);
  [-w/2-1.5,w/2+1.5].forEach(o=>{
    const s=new THREE.Mesh(new THREE.PlaneGeometry(3,d),sw);
    s.rotation.x=-Math.PI/2; s.position.set(cx+o,0.03,cz); scene.add(s);
  });
}

function buildBuildings(){
  const cfgs=[
    {x:55,z:-55,w:18,h:32,d:18,c:0xd4a574},{x:75,z:-55,w:12,h:22,d:14,c:0xc9b99a},
    {x:55,z:-75,w:14,h:40,d:12,c:0x8b9dc3},{x:75,z:-75,w:10,h:18,d:10,c:0xe8d5b7},
    {x:-55,z:-55,w:18,h:28,d:18,c:0xb8a898},{x:-75,z:-55,w:12,h:35,d:14,c:0xd4a574},
    {x:-55,z:-75,w:14,h:20,d:12,c:0xe8d5b7},{x:-75,z:-75,w:10,h:45,d:10,c:0x9b8ea0},
    {x:55,z:55,w:18,h:25,d:18,c:0xd4a574},{x:75,z:55,w:12,h:38,d:14,c:0x8b9dc3},
    {x:55,z:75,w:14,h:22,d:12,c:0xc9b99a},{x:75,z:75,w:10,h:30,d:10,c:0xe8d5b7},
    {x:-55,z:55,w:18,h:35,d:18,c:0xb8a898},{x:-75,z:55,w:12,h:20,d:14,c:0xd4a574},
    {x:-55,z:75,w:14,h:42,d:12,c:0x8b9dc3},{x:-75,z:75,w:10,h:28,d:10,c:0xe8d5b7},
    {x:120,z:-55,w:20,h:50,d:16,c:0x9b8ea0},{x:-120,z:-55,w:20,h:42,d:16,c:0xd4a574},
    {x:120,z:55,w:20,h:38,d:16,c:0x8b9dc3},{x:-120,z:55,w:20,h:55,d:16,c:0xe8d5b7},
    {x:55,z:-120,w:16,h:30,d:20,c:0xc9b99a},{x:-55,z:-120,w:16,h:44,d:20,c:0xd4a574},
    {x:55,z:120,w:16,h:26,d:20,c:0x8b9dc3},{x:-55,z:120,w:16,h:36,d:20,c:0xb8a898},
  ];
  const winMat=new THREE.MeshPhongMaterial({color:0xffffcc,emissive:0xffff88,emissiveIntensity:0.4});
  cfgs.forEach(cfg=>{
    const bld=new THREE.Mesh(new THREE.BoxGeometry(cfg.w,cfg.h,cfg.d),
      new THREE.MeshPhongMaterial({color:cfg.c}));
    bld.position.set(cfg.x,cfg.h/2,cfg.z); bld.castShadow=true; bld.receiveShadow=true; scene.add(bld);
    for(let wy=2;wy<cfg.h-2;wy+=3.5){
      for(let wx=-cfg.w/2+1.5;wx<cfg.w/2-1;wx+=2.5){
        const win=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.4,0.1),winMat);
        win.position.set(cfg.x+wx,wy,cfg.z+cfg.d/2+0.05); scene.add(win);
      }
    }
    const roof=new THREE.Mesh(new THREE.BoxGeometry(cfg.w+0.4,0.5,cfg.d+0.4),
      new THREE.MeshPhongMaterial({color:0x8b4513}));
    roof.position.set(cfg.x,cfg.h+0.25,cfg.z); scene.add(roof);
  });
}

function buildLandmarks(){
  // Cami
  const cMat=new THREE.MeshPhongMaterial({color:0xd4c5a9});
  const cBase=new THREE.Mesh(new THREE.BoxGeometry(22,5,22),cMat);
  cBase.position.set(0,2.5,-160); scene.add(cBase);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(8,16,16,0,Math.PI*2,0,Math.PI/2),cMat);
  dome.position.set(0,5,-160); scene.add(dome);
  [[-9,-9],[-9,9],[9,-9],[9,9]].forEach(([mx,mz])=>{
    const min=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,20,8),cMat);
    min.position.set(mx,10,-160+mz); scene.add(min);
    const top=new THREE.Mesh(new THREE.ConeGeometry(0.8,3,8),
      new THREE.MeshPhongMaterial({color:0x888888}));
    top.position.set(mx,21,-160+mz); scene.add(top);
  });
  // Galata Kulesi
  const galBase=new THREE.Mesh(new THREE.CylinderGeometry(4.5,5,22,12),cMat);
  galBase.position.set(-160,11,0); scene.add(galBase);
  const galTop=new THREE.Mesh(new THREE.ConeGeometry(5,9,12),
    new THREE.MeshPhongMaterial({color:0x8b4513}));
  galTop.position.set(-160,26,0); scene.add(galTop);
  // Köprü
  const tMat=new THREE.MeshPhongMaterial({color:0x888888});
  [-16,16].forEach(x=>{
    const t=new THREE.Mesh(new THREE.BoxGeometry(3,32,3),tMat);
    t.position.set(x,16,160); scene.add(t);
  });
  const br=new THREE.Mesh(new THREE.BoxGeometry(36,1.2,10),
    new THREE.MeshPhongMaterial({color:0x666666}));
  br.position.set(0,30,160); scene.add(br);
  const brRoad=new THREE.Mesh(new THREE.PlaneGeometry(36,10),
    new THREE.MeshLambertMaterial({color:0x1c1c1c}));
  brRoad.rotation.x=-Math.PI/2; brRoad.position.set(0,30.7,160); scene.add(brRoad);
}

function buildTrees(){
  const trunkMat=new THREE.MeshLambertMaterial({color:0x8B4513});
  const leafMat=new THREE.MeshLambertMaterial({color:0x228B22});
  for(let i=0;i<120;i++){
    const x=(Math.random()-0.5)*280, z=(Math.random()-0.5)*280;
    if(Math.abs(x)<14||Math.abs(z)<14) continue;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.28,2.2,6),trunkMat);
    trunk.position.set(x,1.1,z); scene.add(trunk);
    const leaves=new THREE.Mesh(new THREE.SphereGeometry(1.6+Math.random(),8,8),leafMat);
    leaves.position.set(x,3.8,z); scene.add(leaves);
  }
}

function buildStreetLights(){
  const poleMat=new THREE.MeshPhongMaterial({color:0x555555});
  const lampMat=new THREE.MeshPhongMaterial({color:0xffffaa,emissive:0xffff44,emissiveIntensity:1});
  for(let i=-300;i<300;i+=28){
    [11,-11].forEach(off=>{
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.14,7,6),poleMat);
      pole.position.set(i,3.5,off); scene.add(pole);
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,8),lampMat);
      lamp.position.set(i,7.2,off); scene.add(lamp);
    });
  }
}

function buildSky(){
  const sun2=new THREE.Mesh(new THREE.SphereGeometry(9,16,16),
    new THREE.MeshBasicMaterial({color:0xfffacd}));
  sun2.position.set(80,150,-200); scene.add(sun2);
  const cMat=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:0.88});
  for(let i=0;i<18;i++){
    const cloud=new THREE.Group();
    for(let j=0;j<5;j++){
      const p=new THREE.Mesh(new THREE.SphereGeometry(3.5+Math.random()*3,8,8),cMat);
      p.position.set(j*5.5-11,Math.random()*2.5,0); cloud.add(p);
    }
    cloud.position.set((Math.random()-0.5)*500,70+Math.random()*50,(Math.random()-0.5)*500);
    scene.add(cloud);
  }
}

// ─── NPC TAKSİ SİSTEMİ ───────────────────────────────────────────────────────
const NPC_LOCS = [
  {name:'Taksim Meydanı',x:0,z:0},
  {name:'Galata Kulesi',x:-160,z:0},
  {name:'Boğaz Köprüsü',x:0,z:160},
  {name:'Ayasofya',x:0,z:-160},
  {name:'Kadıköy',x:80,z:80},
  {name:'Beşiktaş',x:-80,z:-80},
  {name:'Üsküdar',x:80,z:-80},
  {name:'Fatih',x:-80,z:80},
  {name:'Şişli',x:40,z:-40},
  {name:'Beyoğlu',x:-40,z:40},
];

const npcs=[], npcMeshes=[];
let activePassenger=null, nearNPC=null;

function spawnNPCs(){
  for(let i=0;i<8;i++) spawnOneNPC();
}

function spawnOneNPC(){
  const loc=NPC_LOCS[Math.floor(Math.random()*NPC_LOCS.length)];
  const g=new THREE.Group();
  const colors=[0xe74c3c,0x3498db,0x2ecc71,0x9b59b6,0xe67e22,0x1abc9c];
  const col=colors[Math.floor(Math.random()*colors.length)];
  const bMat=new THREE.MeshPhongMaterial({color:col});
  // Vücut
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.35,1.2,8),bMat);
  body.position.y=0.9; g.add(body);
  // Kafa
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.28,10,10),
    new THREE.MeshPhongMaterial({color:0xf5cba7}));
  head.position.y=1.8; g.add(head);
  // Bacaklar
  [-0.18,0.18].forEach(x=>{
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.9,6),
      new THREE.MeshPhongMaterial({color:0x2c3e50}));
    leg.position.set(x,0.35,0); g.add(leg);
  });
  // Ünlem
  const excMat=new THREE.MeshPhongMaterial({color:0xf1c40f,emissive:0xf1c40f,emissiveIntensity:0.9});
  const excl=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.5,6),excMat);
  excl.position.y=2.6; g.add(excl);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,6),excMat);
  dot.position.y=2.2; g.add(dot);

  g.position.set(loc.x+(Math.random()-0.5)*6,0,loc.z+(Math.random()-0.5)*6);
  g.userData={waiting:true,inCar:false,excl,dot};
  scene.add(g); npcs.push(g);
}

let destMarker=null;
function showDestMarker(x,z){
  if(destMarker) scene.remove(destMarker);
  const g=new THREE.Group();
  const mat=new THREE.MeshPhongMaterial({color:0xe74c3c,emissive:0xe74c3c,emissiveIntensity:0.6});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,5,8),mat);
  pole.position.y=2.5; g.add(pole);
  const flag=new THREE.Mesh(new THREE.BoxGeometry(1.5,1,0.1),mat);
  flag.position.set(0.75,5.2,0); g.add(flag);
  const ring=new THREE.Mesh(new THREE.RingGeometry(2,2.5,32),
    new THREE.MeshBasicMaterial({color:0xe74c3c,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.1; g.add(ring);
  g.position.set(x,0,z); scene.add(g); destMarker=g;
}

let npcT=0;
function animateNPCs(delta){
  npcT+=delta*0.003;
  npcs.forEach(npc=>{
    if(npc.userData.waiting&&!npc.userData.inCar){
      npc.position.y=Math.abs(Math.sin(npcT*2+npc.position.x))*0.15;
      if(npc.userData.excl) npc.userData.excl.material.emissiveIntensity=0.5+Math.sin(npcT*4)*0.5;
    }
  });
  if(destMarker) destMarker.rotation.y+=delta*0.001;
}

function checkNearNPC(){
  if(!playerCar||activePassenger){nearNPC=null; document.getElementById('npc-prompt').classList.add('hidden'); return;}
  const px=playerCar.position.x, pz=playerCar.position.z;
  nearNPC=null;
  for(const npc of npcs){
    if(!npc.userData.waiting||npc.userData.inCar) continue;
    const dx=npc.position.x-px, dz=npc.position.z-pz;
    if(Math.sqrt(dx*dx+dz*dz)<5){nearNPC=npc; break;}
  }
  document.getElementById('npc-prompt').classList.toggle('hidden',!nearNPC);
}

function pickupPassenger(){
  if(!nearNPC||activePassenger) return;
  const npc=nearNPC;
  npc.userData.inCar=true; npc.userData.waiting=false; npc.visible=false;
  const dests=NPC_LOCS.filter(l=>{
    const dx=l.x-npc.position.x,dz=l.z-npc.position.z;
    return Math.sqrt(dx*dx+dz*dz)>30;
  });
  const dest=dests[Math.floor(Math.random()*dests.length)];
  const dist=Math.sqrt((dest.x-npc.position.x)**2+(dest.z-npc.position.z)**2);
  const reward=Math.floor(200+dist*3);
  activePassenger={npc,destination:dest,reward};
  showDestMarker(dest.x,dest.z);
  document.getElementById('taxi-hud').classList.remove('hidden');
  document.getElementById('taxi-status').textContent='🧍 YOLCU ALINDI';
  document.getElementById('taxi-dest').textContent='📍 '+dest.name;
  document.getElementById('taxi-reward').textContent='💰 Ödül: '+reward.toLocaleString('tr-TR')+' ₺';
  document.getElementById('npc-prompt').classList.add('hidden');
  showPopup('🧍 Yolcu bindi!','#f1c40f');
}

function checkDropoff(){
  if(!activePassenger||!playerCar) return;
  const dest=activePassenger.destination;
  const dx=playerCar.position.x-dest.x, dz=playerCar.position.z-dest.z;
  if(Math.sqrt(dx*dx+dz*dz)<8){
    money+=activePassenger.reward;
    saveGame(); updateMoneyHUD();
    showPopup('+'+activePassenger.reward.toLocaleString('tr-TR')+' ₺\n✅ '+dest.name,'#2ecc71');
    setTimeout(()=>{
      activePassenger.npc.userData.inCar=false;
      activePassenger.npc.userData.waiting=true;
      activePassenger.npc.visible=true;
      const newLoc=NPC_LOCS[Math.floor(Math.random()*NPC_LOCS.length)];
      activePassenger.npc.position.set(newLoc.x+(Math.random()-0.5)*6,0,newLoc.z+(Math.random()-0.5)*6);
    },3000);
    activePassenger=null;
    if(destMarker){scene.remove(destMarker);destMarker=null;}
    document.getElementById('taxi-hud').classList.add('hidden');
  }
}

// ─── MOBİL KONTROLLER ────────────────────────────────────────────────────────
const isMobile = /Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent) || window.innerWidth < 768;
if (isMobile) {
  document.getElementById('mobile-controls').classList.add('visible');
}

const joystick = { active: false, x: 0, y: 0, id: null };
const jBase  = document.getElementById('joystick-base');
const jKnob  = document.getElementById('joystick-knob');
const JMAX   = 38; // max px sapma

function getJoyPos(touch) {
  const rect = jBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  let dx = touch.clientX - cx;
  let dy = touch.clientY - cy;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist > JMAX) { dx = dx/dist*JMAX; dy = dy/dist*JMAX; }
  return { dx, dy };
}

jBase.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joystick.active = true; joystick.id = t.identifier;
  const {dx,dy} = getJoyPos(t);
  joystick.x = dx/JMAX; joystick.y = dy/JMAX;
  jKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}, {passive:false});

jBase.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== joystick.id) continue;
    const {dx,dy} = getJoyPos(t);
    joystick.x = dx/JMAX; joystick.y = dy/JMAX;
    jKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}, {passive:false});

['touchend','touchcancel'].forEach(ev => {
  jBase.addEventListener(ev, e => {
    joystick.active = false; joystick.x = 0; joystick.y = 0;
    jKnob.style.transform = 'translate(-50%,-50%)';
  });
});

// Fren butonu
document.getElementById('btn-brake').addEventListener('touchstart', e => {
  e.preventDefault(); keys['Space'] = true;
}, {passive:false});
document.getElementById('btn-brake').addEventListener('touchend', () => { keys['Space'] = false; });

// Yolcu al butonu
document.getElementById('btn-pickup').addEventListener('touchstart', e => {
  e.preventDefault();
  if (nearNPC) pickupPassenger();
}, {passive:false});

// ─── OYUNCU & FİZİK ──────────────────────────────────────────────────────────
let playerCar=null, currentCarData=null;
let speed=0, carAngle=0, wheelRot=0;

async function applySelectedCar(){
  if(playerCar) scene.remove(playerCar);
  currentCarData=CAR_CATALOG.find(c=>c.id===selectedCarId)||CAR_CATALOG[0];
  playerCar=await loadCarGLB(currentCarData);
  playerCar.position.set(5,0,5);
  scene.add(playerCar);
  document.getElementById('car-name-val').textContent=currentCarData.name;
}

const keys={};
window.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyE'&&nearNPC) pickupPassenger();
  if(e.code==='Space') e.preventDefault();
});
window.addEventListener('keyup',e=>{ keys[e.code]=false; });

function updatePhysics(delta){
  if(!playerCar||!currentCarData) return;
  const {acc,maxSpeed,handling,brake}=currentCarData;

  // Joystick + klavye birleşik
  const fwd = (keys['KeyW']||keys['ArrowUp'])   || (joystick.active && joystick.y < -0.2);
  const bwd = (keys['KeyS']||keys['ArrowDown'])  || (joystick.active && joystick.y >  0.2);
  const lft = (keys['KeyA']||keys['ArrowLeft'])  || (joystick.active && joystick.x < -0.2);
  const rgt = (keys['KeyD']||keys['ArrowRight']) || (joystick.active && joystick.x >  0.2);

  if(fwd)       speed=Math.min(speed+acc,maxSpeed);
  else if(bwd)  speed=Math.max(speed-acc*0.7,-maxSpeed*0.45);
  else if(keys['Space']) speed*=(1-brake*2.5);
  else          speed*=0.975;

  if(Math.abs(speed)>0.004){
    const dir=speed>0?1:-1;
    // Joystick hassasiyeti
    const jTurn = joystick.active ? joystick.x * handling * 1.2 * dir : 0;
    if(lft)  carAngle+=handling*dir;
    else if(rgt) carAngle-=handling*dir;
    else if(joystick.active) carAngle-=jTurn;
  }

  playerCar.rotation.y=carAngle;
  playerCar.position.x+=Math.sin(carAngle)*speed;
  playerCar.position.z+=Math.cos(carAngle)*speed;
  playerCar.position.x=Math.max(-340,Math.min(340,playerCar.position.x));
  playerCar.position.z=Math.max(-340,Math.min(340,playerCar.position.z));

  // Tekerlek dönüşü (GLB wheels)
  wheelRot+=speed*3.5;
  if(playerCar.userData&&playerCar.userData.wheels){
    playerCar.userData.wheels.forEach(w=>{ w.rotation.x=wheelRot; });
  }

  // Hız göstergesi - km/h
  const kmh=Math.abs(Math.round(speed*1100));
  document.getElementById('speed-value').textContent=kmh;
  drawSpeedo(kmh,Math.round(currentCarData.maxSpeed*1100));

  checkNearNPC();
  checkDropoff();
}

// ─── SPEEDO (düzgün ibreli) ───────────────────────────────────────────────────
const speedoCanvas=document.getElementById('speedo-canvas');
const sCtx=speedoCanvas.getContext('2d');

function drawSpeedo(kmh,maxKmh){
  const W=140,H=140,cx=70,cy=78,R=58;
  sCtx.clearRect(0,0,W,H);

  // Arka daire
  sCtx.beginPath(); sCtx.arc(cx,cy,R,0,Math.PI*2);
  sCtx.fillStyle='rgba(0,0,0,0.82)'; sCtx.fill();
  sCtx.strokeStyle='rgba(255,255,255,0.12)'; sCtx.lineWidth=2; sCtx.stroke();

  // Yay arka
  const startA=Math.PI*0.75, endA=Math.PI*2.25;
  sCtx.beginPath(); sCtx.arc(cx,cy,R-10,startA,endA);
  sCtx.strokeStyle='#2a2a2a'; sCtx.lineWidth=10; sCtx.stroke();

  // Renkli yay
  const ratio=Math.min(kmh/maxKmh,1);
  const curA=startA+(endA-startA)*ratio;
  const grad=sCtx.createLinearGradient(0,0,W,0);
  grad.addColorStop(0,'#00e676'); grad.addColorStop(0.55,'#ffeb3b'); grad.addColorStop(1,'#f44336');
  sCtx.beginPath(); sCtx.arc(cx,cy,R-10,startA,curA);
  sCtx.strokeStyle=grad; sCtx.lineWidth=10; sCtx.stroke();

  // Çizgiler + sayılar
  sCtx.font='bold 8px Arial'; sCtx.fillStyle='#aaa'; sCtx.textAlign='center';
  for(let i=0;i<=10;i++){
    const a=startA+(endA-startA)*(i/10);
    const x1=cx+Math.cos(a)*(R-18), y1=cy+Math.sin(a)*(R-18);
    const x2=cx+Math.cos(a)*(R-26), y2=cy+Math.sin(a)*(R-26);
    sCtx.beginPath(); sCtx.moveTo(x1,y1); sCtx.lineTo(x2,y2);
    sCtx.strokeStyle=i%2===0?'#888':'#444'; sCtx.lineWidth=i%2===0?2:1; sCtx.stroke();
    if(i%2===0){
      const tx=cx+Math.cos(a)*(R-34), ty=cy+Math.sin(a)*(R-34)+3;
      sCtx.fillText(Math.round(maxKmh*i/10),tx,ty);
    }
  }

  // İbre
  const needleA=startA+(endA-startA)*ratio;
  sCtx.beginPath();
  sCtx.moveTo(cx-Math.cos(needleA)*8, cy-Math.sin(needleA)*8);
  sCtx.lineTo(cx+Math.cos(needleA)*(R-16), cy+Math.sin(needleA)*(R-16));
  sCtx.strokeStyle='#f44336'; sCtx.lineWidth=2.5; sCtx.lineCap='round'; sCtx.stroke();

  // Merkez
  sCtx.beginPath(); sCtx.arc(cx,cy,5,0,Math.PI*2);
  sCtx.fillStyle='#f44336'; sCtx.fill();
  sCtx.beginPath(); sCtx.arc(cx,cy,3,0,Math.PI*2);
  sCtx.fillStyle='#fff'; sCtx.fill();
}

// ─── KAMERA ───────────────────────────────────────────────────────────────────
const camTarget=new THREE.Vector3();
function updateCamera(){
  if(!playerCar) return;
  camTarget.set(
    playerCar.position.x-Math.sin(carAngle)*13,
    5.5,
    playerCar.position.z-Math.cos(carAngle)*13
  );
  camera.position.lerp(camTarget,0.09);
  camera.lookAt(playerCar.position.x,1.2,playerCar.position.z);
}

// ─── MULTIPLAYER ──────────────────────────────────────────────────────────────
const socket=io();
const otherPlayers={};
const COLORS=['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63'];

socket.on('init',({id,players})=>{
  Object.values(players).forEach(p=>{ if(p.id!==id) addOtherPlayer(p); });
  updatePlayersHUD(players);
});
socket.on('playerJoined',p=>addOtherPlayer(p));
socket.on('playerMoved',data=>{
  const op=otherPlayers[data.id]; if(!op) return;
  op.mesh.position.set(data.x,data.y,data.z);
  op.mesh.rotation.y=data.ry;
});
socket.on('playerLeft',id=>{
  if(otherPlayers[id]){scene.remove(otherPlayers[id].mesh);delete otherPlayers[id];}
  updatePlayersHUD();
});

async function addOtherPlayer(p){
  const idx=Object.keys(otherPlayers).length%CAR_CATALOG.length;
  const carData=CAR_CATALOG[idx];
  const mesh=await loadCarGLB(carData);
  mesh.position.set(p.x||0,p.y||0,p.z||0);
  // Renk tonu
  mesh.traverse(n=>{
    if(n.isMesh&&n.material){
      const c=parseInt((p.color||'#3498db').replace('#',''),16);
      if(n.material.color) n.material=n.material.clone();
    }
  });
  scene.add(mesh);
  otherPlayers[p.id]={mesh,data:p};
}

function updatePlayersHUD(players){
  const content=document.getElementById('players-content');
  const all=players?Object.values(players):Object.values(otherPlayers).map(o=>o.data);
  content.innerHTML=all.map(p=>
    `<div class="player-entry">
      <div class="player-dot" style="background:${p.color||'#fff'}"></div>
      <span>${p.name||'Sürücü'}</span>
    </div>`
  ).join('')||'<div style="color:#666;font-size:0.75rem">Kimse yok</div>';
}

let lastSend=0;
function sendPosition(now){
  if(!playerCar||now-lastSend<50) return;
  lastSend=now;
  socket.emit('update',{x:playerCar.position.x,y:playerCar.position.y,z:playerCar.position.z,ry:carAngle,speed});
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function updateMoneyHUD(){
  document.getElementById('money-val').textContent=money.toLocaleString('tr-TR');
  document.getElementById('garage-money').textContent='💰 '+money.toLocaleString('tr-TR')+' ₺';
}

let popTimer=null;
function showPopup(text,color='#2ecc71'){
  const el=document.getElementById('earn-popup');
  el.textContent=text; el.style.color=color; el.style.textShadow=`0 0 20px ${color}`;
  el.classList.add('show');
  if(popTimer) clearTimeout(popTimer);
  popTimer=setTimeout(()=>el.classList.remove('show'),2200);
}

// ─── GARAJ ────────────────────────────────────────────────────────────────────
function openGarage(){ document.getElementById('garage').classList.remove('hidden'); renderGarageUI(); }
function closeGarage(){ document.getElementById('garage').classList.add('hidden'); }

function renderGarageUI(){
  updateMoneyHUD();
  const grid=document.getElementById('car-grid');
  grid.innerHTML='';
  CAR_CATALOG.forEach(car=>{
    const card=document.createElement('div');
    card.className='car-card'+(car.id===selectedCarId?' selected':'')+(car.owned?'':' locked');
    card.innerHTML=`
      <div class="car-preview">${car.emoji}</div>
      <h3>${car.name}</h3>
      <div class="car-stats">
        <div>Hız <div class="stat-bar"><div class="stat-fill" style="width:${car.stats.hiz}%"></div></div></div>
        <div>İvme <div class="stat-bar"><div class="stat-fill" style="width:${car.stats.ivme}%"></div></div></div>
        <div>Kontrol <div class="stat-bar"><div class="stat-fill" style="width:${car.stats.kontrol}%"></div></div></div>
      </div>
      ${car.owned?`<div class="owned-badge">SAHİP</div>`:`<div class="car-price">💰 ${car.price.toLocaleString('tr-TR')} ₺</div>`}
    `;
    card.addEventListener('click',()=>{
      if(car.owned){ selectedCarId=car.id; saveGame(); renderGarageUI(); }
      else if(money>=car.price){
        if(confirm(`${car.name} satın al? (${car.price.toLocaleString('tr-TR')} ₺)`)){
          money-=car.price; car.owned=true; selectedCarId=car.id;
          saveGame(); updateMoneyHUD(); renderGarageUI();
        }
      } else alert(`Yeterli para yok! Gerekli: ${car.price.toLocaleString('tr-TR')} ₺`);
    });
    grid.appendChild(card);
  });
}

document.getElementById('btn-start-race').addEventListener('click',async()=>{
  closeGarage(); await applySelectedCar();
});
document.getElementById('garage-btn').addEventListener('click',openGarage);

// ─── BAŞLATMA ─────────────────────────────────────────────────────────────────
function setLoad(p,t){
  document.getElementById('loader-fill').style.width=p+'%';
  document.getElementById('loader-text').textContent=t;
}

setLoad(10,'Şehir inşa ediliyor...');
buildWorld();
setLoad(50,'NPC\'ler yerleştiriliyor...');
spawnNPCs();
setLoad(75,'Araç yükleniyor...');

applySelectedCar().then(()=>{
  setLoad(100,'Hazır!');
  updateMoneyHUD();
  setTimeout(()=>{
    document.getElementById('loading').classList.add('hidden');
    openGarage();
  },800);
});

// ─── OYUN DÖNGÜSÜ ─────────────────────────────────────────────────────────────
let lastTime=0;
function animate(now){
  requestAnimationFrame(animate);
  const delta=now-lastTime; lastTime=now;
  updatePhysics(delta);
  updateCamera();
  animateNPCs(delta);
  sendPosition(now);
  renderer.render(scene,camera);
}
animate(0);
