// ═══════════════════════════════════════════════════
// İSTANBUL RACING - Temiz yeniden yazım
// ═══════════════════════════════════════════════════

// ── KULLANICI ADI ────────────────────────────────
let playerName = localStorage.getItem('igt_name') || '';

const nameScreen = document.getElementById('name-screen');
const nameInput  = document.getElementById('name-input');
const nameBtn    = document.getElementById('name-btn');

function startGame() {
  nameScreen.classList.add('hidden');
  document.getElementById('player-name-display').textContent = playerName;
  // Loading'i göster, sonra başlat
  document.getElementById('loading').classList.remove('hidden');
  // Kısa gecikme ile başlat (DOM render için)
  setTimeout(initGame, 100);
}

if (playerName) {
  startGame();
} else {
  nameInput.focus();
  nameBtn.addEventListener('click', () => {
    const v = nameInput.value.trim();
    if (!v) { nameInput.style.borderColor = '#e74c3c'; return; }
    playerName = v;
    localStorage.setItem('igt_name', playerName);
    startGame();
  });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nameBtn.click(); });
}

// ── ARABA KATALOĞU ───────────────────────────────
const CARS = [
  { id:'taxi',    name:'Taksi',      emoji:'🚕', price:0,     owned:true,  glb:'models/taxi.glb',         scale:1.8, maxSpeed:0.28, acc:0.012, hdl:0.046, brk:0.020, stats:[55,50,65], color:0xf1c40f },
  { id:'sedan',   name:'Sedan',      emoji:'🚗', price:2000,  owned:false, glb:'models/sedan.glb',        scale:1.8, maxSpeed:0.34, acc:0.015, hdl:0.052, brk:0.023, stats:[62,56,70], color:0x3498db },
  { id:'sports',  name:'Spor Sedan', emoji:'🏎️', price:5000,  owned:false, glb:'models/sedan-sports.glb', scale:1.8, maxSpeed:0.46, acc:0.020, hdl:0.060, brk:0.027, stats:[82,76,82], color:0xe74c3c },
  { id:'hatch',   name:'Hatchback',  emoji:'⚡', price:4000,  owned:false, glb:'models/hatchback-sports.glb',scale:1.8,maxSpeed:0.42,acc:0.018,hdl:0.062,brk:0.025,stats:[76,72,86],color:0x9b59b6 },
  { id:'suv',     name:'Lüks SUV',   emoji:'💎', price:8000,  owned:false, glb:'models/suv-luxury.glb',   scale:1.8, maxSpeed:0.40, acc:0.016, hdl:0.044, brk:0.024, stats:[72,62,62], color:0x2c3e50 },
  { id:'race',    name:'Yarış',      emoji:'🔥', price:12000, owned:false, glb:'models/race.glb',         scale:1.8, maxSpeed:0.62, acc:0.030, hdl:0.066, brk:0.033, stats:[96,93,89], color:0xe67e22 },
  { id:'future',  name:'Fütüristik', emoji:'🚀', price:15000, owned:false, glb:'models/race-future.glb',  scale:1.8, maxSpeed:0.70, acc:0.033, hdl:0.063, brk:0.036, stats:[99,99,83], color:0x1abc9c },
  { id:'police',  name:'Polis',      emoji:'🚔', price:6000,  owned:false, glb:'models/police.glb',       scale:1.8, maxSpeed:0.52, acc:0.023, hdl:0.056, brk:0.029, stats:[89,81,79], color:0x2980b9 },
];

// ── SAVE/LOAD ────────────────────────────────────
let money = 0, selCar = 'taxi';
function save() {
  localStorage.setItem('igt_money', money);
  localStorage.setItem('igt_owned', JSON.stringify(CARS.filter(c=>c.owned).map(c=>c.id)));
  localStorage.setItem('igt_car', selCar);
}
function load() {
  money = parseInt(localStorage.getItem('igt_money') || '0');
  const owned = JSON.parse(localStorage.getItem('igt_owned') || '["taxi"]');
  CARS.forEach(c => { c.owned = owned.includes(c.id); });
  selCar = localStorage.getItem('igt_car') || 'taxi';
}
load();

// ── GLOBALS ──────────────────────────────────────
let renderer, scene, camera;
let playerCar = null, carData = null;
let speed = 0, angle = 0, wRot = 0;
let activePassenger = null, nearNPC = null;
let destMarker = null;
const npcs = [];
const others = {};
let socket;
const mKeys = { left:false, right:false, gas:false, brake:false };
const keys = {};

