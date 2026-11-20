/* =====================================================================
   ROASLift Clothes — single-page 3D store
   Structure:
   1. Data (products, sizes)
   2. Helpers + state (cart, wishlist) + toast
   3. Loader (counter, skip, reveal)
   4. Three.js scenes (loader logo, hero carousel, product viewer)
   5. Shop grid, size finder, cart drawer, checkout, nav, reveals
   Every Three.js / GSAP feature is guarded: if a CDN fails, the page
   still works with plain <img> fallbacks and normal scrolling.
   ===================================================================== */

/* ---------------- 1. Data ---------------- */
var PRODUCTS = [
  { id: 'ash-wool', name: 'Ash Wool Bomber', price: 8499,
    img: 'images/jacket-gray-wool-bomber-web.jpg',
    tag: 'Wool-blend · Zip-up', badge: '',
    desc: 'A warm wool-blend bomber with a clean zip front and roomy flap pockets.' },
  { id: 'cognac-suede', name: 'Cognac Suede Bomber', price: 9499,
    img: 'images/jacket-brown-suede-bomber-web.jpg',
    tag: 'Soft suede · Bomber', badge: 'Hero',
    desc: 'Soft suede bomber with a clean collar and a warm, broken-in feel.' },
  { id: 'onyx', name: 'Onyx Bomber', price: 6999,
    img: 'images/jacket-black-bomber-web.jpg',
    tag: 'Matte black · Bomber', badge: '',
    desc: 'A matte black bomber that goes with everything. Clean, sharp, everyday.' },
  { id: 'stone-work', name: 'Stone Work Jacket', price: 7499,
    img: 'images/jacket-grey-work-web.jpg',
    tag: 'Workwear · Corduroy collar', badge: '',
    desc: 'A sturdy stone-grey work jacket with a soft corduroy collar.' },
  { id: 'espresso-trucker', name: 'Espresso Trucker', price: 8999,
    img: 'images/jacket-dark-brown-trucker-web.jpg',
    tag: 'Trucker · Snap buttons', badge: '',
    desc: 'A deep espresso trucker with snap buttons and classic chest pockets.' }
];
var HERO_INDEX = 1; /* Cognac Suede Bomber is the hero product */
var SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
/* Dummy jacket measurements (chest / length in cm, fits-height range). */
var SIZE_TABLE = [
  { size: 'S',   chest: 112, length: 66, minH: 160, maxH: 168 },
  { size: 'M',   chest: 118, length: 68, minH: 168, maxH: 175 },
  { size: 'L',   chest: 124, length: 70, minH: 175, maxH: 182 },
  { size: 'XL',  chest: 130, length: 72, minH: 182, maxH: 189 },
  { size: 'XXL', chest: 136, length: 74, minH: 189, maxH: 198 }
];
var FREE_DELIVERY_AT = 10000;
var DELIVERY_FEE = 250;
var NAVY = 0x0a1e3c;
var ACCENT = 0x2e5aac;

