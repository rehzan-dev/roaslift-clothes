/* =====================================================================
   ROASLift Clothes — single-page 3D store (V3)
   Structure:
   1. Data (products, sizes)
   2. Helpers + state (cart, wishlist) + toast + smooth scroll
   3. Loader (counter, skip, split-curtain reveal)
   4. Three.js (garment factory, loader logo, hero->viewer showcase,
      reduced-motion local viewer)
   5. Hero controls
   6. Shop grid (hover-to-spin)
   7. Viewer panel + drag controls
   8. Size finder (+ live diagram)
   9. Cart drawer + checkout
   10. Nav, newsletter, reveals
   11. Init
   Every Three.js / GSAP / Lenis feature is guarded: if a CDN fails, the
   page still works with plain <img> fallbacks and normal scrolling.
   ===================================================================== */

/* ---------------- 1. Data ---------------- */
var PRODUCTS = [
  { id: 'ash-wool', name: 'Ash Wool Bomber', price: 8499,
    img: 'images/jacket-gray-wool-bomber-web.jpg',
    cutout: 'images/cutout/jacket-gray-wool-bomber.webp',
    depth: 'images/depth/jacket-gray-wool-bomber.png',
    tag: 'Wool-blend · Zip-up', badge: '',
    desc: 'A warm wool-blend bomber with a clean zip front and roomy flap pockets.' },
  { id: 'cognac-suede', name: 'Cognac Suede Bomber', price: 9499,
    img: 'images/jacket-brown-suede-bomber-web.jpg',
    cutout: 'images/cutout/jacket-brown-suede-bomber.webp',
    depth: 'images/depth/jacket-brown-suede-bomber.png',
    tag: 'Soft suede · Bomber', badge: 'Hero',
    desc: 'Soft suede bomber with a clean collar and a warm, broken-in feel.' },
  { id: 'onyx', name: 'Onyx Bomber', price: 6999,
    img: 'images/jacket-black-bomber-web.jpg',
    cutout: 'images/cutout/jacket-black-bomber.webp',
    depth: 'images/depth/jacket-black-bomber.png',
    tag: 'Matte black · Bomber', badge: '',
    desc: 'A matte black bomber that goes with everything. Clean, sharp, everyday.' },
  { id: 'stone-work', name: 'Stone Work Jacket', price: 7499,
    img: 'images/jacket-grey-work-web.jpg',
    cutout: 'images/cutout/jacket-grey-work.webp',
    depth: 'images/depth/jacket-grey-work.png',
    tag: 'Workwear · Corduroy collar', badge: '',
    desc: 'A sturdy stone-grey work jacket with a soft corduroy collar.' },
  { id: 'espresso-trucker', name: 'Espresso Trucker', price: 8999,
    img: 'images/jacket-dark-brown-trucker-web.jpg',
    cutout: 'images/cutout/jacket-dark-brown-trucker.webp',
    depth: 'images/depth/jacket-dark-brown-trucker.png',
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
function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

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
var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
/* Shared 360° viewer state: the drag handlers write here, and whichever
   3D mode is active (showcase or local viewer) reads from it. */
var view3d = { rotY: 0, targetRotY: 0, velY: 0, dragging: false, lastX: 0,
               lastInteract: 0, zoom: 1, zoomTarget: 1 };

var toastTimer = null;
function toast(msg) {
  var el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

/* Smooth-scroll to an element: Lenis when it is running, else native. */
var lenis = null;
function scrollToEl(el) {
  if (!el) return;
  /* The hero is ScrollTrigger-pinned: once scrolled past the pin, the hero
     element sits at the bottom of the pin spacer, so scrolling to the
     element would land mid-pin (progress ~0.96) instead of at the top. */
  if (el.id === 'hero') {
    if (lenis) { lenis.scrollTo(0, { duration: 1.2 }); }
    else { window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' }); }
    return;
  }
  if (lenis) { lenis.scrollTo(el, { offset: -110, duration: 1.2 }); }
  else { el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); }
}
function initLenis() {
  if (reducedMotion || typeof window.Lenis === 'undefined') return;
  if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') return;
  try {
    lenis = new window.Lenis({ smoothWheel: true });
    lenis.on('scroll', window.ScrollTrigger.update);
    window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    window.gsap.ticker.lagSmoothing(0);
  } catch (e) { lenis = null; }
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
  loader.classList.add('open'); /* curtains part, content fades */
  setTimeout(function () {
    loader.style.display = 'none';
    /* Free the loader's WebGL context now that it is hidden — disposing
       earlier blanks the logo mid-fade (the canvas paints white once its
       context is lost). */
    if (loaderRenderer) {
      try { loaderRenderer.dispose(); loaderRenderer.forceContextLoss(); } catch (e) { /* already gone */ }
      loaderRenderer = null;
    }
  }, 950);
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

/* ---------------- 4. Three.js ---------------- */
/* All 3D is progressive enhancement: if WebGL or a CDN is unavailable,
   the <img> fallbacks stay visible and the page still works. */
var THREE = null;
var textures = {};       /* product id -> { color, depth } */
var threeReady = false;
var mode = 'none';       /* 'showcase' | 'local' | 'fallback' */
var GARMENT_W = 2.3;     /* garment plane width in world units */
var GARMENT_H = GARMENT_W * 1.5;

function webglAvailable() {
  try {
    var c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}

function makeRenderer(canvas) {
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

function sizeRendererToCanvas(renderer, camera) {
  var canvas = renderer.domElement;
  var w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
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
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xdce8ff, 0.4);
  fill.position.set(-4, 2, 3);
  scene.add(fill);
}

/* Soft radial blob shared by every contact shadow (no asset needed). */
var blobTexture = null;
function getBlobTexture() {
  if (blobTexture) return blobTexture;
  var c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  var g = c.getContext('2d');
  var grad = g.createRadialGradient(128, 128, 8, 128, 128, 124);
  grad.addColorStop(0, 'rgba(10, 30, 60, 0.34)');
  grad.addColorStop(0.55, 'rgba(10, 30, 60, 0.16)');
  grad.addColorStop(1, 'rgba(10, 30, 60, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  blobTexture = new THREE.CanvasTexture(c);
  return blobTexture;
}

function makeContactShadow() {
  var mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false })
  );
  /* Tilted toward the camera so the blob reads as a soft floor ellipse. */
  mesh.rotation.x = -1.05;
  return mesh;
}

/* Branded back for a garment: navy gradient + ROASLIFT text. */
var backTexture = null;
function getBackTexture() {
  if (backTexture) return backTexture;
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
  backTexture = new THREE.CanvasTexture(c);
  backTexture.colorSpace = THREE.SRGBColorSpace;
  return backTexture;
}

/* One garment: a subdivided plane with the bg-removed cut-out as its map
   and the depth map as vertex displacement (subtle relief, not lumps),
   plus the flat branded back panel behind it. */
function makeGarmentGroup(product) {
  var group = new THREE.Group();
  var geo = new THREE.PlaneGeometry(GARMENT_W, GARMENT_H, 48, 72);
  var tex = textures[product.id] || {};
  var frontMat = new THREE.MeshStandardMaterial({
    map: tex.color || null,
    displacementMap: tex.depth || null,
    displacementScale: 0.085, displacementBias: -0.042,
    roughness: 0.85, metalness: 0,
    transparent: true, alphaTest: 0.08, side: THREE.FrontSide
  });
  var front = new THREE.Mesh(geo, frontMat);
  var back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: getBackTexture(), roughness: 0.85,
    transparent: true, alphaTest: 0.08, side: THREE.FrontSide
  }));
  back.rotation.y = Math.PI;
  back.position.z = -0.02;
  group.add(front);
  group.add(back);
  group.userData.mats = [frontMat, back.material];
  group.userData.frontMat = frontMat;
  return group;
}