// ── INIT ─────────────────────────────────────────
function initGame() {
  try {
    // Three.js setup
    const canvas = document.getElementById('gameCanvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 100, 400);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 0.1, 500);

    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth/window.innerHeight;
      camera.updateProjectionMatrix();
    });

    // Işıklar
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
    sun.position.set(80, 120, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -200;
    sun.shadow.camera.right = sun.shadow.camera.top = 200;
    scene.add(sun);

    // Dünya inşa et
    buildWorld();
    spawnNPCs();

    // Araba oluştur
    carData = CARS.find(c => c.id === selCar) || CARS[0];
    playerCar = makeCar(carData);
    playerCar.position.set(5, 0, 5);
    scene.add(playerCar);

    // Kontroller
    window.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'KeyE' && nearNPC) pickupPassenger();
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    setupMobile();

    // Socket
    socket = io();
    socket.on('connect', () => socket.emit('setName', playerName));
    socket.on('init', ({id, players}) => {
      Object.values(players).forEach(p => { if (p.id !== id) addOther(p); });
      updateHUDPlayers(players);
    });
    socket.on('playerJoined', p => addOther(p));
    socket.on('playerMoved', d => {
      if (others[d.id]) {
        others[d.id].position.set(d.x, d.y, d.z);
        others[d.id].rotation.y = d.ry;
      }
    });
    socket.on('playerLeft', id => {
      if (others[id]) { scene.remove(others[id]); delete others[id]; }
      updateHUDPlayers();
    });

    // HUD
    updateMoneyHUD();
    document.getElementById('btn-start-race').addEventListener('click', () => {
      closeGarage();
      swapCar();
    });
    document.getElementById('garage-btn').addEventListener('click', openGarage);

    // Loading kapat, UI aç
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('ui').classList.remove('hidden');
    openGarage();

    // GLB arka planda yükle
    loadGLBBackground();

    // Oyun döngüsü
    let last = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = now - last; last = now;
      updatePhysics(dt);
      updateCamera();
      animNPCs(dt);
      sendPos(now);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);

  } catch(err) {
    console.error('initGame hatası:', err);
    // Hata olsa bile loading'i kapat
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('ui').classList.remove('hidden');
  }
}

// ── ARABA YAPICI ─────────────────────────────────
function makeCar(car) {
  const g = new THREE.Group();
  const bMat = new THREE.MeshPhongMaterial({ color: car.color, shininess: 150 });
  const gMat = new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.4 });
  const tMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const rMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 200 });

  // Gövde
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 4.2), bMat);
  body.position.y = 0.45; body.castShadow = true; g.add(body);
  // Kabin
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), bMat);
  cab.position.set(0, 0.95, -0.1); g.add(cab);
  // Ön cam
  const ws = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.5, 0.07), gMat);
  ws.position.set(0, 0.95, 1.0); ws.rotation.x = 0.4; g.add(ws);
  // Arka cam
  const rg = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.45, 0.07), gMat);
  rg.position.set(0, 0.95, -1.2); rg.rotation.x = -0.4; g.add(rg);
  // Tamponlar
  const fb = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.22, 0.15), bMat);
  fb.position.set(0, 0.28, 2.25); g.add(fb);
  const rb = fb.clone(); rb.position.z = -2.25; g.add(rb);
  // Farlar
  const lF = new THREE.MeshPhongMaterial({ color: 0xffffaa, emissive: 0xffff00, emissiveIntensity: 0.5 });
  const lR = new THREE.MeshPhongMaterial({ color: 0xff2200, emissive: 0xff0000, emissiveIntensity: 0.4 });
  [-0.65, 0.65].forEach(x => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.07), lF);
    hl.position.set(x, 0.52, 2.28); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.07), lR);
    tl.position.set(x, 0.52, -2.28); g.add(tl);
  });
  // Taksi şeridi
  if (car.id === 'taxi') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.1, 4.22),
      new THREE.MeshPhongMaterial({ color: 0xf1c40f }));
    stripe.position.y = 0.72; g.add(stripe);
  }
  // Tekerlekler
  g.userData.wheels = [];
  [[-1.05, 0.38, 1.4], [1.05, 0.38, 1.4], [-1.05, 0.38, -1.4], [1.05, 0.38, -1.4]].forEach(([x, y, z]) => {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 16), tMat);
    tire.rotation.z = Math.PI / 2; wg.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.27, 10), rMat);
    rim.rotation.z = Math.PI / 2; wg.add(rim);
    wg.position.set(x, y, z); g.add(wg);
    g.userData.wheels.push(wg);
  });
  return g;
}

