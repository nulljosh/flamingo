// Footer band: Flamingo's own things in a row (a pin, the search glass, a palm, a mission flag, the map, a sparkle),
// printed like an old screen, after Keyrate's band. The glyphs fill with an ordered (Bayer) dither whose density rolls
// across them in a slow wave, a brighter beam sweeps down, and faint scanlines crawl over the band. Plain 2D canvas.
(function () {
  var band = document.querySelector('.word-band'), canvas = band && band.querySelector('canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Each glyph is drawn white on a 100 unit square.
  var GLYPHS = [
    function (c) { // a pin
      c.beginPath(); c.moveTo(50, 92); c.bezierCurveTo(30, 66, 20, 52, 20, 38); c.arc(50, 38, 30, Math.PI, 0); c.bezierCurveTo(80, 52, 70, 66, 50, 92); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(50, 38, 11, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
    },
    function (c) { // the search glass
      c.lineWidth = 10; c.beginPath(); c.arc(42, 42, 24, 0, 7); c.stroke(); c.lineCap = 'round'; c.lineWidth = 12; c.beginPath(); c.moveTo(60, 60); c.lineTo(82, 82); c.stroke();
    },
    function (c) { // a palm
      c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(52, 92); c.quadraticCurveTo(56, 60, 50, 36); c.stroke();
      [[-1, 0], [1, 0], [-1, 1], [1, 1]].forEach(function (f) { c.beginPath(); c.moveTo(50, 34); c.quadraticCurveTo(50 + f[0] * 22, 14 + f[1] * 16, 50 + f[0] * 42, 30 + f[1] * 22); c.quadraticCurveTo(50 + f[0] * 24, 26 + f[1] * 12, 50, 36); c.fill(); });
    },
    function (c) { // a flag: missions
      c.fillRect(24, 12, 8, 80); c.beginPath(); c.moveTo(32, 14); c.lineTo(82, 14); c.lineTo(70, 32); c.lineTo(82, 50); c.lineTo(32, 50); c.fill();
    },
    function (c) { // the map
      c.beginPath(); c.moveTo(12, 24); c.lineTo(38, 14); c.lineTo(62, 24); c.lineTo(88, 14); c.lineTo(88, 76); c.lineTo(62, 86); c.lineTo(38, 76); c.lineTo(12, 86); c.closePath(); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.fillRect(36, 16, 4, 62); c.fillRect(60, 22, 4, 62); c.globalCompositeOperation = 'source-over';
    },
    function (c) { // a sparkle: collectibles
      c.beginPath(); c.moveTo(50, 10); c.quadraticCurveTo(54, 46, 90, 50); c.quadraticCurveTo(54, 54, 50, 90); c.quadraticCurveTo(46, 54, 10, 50); c.quadraticCurveTo(46, 46, 50, 10); c.fill();
    }
  ];
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; // 4x4 ordered dither thresholds

  function layer(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  var W, H, dpr, tileW, mask, shade, work, wc, levels, scan, cell;
  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(canvas.clientWidth * dpr); H = Math.round(canvas.clientHeight * dpr);
    if (!W || !H) return false;
    canvas.width = W; canvas.height = H;
    var colour = getComputedStyle(band).color;
    // one row of glyphs, spaced a little wider than the band so the row can loop sideways without a seam
    var size = Math.min(H * 0.82, W / 5.2), gap = size * 0.55;
    tileW = Math.round(GLYPHS.length * (size + gap));
    mask = layer(tileW, H);
    var m = mask.getContext('2d'); m.fillStyle = m.strokeStyle = '#fff';
    GLYPHS.forEach(function (draw, i) {
      m.save(); m.translate(i * (size + gap) + gap / 2, (H - size) / 2); m.scale(size / 100, size / 100); draw(m); m.restore();
    });
    // the edge facing away from the light, for a cut-in look
    var s = Math.max(2, H * 0.014);
    shade = layer(tileW, H); var sc = shade.getContext('2d');
    sc.drawImage(mask, 0, 0); sc.globalCompositeOperation = 'destination-out'; sc.drawImage(mask, -s, -s);
    // 17 dither levels as repeating patterns, each Bayer cell `px` device pixels square
    var px = Math.max(2, Math.round(dpr * 1.5));
    cell = px * 4;
    levels = [];
    for (var L = 0; L <= 16; L++) {
      var p = layer(cell, cell), pc = p.getContext('2d'); pc.fillStyle = colour;
      for (var b = 0; b < 16; b++) if (BAYER[b] < L) pc.fillRect((b % 4) * px, Math.floor(b / 4) * px, px, px);
      levels.push(ctx.createPattern(p, 'repeat'));
    }
    // scanlines: one thin rule every few pixels
    var pitch = Math.max(3, Math.round(3 * dpr)), sl = layer(1, pitch), slc = sl.getContext('2d');
    slc.fillStyle = colour; slc.fillRect(0, 0, 1, Math.max(1, Math.round(dpr * 0.75)));
    scan = { pattern: ctx.createPattern(sl, 'repeat'), pitch: pitch };
    work = layer(W, H); wc = work.getContext('2d');
    return true;
  }

  function frame(t) {
    var sec = t / 1000;
    // sideways: the page scroll moves the row, and it drifts slowly on its own
    var ox = ((scrollY * 0.6 + (still ? 0 : sec * 18)) * dpr) % tileW;
    // the beam: a soft bright band sweeping down every 3.2 s
    var beam = still ? -1 : ((sec % 3.2) / 3.2) * (H * 1.6) - H * 0.3;

    // 1. dithered glyph fill on the work layer: cells of the band pick a dither level from a rolling wave plus the beam
    wc.globalCompositeOperation = 'source-over'; wc.clearRect(0, 0, W, H);
    var step = cell * 3;
    for (var y = 0; y < H; y += step) {
      var beamLift = beam < 0 ? 0 : Math.max(0, 1 - Math.abs(y + step / 2 - beam) / (H * 0.22)) * 6;
      for (var x = 0; x < W; x += step) {
        var wave = Math.sin((x + ox) / (W * 0.18) - sec * 1.3) * 0.5 + Math.sin((y / H) * 3 + sec * 0.7) * 0.25;
        var L = Math.max(2, Math.min(16, Math.round(7 + wave * 7 + beamLift))); // mostly mid-tones, so the dots read
        wc.fillStyle = levels[L];
        wc.fillRect(x, y, step, step);
      }
    }
    wc.globalCompositeOperation = 'destination-in';
    wc.drawImage(mask, -ox, 0); wc.drawImage(mask, tileW - ox, 0); if (tileW * 2 - ox < W) wc.drawImage(mask, tileW * 2 - ox, 0);

    // 2. compose: crawling scanlines across the band, the dithered glyphs, then the solid shadow edge
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H);
    var off = still ? 0 : (sec * 14 * dpr) % scan.pitch;
    ctx.save(); ctx.globalAlpha = 0.22; ctx.translate(0, off); ctx.fillStyle = scan.pattern; ctx.fillRect(0, -scan.pitch, W, H + scan.pitch * 2); ctx.restore();
    ctx.drawImage(work, 0, 0);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(shade, -ox, 0); ctx.drawImage(shade, tileW - ox, 0); if (tileW * 2 - ox < W) ctx.drawImage(shade, tileW * 2 - ox, 0);
    ctx.globalAlpha = 1;
    // scanlines cut through the glyphs too, so they read as one screen
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 0.35; ctx.translate(0, off + scan.pitch / 2);
    ctx.fillStyle = scan.pattern; ctx.fillRect(0, -scan.pitch, W, H + scan.pitch * 2); ctx.restore();
    // fade toward the legal line and in from both sides
    ctx.globalCompositeOperation = 'destination-in';
    var g = ctx.createLinearGradient(0, H * 0.84, 0, H); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var gx = ctx.createLinearGradient(0, 0, W, 0);
    gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.08, '#000'); gx.addColorStop(0.92, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gx; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  band.classList.add('live'); // the canvas is display:none until then, so measure after
  if (!build()) { band.classList.remove('live'); return; }
  frame(0);

  var on = false, raf = 0;
  function loop(t) { if (!on) { raf = 0; return; } frame(t); raf = requestAnimationFrame(loop); }
  if (!still) new IntersectionObserver(function (e) { on = e[0].isIntersecting; if (on && !raf) raf = requestAnimationFrame(loop); }).observe(band);
  else addEventListener('scroll', function () { frame(0); }, { passive: true });

  var drawnW = W;
  function rebuild() { if (build()) { drawnW = W; frame(performance.now()); } }
  // iOS fires resize as the toolbar slides; only a width change needs a rebuild
  addEventListener('resize', function () { if (Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2)) !== drawnW) rebuild(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rebuild);
})();
