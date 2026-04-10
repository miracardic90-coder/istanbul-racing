// ═══════════════════════════════════════════════════════
// İSTANBUL GTA - game.js
// ═══════════════════════════════════════════════════════

// ── KULLANICI ADI ────────────────────────────────────────
let playerName = localStorage.getItem('igt_name') || '';
const nameScreen = document.getElementById('name-screen');
const nameInput  = document.getElementById('name-input');
const nameBtn    = document.getElementById('name-btn');

if (playerName) {
  startGame();
} else {
  nameInput.focus();
}

nameBtn.addEventListener('click', () => {
  const v = nameInput.value.trim();
  if (!v) { nameInput.style.borderColor='#e74c3c'; return; }
  playerName = v;
  localStorage.setItem('igt_name', playerName);
  startGame();
});
nameInput.addEventListener('keydown', e => { if(e.key==='Enter') nameBtn.click(); });

function startGame() {
  nameScreen.classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('player-name-display').textContent = playerName;
  initGame();
}

// ── ARABA KATALOĞU ───────────────────────────────────────
const CAR_CATALOG = [
  { id:'taxi',    name:'Taksi',       emoji:'🚕', price:0,     owned:true,
    glb:'models/taxi.glb',         scale:1.8, yOff:0,
    maxSpeed:0.30, acc:0.013, handling:0.048, brake:0.022,
    stats:{hiz:55,ivme:50,kontrol:65} },
  { id:'sedan',   name:'Sedan',       emoji:'🚗', price:2000,  owned:false,
    glb:'models/sedan.glb',        scale:1.8, yOff:0,
    maxSpeed:0.34, acc:0.015, handling:0.052, brake:0.023,
    stats:{hiz:62,ivme:56,kontrol:70} },
  { id:'sedan-sports', name:'Spor Sedan', emoji:'🏎️', price:5000, owned:false,
    glb:'models/sedan-sports.glb', scale:1.8, yOff:0,
    maxSpeed:0.46, acc:0.020, handling:0.060, brake:0.027,
    stats:{hiz:82,ivme:76,kontrol:82} },
  { id:'hatchback-sports', name:'Hatchback', emoji:'⚡', price:4000, owned:false,
    glb:'models/hatchback-sports.glb', scale:1.8, yOff:0,
    maxSpeed:0.42, acc:0.018, handling:0.062, brake:0.025,
    stats:{hiz:76,ivme:72,kontrol:86} },
  { id:'suv-luxury', name:'Lüks SUV', emoji:'💎', price:8000, owned:false,
    glb:'models/suv-luxury.glb',   scale:1.8, yOff:0,
    maxSpeed:0.40, acc:0.016, handling:0.044, brake:0.024,
    stats:{hiz:72,ivme:62,kontrol:62} },
  { id:'race',    name:'Yarış',       emoji:'🔥', price:12000, owned:false,
    glb:'models/race.glb',         scale:1.8, yOff:0,
    maxSpeed:0.62, acc:0.030, handling:0.066, brake:0.033,
    stats:{hiz:96,ivme:93,kontrol:89} },
  { id:'race-future', name:'Fütüristik', emoji:'🚀', price:15000, owned:false,
    glb:'models/race-future.glb',  scale:1.8, yOff:0,
    maxSpeed:0.70, acc:0.033, handling:0.063, brake:0.036,
    stats:{hiz:99,ivme:99,kontrol:83} },
  { id:'police',  name:'Polis',       emoji:'🚔', price:6000,  owned:false,
    glb:'models/police.glb',       scale:1.8, yOff:0,
    maxSpeed:0.52, acc:0.023, handling:0.056, brake:0.029,
    stats:{hiz:89,ivme:81,kontrol:79} },
];

// ── SAVE/LOAD ────────────────────────────────────────────
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

// ── THREE.JS SETUP ───────────────────────────────────────
let renderer, scene, camera, loader, playerCar, currentCarData;
let speed = 0, carAngle = 0, wheelRot = 0;
const carCache = {};

function initGame() {
  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.FogExp2(0xc9e8f5, 0.0025);

  camera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 0.1, 800);
  camera.position.set(0, 6, 14);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  });

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.3);
  sun.position.set(100, 150, 80); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 600;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -300;
  sun.shadow.camera.right = sun.shadow.camera.top = 300;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x87CEEB, 0x3a7d44, 0.4));

  loader = THREE.GLTFLoader ? new THREE.GLTFLoader() : null;

  setLoad(20, 'Şehir inşa ediliyor...');
  buildWorld();
  setLoad(55, 'NPC\'ler yerleştiriliyor...');
  spawnNPCs();
  setLoad(75, 'Araç yükleniyor...');

  applySelectedCar().then(() => {
    setLoad(100, 'Hazır!');
    updateMoneyHUD();
    setupMobileControls();
    setupSocket();
    setTimeout(() => {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('ui').classList.remove('hidden');
      openGarage();
    }, 600);
    animate(0);
  }).catch(err => {
    console.error('Araç yüklenemedi:', err);
    // Fallback ile devam et
    currentCarData = CAR_CATALOG[0];
    playerCar = buildFallbackCar(currentCarData);
    playerCar.position.set(5,0,5);
    scene.add(playerCar);
    setLoad(100, 'Hazır!');
    updateMoneyHUD();
    setupMobileControls();
    setupSocket();
    setTimeout(() => {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('ui').classList.remove('hidden');
      openGarage();
    }, 600);
    animate(0);
  });
}

function setLoad(p, t) {
  document.getElementById('loader-fill').style.width = p + '%';
  document.getElementById('loader-text').textContent = t;
}

