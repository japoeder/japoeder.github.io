/* ============================================================
   Jonathan Poeder — site interactions
   - WebGL morphing wireframe blob (Three.js)
   - Animated flowing line streams (canvas) for the portfolio
   - nav toggle, scroll reveal, responsive cards
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- compact 3D simplex noise (Stefan Gustavson, public domain) ---------- */
  function makeNoise3D() {
    var grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    var p = [];
    for (var i = 0; i < 256; i++) p[i] = Math.floor((Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * 256);
    var perm = [];
    for (var j = 0; j < 512; j++) perm[j] = p[j & 255];
    function dot(g, x, y, z) { return g[0]*x + g[1]*y + g[2]*z; }
    return function (xin, yin, zin) {
      var F3 = 1/3, G3 = 1/6, n0, n1, n2, n3;
      var s = (xin + yin + zin) * F3;
      var i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
      var t = (i + j + k) * G3;
      var x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
      var i1,j1,k1,i2,j2,k2;
      if (x0 >= y0) {
        if (y0 >= z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0;}
        else if (x0 >= z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1;}
        else {i1=0;j1=0;k1=1;i2=1;j2=0;k2=1;}
      } else {
        if (y0 < z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1;}
        else if (x0 < z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1;}
        else {i1=0;j1=1;k1=0;i2=1;j2=1;k2=0;}
      }
      var x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;
      var x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;
      var x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;
      var ii=i&255,jj=j&255,kk=k&255;
      var t0=0.6-x0*x0-y0*y0-z0*z0;
      if(t0<0)n0=0;else{t0*=t0;n0=t0*t0*dot(grad3[perm[ii+perm[jj+perm[kk]]]%12],x0,y0,z0);}
      var t1=0.6-x1*x1-y1*y1-z1*z1;
      if(t1<0)n1=0;else{t1*=t1;n1=t1*t1*dot(grad3[perm[ii+i1+perm[jj+j1+perm[kk+k1]]]%12],x1,y1,z1);}
      var t2=0.6-x2*x2-y2*y2-z2*z2;
      if(t2<0)n2=0;else{t2*=t2;n2=t2*t2*dot(grad3[perm[ii+i2+perm[jj+j2+perm[kk+k2]]]%12],x2,y2,z2);}
      var t3=0.6-x3*x3-y3*y3-z3*z3;
      if(t3<0)n3=0;else{t3*=t3;n3=t3*t3*dot(grad3[perm[ii+1+perm[jj+1+perm[kk+1]]]%12],x3,y3,z3);}
      return 32*(n0+n1+n2+n3);
    };
  }

  /* ---------------------- static SVG wireframe-sphere fallback ---------------------- */
  function blobFallback(canvas, color) {
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('class', (canvas.className || '') + ' blob-fallback');
    svg.setAttribute('aria-hidden', 'true');
    var g = document.createElementNS(svgNS, 'g');
    g.setAttribute('fill', 'none'); g.setAttribute('stroke', color);
    g.setAttribute('stroke-width', '0.6'); g.setAttribute('opacity', '0.8');
    var i, el;
    var c = document.createElementNS(svgNS, 'circle');
    c.setAttribute('cx', '100'); c.setAttribute('cy', '100'); c.setAttribute('r', '78');
    g.appendChild(c);
    for (i = 1; i <= 5; i++) { // longitude ellipses
      el = document.createElementNS(svgNS, 'ellipse');
      el.setAttribute('cx', '100'); el.setAttribute('cy', '100');
      el.setAttribute('rx', String(78 * Math.cos(i * Math.PI / 12))); el.setAttribute('ry', '78');
      g.appendChild(el);
    }
    for (i = 1; i <= 5; i++) { // latitude ellipses
      el = document.createElementNS(svgNS, 'ellipse');
      el.setAttribute('cx', '100'); el.setAttribute('cy', '100');
      el.setAttribute('rx', '78'); el.setAttribute('ry', String(78 * Math.cos(i * Math.PI / 12)));
      g.appendChild(el);
    }
    svg.appendChild(g);
    if (canvas.parentNode) { canvas.parentNode.insertBefore(svg, canvas); canvas.style.display = 'none'; }
  }

  /* ---------------------- WebGL wireframe blob ---------------------- */
  function initBlob(canvas) {
    var color = canvas.getAttribute('data-color') || '#f37021';
    var detail = parseInt(canvas.getAttribute('data-detail') || '5', 10);

    if (typeof THREE === 'undefined') { blobFallback(canvas, color); return; }

    var noise = makeNoise3D();
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) { blobFallback(canvas, color); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    // distance chosen so the fully-morphed blob (radius up to ~1.35) always
    // sits inside the frame with margin — avoids hard clipping at canvas edges
    camera.position.z = 4.4;

    var geometry = new THREE.IcosahedronGeometry(1, detail);
    var base = geometry.attributes.position.array.slice(0);
    var count = geometry.attributes.position.count;

    var material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), wireframe: true, transparent: true, opacity: 0.82 });
    var mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    function resize() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, r.width), h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    var pos = geometry.attributes.position;
    var v = new THREE.Vector3();

    function frame(t) {
      var time = t * 0.00016;
      var amp = 0.3, freq = 1.05;
      for (var i = 0; i < count; i++) {
        var ix = i * 3;
        v.set(base[ix], base[ix + 1], base[ix + 2]);
        var n = noise(v.x * freq + time, v.y * freq, v.z * freq - time);
        var n2 = noise(v.x * freq * 2.1, v.y * freq * 2.1 + time, v.z * freq * 2.1) * 0.4;
        var d = 1 + (n + n2) * amp;
        pos.array[ix] = v.x * d; pos.array[ix + 1] = v.y * d; pos.array[ix + 2] = v.z * d;
      }
      pos.needsUpdate = true;
      mesh.rotation.y = time * 1.4;
      mesh.rotation.x = Math.sin(time * 0.6) * 0.25;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }

    var raf;
    if (reduceMotion) { frame(0); cancelAnimationFrame(raf); renderer.render(scene, camera); }
    else raf = requestAnimationFrame(frame);
  }

  /* ---------------------- flowing line streams (portfolio) ---------------------- */
  function initLines(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W, H;
    function resize() {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    var LINES = 26;
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      var time = t * 0.00022;
      var cx = W * 0.62, cy = H * 0.5;
      for (var l = 0; l < LINES; l++) {
        var k = l / LINES;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(243,112,33,' + (0.10 + k * 0.32) + ')';
        ctx.lineWidth = 1;
        for (var x = -50; x <= W + 50; x += 8) {
          var nx = (x - cx) / (W * 0.5);
          var amp = H * (0.10 + k * 0.16);
          var y = cy
            + Math.sin(nx * 2.2 + time + l * 0.18) * amp
            + Math.sin(nx * 4.7 - time * 1.3 + l * 0.09) * amp * 0.4
            + (k - 0.5) * H * 0.12;
          if (x === -50) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    }
    var raf;
    if (reduceMotion) draw(0); else raf = requestAnimationFrame(draw);
  }

  /* ---------------------- boot ---------------------- */
  function boot() {
    document.querySelectorAll('canvas[data-blob]').forEach(function (c) { try { initBlob(c); } catch (e) {} });
    document.querySelectorAll('canvas[data-lines]').forEach(function (c) { try { initLines(c); } catch (e) {} });

    // mobile cards: swap absolute corner cards for stacked list under ~900px
    var mq = window.matchMedia('(max-width: 900px)');
    function applyCards() {
      var desk = document.querySelectorAll('.quad.desk');
      var mob = document.querySelector('.quads-mobile');
      var title = document.querySelector('.hero-title');
      if (!mob) return;
      if (mq.matches) {
        desk.forEach(function (d) { d.style.display = 'none'; });
        mob.style.display = 'flex';
      } else {
        desk.forEach(function (d) { d.style.display = ''; });
        mob.style.display = 'none';
      }
    }
    applyCards();
    mq.addEventListener ? mq.addEventListener('change', applyCards) : mq.addListener(applyCards);

    // nav toggle
    var toggle = document.getElementById('navToggle');
    var links = document.getElementById('navLinks');
    if (toggle && links) {
      toggle.addEventListener('click', function () { links.classList.toggle('open'); });
      links.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { links.classList.remove('open'); }); });
    }

    // scroll reveal
    var revs = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
      revs.forEach(function (r) { io.observe(r); });
    } else {
      revs.forEach(function (r) { r.classList.add('in'); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