function setGroupOpacity(group, opacity) {
  group.userData.mats.forEach(function (m) { m.opacity = opacity; });
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
var loaderRenderer = null; /* freed in revealSite once the loader is hidden */
function initLoaderScene() {
  if (loaderDone) return; /* loader already revealed — no scene to build */
  var canvas = $('#loaderCanvas');
  var renderer;
  try { renderer = makeRenderer(canvas); }
  catch (e) { return; } /* keep the PNG logo visible */
  loaderRenderer = renderer;
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
    if (loaderDone) {
      cancelAnimationFrame(loaderAnimId);
      /* Last frame stays on the canvas while the loader fades out; the
         context itself is freed in revealSite once it is hidden. */
      return;
    }
    loaderAnimId = requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    sizeRendererToCanvas(renderer, camera);
    group.rotation.y = reducedMotion ? 0 : Math.sin(t * 0.6) * 0.28;
    group.position.y = reducedMotion ? 0 : Math.sin(t * 1.1) * 0.08;
    renderer.render(scene, camera);
  })();
}

/* ---- 4b. Showcase: one fixed stage, hero -> viewer in one sequence ---- */
var show = {
  renderer: null, scene: null, camera: null,
  groups: [], shadows: [], particles: null,
  hero: { current: HERO_INDEX, target: HERO_INDEX },
  layout: null, layoutCur: null, mouseX: 0, mouseY: 0,
  spin: 0,          /* scroll-driven 360 spin (radians) */
  converge: 0,      /* 0 = arc, 1 = tight row at centre */
  sideFade: 0,      /* 0 = sides visible, 1 = sides gone */
  dock: 0,          /* 0 = hero, 1 = docked in the viewer */
  wasDocked: false,
  active: false,    /* canvas visible */
  lastDeg: -1,
  pinST: null, dockST: null
};

/* Layout tiers: the carousel must never sit behind the headline copy.
   Wide screens: carousel right of the copy. Medium: pulled in so the
   active plane still fits. Narrow: smaller planes dropped below the copy. */
function showcaseLayout() {
  var vw = window.innerWidth;
  if (vw < 720) { return { scale: 0.74, spacing: 2.1, shiftX: 0, shiftY: -1.5, camZ: 10.5 }; }
  if (vw < 1100) { return { scale: 0.87, spacing: 2.6, shiftX: 1.4, shiftY: 0, camZ: 9.0 }; }
  return { scale: 1, spacing: 2.9, shiftX: 2.4, shiftY: 0, camZ: 8.4 };
}

/* Viewport point (px) -> world point on the z=0 plane, for dock tracking. */
function screenToWorld(clientX, clientY, camera) {
  var v = new THREE.Vector3(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1,
    0.5);
  v.unproject(camera);
  var dir = v.sub(camera.position).normalize();
  var dist = -camera.position.z / dir.z;
  return camera.position.clone().add(dir.multiplyScalar(dist));
}

/* Where the docked jacket belongs: the viewer stage centre, at a scale
   that fits the stage height. */