// GLB arka planda yükle
function loadGLBBackground() {
  if (!THREE.GLTFLoader) return;
  const loader = new THREE.GLTFLoader();
  const car = CARS.find(c => c.id === selCar) || CARS[0];
  loader.load(car.glb, gltf => {
    if (!playerCar) return;
    const model = gltf.scene;
    model.scale.setScalar(car.scale);
    model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    model.userData.wheels = [];
    model.traverse(n => { if (n.name && /wheel|tire/i.test(n.name)) model.userData.wheels.push(n); });
    const pos = playerCar.position.clone();
    const rot = playerCar.rotation.y;
    scene.remove(playerCar);
    playerCar = model;
    playerCar.position.copy(pos);
    playerCar.rotation.y = rot;
    scene.add(playerCar);
  }, undefined, () => {});
}

function swapCar() {
  carData = CARS.find(c => c.id === selCar) || CARS[0];
  if (playerCar) {
    const pos = playerCar.position.clone();
    scene.remove(playerCar);
    playerCar = makeCar(carData);
    playerCar.position.copy(pos);
    scene.add(playerCar);
  }
  if (THREE.GLTFLoader) {
    const loader = new THREE.GLTFLoader();
    loader.load(carData.glb, gltf => {
      if (!playerCar) return;
      const model = gltf.scene;
      model.scale.setScalar(carData.scale);
      model.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
      model.userData.wheels = [];
      model.traverse(n => { if (n.name && /wheel|tire/i.test(n.name)) model.userData.wheels.push(n); });
      const pos = playerCar.position.clone();
      const rot = playerCar.rotation.y;
      scene.remove(playerCar);
      playerCar = model;
      playerCar.position.copy(pos);
      playerCar.rotation.y = rot;
      scene.add(playerCar);
    }, undefined, () => {});
  }
}

function addOther(p) {
  const car = CARS[Object.keys(others).length % CARS.length];
  const mesh = makeCar(car);
  mesh.position.set(p.x || 0, p.y || 0, p.z || 0);
  scene.add(mesh);
  others[p.id] = mesh;
  updateHUDPlayers();
}

// ── DÜNYA ────────────────────────────────────────
function buildWorld() {
  // Zemin
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ color: 0x3a7d44 }));
  gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; scene.add(gnd);

  const asfalt = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
  const swMat  = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const lineMat= new THREE.MeshLambertMaterial({ color: 0xffffff });
  const yMat   = new THREE.MeshLambertMaterial({ color: 0xf1c40f });

  // Caddeler
  [[0,0,500,18,false],[0,-80,500,12,false],[0,80,500,12,false],[0,-200,500,10,false],[0,200,500,10,false],
   [0,0,18,500,true],[-80,0,12,500,true],[80,0,12,500,true],[-200,0,10,500,true],[200,0,10,500,true]]
  .forEach(([cx,cz,w,d,v]) => {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asfalt);
    r.rotation.x = -Math.PI / 2; r.position.set(cx, 0.02, cz); r.receiveShadow = true; scene.add(r);
    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(v?3:w, v?d:3), swMat);
    s1.rotation.x = -Math.PI / 2;
    s1.position.set(v ? cx+w/2+1.5 : cx, 0.03, v ? cz : cz+d/2+1.5); scene.add(s1);
    const s2 = s1.clone();
    s2.position.set(v ? cx-w/2-1.5 : cx, 0.03, v ? cz : cz-d/2-1.5); scene.add(s2);
  });

  // Yol çizgileri
  for (let x = -240; x < 240; x += 18) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 8), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(x, 0.03, 0); scene.add(l);
  }
  for (let z = -240; z < 240; z += 18) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.25), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(0, 0.03, z); scene.add(l);
  }
  const yc1 = new THREE.Mesh(new THREE.PlaneGeometry(500, 0.3), yMat);
  yc1.rotation.x = -Math.PI / 2; yc1.position.set(0, 0.04, 0); scene.add(yc1);
  const yc2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 500), yMat);
  yc2.rotation.x = -Math.PI / 2; yc2.position.set(0, 0.04, 0); scene.add(yc2);

  buildBuildings();
  buildBridges();
  buildLandmarks();
  buildTrees();
  buildLights();
  buildSky();
}