// ── GLB LOADER ───────────────────────────────────────────
function loadCarGLB(carData) {
  return new Promise(resolve => {
    if (carCache[carData.id]) {
      const c = carCache[carData.id].clone();
      c.userData.wheels = findWheels(c);
      resolve(c); return;
    }
    // GLTFLoader yoksa direkt fallback
    if (!THREE.GLTFLoader) {
      resolve(buildFallbackCar(carData)); return;
    }
    // 5 saniye timeout - yüklenemezse fallback
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; resolve(buildFallbackCar(carData)); }
    }, 5000);

    loader.load(carData.glb, gltf => {
      if (resolved) return;
      resolved = true; clearTimeout(timeout);
      const model = gltf.scene;
      model.scale.setScalar(carData.scale);
      model.position.y = carData.yOff;
      model.traverse(n => { if(n.isMesh){ n.castShadow=true; n.receiveShadow=true; } });
      carCache[carData.id] = model;
      const c = model.clone();
      c.userData.wheels = findWheels(c);
      resolve(c);
    }, undefined, () => {
      if (resolved) return;
      resolved = true; clearTimeout(timeout);
      resolve(buildFallbackCar(carData));
    });
  });
}

function findWheels(model) {
  const w = [];
  model.traverse(n => { if(n.name && /wheel|tire|tyre/i.test(n.name)) w.push(n); });
  return w;
}

function buildFallbackCar(carData) {
  const g = new THREE.Group();
  const col = [0xe74c3c,0x3498db,0x2ecc71,0xf39c12,0x9b59b6][CAR_CATALOG.indexOf(carData)%5];
  const bMat = new THREE.MeshPhongMaterial({color:col, shininess:160, specular:0x444444});
  const glassMat = new THREE.MeshPhongMaterial({color:0x88ccff, transparent:true, opacity:0.45});
  const tireMat = new THREE.MeshPhongMaterial({color:0x111111});
  const rimMat  = new THREE.MeshPhongMaterial({color:0xcccccc, shininess:200});

  // Gövde alt
  const bodyLow = new THREE.Mesh(new THREE.BoxGeometry(2.0,0.52,4.5), bMat);
  bodyLow.position.y=0.46; bodyLow.castShadow=true; g.add(bodyLow);
  // Kabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72,0.58,2.3), bMat);
  cabin.position.set(0,0.97,-0.05); g.add(cabin);
  // Ön cam
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.58,0.52,0.07), glassMat);
  ws.position.set(0,0.97,1.05); ws.rotation.x=0.45; g.add(ws);
  // Arka cam
  const rg = new THREE.Mesh(new THREE.BoxGeometry(1.58,0.46,0.07), glassMat);
  rg.position.set(0,0.97,-1.22); rg.rotation.x=-0.45; g.add(rg);
  // Yan camlar
  [-0.87,0.87].forEach(x => {
    const sg = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.40,1.65), glassMat);
    sg.position.set(x,0.99,-0.08); g.add(sg);
  });
  // Kaput & bagaj
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.96,0.07,1.25), bMat);
  hood.position.set(0,0.73,1.55); g.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.96,0.07,0.95), bMat);
  trunk.position.set(0,0.73,-1.65); g.add(trunk);
  // Tamponlar
  const fb = new THREE.Mesh(new THREE.BoxGeometry(2.06,0.24,0.16), bMat);
  fb.position.set(0,0.28,2.32); g.add(fb);
  const rb = new THREE.Mesh(new THREE.BoxGeometry(2.06,0.24,0.16), bMat);
  rb.position.set(0,0.28,-2.32); g.add(rb);
  // Farlar
  const lF = new THREE.MeshPhongMaterial({color:0xffffaa,emissive:0xffff00,emissiveIntensity:0.5});
  const lR = new THREE.MeshPhongMaterial({color:0xff2200,emissive:0xff0000,emissiveIntensity:0.4});
  [-0.68,0.68].forEach(x => {
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.36,0.16,0.07),lF),{position:new THREE.Vector3(x,0.53,2.34)}));
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.36,0.16,0.07),lR),{position:new THREE.Vector3(x,0.53,-2.34)}));
  });
  // Tekerlekler
  g.userData.wheels = [];
  [[-1.06,0.38,1.45],[1.06,0.38,1.45],[-1.06,0.38,-1.45],[1.06,0.38,-1.45]].forEach(([x,y,z]) => {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.38,0.26,20), tireMat);
    tire.rotation.z = Math.PI/2; wg.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.28,12), rimMat);
    rim.rotation.z = Math.PI/2; wg.add(rim);
    for(let s=0;s<5;s++){
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.04,0.04), rimMat);
      const a = (s/5)*Math.PI*2;
      sp.position.set(0, Math.sin(a)*0.13, Math.cos(a)*0.13);
      sp.rotation.x = a; rim.add(sp);
    }
    wg.position.set(x,y,z); g.add(wg);
    g.userData.wheels.push(wg);
  });
  // Taksi şeridi
  if(carData.id==='taxi'){
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02,0.12,4.52),
      new THREE.MeshPhongMaterial({color:0xf1c40f}));
    stripe.position.y=0.72; g.add(stripe);
  }
  g.castShadow = true;
  return g;
}