/* ---------------- 2. Helpers + state ---------------- */
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
function formatPrice(n) { return 'PKR ' + n.toLocaleString('en-US'); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function loadJSON(key, fallback) {
  try {
    var raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function saveJSON(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
}

var cart = loadJSON('roaslift-cart-v1', []);       /* [{id, size, qty}] */
var wishlist = loadJSON('roaslift-wishlist-v1', []); /* [productId] */
var viewerIndex = HERO_INDEX;
var viewerSize = 'M';
var viewerQty = 1;
var heroIndex = HERO_INDEX;

var toastTimer = null;
function toast(msg) {
  var el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

/* ---------------- Cart logic ---------------- */
function cartCount() {
  return cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
}
function cartSubtotal() {
  return cart.reduce(function (sum, item) {
    var p = PRODUCTS.find(function (x) { return x.id === item.id; });
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}
function addToCart(id, size, qty) {
  var found = cart.find(function (item) { return item.id === id && item.size === size; });
  if (found) { found.qty = Math.min(found.qty + qty, 10); }
  else { cart.push({ id: id, size: size, qty: qty }); }
  saveJSON('roaslift-cart-v1', cart);
  renderCart();
}
function setQty(id, size, qty) {
  var found = cart.find(function (item) { return item.id === id && item.size === size; });
  if (!found) return;
  if (qty <= 0) { cart = cart.filter(function (item) { return item !== found; }); }
  else { found.qty = Math.min(qty, 10); }
  saveJSON('roaslift-cart-v1', cart);
  renderCart();
}
function removeFromCart(id, size) {
  cart = cart.filter(function (item) { return !(item.id === id && item.size === size); });
  saveJSON('roaslift-cart-v1', cart);
  renderCart();
}

function renderCart() {
  var countEl = $('#cartCount');
  var count = cartCount();
  countEl.textContent = count;
  countEl.hidden = count === 0;

  var list = $('#cartItems');
  list.innerHTML = '';
  cart.forEach(function (item) {
    var p = PRODUCTS.find(function (x) { return x.id === item.id; });
    if (!p) return;
    var row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML =
      '<img src="' + p.img + '" alt="' + p.name + '" loading="lazy">' +
      '<div class="cart-item-info"><h4>' + p.name + '</h4>' +
      '<p>Size ' + item.size + '</p>' +
      '<p class="cart-item-price">' + formatPrice(p.price * item.qty) + '</p></div>' +
      '<div class="cart-item-ctrl">' +
      '<span class="mini-qty"><button type="button" data-act="minus" aria-label="Decrease quantity">&minus;</button>' +
      '<span>' + item.qty + '</span>' +
      '<button type="button" data-act="plus" aria-label="Increase quantity">+</button></span>' +
      '<button type="button" class="remove-btn" data-act="remove">Remove</button></div>';
    row.querySelector('[data-act="minus"]').addEventListener('click', function () { setQty(item.id, item.size, item.qty - 1); });
    row.querySelector('[data-act="plus"]').addEventListener('click', function () { setQty(item.id, item.size, item.qty + 1); });
    row.querySelector('[data-act="remove"]').addEventListener('click', function () { removeFromCart(item.id, item.size); });
    list.appendChild(row);
  });

  $('#cartEmpty').style.display = cart.length === 0 ? 'block' : 'none';
  var subtotal = cartSubtotal();
  $('#cartSubtotal').textContent = formatPrice(subtotal);
  var delivery = cart.length === 0 ? '—' : (subtotal >= FREE_DELIVERY_AT ? 'FREE' : formatPrice(DELIVERY_FEE));
  $('#cartDelivery').textContent = delivery;
  $('#checkoutBtn').disabled = cart.length === 0;

  var pct = clamp(subtotal / FREE_DELIVERY_AT * 100, 0, 100);
  $('#freeDelBar').style.width = pct + '%';
  $('#freeDelMsg').textContent = subtotal >= FREE_DELIVERY_AT
    ? 'You have FREE delivery!'
    : 'Add ' + formatPrice(FREE_DELIVERY_AT - subtotal) + ' more for FREE delivery';
}

/* ---------------- 3. Loader ---------------- */
var loaderDone = false;
var revealCallbacks = [];
function onReveal(fn) { revealCallbacks.push(fn); }

function revealSite() {
  if (loaderDone) return;
  loaderDone = true;
  var loader = $('#loader');
  loader.classList.add('done');
  setTimeout(function () { loader.style.display = 'none'; }, 700);
  revealCallbacks.forEach(function (fn) { try { fn(); } catch (e) { /* keep going */ } });
}

function initLoader() {
  var pctEl = $('#loaderPct');
  var barEl = $('#loaderBarFill');
  var start = performance.now();
  var DURATION = 1900; /* fast on purpose — DUDEFOX took ~5s */
  function tick(now) {
    var p = clamp((now - start) / DURATION, 0, 1);
    var eased = 1 - Math.pow(1 - p, 2);
    var val = Math.round(eased * 100);
    pctEl.textContent = String(val).padStart(3, '0');
    barEl.style.width = (eased * 100) + '%';
    if (p < 1 && !loaderDone) { requestAnimationFrame(tick); }
    else { revealSite(); }
  }
  requestAnimationFrame(tick);
  $('#loaderSkip').addEventListener('click', revealSite);
  /* Hard safety: never trap the visitor behind the loader. */
  setTimeout(revealSite, 3500);
}

/* ---------------- 4. Three.js scenes ---------------- */
/* All 3D is progressive enhancement: if WebGL or the CDN is unavailable,
   the <img> fallbacks stay visible and the page still works. */
var THREE = null;
var textures = {};       /* product id -> THREE.Texture */
var threeReady = false;
var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function webglAvailable() {
  try {
    var c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

function makeRenderer(canvas) {
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

function sizeRendererToCanvas(renderer, camera) {
  var canvas = renderer.domElement;
  var w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe9ff, 1.0));
  var key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6; key.shadow.camera.right = 6;
  key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0004;
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xdce8ff, 0.4);
  fill.position.set(-4, 2, 3);
  scene.add(fill);
}

function addGroundShadow(scene, y) {
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 10),
    new THREE.ShadowMaterial({ opacity: 0.16 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = y;
  ground.receiveShadow = true;
  scene.add(ground);
}

/* Branded back for the viewer card: navy gradient + ROASLIFT text. */
function makeBackTexture() {
  var c = document.createElement('canvas');
  c.width = 512; c.height = 768;
  var g = c.getContext('2d');
  var grad = g.createLinearGradient(0, 0, 0, 768);
  grad.addColorStop(0, '#12305e');
  grad.addColorStop(1, '#0a1e3c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 768);
  g.strokeStyle = '#2e5aac';
  g.lineWidth = 14;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(90, 330); g.lineTo(210, 250); g.lineTo(250, 272); g.lineTo(290, 240); g.lineTo(400, 160);
  g.stroke();
  g.beginPath();
  g.moveTo(350, 150); g.lineTo(410, 150); g.lineTo(410, 210);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = '800 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('ROASLIFT', 256, 430);
  g.font = '600 24px Arial, sans-serif';
  g.fillStyle = '#bcd2f5';
  g.fillText('WEAR THE RISE', 256, 472);
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---- 4a. Loader logo: extruded 3D arrow + wordmark ---- */
/* Builds a thick zigzag band from centreline points (miter joins). */
function thickPolylineShape(points, thickness) {
  var half = thickness / 2;
  function normal(p, q) {
    var dx = q[0] - p[0], dy = q[1] - p[1];
    var len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  }
  var left = [], right = [];
  for (var i = 0; i < points.length; i++) {
    var n;
    if (i === 0) { n = normal(points[0], points[1]); }
    else if (i === points.length - 1) { n = normal(points[i - 1], points[i]); }
    else {
      var n1 = normal(points[i - 1], points[i]);
      var n2 = normal(points[i], points[i + 1]);
      n = [n1[0] + n2[0], n1[1] + n2[1]];
      var l = Math.hypot(n[0], n[1]) || 1;
      n = [n[0] / l, n[1] / l];
    }
    left.push([points[i][0] + n[0] * half, points[i][1] + n[1] * half]);
    right.push([points[i][0] - n[0] * half, points[i][1] - n[1] * half]);
  }
  var shape = new THREE.Shape();
  shape.moveTo(left[0][0], left[0][1]);
  for (var j = 1; j < left.length; j++) { shape.lineTo(left[j][0], left[j][1]); }
  for (var k = right.length - 1; k >= 0; k--) { shape.lineTo(right[k][0], right[k][1]); }
  shape.closePath();
  return shape;
}

function buildArrowGeometry() {
  var shaft = thickPolylineShape(
    [[0, 0.15], [2.3, 1.3], [2.95, 0.85], [3.6, 1.45], [4.5, 2.2]], 0.34);
  var head = new THREE.Shape();
  head.moveTo(4.34, 2.62);
  head.lineTo(5.19, 2.78);
  head.lineTo(4.88, 1.98);
  head.closePath();
  return new THREE.ExtrudeGeometry([shaft, head], {
    depth: 0.35, bevelEnabled: true,
    bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2
  });
}

var loaderAnimId = null;
function initLoaderScene() {
  var canvas = $('#loaderCanvas');
  var renderer;
  try { renderer = makeRenderer(canvas); }
  catch (e) { return; } /* keep the PNG logo visible */
  canvas.classList.add('ready');
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0.4, 8.4);
  camera.lookAt(0, 0.4, 0);
  addLights(scene);

  var group = new THREE.Group();
  var arrow = new THREE.Mesh(
    buildArrowGeometry(),
    new THREE.MeshStandardMaterial({ color: ACCENT, metalness: 0.35, roughness: 0.35 })
  );
  arrow.geometry.center();
  arrow.castShadow = true;
  arrow.position.y = 1.15;
  group.add(arrow);

  /* Wordmark: logo PNG plane first; swapped for real 3D text if the font loads. */
  var logoTex = new THREE.TextureLoader().load('images/logo-light-web.png');
  logoTex.colorSpace = THREE.SRGBColorSpace;
  var wordmark = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 3.09),
    new THREE.MeshBasicMaterial({ map: logoTex, transparent: true })
  );
  wordmark.position.y = -1.55;
  group.add(wordmark);
  scene.add(group);

  /* Try to upgrade the wordmark to extruded 3D text (non-blocking). */
  (function load3DText() {
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; }, 4000);
    Promise.all([
      import('three/addons/loaders/FontLoader.js'),
      import('three/addons/geometries/TextGeometry.js')
    ]).then(function (mods) {
      if (timedOut) return;
      var loader = new mods[0].FontLoader();
      return loader.loadAsync('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json')
        .then(function (font) {
          if (timedOut || loaderDone) return;
          clearTimeout(timer);
          var geo = new mods[1].TextGeometry('ROASLIFT', {
            font: font, size: 0.82, height: 0.18,
            curveSegments: 6, bevelEnabled: true,
            bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2
          });
          geo.center();
          var text = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
            color: NAVY, metalness: 0.2, roughness: 0.4
          }));
          text.position.y = -1.55;
          group.remove(wordmark);
          group.add(text);
        });
    }).catch(function () { /* keep the PNG wordmark */ });
  })();

  var clock = new THREE.Clock();
  (function animate() {
    if (loaderDone) { cancelAnimationFrame(loaderAnimId); return; }
    loaderAnimId = requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    sizeRendererToCanvas(renderer, camera);
    group.rotation.y = reducedMotion ? 0 : Math.sin(t * 0.6) * 0.28;
    group.position.y = reducedMotion ? 0 : Math.sin(t * 1.1) * 0.08;
    renderer.render(scene, camera);
  })();
}

/* ---- 4b. Hero carousel: 5 jackets on a 3D arc, scroll-driven ---- */
var hero = { current: HERO_INDEX, target: HERO_INDEX, meshes: [], st: null, mouseX: 0, mouseY: 0, lastInteract: 0 };

function heroPlaneMaterial(tex) {
  return new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.85, metalness: 0.0,
    transparent: true, side: THREE.DoubleSide
  });
}