function buildBuildings() {
  const cfgs = [
    [50,-50,18,30,18,0xd4a574],[72,-50,12,22,14,0xc9b99a],[50,-75,14,40,12,0x8b9dc3],[72,-75,10,18,10,0xe8d5b7],
    [-50,-50,18,28,18,0xb8a898],[-72,-50,12,35,14,0xd4a574],[-50,-75,14,20,12,0xe8d5b7],[-72,-75,10,45,10,0x9b8ea0],
    [50,50,18,25,18,0xd4a574],[72,50,12,38,14,0x8b9dc3],[50,75,14,22,12,0xc9b99a],[72,75,10,30,10,0xe8d5b7],
    [-50,50,18,35,18,0xb8a898],[-72,50,12,20,14,0xd4a574],[-50,75,14,42,12,0x8b9dc3],[-72,75,10,28,10,0xe8d5b7],
    [130,-50,20,50,16,0x9b8ea0],[-130,-50,20,42,16,0xd4a574],[130,50,20,38,16,0x8b9dc3],[-130,50,20,55,16,0xe8d5b7],
    [50,-130,16,30,20,0xc9b99a],[-50,-130,16,44,20,0xd4a574],[50,130,16,26,20,0x8b9dc3],[-50,130,16,36,20,0xb8a898],
  ];
  const wMat = new THREE.MeshPhongMaterial({ color: 0xffffcc, emissive: 0xffff88, emissiveIntensity: 0.5 });
  cfgs.forEach(([x,z,w,h,d,c]) => {
    const bld = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshPhongMaterial({color:c}));
    bld.position.set(x, h/2, z); bld.castShadow = true; scene.add(bld);
    for (let wy = 3; wy < h-3; wy += 5) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(w*0.7, 1.2, 0.1), wMat);
      win.position.set(x, wy, z+d/2+0.05); scene.add(win);
    }
  });
}

function buildBridges() {
  const cMat = new THREE.MeshPhongMaterial({ color: 0x888888 });
  const rMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
  const caMat= new THREE.MeshPhongMaterial({ color: 0x555555 });
  [200, -200].forEach(cz => {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(100, 1.5, 16), cMat);
    deck.position.set(0, 8, cz); scene.add(deck);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(100, 14), rMat);
    road.rotation.x = -Math.PI/2; road.position.set(0, 9.1, cz); scene.add(road);
    [-42, 42].forEach(ox => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(3, 35, 3), cMat);
      t.position.set(ox, 17.5, cz); t.castShadow = true; scene.add(t);
    });
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 55, 6), caMat);
    cable.rotation.z = Math.PI/2; cable.position.set(0, 26, cz); scene.add(cable);
  });
}

function buildLandmarks() {
  const cMat = new THREE.MeshPhongMaterial({ color: 0xd4c5a9 });
  const rMat = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
  const bMat = new THREE.MeshPhongMaterial({ color: 0x6699cc });

  // Ayasofya
  const ayB = new THREE.Mesh(new THREE.BoxGeometry(22,5,22), cMat);
  ayB.position.set(0, 2.5, -220); scene.add(ayB);
  const ayD = new THREE.Mesh(new THREE.SphereGeometry(8,12,12,0,Math.PI*2,0,Math.PI/2), cMat);
  ayD.position.set(0, 5, -220); scene.add(ayD);
  [[-9,-9],[-9,9],[9,-9],[9,9]].forEach(([mx,mz]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,20,8), cMat);
    m.position.set(mx, 10, -220+mz); scene.add(m);
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.8,3,8), new THREE.MeshPhongMaterial({color:0x888888}));
    t.position.set(mx, 21, -220+mz); scene.add(t);
  });

  // Sultanahmet (Mavi Cami)
  const smB = new THREE.Mesh(new THREE.BoxGeometry(20,4,20), cMat);
  smB.position.set(60, 2, -220); scene.add(smB);
  const smD = new THREE.Mesh(new THREE.SphereGeometry(7,12,12,0,Math.PI*2,0,Math.PI/2), bMat);
  smD.position.set(60, 4, -220); scene.add(smD);
  [[-8,-8],[-8,8],[8,-8],[8,8],[-8,0],[8,0]].forEach(([mx,mz]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.6,18,8), cMat);
    m.position.set(60+mx, 9, -220+mz); scene.add(m);
  });

  // Galata Kulesi
  const gB = new THREE.Mesh(new THREE.CylinderGeometry(4.5,5,22,12), cMat);
  gB.position.set(-220, 11, 0); scene.add(gB);
  const gT = new THREE.Mesh(new THREE.ConeGeometry(5,9,12), rMat);
  gT.position.set(-220, 27, 0); scene.add(gT);

  // Kız Kulesi
  const kB = new THREE.Mesh(new THREE.CylinderGeometry(3.5,4,16,10), cMat);
  kB.position.set(220, 8, -220); scene.add(kB);
  const kT = new THREE.Mesh(new THREE.ConeGeometry(4,7,10), rMat);
  kT.position.set(220, 20, -220); scene.add(kT);
}

function buildTrees() {
  const tMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const lMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
  for (let i = 0; i < 50; i++) {
    const x = (Math.random()-0.5)*450, z = (Math.random()-0.5)*450;
    if (Math.abs(x) < 14 || Math.abs(z) < 14) continue;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,2.5,6), tMat);
    t.position.set(x, 1.25, z); scene.add(t);
    const l = new THREE.Mesh(new THREE.SphereGeometry(1.8,6,6), lMat);
    l.position.set(x, 4.2, z); scene.add(l);
  }
}

