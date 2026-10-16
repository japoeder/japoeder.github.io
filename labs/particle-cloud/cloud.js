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

  var canvas = document.getElementById('cloud');
  if (!canvas || typeof THREE === 'undefined') return;

  var isMobile = window.matchMedia('(max-width: 760px)').matches;
  var GRID = isMobile ? 180 : 300;
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
      stops: ['#2c3fc5', '#1f81d2', '#38e6e0', '#4fd9b0'],
      blend: THREE.AdditiveBlending, alpha: 0.9, size: 4.2, bg: ['#02040a', '#0b2859']
    },
    light: {
      stops: ['#9a2f00', '#f37021', '#ff9d4d', '#ffcf99'],
      blend: THREE.NormalBlending, alpha: 0.75, size: 3.6, bg: ['#f7f7f9', '#fde7d6']
    }
  };

  /* ---------- geometry ---------- */
  // Grid sphere, phi from pole to pole, with a cap skipped at both ends so a
  // hole runs through the shell. The grid is what produces the moire.
  var cap = 0.62;                 // |cos(phi)| above this is skipped
  var rows = GRID, cols = GRID;
  var targets = [], starts = [], delays = [], seeds = [];
  for (var i = 0; i < rows; i++) {
    var phi = Math.PI * (i + 0.5) / rows;
    var cy = Math.cos(phi);
    if (Math.abs(cy) > cap) continue;
    var sy = Math.sin(phi);
    for (var j = 0; j < cols; j++) {
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
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(targets, 3));
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
    'attribute vec3 aStart; attribute float aDelay; attribute float aSeed;',
    'uniform float uTime, uProgress, uDissolve, uSize, uPixelRatio, uPull;',
    'uniform vec3 uMouse;',
    'uniform vec3 uC0, uC1, uC2, uC3;',
    'varying vec3 vColor; varying float vAlpha;',
    'float easeOut(float t){ return 1.0 - pow(1.0 - t, 3.0); }',
    'void main(){',
    '  vec3 tgt = position;',
    // ripple: low frequency noise along the normal, animated; plus breathing
    '  float n = snoise(tgt * 1.5 + vec3(0.0, uTime * 0.18, uTime * 0.11));',
    '  float n2 = snoise(tgt * 4.0 - uTime * 0.25) * 0.25;',
    '  vec3 p = tgt * (1.0 + 0.2 * n + 0.05 * n2) * (1.0 + 0.025 * sin(uTime * 0.7));',
    // assemble: each particle has its own window inside uProgress
    '  float a = clamp((uProgress - aDelay * 0.65) / 0.35, 0.0, 1.0);',
    '  a = easeOut(a);',
    '  vec3 pos = mix(aStart, p, a);',
    // dissolve: top (high y) lets go first, outward plus a little downward drift
    '  float order = 1.0 - (tgt.y + 1.0) * 0.5;',
    '  float d = clamp((uDissolve - order * 0.45 - aSeed * 0.15) / 0.4, 0.0, 1.0);',
    '  d = d * d;',
    '  pos += normalize(p) * d * (1.6 + aSeed) + vec3(0.0, -0.5, 0.0) * d;',
    // cursor: pull particles near the pointer toward it, far side unaffected
    '  vec3 toM = uMouse - pos;',
    '  float dist = length(toM);',
    '  float pull = exp(-dist * dist * 2.2) * uPull;',
    '  pos += toM * pull * 0.55;',
    // colour: world-space height ramp
    '  vec4 world = modelMatrix * vec4(pos, 1.0);',
    '  float h = clamp((world.y + 1.15) / 2.3, 0.0, 1.0);',
    '  vec3 c = h < 0.33 ? mix(uC0, uC1, h / 0.33) : (h < 0.72 ? mix(uC1, uC2, (h - 0.33) / 0.39) : mix(uC2, uC3, (h - 0.72) / 0.28));',
    '  vColor = c;',
    '  vAlpha = (0.55 + 0.45 * a) * (1.0 - d) * (0.6 + 0.4 * aSeed);',
    '  vec4 mv = viewMatrix * world;',
    '  gl_PointSize = uSize * uPixelRatio * (1.0 + 0.6 * pull) * (4.8 / -mv.z);',
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
    uSize: { value: 2.2 }, uPixelRatio: { value: pixelRatio }, uPull: { value: 0 },
    uMouse: { value: new THREE.Vector3(99, 99, 0) }, uAlpha: { value: 0.55 },
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
  // tilt so the hole is seen off axis, like the reference
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
    bUniforms.uAlpha.value = name === 'light' ? 0.18 : 0.35;
    document.documentElement.setAttribute('data-palette', name);
  }
  window.cloudPalette = applyPalette;
  applyPalette(document.documentElement.getAttribute('data-palette') || 'navy');

  /* ---------- sizing ---------- */
  function resize() {
    var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    // keep the shell about the same on-screen size at any aspect
    camera.position.z = isMobile ? 8.2 : 6.0;
    camera.position.x = isMobile ? 0 : -0.55;
    camera.lookAt(0, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- pointer: smoothed, with spring back ---------- */
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  var hit = new THREE.Vector3(), mouseTarget = new THREE.Vector3(99, 99, 0), pullTarget = 0, lastMove = 0;
  function onMove(x, y) {
    var r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      group.worldToLocal(mouseTarget.copy(hit));
      pullTarget = 1; lastMove = performance.now();
    }
  }
  window.addEventListener('pointermove', function (e) { onMove(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener('pointerleave', function () { pullTarget = 0; });

  /* ---------- scroll drives dissolve ---------- */
  var dissolveTarget = 0;
  function onScroll() {
    var span = window.innerHeight * 0.7;
    dissolveTarget = Math.max(0, Math.min(1, window.scrollY / span));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- replay (for the review page) ---------- */
  var t0 = performance.now(), progressTarget = 1;
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
    var pr = reduce ? 1 : Math.min(1, t / 2.4);
    uniforms.uProgress.value += (pr - uniforms.uProgress.value) * Math.min(1, dt * 8);
    uniforms.uDissolve.value += (dissolveTarget - uniforms.uDissolve.value) * Math.min(1, dt * 6);
    // pointer: pull in fast (~5 frames), relax slow (~10 frames) after the pointer stops
    if (now - lastMove > 140) pullTarget = 0;
    var k = pullTarget > uniforms.uPull.value ? 14 : 5;
    uniforms.uPull.value += (pullTarget - uniforms.uPull.value) * Math.min(1, dt * k);
    uniforms.uMouse.value.lerp(mouseTarget, Math.min(1, dt * 12));
    if (!reduce) group.rotation.y += dt * (Math.PI * 2 / 22);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.cloudInfo = { particles: count };
})();
