/* Particle cloud hero, after the teardown in docs/vesper-motion-reference.md.
 *
 * One THREE.Points object. Every particle carries its slot on a noise-rippled
 * sphere with the poles cut away (the hole), a random start position, and a
 * random delay. Three scalar uniforms drive everything:
 *   uProgress  0 -> 1  assemble from dust (on load)
 *   uDissolve  0 -> 1  scatter and fade (driven by scroll)
 *   uMouse     world-space attractor (smoothed pointer, spring back)
 * Colour is a height ramp in world space, so it stays put while the shell
 * turns. Additive blending on the dark theme gives the halo; the light theme
 * switches to normal blending with a darker ramp.
 */
(function () {
  'use strict';

  function initCloud(canvas, opts) {
  opts = opts || {};
  if (!canvas || typeof THREE === 'undefined') return;

  var isMobile = window.matchMedia('(max-width: 760px)').matches;
  var GRID = opts.grid || (isMobile ? 180 : 300);
  var pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch (e) { return; }
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 5.2);

  /* ---------- palettes ---------- */
  var PALETTES = {
    navy: {
      stops: ['#2c3fc5', '#3f7fcc', '#38e6e0', '#4fd9b0'],
      blend: THREE.AdditiveBlending, alpha: 0.9, size: 4.2, bg: ['#02040a', '#0b2859']
    },
    light: {
      stops: ['#2c3fc5', '#3f7fcc', '#17a9a4', '#2f9f84'],
      blend: THREE.NormalBlending, alpha: 0.8, size: 3.6, bg: ['#eef4fb', '#cfe3fb']
    }
  };

  /* ---------- geometry ---------- */
  // Grid sphere, phi from pole to pole. The grid is what produces the moire.
  // Full sphere, no holes. A lat/long grid bunches up at the poles, so rows
  // near a pole keep only a sin(phi) share of their columns; density stays
  // even and the grid lines (the moire) survive.
  var rows = GRID, cols = GRID;
  var targets = [], starts = [], delays = [], seeds = [];
  for (var i = 0; i < rows; i++) {
    var phi = Math.PI * (i + 0.5) / rows;
    var cy = Math.cos(phi);
    var sy = Math.sin(phi);
    var keep = Math.max(1, Math.round(cols * sy));
    for (var jj = 0; jj < keep; jj++) {
      var j = Math.floor(jj * cols / keep);
      var theta = 2 * Math.PI * j / cols;
      targets.push(sy * Math.cos(theta), cy, sy * Math.sin(theta));
      // start: random point in a wide sphere, radius 1.5 to 4
      var r = 1.5 + Math.random() * 2.5;
      var u = Math.random() * 2 - 1, t2 = Math.random() * 2 * Math.PI;
      var s = Math.sqrt(1 - u * u);
      starts.push(r * s * Math.cos(t2), r * u, r * s * Math.sin(t2));
      delays.push(Math.random());
      seeds.push(Math.random());
    }
  }
  var count = delays.length;
  // Simulation state. `position` is the simulated position (starts on the
  // shell); aTarget is the particle's slot; aFree is 1 right after a cursor
  // blast and decays to 0 as gravity and the spring bring it home.
  var tgt = new Float32Array(targets), pos = new Float32Array(targets);
  var vel = new Float32Array(count * 3), free = new Float32Array(count);
  var geo = new THREE.BufferGeometry();
  var posAttr = new THREE.BufferAttribute(pos, 3); posAttr.setUsage(THREE.DynamicDrawUsage);
  var freeAttr = new THREE.BufferAttribute(free, 1); freeAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aFree', freeAttr);
  geo.setAttribute('aTarget', new THREE.BufferAttribute(tgt, 3));
  geo.setAttribute('aStart', new THREE.Float32BufferAttribute(starts, 3));
  geo.setAttribute('aDelay', new THREE.Float32BufferAttribute(delays, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));

  /* ---------- shaders ---------- */
  var NOISE = [
    // Ashima 3D simplex noise (MIT)
    'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}',
    'float snoise(vec3 v){',
    ' const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);',
    ' vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);',
    ' vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);',
    ' vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;',
    ' i=mod289(i); vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
    ' float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;',
    ' vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);',
    ' vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);',
    ' vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);',
    ' vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));',
    ' vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    ' vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);',
    ' vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    ' p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;',
    ' vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;',
    ' return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}'
  ].join('\n');

  var VERT = NOISE + '\n' + [
    'attribute vec3 aStart; attribute vec3 aTarget; attribute float aDelay; attribute float aSeed; attribute float aFree;',
    'uniform float uTime, uProgress, uDissolve, uSize, uPixelRatio;',
    'uniform vec3 uC0, uC1, uC2, uC3;',
    'varying vec3 vColor; varying float vAlpha;',
    'float easeOut(float t){ return 1.0 - pow(1.0 - t, 3.0); }',
    'void main(){',
    '  vec3 tgt = aTarget;',
    // ripple: low frequency noise along the normal, animated; plus breathing
    '  float n = snoise(tgt * 1.5 + vec3(0.0, uTime * 0.18, uTime * 0.11));',
    '  float n2 = snoise(tgt * 4.0 - uTime * 0.25) * 0.25;',
    '  vec3 p = tgt * (1.0 + 0.2 * n + 0.05 * n2) * (1.0 + 0.025 * sin(uTime * 0.7));',
    // loose particles follow the simulation instead of the shell
    '  p = mix(p, position, smoothstep(0.0, 0.25, aFree));',
    // assemble: each particle has its own window inside uProgress
    '  float a = clamp((uProgress - aDelay * 0.65) / 0.35, 0.0, 1.0);',
    '  a = easeOut(a);',
    '  vec3 pos = mix(aStart, p, a);',
    // dissolve: top (high y) lets go first, outward plus a little downward drift
    '  float order = 1.0 - (tgt.y + 1.0) * 0.5;',
    '  float d = clamp((uDissolve - order * 0.45 - aSeed * 0.15) / 0.4, 0.0, 1.0);',
    '  d = d * d;',
    '  pos += normalize(p) * d * (1.6 + aSeed) + vec3(0.0, -0.5, 0.0) * d;',
    // colour: world-space height ramp
    '  vec4 world = modelMatrix * vec4(pos, 1.0);',
    '  float h = clamp((world.y + 1.15) / 2.3, 0.0, 1.0);',
    '  vec3 c = h < 0.45 ? mix(uC0, uC1, h / 0.45) : (h < 0.88 ? mix(uC1, uC2, (h - 0.45) / 0.43) : mix(uC2, uC3, (h - 0.88) / 0.12));',
    '  vColor = c;',
    '  vAlpha = (0.55 + 0.45 * a) * (1.0 - d) * (0.6 + 0.4 * aSeed) * (1.0 + 0.5 * aFree);',
    '  vec4 mv = viewMatrix * world;',
    '  gl_PointSize = uSize * uPixelRatio * (1.0 + 0.5 * aFree) * (4.8 / -mv.z);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var FRAG = [
    'uniform float uAlpha;',
    'varying vec3 vColor; varying float vAlpha;',
    'void main(){',
    '  float r = length(gl_PointCoord - 0.5);',
    '  float a = smoothstep(0.5, 0.05, r); a = a * a;',
    '  gl_FragColor = vec4(vColor, a * vAlpha * uAlpha);',
    '}'
  ].join('\n');

  var uniforms = {
    uTime: { value: 0 }, uProgress: { value: 0 }, uDissolve: { value: 0 },
    uSize: { value: 2.2 }, uPixelRatio: { value: pixelRatio }, uAlpha: { value: 0.55 },
    uC0: { value: new THREE.Color() }, uC1: { value: new THREE.Color() },
    uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() }
  };
  var mat = new THREE.ShaderMaterial({
    uniforms: uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
  });
  var points = new THREE.Points(geo, mat);
  var group = new THREE.Group();
  group.add(points);
  // tilt so the pole axis leans toward the camera (the swirl reads as a spiral)
  group.rotation.x = 0.95;
  group.rotation.z = 0.35;
  scene.add(group);

  /* ---------- background bokeh ---------- */
  var bokehN = 14, bPos = [], bSeed = [];
  for (var k = 0; k < bokehN; k++) {
    bPos.push((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, -1 - Math.random() * 2);
    bSeed.push(Math.random());
  }
  var bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  bGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(bSeed, 1));
  var bUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uPixelRatio: { value: pixelRatio }, uAlpha: { value: 0.35 } };
  var bokeh = new THREE.Points(bGeo, new THREE.ShaderMaterial({
    uniforms: bUniforms, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: [
      'attribute float aSeed; uniform float uTime, uPixelRatio; varying float vSeed;',
      'void main(){ vSeed = aSeed;',
      '  vec3 p = position; p.y = mod(p.y + uTime * (0.04 + aSeed * 0.05) + 2.5, 5.0) - 2.5;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_PointSize = (14.0 + aSeed * 26.0) * uPixelRatio * (4.8 / -mv.z);',
      '  gl_Position = projectionMatrix * mv; }'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uColor; uniform float uAlpha; varying float vSeed;',
      'void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r) * uAlpha * (0.4 + 0.6 * vSeed);',
      '  gl_FragColor = vec4(uColor, a); }'
    ].join('\n')
  }));
  scene.add(bokeh);

  /* ---------- palette ---------- */
  function applyPalette(name) {
    var p = PALETTES[name] || PALETTES.navy;
    uniforms.uC0.value.set(p.stops[0]); uniforms.uC1.value.set(p.stops[1]);
    uniforms.uC2.value.set(p.stops[2]); uniforms.uC3.value.set(p.stops[3]);
    uniforms.uAlpha.value = p.alpha; uniforms.uSize.value = p.size * (isMobile ? 1.35 : 1);
    mat.blending = p.blend; mat.needsUpdate = true;
    bUniforms.uColor.value.set(p.stops[1]);
    bUniforms.uAlpha.value = opts.static ? 0 : (name === 'light' ? 0.18 : 0.35);
    document.documentElement.setAttribute('data-palette', name);
  }
  window.cloudPalette = applyPalette;
  function themePalette() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'navy'; }
  applyPalette(opts.palette || document.documentElement.getAttribute('data-palette') || themePalette());
  window.addEventListener('themechange', function () { applyPalette(themePalette()); });

  /* ---------- sizing ---------- */
  function resize() {
    var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    // keep the shell about the same on-screen size at any aspect
    camera.position.z = isMobile ? 8.2 : (opts.distance || (opts.static ? 5.0 : 6.0));
    camera.position.x = isMobile ? 0 : (opts.offsetX || 0);
    camera.lookAt(0, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- pointer: smoothed, with spring back ---------- */
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  var hit = new THREE.Vector3(), cur = new THREE.Vector3(99, 99, 0), prev = new THREE.Vector3(99, 99, 0);
  // the pointer's ray in group space: particles are tested against the line
  // of sight, so only the column the pointer actually covers on screen is hit
  var ro = new THREE.Vector3(), rd = new THREE.Vector3(), inv = new THREE.Matrix4();
  var cursorIn = false, pendingMove = false;
  function onMove(x, y) {
    var r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      group.updateMatrixWorld();
      group.worldToLocal(cur.copy(hit));
      inv.copy(group.matrixWorld).invert();
      ro.copy(ray.ray.origin).applyMatrix4(inv);
      rd.copy(ray.ray.direction).transformDirection(inv).normalize();
      cursorIn = true; pendingMove = true;
    }
  }
  window.addEventListener('pointermove', function (e) { onMove(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener('pointerleave', function () { cursorIn = false; });

  /* ---------- simulation: blast, gravity, swirl, spring home ---------- */
  // The cursor is a body passing through gas. Particles within BLAST_R of its
  // path are thrown outward with the cursor's speed. Loose particles then feel
  // a central gravity, a tangential swirl around the shell's axis (so they
  // orbit rather than fall straight in), drag, and a spring back to their slot
  // that strengthens as aFree decays. Once home they snap and go quiet.
  var BLAST_R = 0.5, BLAST = 2.6, G = 3.0, SOFT = 0.35, SWIRL = 1.6, DRAG = 1.1, SPRING = 7.0, RELAX = 3.2;
  var active = 0;
  function simulate(dt) {
    var blast = false, sx = 0, sy = 0, sz = 0, speed = 0;
    if (pendingMove && cursorIn) {
      sx = cur.x - prev.x; sy = cur.y - prev.y; sz = cur.z - prev.z;
      speed = Math.sqrt(sx * sx + sy * sy + sz * sz);
      blast = prev.x < 50 && speed > 0.004 && speed < 2.5;
      prev.copy(cur); pendingMove = false;
    }
    if (!blast && active === 0) return;
    var r2 = BLAST_R * BLAST_R, kick = BLAST * Math.min(1, 0.35 + speed * 6);
    var ax = 0, ay = 1, az = 0; // shell axis in group space
    active = 0;
    for (var i = 0, j = 0; i < count; i++, j += 3) {
      var f = free[i];
      if (blast) {
        // distance from the pointer's line of sight, so only the column the
        // pointer visibly covers is disturbed, whatever the shell's tilt
        var vx = pos[j] - ro.x, vy = pos[j + 1] - ro.y, vz = pos[j + 2] - ro.z;
        var t = vx * rd.x + vy * rd.y + vz * rd.z;
        var dx = vx - t * rd.x, dy = vy - t * rd.y, dz = vz - t * rd.z;
        var q = dx * dx + dy * dy + dz * dz;
        if (q < r2) {
          var dd = Math.sqrt(q) + 1e-4, w = 1 - dd / BLAST_R;
          f = free[i] = 1;
          var jx = (Math.random() - 0.5) * 0.5, jy = (Math.random() - 0.5) * 0.5, jz = (Math.random() - 0.5) * 0.5;
          vel[j] += (dx / dd * 0.6 + sx / (speed + 1e-4) * 0.8 + jx) * kick * w;
          vel[j + 1] += (dy / dd * 0.6 + sy / (speed + 1e-4) * 0.8 + jy) * kick * w;
          vel[j + 2] += (dz / dd * 0.6 + sz / (speed + 1e-4) * 0.8 + jz) * kick * w;
        }
      }
      if (f <= 0) continue;
      var px = pos[j], py = pos[j + 1], pz = pos[j + 2];
      var r = Math.sqrt(px * px + py * py + pz * pz) + 1e-4;
      var g = G / (r * r + SOFT);
      // gravity toward the centre, swirl around the axis (cross(axis, pos)/r)
      var axx = -px / r * g + (ay * pz - az * py) / r * SWIRL;
      var ayy = -py / r * g + (az * px - ax * pz) / r * SWIRL;
      var azz = -pz / r * g + (ax * py - ay * px) / r * SWIRL;
      var home = (1 - f); home = home * home * SPRING;
      axx += (tgt[j] - px) * home; ayy += (tgt[j + 1] - py) * home; azz += (tgt[j + 2] - pz) * home;
      var dragK = 1 - Math.min(0.9, DRAG * dt * (1 + 2 * (1 - f)));
      vel[j] = (vel[j] + axx * dt) * dragK; vel[j + 1] = (vel[j + 1] + ayy * dt) * dragK; vel[j + 2] = (vel[j + 2] + azz * dt) * dragK;
      pos[j] = px + vel[j] * dt; pos[j + 1] = py + vel[j + 1] * dt; pos[j + 2] = pz + vel[j + 2] * dt;
      f -= dt / RELAX;
      if (f <= 0) { f = 0; pos[j] = tgt[j]; pos[j + 1] = tgt[j + 1]; pos[j + 2] = tgt[j + 2]; vel[j] = vel[j + 1] = vel[j + 2] = 0; }
      else active++;
      free[i] = f;
    }
    posAttr.needsUpdate = true; freeAttr.needsUpdate = true;
  }

  /* ---------- scroll drives dissolve ---------- */
  var dissolveTarget = 0;
  function onScroll() {
    if (opts.static) return;
    var span = window.innerHeight * 0.7;
    dissolveTarget = Math.max(0, Math.min(1, window.scrollY / span));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- replay (for the review page) ---------- */
  var t0 = performance.now(), progressTarget = 1;
  if (opts.static && 'IntersectionObserver' in window) {
    // a footer cloud assembles the first time it scrolls into view
    t0 = Infinity;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && t0 === Infinity) { t0 = performance.now(); io.disconnect(); } });
    });
    io.observe(canvas);
  }
  window.cloudReplay = function () { uniforms.uProgress.value = 0; t0 = performance.now(); };

  /* ---------- loop ---------- */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var t = (now - t0) / 1000;
    uniforms.uTime.value = now / 1000;
    bUniforms.uTime.value = now / 1000;
    // assemble over ~2.4 s after load (reference: 27 frames of condense, then crisp)
    var pr = reduce ? 1 : (t0 === Infinity ? 0 : Math.min(1, t / 2.4));
    uniforms.uProgress.value += (pr - uniforms.uProgress.value) * Math.min(1, dt * 8);
    uniforms.uDissolve.value += (dissolveTarget - uniforms.uDissolve.value) * Math.min(1, dt * 6);
    if (!reduce) { simulate(dt); group.rotation.y += dt * (Math.PI * 2 / 22); }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.cloudInfo = { particles: count, active: function () { return active; }, progress: function () { return uniforms.uProgress.value; }, t0: function () { return t0; } };
  }

  window.initCloud = initCloud;
  function boot() {
    document.querySelectorAll('canvas[data-cloud]').forEach(function (c) {
      try {
        initCloud(c, { offsetX: parseFloat(c.getAttribute('data-offset-x') || '0'),
                       grid: parseInt(c.getAttribute('data-grid') || '0', 10) || 0,
                       static: c.hasAttribute('data-static') });
      } catch (e) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