function initHeroScene() {
  var canvas = $('#heroCanvas');
  var renderer;
  try { renderer = makeRenderer(canvas); }
  catch (e) { showHeroFallback(); return; }

  /* Layout tiers: the carousel must never sit behind the headline copy.
     Wide screens: carousel right of the copy. Medium: pulled in so the
     active plane still fits. Narrow: smaller planes dropped below the copy. */
  var vw = window.innerWidth;
  var tier = vw < 720 ? 'narrow' : (vw < 1100 ? 'medium' : 'wide');
  var layout = {
    narrow: { planeW: 1.7, spacing: 2.1, shiftX: 0, shiftY: -1.5, camZ: 10.5, shadowY: -3.1 },
    medium: { planeW: 2.0, spacing: 2.6, shiftX: 1.4, shiftY: 0, camZ: 9.0, shadowY: -2.35 },
    wide: { planeW: 2.3, spacing: 2.9, shiftX: 2.4, shiftY: 0, camZ: 8.4, shadowY: -2.35 }
  }[tier];

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  camera.position.set(0, 0.2, layout.camZ);
  addLights(scene);
  addGroundShadow(scene, layout.shadowY);

  /* Floating blue particles. */
  var pCount = 140, pPos = new Float32Array(pCount * 3);
  for (var i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 12;
    pPos[i * 3 + 1] = -2.5 + Math.random() * 5.5;
    pPos[i * 3 + 2] = -3 + Math.random() * 4;
  }
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: ACCENT, size: 0.05, transparent: true, opacity: 0.45
  }));
  scene.add(particles);

  var geo = new THREE.PlaneGeometry(layout.planeW, layout.planeW * 1.5);
  PRODUCTS.forEach(function (p) {
    var mat = heroPlaneMaterial(textures[p.id]);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    scene.add(mesh);
    hero.meshes.push(mesh);
  });

  window.addEventListener('pointermove', function (e) {
    hero.mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    hero.mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  var clock = new THREE.Clock();
  var lastRounded = HERO_INDEX;
  (function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    sizeRendererToCanvas(renderer, camera);
    hero.current = lerp(hero.current, hero.target, 0.08);
    if (Math.abs(hero.target - hero.current) < 0.001) { hero.current = hero.target; }
    hero.meshes.forEach(function (mesh, i) {
      var off = i - hero.current;
      mesh.position.x = off * layout.spacing + layout.shiftX;
      mesh.position.z = -Math.abs(off) * 1.5;
      mesh.position.y = (reducedMotion ? 0 : Math.sin(t * 0.8 + i * 1.3) * 0.09) + layout.shiftY;
      mesh.rotation.y = clamp(-off * 0.38, -1.1, 1.1);
      var s = 1 - Math.min(Math.abs(off) * 0.14, 0.4);
      mesh.scale.set(s, s, s);
      mesh.material.opacity = 1 - Math.min(Math.abs(off) * 0.4, 0.75);
      mesh.visible = Math.abs(off) < 3.2;
    });
    particles.rotation.y = t * 0.02;
    camera.position.x = lerp(camera.position.x, hero.mouseX * 0.5, 0.04);
    camera.position.y = lerp(camera.position.y, 0.2 - hero.mouseY * 0.25, 0.04);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    var rounded = Math.round(hero.current);
    if (rounded !== lastRounded) { lastRounded = rounded; setHeroIndex(rounded, false); }
  })();

  /* Idle auto-rotate only when scroll is NOT driving the carousel. */
  setInterval(function () {
    if (hero.st || reducedMotion) return;
    if (Date.now() - hero.lastInteract < 4000) return;
    goToHeroIndex((Math.round(hero.target) + 1) % PRODUCTS.length);
  }, 3600);
}