// ── İSTANBUL DÜNYASI (geniş şehir) ──────────────────────
function buildWorld() {
  // Zemin
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),
    new THREE.MeshLambertMaterial({color:0x3a7d44}));
  gnd.rotation.x=-Math.PI/2; gnd.receiveShadow=true; scene.add(gnd);

  const asfalt = new THREE.MeshLambertMaterial({color:0x1c1c1c});
  const swMat  = new THREE.MeshLambertMaterial({color:0x999999});
  const lineMat= new THREE.MeshLambertMaterial({color:0xffffff});
  const yLine  = new THREE.MeshLambertMaterial({color:0xf1c40f});

  // Ana caddeler - çok daha geniş şehir
  const roads = [
    // Yatay ana caddeler
    {cx:0,cz:0,w:1400,d:20,v:false},
    {cx:0,cz:-120,w:1400,d:14,v:false},
    {cx:0,cz:120,w:1400,d:14,v:false},
    {cx:0,cz:-280,w:1400,d:14,v:false},
    {cx:0,cz:280,w:1400,d:14,v:false},
    {cx:0,cz:-480,w:1400,d:12,v:false},
    {cx:0,cz:480,w:1400,d:12,v:false},
    // Dikey ana caddeler
    {cx:0,cz:0,w:20,d:1400,v:true},
    {cx:-120,cz:0,w:14,d:1400,v:true},
    {cx:120,cz:0,w:14,d:1400,v:true},
    {cx:-280,cz:0,w:14,d:1400,v:true},
    {cx:280,cz:0,w:14,d:1400,v:true},
    {cx:-480,cz:0,w:12,d:1400,v:true},
    {cx:480,cz:0,w:12,d:1400,v:true},
  ];

  roads.forEach(r => {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(r.w,r.d), asfalt);
    road.rotation.x=-Math.PI/2; road.position.set(r.cx,0.02,r.cz);
    road.receiveShadow=true; scene.add(road);
    // Kaldırım
    const sw1 = new THREE.Mesh(new THREE.PlaneGeometry(r.v?3:r.w, r.v?r.d:3), swMat);
    sw1.rotation.x=-Math.PI/2;
    sw1.position.set(r.v?r.cx+r.w/2+1.5:r.cx, 0.03, r.v?r.cz:r.cz+r.d/2+1.5);
    scene.add(sw1);
    const sw2 = sw1.clone();
    sw2.position.set(r.v?r.cx-r.w/2-1.5:r.cx, 0.03, r.v?r.cz:r.cz-r.d/2-1.5);
    scene.add(sw2);
  });

  // Yol çizgileri
  for(let x=-680;x<680;x+=16){
    const l=new THREE.Mesh(new THREE.PlaneGeometry(0.25,8),lineMat);
    l.rotation.x=-Math.PI/2; l.position.set(x,0.03,0); scene.add(l);
  }
  for(let z=-680;z<680;z+=16){
    const l=new THREE.Mesh(new THREE.PlaneGeometry(8,0.25),lineMat);
    l.rotation.x=-Math.PI/2; l.position.set(0,0.03,z); scene.add(l);
  }
  // Orta sarı çizgiler
  const yc1=new THREE.Mesh(new THREE.PlaneGeometry(1400,0.3),yLine);
  yc1.rotation.x=-Math.PI/2; yc1.position.set(0,0.04,0); scene.add(yc1);
  const yc2=new THREE.Mesh(new THREE.PlaneGeometry(0.3,1400),yLine);
  yc2.rotation.x=-Math.PI/2; yc2.position.set(0,0.04,0); scene.add(yc2);

  buildBuildings();
  buildBridges();
  buildLandmarks();
  buildTrees();
  buildStreetLights();
  buildSky();
}