function buildLights() {
  const pMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
  const lMat = new THREE.MeshPhongMaterial({ color: 0xffffaa, emissive: 0xffff44, emissiveIntensity: 1 });
  for (let i = -250; i < 250; i += 40) {
    [11,-11].forEach(off => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.14,7,6), pMat);
      p.position.set(i, 3.5, off); scene.add(p);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.3,6,6), lMat);
      l.position.set(i, 7.3, off); scene.add(l);
    });
  }
}

function buildSky() {
  const sun = new THREE.Mesh(new THREE.SphereGeometry(10,12,12),
    new THREE.MeshBasicMaterial({ color: 0xfffacd }));
  sun.position.set(100, 180, -300); scene.add(sun);
  const cMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(4+Math.random()*2,6,6), cMat);
      p.position.set(j*6-9, Math.random()*2, 0); cloud.add(p);
    }
    cloud.position.set((Math.random()-0.5)*500, 80+Math.random()*40, (Math.random()-0.5)*500);
    scene.add(cloud);
  }
}

// ── NPC SİSTEMİ ──────────────────────────────────
// NPC spawn noktaları - SADECE yol üzerinde, binalardan uzak
const ROAD_SPAWN_POINTS = [
  {name:'Taksim',        x:0,   z:0},
  {name:'Galata',        x:-220,z:0},
  {name:'Ayasofya',      x:0,   z:-220},
  {name:'Sultanahmet',   x:60,  z:-220},
  {name:'Kadıköy',       x:150, z:150},
  {name:'Beşiktaş',      x:-150,z:-150},
  {name:'Üsküdar',       x:150, z:-150},
  {name:'Fatih',         x:-150,z:150},
  {name:'Şişli',         x:0,   z:-80},
  {name:'Beyoğlu',       x:-80, z:0},
  {name:'Boğaz Köprüsü', x:0,   z:200},
  {name:'Kavşak D',      x:80,  z:0},
  {name:'Kavşak K',      x:0,   z:80},
  {name:'Kavşak G',      x:-80, z:-80},
  {name:'Kavşak H',      x:80,  z:-80},
  {name:'Kavşak I',      x:-80, z:80},
  {name:'Kavşak J',      x:200, z:0},
  {name:'Kavşak L',      x:-200,z:0},
  {name:'Kavşak M',      x:0,   z:-200},
  {name:'Kavşak N',      x:0,   z:200},
];

const LOCS = ROAD_SPAWN_POINTS.filter(p => !p.name.startsWith('Kavşak'));

function spawnNPCs() {
  // 20 NPC - tam yol üzerinde doğar, offset yok
  for (let i = 0; i < 20; i++) {
    const loc = ROAD_SPAWN_POINTS[i % ROAD_SPAWN_POINTS.length];
    spawnOneNPC(loc.x, loc.z);
  }
}

function spawnOneNPC(x, z) {
  const g = new THREE.Group();
  const cols = [0xe74c3c,0x3498db,0x2ecc71,0x9b59b6,0xe67e22,0x1abc9c];
  const bMat = new THREE.MeshPhongMaterial({ color: cols[Math.floor(Math.random()*cols.length)] });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.35,1.2,8), bMat);
  body.position.y = 0.9; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28,8,8),
    new THREE.MeshPhongMaterial({ color: 0xf5cba7 }));
  head.position.y = 1.8; g.add(head);
  // Kollar
  [-0.45, 0.45].forEach(ox => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.8,6), bMat);
    arm.position.set(ox, 1.1, 0); arm.rotation.z = ox > 0 ? 0.4 : -0.4; g.add(arm);
  });
  // Bacaklar
  [-0.18, 0.18].forEach(ox => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.9,6),
      new THREE.MeshPhongMaterial({ color: 0x2c3e50 }));
    leg.position.set(ox, 0.35, 0); g.add(leg);
  });
  const excMat = new THREE.MeshPhongMaterial({ color: 0xf1c40f, emissive: 0xf1c40f, emissiveIntensity: 0.9 });
  const excl = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.5,6), excMat);
  excl.position.y = 2.6; g.add(excl);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1,6,6), excMat);
  dot.position.y = 2.2; g.add(dot);
  g.position.set(x, 0, z);
  g.userData = { waiting: true, inCar: false, excl };
  scene.add(g); npcs.push(g);
}