function stageTargetWorld() {
  var stage = $('.viewer-stage');
  var r = stage.getBoundingClientRect();
  var p = screenToWorld(r.left + r.width / 2, r.top + r.height / 2, show.camera);
  var visH = 2 * Math.tan(THREE.MathUtils.degToRad(show.camera.fov / 2)) * show.camera.position.z;
  var stageWorldH = (r.height / window.innerHeight) * visH;
  return { x: p.x, y: p.y, scale: (stageWorldH * 0.88) / GARMENT_H };
}

function initShowcase() {
  var canvas = $('#stageCanvas');
  var renderer;
  try { renderer = makeRenderer(canvas); }
  catch (e) { return false; }
  show.renderer = renderer;
  show.layout = showcaseLayout();
  /* layoutCur glides toward layout so a resize never teleports the jackets. */
  show.layoutCur = Object.assign({}, show.layout);

  var scene = new THREE.Scene();
  show.scene = scene;
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  camera.position.set(0, 0.2, show.layout.camZ);
  show.camera = camera;
  addLights(scene);

  /* Floating blue particles (hero only — they fade out as the jacket docks). */
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
  show.particles = particles;

  PRODUCTS.forEach(function (p) {
    var group = makeGarmentGroup(p);
    scene.add(group);
    show.groups.push(group);
    var shadow = makeContactShadow();
    scene.add(shadow);
    show.shadows.push(shadow);
  });

  window.addEventListener('pointermove', function (e) {
    show.mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    show.mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('resize', function () {
    /* Target tier only — the render loop glides layoutCur (and the camera)
       to it, so the jackets slide instead of jumping. */
    show.layout = showcaseLayout();
  });

  var clock = new THREE.Clock();
  (function animate() {
    requestAnimationFrame(animate);
    if (!show.active) return; /* canvas hidden — skip the work */
    var t = clock.getElapsedTime();
    sizeRendererToCanvas(renderer, camera);
    /* Glide the live layout toward its tier (resize changes the target). */
    var L = show.layoutCur;
    ['scale', 'spacing', 'shiftX', 'shiftY', 'camZ'].forEach(function (k) {
      L[k] = lerp(L[k], show.layout[k], 0.12);
      if (Math.abs(L[k] - show.layout[k]) < 0.001) { L[k] = show.layout[k]; }
    });
    camera.position.z = L.camZ;
    var dock = smoothstep(show.dock);
    var center = Math.round(show.hero.target);
    var target = dock > 0 ? stageTargetWorld() : null;

    show.hero.current = lerp(show.hero.current, show.hero.target, 0.08);
    if (Math.abs(show.hero.target - show.hero.current) < 0.001) { show.hero.current = show.hero.target; }
    updateViewRotation(dock > 0.99);

    var centerRot = 0;
    show.groups.forEach(function (group, i) {
      var off = i - show.hero.current;
      /* Arc position, converging into a tight centre row as you scroll. */
      var ax = off * L.spacing + L.shiftX;
      var ay = L.shiftY;
      var az = -Math.abs(off) * 1.5;
      /* The converge target must follow the lerped hero position, not the
         snapped centre: using the snapped centre teleports the whole row
         by converge x jacket-gap when the visitor switches mid-scroll. */
      var tx = lerp(ax, (i - show.hero.current) * 0.95, show.converge);
      var ty = lerp(ay, L.shiftY, show.converge);
      var tz = lerp(az, -Math.abs(off) * 0.4, show.converge);
      var ts = L.scale * (1 - Math.min(Math.abs(off) * 0.14, 0.4));
      var top = 1 - Math.min(Math.abs(off) * 0.4, 0.75);
      var rot = show.spin;
      var floatAmp = 1;
      if (i === center) {
        if (target) {
          tx = lerp(tx, target.x, dock);
          ty = lerp(ty, target.y, dock);
          tz = lerp(tz, 0, dock);
          ts = lerp(ts, target.scale * view3d.zoom, dock);
        }
        /* Blend to the equivalent of the drag angle nearest the spin angle,
           so the jacket glides into the stage front-facing instead of
           taking a full extra turn (spin is 2π, the drag angle ~0). */
        var dockRot = view3d.rotY + Math.PI * 2 * Math.round((show.spin - view3d.rotY) / (Math.PI * 2));
        rot = rot * (1 - dock) + dockRot * dock;
        top = 1;
        floatAmp = 1 - dock; /* stop bobbing once docked — drag owns it */
        centerRot = rot;
      } else {
        top = top * (1 - show.sideFade);
        ty -= show.sideFade * 1.4;
      }
      if (!reducedMotion) { ty += Math.sin(t * 0.8 + i * 1.3) * 0.09 * floatAmp; }
      group.position.set(tx, ty, tz);
      group.rotation.y = rot;
      group.scale.set(ts, ts, ts);
      setGroupOpacity(group, top);
      group.visible = top > 0.02;

      /* Contact shadow: under the garment, narrowing as it turns sideways. */
      var sh = show.shadows[i];
      var w = GARMENT_W * ts * 1.15 * (0.4 + 0.6 * Math.abs(Math.cos(rot)));
      sh.position.set(tx, ty - (GARMENT_H * ts / 2) - 0.12, tz);
      sh.scale.set(w, w, 1);
      sh.material.opacity = 0.9 * top;
      sh.visible = group.visible;
    });

    particles.rotation.y = t * 0.02;
    particles.material.opacity = 0.45 * (1 - dock);

    /* Mouse parallax, fading out as the jacket docks (the dock must sit still). */
    var px = reducedMotion ? 0 : show.mouseX * 0.5 * (1 - dock);
    var py = 0.2 - (reducedMotion ? 0 : show.mouseY * 0.25 * (1 - dock));
    camera.position.x = lerp(camera.position.x, px, 0.04);
    camera.position.y = lerp(camera.position.y, py, 0.04);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);

    /* Docked once? Sync the viewer panel to the jacket that docked. */
    if (show.dock >= 0.999 && !show.wasDocked) {
      show.wasDocked = true;
      view3d.lastInteract = Date.now(); /* jacket sits still 2.5s, then idles */
      setViewerProduct(center);
    } else if (show.dock < 0.98 && show.wasDocked) {
      show.wasDocked = false;
      /* Normalise the drag angle so the undock blend is at most one turn. */
      view3d.rotY = ((view3d.rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      view3d.targetRotY = view3d.rotY;
      view3d.velY = 0;
    }

    var deg = Math.round((((centerRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
    if (deg !== show.lastDeg) {
      show.lastDeg = deg;
      var dv = $('#degVal');
      if (dv) { dv.innerHTML = deg + '&deg;'; }
    }
  })();
  return true;
}

/* Drag inertia + arrow tweens + idle auto-rotate, shared by both 3D modes. */
function updateViewRotation(allowIdle) {
  if (view3d.dragging) return;
  var diff = view3d.targetRotY - view3d.rotY;
  if (Math.abs(diff) > 0.001) {
    view3d.rotY += diff * 0.12;
    view3d.velY = 0;
  } else {
    view3d.rotY += view3d.velY;
    view3d.targetRotY = view3d.rotY;
    /* A hard flick coasts at most ~half a turn before stopping. */
    view3d.velY *= 0.92;
    if (Math.abs(view3d.velY) < 0.0005) { view3d.velY = 0; }
    if (allowIdle && !reducedMotion && Date.now() - view3d.lastInteract > 2500) {
      view3d.rotY += 0.0028;
      view3d.targetRotY = view3d.rotY;
    }
  }
  view3d.zoom = lerp(view3d.zoom, view3d.zoomTarget, 0.12);
}

function setCanvasActive(active) {
  show.active = active;
  $('#stageCanvas').style.display = active ? 'block' : 'none';
  /* When the canvas is off-screen, the viewer stage shows its <img> so the
     section never looks empty if it is still partly visible. */
  var fb = $('#viewerFallback');
  if (!active) {
    fb.src = PRODUCTS[viewerIndex].cutout;
    fb.alt = PRODUCTS[viewerIndex].name;
    fb.hidden = false;
  } else {
    fb.hidden = true;
  }
}

function fadeHeroChrome(p) {
  /* p: 0 = hero at rest, 1 = chrome fully faded. */
  var k = clamp(p / 0.3, 0, 1);
  var copy = $('.hero-copy');
  var hint = $('.hero-hint');
  var controls = $('.hero-controls');
  var mark = $('.hero-watermark');
  if (k === 0) {
    /* Clear inline styles at rest, so the .fading copy-swap class works. */
    copy.style.opacity = '';
    copy.style.transform = '';
    copy.style.visibility = '';
    hint.style.opacity = '';
    controls.style.opacity = '';
    controls.style.visibility = '';
    mark.style.opacity = '';
    return;
  }
  /* Fully faded chrome must not stay clickable or tabbable. */
  var hidden = k >= 1 ? 'hidden' : '';
  copy.style.opacity = String(1 - k);
  copy.style.transform = 'translateY(' + (-40 * k) + 'px)';
  copy.style.visibility = hidden;
  hint.style.opacity = String(1 - k);
  controls.style.opacity = String(1 - k);
  controls.style.visibility = hidden;
  mark.style.opacity = String(1 - k * 0.8);
}

/* Runs once, when BOTH the loader has revealed and Three.js is ready —
   whichever finishes second triggers it. (Calling it only from onReveal
   raced the async texture load: if Three.js was not ready yet, the pin
   and dock triggers were never created at all.) */
var showcaseScrollInit = false;

function initShowcaseScroll() {
  if (showcaseScrollInit) return;
  if (mode !== 'showcase') return;
  if (!loaderDone) return;
  if (typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') return;
  showcaseScrollInit = true;
  try {
    window.gsap.registerPlugin(window.ScrollTrigger);
    /* Pin: scroll turns the carousel — jackets converge and spin 360°,
       then the side jackets fade away, leaving the centre one. */
    var distance = window.innerWidth < 720 ? 2000 : 2600;
    show.pinST = window.ScrollTrigger.create({
      trigger: '#hero',
      start: 'top top',
      end: '+=' + distance,
      pin: true,
      scrub: 0.5,
      anticipatePin: 1,
      onUpdate: function (self) {
        var p = self.progress;
        var a = clamp(p / 0.55, 0, 1); /* phase A: converge + spin */
        show.converge = a;
        show.spin = a * Math.PI * 2;
        show.sideFade = clamp((p - 0.55) / 0.45, 0, 1); /* phase B: sides fade */
        fadeHeroChrome(p);
      }
    });
    /* Dock: as the viewer stage scrolls into the centre, the centre
       jacket travels down and lands in it. */
    show.dockST = window.ScrollTrigger.create({
      trigger: '.viewer-stage',
      start: 'top 95%',
      end: 'center 55%',
      scrub: 0.5,
      onUpdate: function (self) { show.dock = self.progress; }
    });
    /* Canvas visibility: an IntersectionObserver on hero + viewer, not a
       ScrollTrigger with endTrigger — ScrollTrigger measured the viewer
       end WITHOUT the pin spacing (end 1953 instead of ~4553), which
       switched the canvas off mid-scroll and froze the jacket. */
    if ('IntersectionObserver' in window) {
      var vis = { hero: false, viewer: false };
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.target.id === 'hero') { vis.hero = en.isIntersecting; }
          else if (en.target.id === 'viewer') { vis.viewer = en.isIntersecting; }
        });
        setCanvasActive(vis.hero || vis.viewer);
      }, { rootMargin: '100px 0px' });
      io.observe(document.getElementById('hero'));
      io.observe(document.getElementById('viewer'));
    } else {
      setCanvasActive(true);
    }
    window.ScrollTrigger.refresh();
  } catch (e) { /* showcase stays inert; fallbacks cover it */ }
}

/* ---- 4c. Local viewer (reduced motion, or no ScrollTrigger) ---- */
/* A classic in-stage drag viewer: same garment, no scroll choreography. */
var local = { group: null, frontMat: null, fade: 1, fadeTarget: 1, pendingIndex: null };

function initLocalViewer() {
  var stage = $('.viewer-stage');
  var canvas = document.createElement('canvas');
  canvas.id = 'localCanvas';
  canvas.setAttribute('aria-hidden', 'true');
  stage.insertBefore(canvas, stage.firstChild);
  var renderer;
  try { renderer = makeRenderer(canvas); }
  catch (e) { canvas.remove(); return false; }
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 0, 7.2);
  addLights(scene);
  var group = makeGarmentGroup(PRODUCTS[viewerIndex]);
  scene.add(group);
  local.group = group;
  local.frontMat = group.userData.frontMat;
  var shadow = makeContactShadow();
  scene.add(shadow);

  var clock = new THREE.Clock();
  (function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    sizeRendererToCanvas(renderer, camera);
    updateViewRotation(true);
    group.rotation.y = view3d.rotY;
    group.position.y = reducedMotion ? 0 : Math.sin(t * 0.9) * 0.06;
    var s = view3d.zoom;
    group.scale.set(s, s, s);
    /* Texture-swap crossfade. */
    if (local.fade !== local.fadeTarget) {
      local.fade = lerp(local.fade, local.fadeTarget, 0.2);
      if (Math.abs(local.fade - local.fadeTarget) < 0.02) { local.fade = local.fadeTarget; }
      local.frontMat.opacity = local.fade;
      if (local.fade === 0 && local.pendingIndex !== null) {
        var tex = textures[PRODUCTS[local.pendingIndex].id] || {};
        local.frontMat.map = tex.color || null;
        local.frontMat.displacementMap = tex.depth || null;
        local.frontMat.needsUpdate = true;
        local.pendingIndex = null;
        local.fadeTarget = 1;
      }
    }
    var w = GARMENT_W * s * 1.15 * (0.4 + 0.6 * Math.abs(Math.cos(view3d.rotY)));
    shadow.position.set(0, group.position.y - (GARMENT_H * s / 2) - 0.12, 0);
    shadow.scale.set(w, w, 1);
    shadow.material.opacity = 0.9 * local.fade;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    var deg = Math.round((((view3d.rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
    if (deg !== show.lastDeg) {
      show.lastDeg = deg;
      var dv = $('#degVal');
      if (dv) { dv.innerHTML = deg + '&deg;'; }
    }
  })();
  return true;
}

function swapLocalProduct(index) {
  if (!local.group) return;
  local.pendingIndex = index;
  local.fadeTarget = 0;
}

/* ---- 4d. Boot Three.js (async, guarded) ---- */
function initThree() {
  if (!webglAvailable()) {
    mode = 'fallback';
    showHeroFallback();
    showViewerFallback();
    return;
  }
  /* Boot timeout: if the Three.js CDN (or a texture) hangs, show the <img>
     fallbacks instead of leaving the hero and viewer empty. A late load
     must not take over afterwards — the mode checks below guard that. */
  var bootTimer = setTimeout(function () {
    if (mode !== 'none') return;
    mode = 'fallback';
    showHeroFallback();
    showViewerFallback();
  }, 6000);
  import('three').then(function (mod) {
    if (mode !== 'none') return []; /* boot timed out — stay on fallbacks */
    THREE = mod;
    /* Start the 3D loader logo now — it needs no textures, and waiting for
       all 10 product textures could leave the loader without it. */
    try { initLoaderScene(); } catch (e) { /* PNG logo stays */ }
    var loader = new THREE.TextureLoader();
    var jobs = [];
    PRODUCTS.forEach(function (p) {
      jobs.push(loader.loadAsync(p.cutout).then(function (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        textures[p.id] = textures[p.id] || {};
        textures[p.id].color = tex;
      }).catch(function () { /* material renders untextured */ }));
      jobs.push(loader.loadAsync(p.depth).then(function (tex) {
        textures[p.id] = textures[p.id] || {};
        textures[p.id].depth = tex; /* data map: keep linear, no sRGB */
      }).catch(function () { /* no relief for this jacket */ }));
    });
    return Promise.all(jobs);
  }).then(function () {
    clearTimeout(bootTimer);
    if (!THREE || mode !== 'none') return;
    threeReady = true;
    var canShowcase = !reducedMotion &&
      typeof window.gsap !== 'undefined' &&
      typeof window.ScrollTrigger !== 'undefined';
    if (canShowcase) {
      try {
        if (initShowcase()) {
          mode = 'showcase';
          initShowcaseScroll(); /* no-op until the loader has revealed */
          return;
        }
      } catch (e) { /* fall through to the local viewer */ }
    }
    try {
      if (initLocalViewer()) {
        mode = 'local';
        /* No showcase in this mode, so the hero needs its static cutout. */
        showHeroFallback();
        return;
      }
    } catch (e) { /* fall through to fallbacks */ }
    mode = 'fallback';
    showHeroFallback();
    showViewerFallback();
  }).catch(function () {
    clearTimeout(bootTimer);
    if (mode !== 'none') return;
    mode = 'fallback';
    showHeroFallback();
    showViewerFallback();
  });
}

function showHeroFallback() {
  $('#heroFallback').hidden = false;
}
function showViewerFallback() {
  var fb = $('#viewerFallback');
  fb.src = PRODUCTS[viewerIndex].cutout;
  fb.alt = PRODUCTS[viewerIndex].name;
  fb.hidden = false;
  $('#viewerFallbackBack').hidden = false;
}
function setHeroFallbackImage(index) {
  var fb = $('#heroFallback');
  if (!fb.hidden) {
    fb.src = PRODUCTS[index].cutout;
    fb.alt = PRODUCTS[index].name;
  }
}

/* ---------------- 5. Hero controls ---------------- */
/* Update headline + dots for the active hero jacket. */
function setHeroIndex(index, updateTarget) {
  index = clamp(index, 0, PRODUCTS.length - 1);
  heroIndex = index;
  if (updateTarget !== false) { show.hero.target = index; }
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
  setHeroIndex(index);
}

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
    goToHeroIndex(Math.round(show.hero.target) - 1);
  });
  $('#heroNext').addEventListener('click', function () {
    goToHeroIndex(Math.round(show.hero.target) + 1);
  });
  $('#heroAddBtn').addEventListener('click', function () {
    addToCart(PRODUCTS[heroIndex].id, 'M', 1);
    toast(PRODUCTS[heroIndex].name + ' (M) added to bag');
  });
  $('#heroViewBtn').addEventListener('click', function () {
    setViewerProduct(heroIndex);
  });
}

/* ---------------- 6. Shop grid + hover-to-spin ---------------- */
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
      '<div class="card-spin">' +
      '<div class="card-face card-face-front"><img src="' + p.cutout + '" alt="' + p.name + '" loading="lazy"></div>' +
      '<div class="card-face card-face-back"><span class="card-back-mark">ROASLIFT</span><span class="card-back-tag">WEAR THE RISE</span></div>' +
      '</div>' +
      (p.badge ? '<span class="card-badge">' + p.badge + '</span>' : '') +
      '<span class="card-turn">0&deg;</span></div>' +
      '<div class="card-body"><h3>' + p.name + '</h3>' +
      '<p class="card-tag">' + p.tag + '</p>' +
      '<div class="card-foot"><span class="card-price">' + formatPrice(p.price) + '</span>' +
      '<button class="card-add" type="button" aria-label="Add ' + p.name + ' to bag">Add +</button></div></div>';
    function openInViewer() {
      setViewerProduct(i);
      scrollToEl(document.getElementById('viewer'));
    }
    card.addEventListener('click', openInViewer);
    card.addEventListener('keydown', function (e) {
      /* Keydown on the Add + button bubbles up here; only keys pressed on the
         card itself open the viewer, so the button keeps its own behaviour. */
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInViewer(); }
    });
    card.querySelector('.card-add').addEventListener('click', function (e) {
      e.stopPropagation();
      addToCart(p.id, 'M', 1);
      toast(p.name + ' (M) added to bag');
    });
    /* Hover spins the jacket 0° -> 180° (front cut-out -> branded back)
       with a live angle readout; leaving spins it back to 0°. */
    if (finePointer && !reducedMotion) {
      var spinEl = card.querySelector('.card-spin');
      var turnEl = card.querySelector('.card-turn');
      var spin = { angle: 0, target: 0, raf: null };
      var tickSpin = function () {
        spin.angle += (spin.target - spin.angle) * 0.12;
        if (Math.abs(spin.target - spin.angle) < 0.3) { spin.angle = spin.target; }
        spinEl.style.transform = 'rotateY(' + spin.angle + 'deg)';
        turnEl.innerHTML = Math.round(((spin.angle % 360) + 360) % 360) + '&deg;';
        if (spin.angle !== spin.target) { spin.raf = requestAnimationFrame(tickSpin); }
        else { spin.raf = null; }
      };
      var startSpin = function () {
        if (!spin.raf) { spin.raf = requestAnimationFrame(tickSpin); }
      };
      card.addEventListener('pointerenter', function () { spin.target = 180; startSpin(); });
      card.addEventListener('pointerleave', function () { spin.target = 0; startSpin(); });
    }
    grid.appendChild(card);
  });
}