function buildBuildings() {
  const winMat = new THREE.MeshPhongMaterial({color:0xffffcc,emissive:0xffff88,emissiveIntensity:0.4});
  const blocks = [
    // Taksim bölgesi
    {x:60,z:-60,w:20,h:35,d:20,c:0xd4a574},{x:85,z:-60,w:14,h:25,d:16,c:0xc9b99a},
    {x:60,z:-90,w:16,h:45,d:14,c:0x8b9dc3},{x:85,z:-90,w:12,h:20,d:12,c:0xe8d5b7},
    {x:-60,z:-60,w:20,h:30,d:20,c:0xb8a898},{x:-85,z:-60,w:14,h:40,d:16,c:0xd4a574},
    {x:-60,z:-90,w:16,h:22,d:14,c:0xe8d5b7},{x:-85,z:-90,w:12,h:50,d:12,c:0x9b8ea0},
    {x:60,z:60,w:20,h:28,d:20,c:0xd4a574},{x:85,z:60,w:14,h:42,d:16,c:0x8b9dc3},
    {x:60,z:90,w:16,h:25,d:14,c:0xc9b99a},{x:85,z:90,w:12,h:33,d:12,c:0xe8d5b7},
    {x:-60,z:60,w:20,h:38,d:20,c:0xb8a898},{x:-85,z:60,w:14,h:22,d:16,c:0xd4a574},
    {x:-60,z:90,w:16,h:46,d:14,c:0x8b9dc3},{x:-85,z:90,w:12,h:30,d:12,c:0xe8d5b7},
    // Kadıköy bölgesi
    {x:160,z:160,w:22,h:28,d:18,c:0xd4a574},{x:190,z:160,w:16,h:35,d:14,c:0x8b9dc3},
    {x:160,z:190,w:18,h:20,d:16,c:0xc9b99a},{x:190,z:190,w:14,h:42,d:12,c:0xe8d5b7},
    // Beşiktaş bölgesi
    {x:-160,z:-160,w:22,h:32,d:18,c:0xb8a898},{x:-190,z:-160,w:16,h:25,d:14,c:0xd4a574},
    {x:-160,z:-190,w:18,h:48,d:16,c:0x8b9dc3},{x:-190,z:-190,w:14,h:22,d:12,c:0xe8d5b7},
    // Üsküdar
    {x:160,z:-160,w:22,h:30,d:18,c:0xd4a574},{x:190,z:-160,w:16,h:38,d:14,c:0xc9b99a},
    {x:160,z:-190,w:18,h:24,d:16,c:0x8b9dc3},{x:190,z:-190,w:14,h:45,d:12,c:0xe8d5b7},
    // Fatih
    {x:-160,z:160,w:22,h:26,d:18,c:0xb8a898},{x:-190,z:160,w:16,h:40,d:14,c:0xd4a574},
    {x:-160,z:190,w:18,h:35,d:16,c:0x8b9dc3},{x:-190,z:190,w:14,h:28,d:12,c:0xe8d5b7},
    // Uzak binalar
    {x:320,z:-60,w:24,h:55,d:18,c:0x9b8ea0},{x:-320,z:-60,w:24,h:48,d:18,c:0xd4a574},
    {x:320,z:60,w:24,h:42,d:18,c:0x8b9dc3},{x:-320,z:60,w:24,h:60,d:18,c:0xe8d5b7},
    {x:60,z:-320,w:18,h:38,d:24,c:0xc9b99a},{x:-60,z:-320,w:18,h:50,d:24,c:0xd4a574},
    {x:60,z:320,w:18,h:30,d:24,c:0x8b9dc3},{x:-60,z:320,w:18,h:44,d:24,c:0xb8a898},
  ];

  blocks.forEach(cfg => {
    const bld = new THREE.Mesh(new THREE.BoxGeometry(cfg.w,cfg.h,cfg.d),
      new THREE.MeshPhongMaterial({color:cfg.c}));
    bld.position.set(cfg.x,cfg.h/2,cfg.z);
    bld.castShadow=true; bld.receiveShadow=true; scene.add(bld);
    // Pencereler
    for(let wy=2;wy<cfg.h-2;wy+=3.5){
      for(let wx=-cfg.w/2+1.5;wx<cfg.w/2-1;wx+=2.5){
        const win=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.4,0.1),winMat);
        win.position.set(cfg.x+wx,wy,cfg.z+cfg.d/2+0.05); scene.add(win);
      }
    }
    // Çatı
    const roof=new THREE.Mesh(new THREE.BoxGeometry(cfg.w+0.4,0.5,cfg.d+0.4),
      new THREE.MeshPhongMaterial({color:0x8b4513}));
    roof.position.set(cfg.x,cfg.h+0.25,cfg.z); scene.add(roof);
  });
}

function buildBridges() {
  const concMat = new THREE.MeshPhongMaterial({color:0x888888});
  const roadMat = new THREE.MeshLambertMaterial({color:0x1c1c1c});
  const cableMat= new THREE.MeshPhongMaterial({color:0x555555});
  const railMat = new THREE.MeshPhongMaterial({color:0x666666});

  // Boğaz Köprüsü 1 (kuzey)
  buildSuspensionBridge(0, 0, 280, concMat, roadMat, cableMat, railMat);
  // Boğaz Köprüsü 2 (güney)
  buildSuspensionBridge(0, 0, -280, concMat, roadMat, cableMat, railMat);
  // Yatay köprü (doğu-batı)
  buildSuspensionBridgeH(280, 0, 0, concMat, roadMat, cableMat, railMat);
  buildSuspensionBridgeH(-280, 0, 0, concMat, roadMat, cableMat, railMat);
}

function buildSuspensionBridge(cx, cy, cz, concMat, roadMat, cableMat, railMat) {
  const bridgeLen = 120, bridgeW = 20, towerH = 40;
  // Köprü yolu
  const deck = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen,1.5,bridgeW), concMat);
  deck.position.set(cx,8,cz); scene.add(deck);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(bridgeLen,bridgeW-2), roadMat);
  road.rotation.x=-Math.PI/2; road.position.set(cx,9.1,cz); scene.add(road);
  // Kuleler
  [-bridgeLen/2+8, bridgeLen/2-8].forEach(ox => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3,towerH,3), concMat);
    tower.position.set(cx+ox, towerH/2, cz); tower.castShadow=true; scene.add(tower);
    // Kablo
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,bridgeLen*0.6,8), cableMat);
    cable.rotation.z = Math.PI/2; cable.position.set(cx, towerH*0.7, cz); scene.add(cable);
  });
  // Korkuluklar
  [-bridgeW/2+1, bridgeW/2-1].forEach(oz => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen,1,0.3), railMat);
    rail.position.set(cx,9.8,cz+oz); scene.add(rail);
  });
}

function buildSuspensionBridgeH(cx, cy, cz, concMat, roadMat, cableMat, railMat) {
  const bridgeLen = 120, bridgeW = 20, towerH = 40;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(bridgeW,1.5,bridgeLen), concMat);
  deck.position.set(cx,8,cz); scene.add(deck);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(bridgeW-2,bridgeLen), roadMat);
  road.rotation.x=-Math.PI/2; road.position.set(cx,9.1,cz); scene.add(road);
  [-(bridgeLen/2-8), bridgeLen/2-8].forEach(oz => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3,towerH,3), concMat);
    tower.position.set(cx, towerH/2, cz+oz); tower.castShadow=true; scene.add(tower);
  });
  [-bridgeW/2+1, bridgeW/2-1].forEach(ox => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3,1,bridgeLen), concMat);
    rail.position.set(cx+ox,9.8,cz); scene.add(rail);
  });
}