function showHeroFallback() {
  var fb = $('#heroFallback');
  var canvas = $('#heroCanvas');
  canvas.style.display = 'none';
  fb.hidden = false;
}
function setHeroFallbackImage(index) {
  var fb = $('#heroFallback');
  if (!fb.hidden) {
    fb.src = PRODUCTS[index].img;
    fb.alt = PRODUCTS[index].name;
  }
}

/* Update headline + dots for the active hero jacket. */
function setHeroIndex(index, updateTarget) {
  index = clamp(index, 0, PRODUCTS.length - 1);
  heroIndex = index;
  if (updateTarget !== false) { hero.target = index; }
  var p = PRODUCTS[index];
  var copy = $('.hero-copy');
  copy.classList.add('fading');
  setTimeout(function () {
    $('#heroTitle').textContent = index === HERO_INDEX ? 'Wear the Rise.' : p.name + '.';
    $('#heroTag').textContent = p.name + ' — ' + p.tag.toLowerCase() + '.';
    $('#heroPrice').textContent = formatPrice(p.price);
    copy.classList.remove('fading');
  }, 180);
  $all('.hero-dot').forEach(function (dot, i) {
    dot.classList.toggle('active', i === index);
    dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
  });
  setHeroFallbackImage(index);
}

function goToHeroIndex(index) {
  index = clamp(index, 0, PRODUCTS.length - 1);
  hero.lastInteract = Date.now();
  if (hero.st) {
    /* Scroll the pinned hero to the matching progress. */
    var st = hero.st;
    var y = st.start + (index / (PRODUCTS.length - 1)) * (st.end - st.start);
    window.scrollTo({ top: y, behavior: reducedMotion ? 'auto' : 'smooth' });
  } else {
    setHeroIndex(index);
  }
}