/* ---------------- 7. Viewer panel + drag controls ---------------- */
/* Set when a product switch starts a reset-to-front tween: the showcase
   loop's undock normalisation can overwrite targetRotY mid-tween when the
   jacket undocks on the way back, so the reset is re-asserted on re-dock. */
var viewerResetPending = false;

function setViewerProduct(index) {
  index = clamp(index, 0, PRODUCTS.length - 1);
  var changed = index !== viewerIndex;
  var fb;
  viewerIndex = index;
  var p = PRODUCTS[index];
  $('#viewerEyebrow').textContent = 'Drop 01 · ' + p.tag.split('·')[0].trim();
  $('#viewerName').textContent = p.name;
  $('#viewerPrice').textContent = formatPrice(p.price);
  $('#viewerDesc').textContent = p.desc;
  updateWishlistBtn();
  if (changed) {
    /* A new jacket docks facing front, at default zoom. (No reset when the
       same jacket re-docks — its angle is kept across undock/re-dock.) */
    view3d.targetRotY = Math.round(view3d.rotY / (Math.PI * 2)) * Math.PI * 2;
    view3d.velY = 0;
    view3d.zoomTarget = 1;
    view3d.lastInteract = Date.now();
    viewerResetPending = true;
  } else if (viewerResetPending && mode === 'showcase') {
    /* Re-dock after a switch whose reset was interrupted mid-tween: finish it. */
    view3d.targetRotY = Math.round(view3d.rotY / (Math.PI * 2)) * Math.PI * 2;
    view3d.velY = 0;
    viewerResetPending = false;
  }
  if (mode === 'showcase') {
    /* Re-centre the arc on this jacket — it is the one that docks. */
    show.hero.target = index;
    setHeroIndex(index, false);
    /* Canvas off-screen: the <img> stand-in shows the new jacket too. */
    if (!show.active) {
      fb = $('#viewerFallback');
      fb.src = p.cutout;
      fb.alt = p.name;
    }
  } else if (mode === 'local') {
    if (changed) { swapLocalProduct(index); }
  } else {
    fb = $('#viewerFallback');
    fb.src = p.cutout;
    fb.alt = p.name;
    if (changed) { kickFallback(); }
  }
}

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
    scrollToEl(document.getElementById('size'));
  });
}