let npcT = 0;
function animNPCs(dt) {
  npcT += dt * 0.003;
  npcs.forEach(n => {
    if (n.userData.waiting && !n.userData.inCar) {
      n.position.y = Math.abs(Math.sin(npcT*2+n.position.x)) * 0.15;
      if (n.userData.excl) n.userData.excl.material.emissiveIntensity = 0.5 + Math.sin(npcT*4)*0.5;
    }
  });
  if (destMarker) destMarker.rotation.y += dt * 0.0015;
  updateArrow();
}

function checkNearNPC() {
  if (!playerCar || activePassenger) {
    nearNPC = null;
    document.getElementById('npc-prompt').classList.add('hidden');
    return;
  }
  const px = playerCar.position.x, pz = playerCar.position.z;
  nearNPC = null;
  for (const n of npcs) {
    if (!n.userData.waiting || n.userData.inCar) continue;
    const dx = n.position.x-px, dz = n.position.z-pz;
    if (Math.sqrt(dx*dx+dz*dz) < 6) { nearNPC = n; break; }
  }
  document.getElementById('npc-prompt').classList.toggle('hidden', !nearNPC);
}

function pickupPassenger() {
  if (!nearNPC || activePassenger) return;
  const npc = nearNPC;
  npc.userData.inCar = true; npc.userData.waiting = false; npc.visible = false;
  const dests = LOCS.filter(l => {
    const dx = l.x-npc.position.x, dz = l.z-npc.position.z;
    return Math.sqrt(dx*dx+dz*dz) > 50;
  });
  const dest = dests[Math.floor(Math.random()*dests.length)];
  const dist = Math.sqrt((dest.x-npc.position.x)**2+(dest.z-npc.position.z)**2);
  const reward = Math.floor(300 + dist*2.5);
  activePassenger = { npc, destination: dest, reward };

  // Hedef marker
  if (destMarker) scene.remove(destMarker);
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: 0xe74c3c, emissive: 0xe74c3c, emissiveIntensity: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,6,8), mat);
  pole.position.y = 3; g.add(pole);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2,2.5,8), mat);
  cone.position.y = 7.5; g.add(cone);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.5,3.2,32),
    new THREE.MeshBasicMaterial({ color: 0xe74c3c, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.1; g.add(ring);
  g.position.set(dest.x, 0, dest.z);
  scene.add(g); destMarker = g;

  document.getElementById('taxi-hud').classList.remove('hidden');
  document.getElementById('taxi-status').textContent = '🧍 YOLCU ALINDI';
  document.getElementById('taxi-dest').textContent = '📍 ' + dest.name;
  document.getElementById('taxi-reward').textContent = '💰 Ödül: ' + reward.toLocaleString('tr-TR') + ' ₺';
  document.getElementById('npc-prompt').classList.add('hidden');
  showPopup('🧍 Yolcu bindi!', '#f1c40f');
}

function checkDropoff() {
  if (!activePassenger || !playerCar) return;
  const dest = activePassenger.destination;
  const dx = playerCar.position.x-dest.x, dz = playerCar.position.z-dest.z;
  if (Math.sqrt(dx*dx+dz*dz) < 10) {
    money += activePassenger.reward;
    save(); updateMoneyHUD();
    showPopup('+'+activePassenger.reward.toLocaleString('tr-TR')+' ₺\n✅ '+dest.name, '#2ecc71');
    setTimeout(() => {
      activePassenger.npc.userData.inCar = false;
      activePassenger.npc.userData.waiting = true;
      activePassenger.npc.visible = true;
      const nl = ROAD_SPAWN_POINTS[Math.floor(Math.random()*ROAD_SPAWN_POINTS.length)];
      activePassenger.npc.position.set(nl.x, 0, nl.z);
    }, 3000);
    activePassenger = null;
    if (destMarker) { scene.remove(destMarker); destMarker = null; }
    document.getElementById('taxi-hud').classList.add('hidden');
    document.getElementById('direction-arrow').classList.add('hidden');
  }
}

function updateArrow() {
  const el = document.getElementById('direction-arrow');
  if (!activePassenger || !playerCar) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const dest = activePassenger.destination;
  const dx = dest.x - playerCar.position.x;
  const dz = dest.z - playerCar.position.z;
  const dist = Math.round(Math.sqrt(dx*dx+dz*dz));
  const a = Math.atan2(dx, dz) - angle;
  document.getElementById('arrow-icon').style.transform = `rotate(${-a}rad)`;
  document.getElementById('arrow-dist').textContent = dist + 'm';
}

// ── MOBİL KONTROLLER ─────────────────────────────
function setupMobile() {
  function hold(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); mKeys[key] = true; el.classList.add('pressed'); }, {passive:false});
    el.addEventListener('touchend', () => { mKeys[key] = false; el.classList.remove('pressed'); });
    el.addEventListener('touchcancel', () => { mKeys[key] = false; el.classList.remove('pressed'); });
    el.addEventListener('mousedown', () => { mKeys[key] = true; el.classList.add('pressed'); });
    el.addEventListener('mouseup', () => { mKeys[key] = false; el.classList.remove('pressed'); });
    el.addEventListener('mouseleave', () => { mKeys[key] = false; el.classList.remove('pressed'); });
  }
  hold('steering-left', 'left');
  hold('steering-right', 'right');
  hold('btn-gas', 'gas');
  hold('btn-brake', 'brake');
  const pickup = document.getElementById('btn-pickup');
  if (pickup) {
    pickup.addEventListener('touchstart', e => { e.preventDefault(); if (nearNPC) pickupPassenger(); }, {passive:false});
    pickup.addEventListener('click', () => { if (nearNPC) pickupPassenger(); });
  }
}