function buildLandmarks() {
  const cMat = new THREE.MeshPhongMaterial({color:0xd4c5a9});
  // Cami (Ayasofya tarzı)
  const cBase = new THREE.Mesh(new THREE.BoxGeometry(24,6,24), cMat);
  cBase.position.set(0,3,-350); scene.add(cBase);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9,16,16,0,Math.PI*2,0,Math.PI/2), cMat);
  dome.position.set(0,6,-350); scene.add(dome);
  [[-10,-10],[-10,10],[10,-10],[10,10]].forEach(([mx,mz]) => {
    const min=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.8,22,8),cMat);
    min.position.set(mx,11,-350+mz); scene.add(min);
    const top=new THREE.Mesh(new THREE.ConeGeometry(0.9,3.5,8),
      new THREE.MeshPhongMaterial({color:0x888888}));
    top.position.set(mx,23,-350+mz); scene.add(top);
  });
  // Galata Kulesi
  const galBase=new THREE.Mesh(new THREE.CylinderGeometry(5,5.5,25,12),cMat);
  galBase.position.set(-350,12.5,0); scene.add(galBase);
  const galTop=new THREE.Mesh(new THREE.ConeGeometry(5.5,10,12),
    new THREE.MeshPhongMaterial({color:0x8b4513}));
  galTop.position.set(-350,30,0); scene.add(galTop);
  // Kız Kulesi
  const kkBase=new THREE.Mesh(new THREE.CylinderGeometry(4,4.5,18,10),cMat);
  kkBase.position.set(350,9,-350); scene.add(kkBase);
  const kkTop=new THREE.Mesh(new THREE.ConeGeometry(4.5,8,10),
    new THREE.MeshPhongMaterial({color:0x8b4513}));
  kkTop.position.set(350,22,-350); scene.add(kkTop);
}

function buildTrees() {
  const trunkMat=new THREE.MeshLambertMaterial({color:0x8B4513});
  const leafMat=new THREE.MeshLambertMaterial({color:0x228B22});
  for(let i=0;i<200;i++){
    const x=(Math.random()-0.5)*900, z=(Math.random()-0.5)*900;
    if(Math.abs(x)<16||Math.abs(z)<16) continue;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,2.5,6),trunkMat);
    trunk.position.set(x,1.25,z); scene.add(trunk);
    const leaves=new THREE.Mesh(new THREE.SphereGeometry(1.8+Math.random(),8,8),leafMat);
    leaves.position.set(x,4.2,z); scene.add(leaves);
  }
}

function buildStreetLights() {
  const poleMat=new THREE.MeshPhongMaterial({color:0x555555});
  const lampMat=new THREE.MeshPhongMaterial({color:0xffffaa,emissive:0xffff44,emissiveIntensity:1});
  for(let i=-600;i<600;i+=30){
    [12,-12].forEach(off=>{
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.14,7,6),poleMat);
      pole.position.set(i,3.5,off); scene.add(pole);
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8),lampMat);
      lamp.position.set(i,7.3,off); scene.add(lamp);
    });
  }
}

function buildSky() {
  const sun2=new THREE.Mesh(new THREE.SphereGeometry(10,16,16),
    new THREE.MeshBasicMaterial({color:0xfffacd}));
  sun2.position.set(100,180,-300); scene.add(sun2);
  const cMat=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:0.88});
  for(let i=0;i<22;i++){
    const cloud=new THREE.Group();
    for(let j=0;j<5;j++){
      const p=new THREE.Mesh(new THREE.SphereGeometry(4+Math.random()*3,8,8),cMat);
      p.position.set(j*6-12,Math.random()*3,0); cloud.add(p);
    }
    cloud.position.set((Math.random()-0.5)*700,80+Math.random()*60,(Math.random()-0.5)*700);
    scene.add(cloud);
  }
}

// ── NPC TAKSİ SİSTEMİ ────────────────────────────────────
const NPC_LOCS = [
  {name:'Taksim Meydanı',   x:0,   z:0},
  {name:'Galata Kulesi',    x:-350,z:0},
  {name:'Kız Kulesi',       x:350, z:-350},
  {name:'Ayasofya',         x:0,   z:-350},
  {name:'Kadıköy',          x:200, z:200},
  {name:'Beşiktaş',         x:-200,z:-200},
  {name:'Üsküdar',          x:200, z:-200},
  {name:'Fatih',            x:-200,z:200},
  {name:'Şişli',            x:60,  z:-120},
  {name:'Beyoğlu',          x:-60, z:120},
  {name:'Bağcılar',         x:-350,z:200},
  {name:'Maltepe',          x:350, z:200},
  {name:'Sarıyer',          x:0,   z:-480},
  {name:'Pendik',           x:480, z:0},
];

const npcs = [];
let activePassenger = null, nearNPC = null;

function spawnNPCs() {
  for(let i=0;i<10;i++) spawnOneNPC();
}