function updateWishlistBtn() {
  var on = wishlist.indexOf(PRODUCTS[viewerIndex].id) !== -1;
  var btn = $('#wishlistBtn');
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  $('#wishlistLabel').textContent = on ? 'Saved to wishlist' : 'Add to wishlist';
}

/* Dragging only makes sense once the jacket is docked (showcase mode);
   the local and fallback viewers are always draggable. */
function viewerCanDrag() {
  if (mode === 'showcase') { return show.dock >= 0.99; }
  return true;
}

function rotateViewerBy(delta) {
  if (!viewerCanDrag()) return;
  viewerResetPending = false; /* manual turn overrides a pending reset */
  view3d.targetRotY += delta;
  view3d.lastInteract = Date.now();
  if (mode === 'fallback') { kickFallback(); }
}

/* No-WebGL fallback has no render loop, so inertia, arrow tweens and zoom
   need their own rAF loop — started on demand, stops when settled. */
var fallbackRaf = null;
function fallbackTick() {
  fallbackRaf = null;
  updateViewRotation(false); /* no idle auto-rotate in the fallback viewer */
  applyFallbackRotation();
  var moving = Math.abs(view3d.velY) > 0.0005 ||
    Math.abs(view3d.targetRotY - view3d.rotY) > 0.001 ||
    Math.abs(view3d.zoomTarget - view3d.zoom) > 0.001;
  if (moving) { fallbackRaf = requestAnimationFrame(fallbackTick); }
}
function kickFallback() {
  if (mode !== 'fallback' || fallbackRaf !== null) return;
  fallbackRaf = requestAnimationFrame(fallbackTick);
}