function initHeroScroll() {
  if (reducedMotion) return; /* keep the hero a simple carousel */
  if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') return;
  try {
    window.gsap.registerPlugin(window.ScrollTrigger);
    var distance = window.innerWidth < 720 ? 1600 : 2200;
    hero.st = window.ScrollTrigger.create({
      trigger: '#hero',
      start: 'top top',
      end: '+=' + distance,
      pin: true,
      scrub: 0.5,
      anticipatePin: 1,
      onUpdate: function (self) {
        hero.target = self.progress * (PRODUCTS.length - 1);
        hero.lastInteract = Date.now();
      }
    });
  } catch (e) { hero.st = null; }
}

/* ---- 4c. Product viewer: drag-to-spin 3D stage ---- */
var viewer = { rotY: 0, velY: 0, dragging: false, lastX: 0, lastInteract: 0,
               targetZ: 7.2, currentZ: 7.2, group: null, frontMat: null,
               fade: 1, fadeTarget: 1, pendingIndex: null, is3D: false };

function initViewerScene() {
  var canvas = $('#viewerCanvas');
  var renderer;
  try { renderer = makeRenderer(canvas); }
  catch (e) { showViewerFallback(); return; }
  viewer.is3D = true;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 0, viewer.currentZ);
  addLights(scene);
  addGroundShadow(scene, -2.45);

  var group = new THREE.Group();
  var geo = new THREE.PlaneGeometry(2.4, 3.6);
  viewer.frontMat = new THREE.MeshStandardMaterial({
    map: textures[PRODUCTS[viewerIndex].id], roughness: 0.85,
    transparent: true, side: THREE.FrontSide
  });
  var front = new THREE.Mesh(geo, viewer.frontMat);
  front.castShadow = true;
  var back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: makeBackTexture(), roughness: 0.85, transparent: true, side: THREE.FrontSide
  }));
  back.rotation.y = Math.PI;
  back.position.z = -0.02;
  back.castShadow = true;
  group.add(front);
  group.add(back);
  scene.add(group);
  viewer.group = group;

  var clock = new THREE.Clock();
  (function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    sizeRendererToCanvas(renderer, camera);
    if (!viewer.dragging) {
      viewer.rotY += viewer.velY;
      viewer.velY *= 0.95;
      if (Math.abs(viewer.velY) < 0.0005) { viewer.velY = 0; }
      if (!reducedMotion && Date.now() - viewer.lastInteract > 2500) {
        viewer.rotY += 0.0028; /* gentle idle auto-rotate */
      }
    }
    group.rotation.y = viewer.rotY;
    group.position.y = reducedMotion ? 0 : Math.sin(t * 0.9) * 0.06;
    /* Texture-swap crossfade. */
    if (viewer.fade !== viewer.fadeTarget) {
      viewer.fade = lerp(viewer.fade, viewer.fadeTarget, 0.2);
      if (Math.abs(viewer.fade - viewer.fadeTarget) < 0.02) { viewer.fade = viewer.fadeTarget; }
      viewer.frontMat.opacity = viewer.fade;
      if (viewer.fade === 0 && viewer.pendingIndex !== null) {
        viewer.frontMat.map = textures[PRODUCTS[viewer.pendingIndex].id];
        viewer.frontMat.needsUpdate = true;
        viewer.pendingIndex = null;
        viewer.fadeTarget = 1;
      }
    }
    viewer.currentZ = lerp(viewer.currentZ, viewer.targetZ, 0.1);
    camera.position.z = viewer.currentZ;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  })();
}

function showViewerFallback() {
  var fb = $('#viewerFallback');
  $('#viewerCanvas').style.display = 'none';
  fb.hidden = false;
}

function setViewerProduct(index) {
  index = clamp(index, 0, PRODUCTS.length - 1);
  viewerIndex = index;
  var p = PRODUCTS[index];
  $('#viewerEyebrow').textContent = 'Drop 01 · ' + p.tag.split('·')[0].trim();
  $('#viewerName').textContent = p.name;
  $('#viewerPrice').textContent = formatPrice(p.price);
  $('#viewerDesc').textContent = p.desc;
  updateWishlistBtn();
  if (viewer.is3D) {
    viewer.pendingIndex = index;
    viewer.fadeTarget = 0;
  } else {
    var fb = $('#viewerFallback');
    fb.src = p.img;
    fb.alt = p.name;
  }
}