function spawnOneNPC() {
  const loc = NPC_LOCS[Math.floor(Math.random()*NPC_LOCS.length)];
  const g = new THREE.Group();
  const colors=[0xe74c3c,0x3498db,0x2ecc71,0x9b59b6,0xe67e22,0x1abc9c];
  const bMat = new THREE.MeshPhongMaterial({color:colors[Math.floor(Math.random()*colors.length)]});
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.35,1.2,8),bMat);
  body.position.y=0.9; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28,10,10),
    new THREE.MeshPhongMaterial({color:0xf5cba7}));
  head.position.y=1.8; g.add(head);
  [-0.18,0.18].forEach(x=>{
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.9,6),
      new THREE.MeshPhongMaterial({color:0x2c3e50}));
    leg.position.set(x,0.35,0); g.add(leg);
  });
  const excMat=new THREE.MeshPhongMaterial({color:0xf1c40f,emissive:0xf1c40f,emissiveIntensity:0.9});
  const excl=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.5,6),excMat);
  excl.position.y=2.6; g.add(excl);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,6),excMat);
  dot.position.y=2.2; g.add(dot);
  g.position.set(loc.x+(Math.random()-0.5)*8,0,loc.z+(Math.random()-0.5)*8);
  g.userData={waiting:true,inCar:false,excl};
  scene.add(g); npcs.push(g);
}

// Yön oku (3D ok + HUD ok)
let destMarker = null;
function showDestMarker(x,z) {
  if(destMarker) scene.remove(destMarker);
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({color:0xe74c3c,emissive:0xe74c3c,emissiveIntensity:0.7});
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,6,8),mat);
  pole.position.y=3; g.add(pole);
  // Ok başı (koni)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2,2.5,8),mat);
  cone.position.y=7.5; g.add(cone);
  // Zemin çemberi
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.5,3.2,32),
    new THREE.MeshBasicMaterial({color:0xe74c3c,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.1; g.add(ring);
  g.position.set(x,0,z); scene.add(g); destMarker=g;
}

let npcT=0;
function animateNPCs(delta) {
  npcT+=delta*0.003;
  npcs.forEach(npc=>{
    if(npc.userData.waiting&&!npc.userData.inCar){
      npc.position.y=Math.abs(Math.sin(npcT*2+npc.position.x))*0.18;
      if(npc.userData.excl) npc.userData.excl.material.emissiveIntensity=0.5+Math.sin(npcT*4)*0.5;
    }
  });
  if(destMarker) destMarker.rotation.y+=delta*0.0015;
  updateDirectionArrow();
}

// HUD yön oku güncelle
function updateDirectionArrow() {
  const arrowEl = document.getElementById('direction-arrow');
  if(!activePassenger||!playerCar){ arrowEl.classList.add('hidden'); return; }
  arrowEl.classList.remove('hidden');
  const dest = activePassenger.destination;
  const dx = dest.x - playerCar.position.x;
  const dz = dest.z - playerCar.position.z;
  const dist = Math.round(Math.sqrt(dx*dx+dz*dz));
  // Açı hesapla (kameraya göre)
  const angle = Math.atan2(dx, dz) - carAngle;
  document.getElementById('arrow-icon').style.transform = `rotate(${-angle}rad)`;
  document.getElementById('arrow-dist').textContent = dist + 'm';
}

function checkNearNPC() {
  if(!playerCar||activePassenger){nearNPC=null; document.getElementById('npc-prompt').classList.add('hidden'); return;}
  const px=playerCar.position.x, pz=playerCar.position.z;
  nearNPC=null;
  for(const npc of npcs){
    if(!npc.userData.waiting||npc.userData.inCar) continue;
    const dx=npc.position.x-px, dz=npc.position.z-pz;
    if(Math.sqrt(dx*dx+dz*dz)<6){nearNPC=npc; break;}
  }
  document.getElementById('npc-prompt').classList.toggle('hidden',!nearNPC);
}

function pickupPassenger() {
  if(!nearNPC||activePassenger) return;
  const npc=nearNPC;
  npc.userData.inCar=true; npc.userData.waiting=false; npc.visible=false;
  const dests=NPC_LOCS.filter(l=>{
    const dx=l.x-npc.position.x,dz=l.z-npc.position.z;
    return Math.sqrt(dx*dx+dz*dz)>60;
  });
  const dest=dests[Math.floor(Math.random()*dests.length)];
  const dist=Math.sqrt((dest.x-npc.position.x)**2+(dest.z-npc.position.z)**2);
  const reward=Math.floor(300+dist*2.5);
  activePassenger={npc,destination:dest,reward};
  showDestMarker(dest.x,dest.z);
  document.getElementById('taxi-hud').classList.remove('hidden');
  document.getElementById('taxi-status').textContent='🧍 YOLCU ALINDI';
  document.getElementById('taxi-dest').textContent='📍 '+dest.name;
  document.getElementById('taxi-reward').textContent='💰 Ödül: '+reward.toLocaleString('tr-TR')+' ₺';
  document.getElementById('npc-prompt').classList.add('hidden');
  showPopup('🧍 Yolcu bindi!','#f1c40f');
}

function checkDropoff() {
  if(!activePassenger||!playerCar) return;
  const dest=activePassenger.destination;
  const dx=playerCar.position.x-dest.x, dz=playerCar.position.z-dest.z;
  if(Math.sqrt(dx*dx+dz*dz)<10){
    money+=activePassenger.reward;
    saveGame(); updateMoneyHUD();
    showPopup('+'+activePassenger.reward.toLocaleString('tr-TR')+' ₺\n✅ '+dest.name,'#2ecc71');
    setTimeout(()=>{
      activePassenger.npc.userData.inCar=false;
      activePassenger.npc.userData.waiting=true;
      activePassenger.npc.visible=true;
      const newLoc=NPC_LOCS[Math.floor(Math.random()*NPC_LOCS.length)];
      activePassenger.npc.position.set(newLoc.x+(Math.random()-0.5)*8,0,newLoc.z+(Math.random()-0.5)*8);
    },3000);
    activePassenger=null;
    if(destMarker){scene.remove(destMarker);destMarker=null;}
    document.getElementById('taxi-hud').classList.add('hidden');
    document.getElementById('direction-arrow').classList.add('hidden');
  }
}

// ── MOBİL KONTROLLER (Sol=Direksiyon, Sağ=Gaz+Fren) ─────
const mobileKeys = {left:false, right:false, gas:false, brake:false};

function setupMobileControls() {
  const steerL = document.getElementById('steering-left');
  const steerR = document.getElementById('steering-right');
  const btnGas  = document.getElementById('btn-gas');
  const btnBrake= document.getElementById('btn-brake');
  const btnPickup=document.getElementById('btn-pickup');

  function hold(el, key) {
    el.addEventListener('touchstart', e=>{ e.preventDefault(); mobileKeys[key]=true; el.classList.add('pressed'); },{passive:false});
    el.addEventListener('touchend',   ()=>{ mobileKeys[key]=false; el.classList.remove('pressed'); });
    el.addEventListener('touchcancel',()=>{ mobileKeys[key]=false; el.classList.remove('pressed'); });
    // Mouse desteği (masaüstü test için)
    el.addEventListener('mousedown', ()=>{ mobileKeys[key]=true; el.classList.add('pressed'); });
    el.addEventListener('mouseup',   ()=>{ mobileKeys[key]=false; el.classList.remove('pressed'); });
  }

  hold(steerL, 'left');
  hold(steerR, 'right');
  hold(btnGas,  'gas');
  hold(btnBrake,'brake');

  btnPickup.addEventListener('touchstart', e=>{ e.preventDefault(); if(nearNPC) pickupPassenger(); },{passive:false});
  btnPickup.addEventListener('click', ()=>{ if(nearNPC) pickupPassenger(); });
}

// ── KLAVYE ───────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='KeyE'&&nearNPC) pickupPassenger();
  if(e.code==='Space') e.preventDefault();
});
window.addEventListener('keyup', e=>{ keys[e.code]=false; });