function applyFallbackRotation() {
  var deg = view3d.rotY * 180 / Math.PI;
  var fb = $('#viewerFallback');
  var back = $('#viewerFallbackBack');
  fb.style.transform = 'translate(-50%, -50%) perspective(800px) rotateY(' + deg + 'deg)';
  /* Branded back, half a turn behind the front — each face hides itself
     past 90° (backface-visibility), so the front never shows mirrored. */
  back.style.transform = 'translate(-50%, -50%) perspective(800px) rotateY(' + (deg + 180) + 'deg)';
  /* Zoomed size for both faces (base: min(340px, 72%) at zoom 1). */
  var w = 'min(' + Math.round(340 * view3d.zoom) + 'px, ' + Math.min(Math.round(72 * view3d.zoom), 88) + '%)';
  fb.style.width = w;
  back.style.width = w;
  var shown = Math.round((((view3d.rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 180 / Math.PI) % 360;
  if (shown !== show.lastDeg) {
    show.lastDeg = shown;
    var dv = $('#degVal');
    if (dv) { dv.innerHTML = shown + '&deg;'; }
  }
}

function initViewerControls() {
  var stage = $('.viewer-stage');
  var layer = $('#dragLayer');
  var badge = $('#dragBadge');

  layer.addEventListener('pointerdown', function (e) {
    if (!viewerCanDrag()) return;
    viewerResetPending = false; /* manual drag overrides a pending reset */
    view3d.dragging = true;
    view3d.lastX = e.clientX;
    view3d.velY = 0;
    view3d.lastInteract = Date.now();
    stage.classList.add('dragging');
    layer.setPointerCapture(e.pointerId);
  });
  layer.addEventListener('pointermove', function (e) {
    if (finePointer && viewerCanDrag()) {
      badge.style.left = e.clientX + 'px';
      badge.style.top = e.clientY + 'px';
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
    if (!view3d.dragging) return;
    var dx = e.clientX - view3d.lastX;
    view3d.lastX = e.clientX;
    view3d.rotY += dx * 0.008;
    view3d.targetRotY = view3d.rotY;
    view3d.velY = clamp(dx * 0.008, -0.25, 0.25);
    view3d.lastInteract = Date.now();
    if (mode === 'fallback') { applyFallbackRotation(); }
  });
  function endDrag() {
    view3d.dragging = false;
    stage.classList.remove('dragging');
    view3d.lastInteract = Date.now();
    kickFallback(); /* inertia + zoom settle in the no-WebGL viewer */
  }
  layer.addEventListener('pointerup', endDrag);
  layer.addEventListener('pointercancel', endDrag);
  layer.addEventListener('lostpointercapture', endDrag);
  layer.addEventListener('pointerleave', function () {
    badge.classList.remove('show');
  });
  /* Scrolling can move the stage away (or undock the jacket) without the
     pointer leaving the layer — never leave the badge behind. */
  window.addEventListener('scroll', function () {
    badge.classList.remove('show');
  }, { passive: true });

  $('#viewerPrev').addEventListener('click', function () { rotateViewerBy(-Math.PI / 2); });
  $('#viewerNext').addEventListener('click', function () { rotateViewerBy(Math.PI / 2); });

  $('#zoomIn').addEventListener('click', function () {
    view3d.zoomTarget = clamp(view3d.zoomTarget + 0.15, 1, 1.6);
    view3d.lastInteract = Date.now();
    kickFallback();
  });
  $('#zoomOut').addEventListener('click', function () {
    view3d.zoomTarget = clamp(view3d.zoomTarget - 0.15, 1, 1.6);
    view3d.lastInteract = Date.now();
    kickFallback();
  });
  $('#zoomReset').addEventListener('click', function () {
    view3d.zoomTarget = 1;
    /* Shortest path back to the front (nearest full turn). */
    view3d.targetRotY = Math.round(view3d.rotY / (Math.PI * 2)) * Math.PI * 2;
    view3d.velY = 0;
    view3d.lastInteract = Date.now();
    kickFallback();
  });
}

/* ---------------- 8. Size finder ---------------- */
var unit = 'cm';
var diagramSize = 'M';
function cmToUnit(cm) {
  return unit === 'cm' ? Math.round(cm) + ' cm' : (cm / 2.54).toFixed(1) + '″';
}
function renderSizeTable(highlight) {
  var body = $('#sizeTableBody');
  body.innerHTML = '';
  SIZE_TABLE.forEach(function (row) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-size', row.size);
    /* Fits-height converts with the unit toggle like the other columns. */
    var fits = unit === 'cm'
      ? row.minH + '&ndash;' + row.maxH + ' cm'
      : cmToUnit(row.minH) + '&ndash;' + cmToUnit(row.maxH);
    if (highlight === row.size) { tr.className = 'highlight'; }
    tr.innerHTML = '<td><strong>' + row.size + '</strong></td>' +
      '<td>' + cmToUnit(row.chest) + '</td>' +
      '<td>' + cmToUnit(row.length) + '</td>' +
      '<td>' + fits + '</td>';
    tr.addEventListener('mouseenter', function () { setDiagramSize(row.size); });
    tr.addEventListener('click', function () { setDiagramSize(row.size); });
    /* Keyboard route: rows are tab stops; Enter/Space selects the size. */
    tr.tabIndex = 0;
    tr.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDiagramSize(row.size); }
    });
    body.appendChild(tr);
  });
}
/* Sync the jacket diagram + its callouts to one size (hover, tap, finder). */
function setDiagramSize(size) {
  var row = SIZE_TABLE.find(function (r) { return r.size === size; });
  if (!row) return;
  diagramSize = size;
  $('#diagramSizeLetter').textContent = size;
  $('#diagChest').textContent = 'Chest ' + cmToUnit(row.chest);
  $('#diagLength').textContent = 'Length ' + cmToUnit(row.length);
  $all('#sizeTableBody tr').forEach(function (tr) {
    tr.classList.toggle('highlight', tr.getAttribute('data-size') === size);
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
  setDiagramSize('M');
  $('#unitCm').addEventListener('click', function () {
    unit = 'cm';
    $('#unitCm').classList.add('active');
    $('#unitIn').classList.remove('active');
    renderSizeTable(diagramSize);
    setDiagramSize(diagramSize);
  });
  $('#unitIn').addEventListener('click', function () {
    unit = 'inches';
    $('#unitIn').classList.add('active');
    $('#unitCm').classList.remove('active');
    renderSizeTable(diagramSize);
    setDiagramSize(diagramSize);
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
    setDiagramSize(size);
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
        scrollToEl(document.getElementById('viewer'));
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
  if (lenis) { lenis.stop(); }
}
function closeCart() {
  $('#cartDrawer').classList.remove('open');
  $('#cartDrawer').setAttribute('aria-hidden', 'true');
  $('#cartOverlay').hidden = true;
  document.body.classList.remove('locked');
  if (lenis) { lenis.start(); }
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
    if (lenis) { lenis.stop(); }
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
  if (lenis) { lenis.start(); }
}

/* ---------------- 10. Nav, anchors, newsletter, reveals ---------------- */
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

/* In-page anchors scroll through Lenis when it is running. */
function initAnchors() {
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    scrollToEl(el);
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
        /* Clear the transform when done: a leftover translate(0,0) turns the
           element into a stacking context + containing block for fixed
           descendants (it once hid the viewer's DRAG badge). */
        clearProps: 'transform',
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
  initAnchors();
  initNewsletter();
  setViewerProduct(HERO_INDEX);
  setHeroIndex(HERO_INDEX, false);
  initLenis();
  initThree();
  /* Scroll effects start after the loader reveals, so measurements are right. */
  onReveal(function () {
    initShowcaseScroll();
    initReveals();
    if (typeof window.ScrollTrigger !== 'undefined') {
      setTimeout(function () { window.ScrollTrigger.refresh(); }, 400);
    }
  });
});