function initViewerControls() {
  var stage = $('.viewer-stage');
  var fb = $('#viewerFallback');
  stage.addEventListener('pointerdown', function (e) {
    viewer.dragging = true;
    viewer.lastX = e.clientX;
    viewer.velY = 0;
    viewer.lastInteract = Date.now();
    stage.classList.add('dragging');
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', function (e) {
    if (!viewer.dragging) return;
    var dx = e.clientX - viewer.lastX;
    viewer.lastX = e.clientX;
    viewer.rotY += dx * 0.008;
    viewer.velY = dx * 0.008;
    viewer.lastInteract = Date.now();
    if (!viewer.is3D) {
      fb.style.transform = 'translate(-50%, -50%) perspective(800px) rotateY(' +
        (viewer.rotY * 57.3) + 'deg)';
    }
  });
  function endDrag() {
    viewer.dragging = false;
    stage.classList.remove('dragging');
    viewer.lastInteract = Date.now();
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  $('#zoomIn').addEventListener('click', function () {
    viewer.targetZ = clamp(viewer.targetZ - 0.8, 5.0, 8.5);
    viewer.lastInteract = Date.now();
    if (!viewer.is3D) { fb.style.width = 'min(420px, 86%)'; }
  });
  $('#zoomOut').addEventListener('click', function () {
    viewer.targetZ = clamp(viewer.targetZ + 0.8, 5.0, 8.5);
    viewer.lastInteract = Date.now();
    if (!viewer.is3D) { fb.style.width = 'min(300px, 64%)'; }
  });
  $('#zoomReset').addEventListener('click', function () {
    viewer.targetZ = 7.2;
    viewer.rotY = 0;
    viewer.velY = 0;
    if (!viewer.is3D) { fb.style.transform = 'translate(-50%, -50%)'; fb.style.width = ''; }
  });
}

/* ---- 4d. Boot Three.js (async, guarded) ---- */
function initThree() {
  if (!webglAvailable()) {
    showHeroFallback();
    showViewerFallback();
    return;
  }
  import('three').then(function (mod) {
    THREE = mod;
    var loader = new THREE.TextureLoader();
    var jobs = PRODUCTS.map(function (p) {
      return loader.loadAsync(p.img).then(function (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        textures[p.id] = tex;
      }).catch(function () {
        textures[p.id] = null; /* material renders untextured, still fine */
      });
    });
    return Promise.all(jobs);
  }).then(function () {
    if (!THREE) return;
    threeReady = true;
    try { initLoaderScene(); } catch (e) { /* PNG logo stays */ }
    try { initHeroScene(); } catch (e) { showHeroFallback(); }
    try { initViewerScene(); } catch (e) { showViewerFallback(); }
  }).catch(function () {
    showHeroFallback();
    showViewerFallback();
  });
}

/* ---------------- 5. Hero controls ---------------- */
function initHeroControls() {
  var dotsWrap = $('#heroDots');
  PRODUCTS.forEach(function (p, i) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'hero-dot' + (i === heroIndex ? ' active' : '');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', p.name);
    dot.setAttribute('aria-selected', i === heroIndex ? 'true' : 'false');
    dot.addEventListener('click', function () { goToHeroIndex(i); });
    dotsWrap.appendChild(dot);
  });
  $('#heroPrev').addEventListener('click', function () {
    goToHeroIndex(Math.round(hero.target) - 1);
  });
  $('#heroNext').addEventListener('click', function () {
    goToHeroIndex(Math.round(hero.target) + 1);
  });
  $('#heroAddBtn').addEventListener('click', function () {
    addToCart(PRODUCTS[heroIndex].id, 'M', 1);
    toast(PRODUCTS[heroIndex].name + ' (M) added to bag');
  });
  $('#heroViewBtn').addEventListener('click', function () {
    setViewerProduct(heroIndex);
  });
}

/* ---------------- 6. Shop grid + 3D tilt ---------------- */
function initGrid() {
  var grid = $('#productGrid');
  PRODUCTS.forEach(function (p, i) {
    var card = document.createElement('article');
    card.className = 'product-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'View ' + p.name + ' in 3D');
    card.innerHTML =
      '<div class="card-img">' +
      '<img src="' + p.img + '" alt="' + p.name + '" loading="lazy">' +
      (p.badge ? '<span class="card-badge">' + p.badge + '</span>' : '') +
      '<span class="card-turn">360&deg;</span></div>' +
      '<div class="card-body"><h3>' + p.name + '</h3>' +
      '<p class="card-tag">' + p.tag + '</p>' +
      '<div class="card-foot"><span class="card-price">' + formatPrice(p.price) + '</span>' +
      '<button class="card-add" type="button" aria-label="Add ' + p.name + ' to bag">Add +</button></div></div>';
    function openInViewer() {
      setViewerProduct(i);
      document.getElementById('viewer').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    card.addEventListener('click', openInViewer);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInViewer(); }
    });
    card.querySelector('.card-add').addEventListener('click', function (e) {
      e.stopPropagation();
      addToCart(p.id, 'M', 1);
      toast(p.name + ' (M) added to bag');
    });
    /* 3D tilt on hover (fine pointers only). */
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -10;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 12;
        card.style.transform = 'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-4px)';
      });
      card.addEventListener('pointerleave', function () { card.style.transform = ''; });
    }
    grid.appendChild(card);
  });
}