// ── FİZİK ────────────────────────────────────────────────
async function applySelectedCar() {
  if(playerCar) scene.remove(playerCar);
  currentCarData = CAR_CATALOG.find(c=>c.id===selectedCarId)||CAR_CATALOG[0];
  playerCar = await loadCarGLB(currentCarData);
  playerCar.position.set(5,0,5);
  scene.add(playerCar);
  document.getElementById('car-name-val') && (document.getElementById('car-name-val').textContent=currentCarData.name);
}

function updatePhysics(delta) {
  if(!playerCar||!currentCarData) return;
  const {acc,maxSpeed,handling,brake} = currentCarData;

  const fwd   = keys['KeyW']||keys['ArrowUp']   ||mobileKeys.gas;
  const bwd   = keys['KeyS']||keys['ArrowDown'] ||mobileKeys.brake;
  const lft   = keys['KeyA']||keys['ArrowLeft'] ||mobileKeys.left;
  const rgt   = keys['KeyD']||keys['ArrowRight']||mobileKeys.right;
  const eBrake= keys['Space'];

  if(fwd)        speed = Math.min(speed+acc, maxSpeed);
  else if(bwd)   speed = Math.max(speed-acc*0.7, -maxSpeed*0.45);
  else if(eBrake)speed *= (1-brake*2.5);
  else           speed *= 0.975;

  if(Math.abs(speed)>0.004){
    const dir = speed>0?1:-1;
    if(lft)  carAngle += handling*dir;
    if(rgt)  carAngle -= handling*dir;
  }

  playerCar.rotation.y = carAngle;
  playerCar.position.x += Math.sin(carAngle)*speed;
  playerCar.position.z += Math.cos(carAngle)*speed;
  // Sınır yok - sonsuz şehir hissi için geniş sınır
  playerCar.position.x = Math.max(-680, Math.min(680, playerCar.position.x));
  playerCar.position.z = Math.max(-680, Math.min(680, playerCar.position.z));

  // Tekerlek dönüşü
  wheelRot += speed*3.5;
  if(playerCar.userData&&playerCar.userData.wheels){
    playerCar.userData.wheels.forEach(w=>{ w.rotation.x=wheelRot; });
  }

  // Hız göstergesi
  const kmh = Math.abs(Math.round(speed*400));
  const maxKmh = Math.round(currentCarData.maxSpeed*400);
  document.getElementById('speed-value').textContent = kmh;
  drawSpeedo(kmh, maxKmh);

  checkNearNPC();
  checkDropoff();
}

// ── SPEEDO ───────────────────────────────────────────────
const speedoCanvas = document.getElementById('speedo-canvas');
const sCtx = speedoCanvas.getContext('2d');