// ── FİZİK ────────────────────────────────────────
function updatePhysics(dt) {
  if (!playerCar || !carData) return;
  const { acc, maxSpeed, hdl, brk } = carData;

  const fwd = keys['KeyW'] || keys['ArrowUp']    || mKeys.gas;
  const bwd = keys['KeyS'] || keys['ArrowDown']  || mKeys.brake;
  const lft = keys['KeyA'] || keys['ArrowLeft']  || mKeys.left;
  const rgt = keys['KeyD'] || keys['ArrowRight'] || mKeys.right;
  const eb  = keys['Space'];

  if (fwd)      speed = Math.min(speed + acc, maxSpeed);
  else if (bwd) speed = Math.max(speed - acc*0.7, -maxSpeed*0.45);
  else if (eb)  speed *= (1 - brk*2.5);
  else          speed *= 0.975;

  if (Math.abs(speed) > 0.004) {
    const dir = speed > 0 ? 1 : -1;
    if (lft) angle += hdl * dir;
    if (rgt) angle -= hdl * dir;
  }

  playerCar.rotation.y = angle;
  playerCar.position.x += Math.sin(angle) * speed;
  playerCar.position.z += Math.cos(angle) * speed;
  playerCar.position.x = Math.max(-280, Math.min(280, playerCar.position.x));
  playerCar.position.z = Math.max(-280, Math.min(280, playerCar.position.z));

  wRot += speed * 3.5;
  if (playerCar.userData && playerCar.userData.wheels) {
    playerCar.userData.wheels.forEach(w => { w.rotation.x = wRot; });
  }

  const kmh = Math.abs(Math.round(speed * 400));
  const maxKmh = Math.round(carData.maxSpeed * 400);
  document.getElementById('speed-value').textContent = kmh;
  drawSpeedo(kmh, maxKmh);

  checkNearNPC();
  checkDropoff();
}

// ── SPEEDO ───────────────────────────────────────
const sCanvas = document.getElementById('speedo-canvas');
const sCtx = sCanvas.getContext('2d');

function drawSpeedo(kmh, maxKmh) {
  const W=140, H=140, cx=70, cy=70, R=60;
  sCtx.clearRect(0,0,W,H);
  sCtx.beginPath(); sCtx.arc(cx,cy,R,0,Math.PI*2);
  sCtx.fillStyle='rgba(0,0,0,0.85)'; sCtx.fill();
  sCtx.strokeStyle='rgba(255,255,255,0.15)'; sCtx.lineWidth=2; sCtx.stroke();

  const s=(225*Math.PI)/180, sw=(270*Math.PI)/180;
  sCtx.beginPath(); sCtx.arc(cx,cy,R-8,s,s+sw);
  sCtx.strokeStyle='#222'; sCtx.lineWidth=10; sCtx.stroke();

  const ratio = Math.min(kmh/Math.max(maxKmh,1), 1);
  const grad = sCtx.createLinearGradient(0,H,W,0);
  grad.addColorStop(0,'#00e676'); grad.addColorStop(0.5,'#ffeb3b'); grad.addColorStop(1,'#f44336');
  sCtx.beginPath(); sCtx.arc(cx,cy,R-8,s,s+sw*ratio);
  sCtx.strokeStyle=grad; sCtx.lineWidth=10; sCtx.stroke();

  sCtx.textAlign='center'; sCtx.textBaseline='middle';
  for (let i=0; i<=10; i++) {
    const a = s+sw*(i/10);
    const cos=Math.cos(a), sin=Math.sin(a);
    sCtx.beginPath();
    sCtx.moveTo(cx+cos*(R-14), cy+sin*(R-14));
    sCtx.lineTo(cx+cos*(R-(i%2===0?22:18)), cy+sin*(R-(i%2===0?22:18)));
    sCtx.strokeStyle=i%2===0?'#aaa':'#555'; sCtx.lineWidth=i%2===0?2:1; sCtx.stroke();
    if (i%2===0) {
      sCtx.font='bold 7px Arial'; sCtx.fillStyle='#ccc';
      sCtx.fillText(Math.round(maxKmh*i/10), cx+cos*(R-30), cy+sin*(R-30));
    }
  }
  const na = s+sw*ratio;
  sCtx.beginPath();
  sCtx.moveTo(cx-Math.cos(na)*10, cy-Math.sin(na)*10);
  sCtx.lineTo(cx+Math.cos(na)*(R-18), cy+Math.sin(na)*(R-18));
  sCtx.strokeStyle='#ff1744'; sCtx.lineWidth=2.5; sCtx.lineCap='round'; sCtx.stroke();
  sCtx.beginPath(); sCtx.arc(cx,cy,5,0,Math.PI*2);
  sCtx.fillStyle='#ff1744'; sCtx.fill();
  sCtx.beginPath(); sCtx.arc(cx,cy,2.5,0,Math.PI*2);
  sCtx.fillStyle='#fff'; sCtx.fill();
}