/* ---------------- 7. Viewer panel ---------------- */
function initViewerPanel() {
  var sizesWrap = $('#viewerSizes');
  SIZES.forEach(function (s) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'size-btn' + (s === viewerSize ? ' active' : '');
    btn.textContent = s;
    btn.setAttribute('aria-pressed', s === viewerSize ? 'true' : 'false');
    btn.addEventListener('click', function () {
      viewerSize = s;
      $all('.size-btn').forEach(function (b) {
        var on = b.textContent === s;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
    sizesWrap.appendChild(btn);
  });
  $('#qtyMinus').addEventListener('click', function () {
    viewerQty = Math.max(1, viewerQty - 1);
    $('#qtyVal').textContent = viewerQty;
  });
  $('#qtyPlus').addEventListener('click', function () {
    viewerQty = Math.min(10, viewerQty + 1);
    $('#qtyVal').textContent = viewerQty;
  });
  $('#viewerAddBtn').addEventListener('click', function () {
    addToCart(PRODUCTS[viewerIndex].id, viewerSize, viewerQty);
    toast(PRODUCTS[viewerIndex].name + ' (' + viewerSize + ') added to bag');
    openCart();
  });
  $('#wishlistBtn').addEventListener('click', function () {
    var id = PRODUCTS[viewerIndex].id;
    var i = wishlist.indexOf(id);
    if (i === -1) { wishlist.push(id); toast('Saved to wishlist'); }
    else { wishlist.splice(i, 1); toast('Removed from wishlist'); }
    saveJSON('roaslift-wishlist-v1', wishlist);
    updateWishlistBtn();
  });
  $('#findSizeBtn').addEventListener('click', function () {
    document.getElementById('size').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  });
}

function updateWishlistBtn() {
  var on = wishlist.indexOf(PRODUCTS[viewerIndex].id) !== -1;
  var btn = $('#wishlistBtn');
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  $('#wishlistLabel').textContent = on ? 'Saved to wishlist' : 'Add to wishlist';
}

/* ---------------- 8. Size finder ---------------- */
var unit = 'cm';
function cmToUnit(cm) {
  return unit === 'cm' ? Math.round(cm) + ' cm' : (cm / 2.54).toFixed(1) + '&Prime;';
}
function renderSizeTable(highlight) {
  var body = $('#sizeTableBody');
  body.innerHTML = '';
  SIZE_TABLE.forEach(function (row) {
    var tr = document.createElement('tr');
    if (highlight === row.size) { tr.className = 'highlight'; }
    tr.innerHTML = '<td><strong>' + row.size + '</strong></td>' +
      '<td>' + cmToUnit(row.chest) + '</td>' +
      '<td>' + cmToUnit(row.length) + '</td>' +
      '<td>' + row.minH + '&ndash;' + row.maxH + ' cm</td>';
    body.appendChild(tr);
  });
}
function suggestSize(height, weight, build, fit) {
  /* Base size from height, then adjust for weight/build/fit. */
  var idx = 1; /* default M */
  for (var i = 0; i < SIZE_TABLE.length; i++) {
    if (height <= SIZE_TABLE[i].maxH) { idx = i; break; }
    idx = i;
  }
  var bmi = weight / Math.pow(height / 100, 2);
  if (bmi >= 27) { idx += 1; }
  else if (bmi < 18.5) { idx -= 1; }
  if (build === 'broad') { idx += 1; }
  else if (build === 'slim') { idx -= 1; }
  if (fit === 'oversized') { idx += 1; }
  else if (fit === 'fitted') { idx -= 1; }
  return SIZES[clamp(idx, 0, SIZES.length - 1)];
}
function initSizeFinder() {
  renderSizeTable(null);
  $('#unitCm').addEventListener('click', function () {
    unit = 'cm';
    $('#unitCm').classList.add('active');
    $('#unitIn').classList.remove('active');
    renderSizeTable(window._foundSize || null);
  });
  $('#unitIn').addEventListener('click', function () {
    unit = 'inches';
    $('#unitIn').classList.add('active');
    $('#unitCm').classList.remove('active');
    renderSizeTable(window._foundSize || null);
  });
  var heightEl = $('#inputHeight'), weightEl = $('#inputWeight');
  var btn = $('#sizeFindBtn');
  function validate() {
    var h = parseFloat(heightEl.value), w = parseFloat(weightEl.value);
    btn.disabled = !(h >= 130 && h <= 220 && w >= 35 && w <= 160);
  }
  heightEl.addEventListener('input', validate);
  weightEl.addEventListener('input', validate);
  btn.addEventListener('click', function () {
    var h = parseFloat(heightEl.value), w = parseFloat(weightEl.value);
    var build = (document.querySelector('input[name="build"]:checked') || {}).value || 'average';
    var fit = (document.querySelector('input[name="fit"]:checked') || {}).value || 'regular';
    var size = suggestSize(h, w, build, fit);
    window._foundSize = size;
    renderSizeTable(size);
    $('#sizeResult').innerHTML = 'Your suggested size is <strong>' + size + '</strong> ' +
      'for a ' + fit + ' fit. <button class="link-btn" type="button" id="useSizeBtn">Use this size</button>';
    var useBtn = $('#useSizeBtn');
    if (useBtn) {
      useBtn.addEventListener('click', function () {
        viewerSize = size;
        $all('.size-btn').forEach(function (b) {
          var on = b.textContent === size;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        document.getElementById('viewer').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
        toast('Size ' + size + ' selected in the viewer');
      });
    }
  });
}

/* ---------------- 9. Cart drawer + checkout ---------------- */
function openCart() {
  $('#cartDrawer').classList.add('open');
  $('#cartDrawer').setAttribute('aria-hidden', 'false');
  $('#cartOverlay').hidden = false;
  document.body.classList.add('locked');
}
function closeCart() {
  $('#cartDrawer').classList.remove('open');
  $('#cartDrawer').setAttribute('aria-hidden', 'true');
  $('#cartOverlay').hidden = true;
  document.body.classList.remove('locked');
}
function nextOrderNumber() {
  var seq = loadJSON('roaslift-order-seq', 1000) + 1;
  saveJSON('roaslift-order-seq', seq);
  return 'RL-' + seq;
}
function initCartUI() {
  $('#cartBtn').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#cartOverlay').addEventListener('click', closeCart);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeCart(); closeCheckout(); }
  });
  $('#checkoutBtn').addEventListener('click', function () {
    if (cart.length === 0) return;
    var subtotal = cartSubtotal();
    var delivery = subtotal >= FREE_DELIVERY_AT ? 0 : DELIVERY_FEE;
    $('#checkoutSummary').textContent = cartCount() + ' item(s) · Subtotal ' +
      formatPrice(subtotal) + ' · Delivery ' +
      (delivery === 0 ? 'FREE' : formatPrice(delivery)) + ' · Total ' +
      formatPrice(subtotal + delivery);
    closeCart();
    $('#checkoutFormView').hidden = false;
    $('#checkoutSuccessView').hidden = true;
    $('#checkoutModal').hidden = false;
    document.body.classList.add('locked');
  });
  $('#checkoutClose').addEventListener('click', closeCheckout);
  $('#checkoutModal').addEventListener('click', function (e) {
    if (e.target === $('#checkoutModal')) { closeCheckout(); }
  });
  $('#successCloseBtn').addEventListener('click', closeCheckout);
  $('#checkoutForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#checkoutError');
    var name = $('#coName').value.trim();
    var phone = $('#coPhone').value.replace(/[^0-9]/g, '');
    var address = $('#coAddress').value.trim();
    var city = $('#coCity').value.trim();
    if (!name || phone.length < 10 || !address || !city) {
      err.textContent = 'Please fill every field — and check your phone number (at least 10 digits).';
      return;
    }
    err.textContent = '';
    $('#successName').textContent = name.split(' ')[0];
    $('#successOrderNo').textContent = nextOrderNumber();
    cart = [];
    saveJSON('roaslift-cart-v1', cart);
    renderCart();
    $('#checkoutForm').reset();
    $('#checkoutFormView').hidden = true;
    $('#checkoutSuccessView').hidden = false;
  });
}
function closeCheckout() {
  $('#checkoutModal').hidden = true;
  document.body.classList.remove('locked');
}

/* ---------------- 10. Nav, newsletter, reveals ---------------- */
function initNav() {
  var menuBtn = $('#menuBtn');
  var links = $('#navLinks');
  menuBtn.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $all('#navLinks a').forEach(function (a) {
    a.addEventListener('click', function () {
      links.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

function initNewsletter() {
  $('#newsletterForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('#newsletterEmail');
    var msg = $('#newsletterMsg');
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
    if (!ok) {
      msg.textContent = 'Please enter a valid email address.';
      return;
    }
    msg.textContent = 'You are in! Watch your inbox for Drop 02.';
    input.value = '';
  });
}

function initReveals() {
  if (reducedMotion) return;
  if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') return;
  try {
    window.gsap.registerPlugin(window.ScrollTrigger);
    $all('.reveal').forEach(function (el) {
      window.gsap.from(el, {
        y: 36, opacity: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });
  } catch (e) { /* content stays visible — reveals are enhancement only */ }
}

/* ---------------- 11. Init ---------------- */
document.addEventListener('DOMContentLoaded', function () {
  renderCart();
  initLoader();
  initHeroControls();
  initGrid();
  initViewerPanel();
  initViewerControls();
  initSizeFinder();
  initCartUI();
  initNav();
  initNewsletter();
  setViewerProduct(HERO_INDEX);
  setHeroIndex(HERO_INDEX, false);
  initThree();
  /* Scroll effects start after the loader reveals, so measurements are right. */
  onReveal(function () {
    initHeroScroll();
    initReveals();
    if (typeof window.ScrollTrigger !== 'undefined') {
      setTimeout(function () { window.ScrollTrigger.refresh(); }, 400);
    }
  });
});