function drawSpeedo(kmh, maxKmh) {
  const W=140,H=140,cx=70,cy=70,R=60;
  sCtx.clearRect(0,0,W,H);
  sCtx.beginPath(); sCtx.arc(cx,cy,R,0,Math.PI*2);
  sCtx.fillStyle='rgba(0,0,0,0.85)'; sCtx.fill();
  sCtx.strokeStyle='rgba(255,255,255,0.15)'; sCtx.lineWidth=2; sCtx.stroke();

  const s=(225*Math.PI)/180, sweep=(270*Math.PI)/180;
  sCtx.beginPath(); sCtx.arc(cx,cy,R-8,s,s+sweep);
  sCtx.strokeStyle='#222'; sCtx.lineWidth=10; sCtx.stroke();

  const ratio=Math.min(kmh/Math.max(maxKmh,1),1);
  const grad=sCtx.createLinearGradient(0,H,W,0);
  grad.addColorStop(0,'#00e676'); grad.addColorStop(0.5,'#ffeb3b'); grad.addColorStop(1,'#f44336');
  sCtx.beginPath(); sCtx.arc(cx,cy,R-8,s,s+sweep*ratio);
  sCtx.strokeStyle=grad; sCtx.lineWidth=10; sCtx.stroke();

  sCtx.textAlign='center'; sCtx.textBaseline='middle';
  for(let i=0;i<=10;i++){
    const a=s+sweep*(i/10);
    const cos=Math.cos(a),sin=Math.sin(a);
    const isMajor=i%2===0;
    sCtx.beginPath();
    sCtx.moveTo(cx+cos*(R-14),cy+sin*(R-14));
    sCtx.lineTo(cx+cos*(R-(isMajor?22:18)),cy+sin*(R-(isMajor?22:18)));
    sCtx.strokeStyle=isMajor?'#aaa':'#555'; sCtx.lineWidth=isMajor?2:1; sCtx.stroke();
    if(isMajor){
      sCtx.font='bold 7px Arial'; sCtx.fillStyle='#ccc';
      sCtx.fillText(Math.round(maxKmh*i/10),cx+cos*(R-30),cy+sin*(R-30));
    }
  }
  const na=s+sweep*ratio;
  sCtx.beginPath();
  sCtx.moveTo(cx-Math.cos(na)*10,cy-Math.sin(na)*10);
  sCtx.lineTo(cx+Math.cos(na)*(R-18),cy+Math.sin(na)*(R-18));
  sCtx.strokeStyle='#ff1744'; sCtx.lineWidth=2.5; sCtx.lineCap='round'; sCtx.stroke();
  sCtx.beginPath(); sCtx.arc(cx,cy,5,0,Math.PI*2);
  sCtx.fillStyle='#ff1744'; sCtx.fill();
  sCtx.beginPath(); sCtx.arc(cx,cy,2.5,0,Math.PI*2);
  sCtx.fillStyle='#fff'; sCtx.fill();
}

// ── KAMERA ───────────────────────────────────────────────
const camTarget = new THREE.Vector3();
function updateCamera() {
  if(!playerCar) return;
  camTarget.set(
    playerCar.position.x - Math.sin(carAngle)*14,
    6,
    playerCar.position.z - Math.cos(carAngle)*14
  );
  camera.position.lerp(camTarget, 0.09);
  camera.lookAt(playerCar.position.x, 1.2, playerCar.position.z);
}

// ── MULTIPLAYER ──────────────────────────────────────────
let socket;
const otherPlayers = {};
const COLORS=['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63'];

function setupSocket() {
  socket = io();
  socket.on('connect', () => {
    socket.emit('setName', playerName);
  });
  socket.on('init',({id,players})=>{
    Object.values(players).forEach(p=>{ if(p.id!==id) addOtherPlayer(p); });
    updatePlayersHUD(players);
  });
  socket.on('playerJoined', p=>addOtherPlayer(p));
  socket.on('playerMoved', data=>{
    const op=otherPlayers[data.id]; if(!op) return;
    op.mesh.position.set(data.x,data.y,data.z);
    op.mesh.rotation.y=data.ry;
  });
  socket.on('playerLeft', id=>{
    if(otherPlayers[id]){scene.remove(otherPlayers[id].mesh);delete otherPlayers[id];}
    updatePlayersHUD();
  });
}

async function addOtherPlayer(p) {
  const idx=Object.keys(otherPlayers).length%CAR_CATALOG.length;
  const mesh=await loadCarGLB(CAR_CATALOG[idx]);
  mesh.position.set(p.x||0,p.y||0,p.z||0);
  scene.add(mesh);
  otherPlayers[p.id]={mesh,data:p};
  // İsim etiketi
  updatePlayersHUD();
}

function updatePlayersHUD(players) {
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
function sendPosition(now) {
  if(!playerCar||!socket||now-lastSend<50) return;
  lastSend=now;
  socket.emit('update',{x:playerCar.position.x,y:playerCar.position.y,z:playerCar.position.z,ry:carAngle,speed});
}

// ── HUD ──────────────────────────────────────────────────
function updateMoneyHUD() {
  document.getElementById('money-val').textContent=money.toLocaleString('tr-TR');
  document.getElementById('garage-money').textContent='💰 '+money.toLocaleString('tr-TR')+' ₺';
}

let popTimer=null;
function showPopup(text,color='#2ecc71') {
  const el=document.getElementById('earn-popup');
  el.textContent=text; el.style.color=color; el.style.textShadow=`0 0 20px ${color}`;
  el.classList.add('show');
  if(popTimer) clearTimeout(popTimer);
  popTimer=setTimeout(()=>el.classList.remove('show'),2200);
}

// ── GARAJ ────────────────────────────────────────────────
function openGarage(){ document.getElementById('garage').classList.remove('hidden'); renderGarageUI(); }
function closeGarage(){ document.getElementById('garage').classList.add('hidden'); }

function renderGarageUI() {
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

document.getElementById('btn-start-race').addEventListener('click', async()=>{
  closeGarage(); await applySelectedCar();
});
document.getElementById('garage-btn').addEventListener('click', openGarage);

// ── OYUN DÖNGÜSÜ ─────────────────────────────────────────
let lastTime=0;
function animate(now) {
  requestAnimationFrame(animate);
  const delta=now-lastTime; lastTime=now;
  updatePhysics(delta);
  updateCamera();
  animateNPCs(delta);
  sendPosition(now);
  renderer.render(scene,camera);
}