// ── KAMERA ───────────────────────────────────────
const camT = new THREE.Vector3();
function updateCamera() {
  if (!playerCar) return;
  camT.set(
    playerCar.position.x - Math.sin(angle)*13,
    6,
    playerCar.position.z - Math.cos(angle)*13
  );
  camera.position.lerp(camT, 0.09);
  camera.lookAt(playerCar.position.x, 1.2, playerCar.position.z);
}

// ── HUD ──────────────────────────────────────────
function updateMoneyHUD() {
  document.getElementById('money-val').textContent = money.toLocaleString('tr-TR');
  document.getElementById('garage-money').textContent = '💰 ' + money.toLocaleString('tr-TR') + ' ₺';
}

let popT = null;
function showPopup(text, color='#2ecc71') {
  const el = document.getElementById('earn-popup');
  el.textContent = text; el.style.color = color;
  el.style.textShadow = `0 0 20px ${color}`;
  el.classList.add('show');
  if (popT) clearTimeout(popT);
  popT = setTimeout(() => el.classList.remove('show'), 2200);
}

function updateHUDPlayers(players) {
  const content = document.getElementById('players-content');
  const all = players ? Object.values(players) : [];
  content.innerHTML = all.map(p =>
    `<div class="player-entry">
      <div class="player-dot" style="background:${p.color||'#fff'}"></div>
      <span>${p.name||'Sürücü'}</span>
    </div>`
  ).join('') || '<div style="color:#666;font-size:0.75rem">Kimse yok</div>';
}

// ── GARAJ ────────────────────────────────────────
function openGarage() { document.getElementById('garage').classList.remove('hidden'); renderGarage(); }
function closeGarage() { document.getElementById('garage').classList.add('hidden'); }

function renderGarage() {
  updateMoneyHUD();
  const grid = document.getElementById('car-grid');
  grid.innerHTML = '';
  CARS.forEach(car => {
    const card = document.createElement('div');
    card.className = 'car-card' + (car.id===selCar?' selected':'') + (car.owned?'':' locked');
    card.innerHTML = `
      <div class="car-preview">${car.emoji}</div>
      <h3>${car.name}</h3>
      <div class="car-stats">
        <div>Hız <div class="stat-bar"><div class="stat-fill" style="width:${car.stats[0]}%"></div></div></div>
        <div>İvme <div class="stat-bar"><div class="stat-fill" style="width:${car.stats[1]}%"></div></div></div>
        <div>Kontrol <div class="stat-bar"><div class="stat-fill" style="width:${car.stats[2]}%"></div></div></div>
      </div>
      ${car.owned ? `<div class="owned-badge">SAHİP</div>` : `<div class="car-price">💰 ${car.price.toLocaleString('tr-TR')} ₺</div>`}
    `;
    card.addEventListener('click', () => {
      if (car.owned) { selCar = car.id; save(); renderGarage(); }
      else if (money >= car.price) {
        if (confirm(`${car.name} satın al? (${car.price.toLocaleString('tr-TR')} ₺)`)) {
          money -= car.price; car.owned = true; selCar = car.id;
          save(); updateMoneyHUD(); renderGarage();
        }
      } else alert(`Yeterli para yok! Gerekli: ${car.price.toLocaleString('tr-TR')} ₺`);
    });
    grid.appendChild(card);
  });
}

// ── MULTIPLAYER ──────────────────────────────────
let lastSend = 0;
function sendPos(now) {
  if (!playerCar || !socket || now-lastSend < 50) return;
  lastSend = now;
  socket.emit('update', {
    x: playerCar.position.x, y: playerCar.position.y, z: playerCar.position.z,
    ry: angle, speed
  });
}
