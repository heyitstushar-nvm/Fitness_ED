(function () {
  const canvas = document.getElementById('shareCanvas');
  const rail = document.getElementById('templateRail');
  const backgroundInput = document.getElementById('backgroundInput');
  const clearBgBtn = document.getElementById('clearBgBtn');

  const pickBgBtn = document.getElementById('pickBgBtn');
  const saveBtn = document.getElementById('saveBtn');
  const shareBtn = document.getElementById('shareBtn');

  // Crop modal elements
  const cropOverlay = document.getElementById('cropOverlay');
  const cropStage = document.getElementById('cropStage');
  const cropCanvas = document.getElementById('cropCanvas');
  const cropZoom = document.getElementById('cropZoom');
  const cropCancel = document.getElementById('cropCancel');
  const cropApply = document.getElementById('cropApply');

  const params = new URLSearchParams(window.location.search);
  const sessionId = Number(params.get('session_id'));

  let run = null;
  let backgroundImage = null;
  let currentTemplateId = 'pulse';

  // ---------- Helpers ----------
  const drawBackground = (ctx, w, h, gradStops) => {
    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0, w, h);
      const o = ctx.createLinearGradient(0, 0, 0, h);
      o.addColorStop(0, 'rgba(0,0,0,0.20)');
      o.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = o; ctx.fillRect(0, 0, w, h);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      gradStops.forEach((s) => g.addColorStop(s[0], s[1]));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  };

  const drawRoute = (ctx, x, y, w, h, points, color, thickness = 10) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (!points || points.length < 2) {
      ctx.globalAlpha = 0.35;
      ctx.strokeRect(x + 30, y + 30, w - 60, h - 60);
      ctx.restore();
      return;
    }
    const lats = points.map((p) => p[0]);
    const lngs = points.map((p) => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latRange = (maxLat - minLat) || 0.0001;
    const lngRange = (maxLng - minLng) || 0.0001;
    const latMid = (minLat + maxLat) / 2;
    const lngMid = (minLng + maxLng) / 2;
    const lngScale = Math.cos(latMid * Math.PI / 180);
    const trueLng = lngRange * lngScale;
    const pad = Math.min(w, h) * 0.12;
    const bw = w - pad * 2, bh = h - pad * 2;
    const scale = Math.min(bw / trueLng, bh / latRange);
    const cx = x + w / 2, cy = y + h / 2;
    const px = (lng) => cx + (lng - lngMid) * lngScale * scale;
    const py = (lat) => cy - (lat - latMid) * scale;

    ctx.beginPath();
    points.forEach((p, i) => {
      const X = px(p[1]), Y = py(p[0]);
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    });
    ctx.stroke();

    const start = points[0], end = points[points.length - 1];
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(px(start[1]), py(start[0]), thickness * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(px(end[1]), py(end[0]), thickness * 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const setShadow = (ctx, on) => {
    if (on) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 3;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
  };

  const drawBrand = (ctx, x, y, conf, size = 30) => {
    ctx.font = `700 ${size}px Space Grotesk`;
    ctx.fillStyle = conf.accent;
    ctx.fillText('FITNESS', x, y);
    const w1 = ctx.measureText('FITNESS').width;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('-', x + w1 + 4, y);
    const w2 = ctx.measureText('-').width;
    ctx.fillStyle = conf.route;
    ctx.fillText('ED', x + w1 + w2 + 8, y);
  };

  const stat = (ctx, label, value, x, y, conf, valSize = 56) => {
    ctx.fillStyle = conf.accent;
    ctx.font = '600 24px Space Grotesk';
    ctx.fillText(label, x, y);
    ctx.fillStyle = conf.text;
    ctx.font = `700 ${valSize}px Space Grotesk`;
    ctx.fillText(value, x, y + valSize + 6);
  };

  // ---------- Templates ----------
  const TEMPLATES = [
    {
      id: 'pulse',
      name: 'Pulse',
      colors: { route: '#84ffd1', accent: '#84ffd1', text: '#ffffff', grad: [[0, '#091613'], [1, '#12211f']] },
      draw(ctx, w, h, run, conf) {
        drawBackground(ctx, w, h, conf.grad);
        drawRoute(ctx, 60, 120, w - 120, h * 0.42, run.route_points, conf.route, 12);
        setShadow(ctx, true);
        const x = 80;
        let y = h * 0.62;
        stat(ctx, 'DISTANCE', `${Number(run.distance_km).toFixed(2)} km`, x, y, conf, 56); y += 130;
        stat(ctx, 'PACE / KM', run.pace_per_km, x, y, conf, 50); y += 120;
        stat(ctx, 'STEPS', Number(run.steps).toLocaleString(), x, y, conf, 50);
        drawBrand(ctx, x, h - 90, conf, 36);
        setShadow(ctx, false);
      },
    },
    {
      id: 'sunset',
      name: 'Sunset',
      colors: { route: '#ffc37f', accent: '#ffc37f', text: '#fff6ea', grad: [[0, '#3a1d10'], [0.5, '#7a3a1c'], [1, '#1c0e07']] },
      draw(ctx, w, h, run, conf) {
        drawBackground(ctx, w, h, conf.grad);
        // Route only takes the middle band so nothing overlaps the brand strip.
        drawRoute(ctx, 60, h * 0.48, w - 120, h * 0.34, run.route_points, conf.route, 11);
        setShadow(ctx, true);
        ctx.textAlign = 'right';
        const rx = w - 80;
        let y = 200;
        ctx.fillStyle = conf.accent; ctx.font = '600 26px Space Grotesk';
        ctx.fillText('DISTANCE', rx, y);
        ctx.fillStyle = conf.text; ctx.font = '700 130px Space Grotesk';
        ctx.fillText(`${Number(run.distance_km).toFixed(2)}`, rx, y + 130);
        ctx.font = '600 32px Space Grotesk'; ctx.fillStyle = conf.accent;
        ctx.fillText('KILOMETERS', rx, y + 175);
        // Stats row sits ABOVE the route so the brand can own the bottom strip.
        ctx.textAlign = 'left';
        const sy = h - 200;
        ctx.fillStyle = conf.text; ctx.font = '700 44px Space Grotesk';
        ctx.fillText(`${run.pace_per_km}  /  ${Number(run.steps).toLocaleString()} steps`, 80, sy);
        drawBrand(ctx, 80, h - 90, conf, 34);
        setShadow(ctx, false);
      },
    },
    {
      id: 'night',
      name: 'Night',
      colors: { route: '#8ab6ff', accent: '#8ab6ff', text: '#edf3ff', grad: [[0, '#06091a'], [1, '#101630']] },
      draw(ctx, w, h, run, conf) {
        drawBackground(ctx, w, h, conf.grad);
        drawRoute(ctx, 0, 0, w, h, run.route_points, conf.route, 8);
        // dim overlay so route reads as backdrop
        ctx.fillStyle = 'rgba(6,9,26,0.45)'; ctx.fillRect(0, 0, w, h);
        setShadow(ctx, true);
        ctx.textAlign = 'center';
        const cx = w / 2;
        ctx.fillStyle = conf.accent; ctx.font = '600 28px Space Grotesk';
        ctx.fillText('TONIGHT\u2019S RUN', cx, 240);
        ctx.fillStyle = conf.text; ctx.font = '700 180px Space Grotesk';
        ctx.fillText(`${Number(run.distance_km).toFixed(2)}`, cx, 440);
        ctx.font = '600 36px Space Grotesk'; ctx.fillStyle = conf.accent;
        ctx.fillText('KILOMETERS', cx, 500);

        // pace / steps row
        ctx.font = '700 56px Space Grotesk'; ctx.fillStyle = conf.text;
        ctx.fillText(`${run.pace_per_km}`, cx - 220, h - 380);
        ctx.fillText(`${Number(run.steps).toLocaleString()}`, cx + 220, h - 380);
        ctx.font = '600 22px Space Grotesk'; ctx.fillStyle = conf.accent;
        ctx.fillText('PACE / KM', cx - 220, h - 330);
        ctx.fillText('STEPS', cx + 220, h - 330);
        ctx.textAlign = 'left';
        drawBrand(ctx, cx - 130, h - 100, conf, 36);
        setShadow(ctx, false);
      },
    },
    {
      id: 'minimal',
      name: 'Minimal',
      colors: { route: '#ffffff', accent: '#ffffff', text: '#ffffff', grad: [[0, '#0a0a0a'], [1, '#1a1a1a']] },
      draw(ctx, w, h, run, conf) {
        drawBackground(ctx, w, h, conf.grad);
        drawRoute(ctx, 60, 100, w - 120, h * 0.45, run.route_points, conf.route, 6);
        // thin divider
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(80, h * 0.6, w - 160, 2);
        setShadow(ctx, true);
        const x = 80;
        let y = h * 0.65;
        ctx.fillStyle = '#ffffff'; ctx.font = '600 22px Space Grotesk';
        ctx.fillText('DISTANCE', x, y);
        ctx.font = '300 110px Space Grotesk';
        ctx.fillText(`${Number(run.distance_km).toFixed(2)} km`, x, y + 110);
        y += 200;
        ctx.font = '600 22px Space Grotesk';
        ctx.fillText(`PACE  ${run.pace_per_km}    /    STEPS  ${Number(run.steps).toLocaleString()}`, x, y);
        drawBrand(ctx, x, h - 90, conf, 30);
        setShadow(ctx, false);
      },
    },
    {
      id: 'card',
      name: 'Card',
      colors: { route: '#ffd07a', accent: '#ffb347', text: '#ffffff', grad: [[0, '#150f08'], [1, '#2a1c10']] },
      draw(ctx, w, h, run, conf) {
        drawBackground(ctx, w, h, conf.grad);
        drawRoute(ctx, 0, 0, w, h * 0.6, run.route_points, conf.route, 10);
        // glass card centered lower
        const cardW = w - 120, cardH = 760;
        const cx = 60, cy = h - cardH - 100;
        ctx.fillStyle = 'rgba(15,15,20,0.78)';
        roundRect(ctx, cx, cy, cardW, cardH, 36); ctx.fill();
        ctx.strokeStyle = 'rgba(255,179,71,0.35)'; ctx.lineWidth = 2;
        roundRect(ctx, cx, cy, cardW, cardH, 36); ctx.stroke();
        setShadow(ctx, false);
        const px = cx + 50;
        let py = cy + 80;
        ctx.fillStyle = conf.accent; ctx.font = '600 26px Space Grotesk';
        ctx.fillText('TODAY\u2019S RUN', px, py);
        ctx.fillStyle = conf.text; ctx.font = '700 130px Space Grotesk';
        const distStr = `${Number(run.distance_km).toFixed(2)}`;
        ctx.fillText(distStr, px, py + 130);
        const distW = ctx.measureText(distStr).width;
        ctx.font = '600 34px Space Grotesk'; ctx.fillStyle = conf.accent;
        ctx.fillText('km', px + distW + 16, py + 130);
        py += 230;
        // two-column stats
        const col2 = px + cardW / 2 - 30;
        stat(ctx, 'PACE / KM', run.pace_per_km, px, py, conf, 56);
        stat(ctx, 'STEPS', Number(run.steps).toLocaleString(), col2, py, conf, 56);
        py += 220;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(px, py, cardW - 100, 1);
        drawBrand(ctx, px, py + 60, conf, 32);
      },
    },
    {
      id: 'split',
      name: 'Split',
      colors: { route: '#ff7a59', accent: '#ff7a59', text: '#ffffff', grad: [[0, '#0a0a0c'], [1, '#1a1015']] },
      draw(ctx, w, h, run, conf) {
        drawBackground(ctx, w, h, conf.grad);
        // top half: stats stack
        setShadow(ctx, true);
        ctx.textAlign = 'left';
        const x = 80;
        let y = 180;
        ctx.fillStyle = conf.accent; ctx.font = '600 28px Space Grotesk';
        ctx.fillText('FRESH SPLIT', x, y); y += 90;
        ctx.fillStyle = conf.text; ctx.font = '700 160px Space Grotesk';
        const dStr = `${Number(run.distance_km).toFixed(2)}`;
        ctx.fillText(dStr, x, y);
        const dW = ctx.measureText(dStr).width;
        ctx.font = '600 36px Space Grotesk'; ctx.fillStyle = conf.accent;
        ctx.fillText('KM', x + dW + 18, y);
        y += 80;
        ctx.fillStyle = conf.text; ctx.font = '700 50px Space Grotesk';
        ctx.fillText(`${run.pace_per_km} pace`, x, y);
        y += 65;
        ctx.fillText(`${Number(run.steps).toLocaleString()} steps`, x, y);
        setShadow(ctx, false);
        // bottom half: route panel — leave a clear strip at the very bottom for the brand
        const ry = h * 0.55;
        const brandStrip = 130;
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, ry, w, h - ry - brandStrip);
        drawRoute(ctx, 40, ry + 30, w - 80, h - ry - brandStrip - 60, run.route_points, conf.route, 14);
        drawBrand(ctx, x, h - 60, conf, 34);
      },
    },
  ];

  // ---------- Util: rounded rect ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Drawing ----------
  const drawShare = () => {
    if (!run) return;
    const tpl = TEMPLATES.find((t) => t.id === currentTemplateId) || TEMPLATES[0];
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    tpl.draw(ctx, canvas.width, canvas.height, run, tpl.colors);
  };

  // ---------- Template thumbnails ----------
  const buildThumbnails = () => {
    rail.innerHTML = '';
    const sampleRun = run || {
      distance_km: 5.20, pace_per_km: '5:12', steps: 6800,
      route_points: [[0, 0], [0.001, 0.0008], [0.0015, 0.002], [0.003, 0.0019], [0.0035, 0.003]],
    };
    TEMPLATES.forEach((tpl) => {
      const card = document.createElement('div');
      card.className = 'template-card' + (tpl.id === currentTemplateId ? ' active' : '');
      card.dataset.id = tpl.id;
      const c = document.createElement('canvas');
      c.width = 270; c.height = 480;
      const cctx = c.getContext('2d');
      // draw using same template logic but smaller — temporarily disable bg image
      const realBg = backgroundImage; backgroundImage = null;
      tpl.draw(cctx, c.width, c.height, sampleRun, tpl.colors);
      backgroundImage = realBg;
      const name = document.createElement('div');
      name.className = 'tname';
      name.textContent = tpl.name;
      card.appendChild(c);
      card.appendChild(name);
      card.addEventListener('click', () => {
        currentTemplateId = tpl.id;
        document.querySelectorAll('.template-card').forEach((el) => el.classList.toggle('active', el.dataset.id === tpl.id));
        drawShare();
      });
      rail.appendChild(card);
    });
  };

  // ---------- Data ----------
  const loadRun = async () => {
    if (!sessionId) {
      buildThumbnails();
      return;
    }
    const res = await fetch(`/api/activity/session/${sessionId}`);
    if (!res.ok) {
      buildThumbnails();
      return;
    }
    const data = await res.json();
    run = data.session;
    buildThumbnails();
    drawShare();
  };

  // ---------- Cropping ----------
  // Target aspect 9:16 — same as the share canvas. Drag to pan, slider to zoom.
  const CROP_W = cropCanvas.width;
  const CROP_H = cropCanvas.height;
  let cropImg = null;
  let cropState = { scale: 1, baseScale: 1, offX: 0, offY: 0, dragging: false, lastX: 0, lastY: 0 };

  const renderCrop = () => {
    const cctx = cropCanvas.getContext('2d');
    cctx.fillStyle = '#000';
    cctx.fillRect(0, 0, CROP_W, CROP_H);
    if (!cropImg) return;
    const s = cropState.baseScale * cropState.scale;
    const dw = cropImg.width * s;
    const dh = cropImg.height * s;
    // Clamp pan so the image always covers the crop frame.
    const minX = CROP_W - dw, minY = CROP_H - dh;
    cropState.offX = Math.min(0, Math.max(minX, cropState.offX));
    cropState.offY = Math.min(0, Math.max(minY, cropState.offY));
    cctx.drawImage(cropImg, cropState.offX, cropState.offY, dw, dh);
  };

  const openCrop = (img) => {
    cropImg = img;
    // Base scale = "cover" the 9:16 frame.
    cropState.baseScale = Math.max(CROP_W / img.width, CROP_H / img.height);
    cropState.scale = 1;
    cropZoom.value = '1';
    const dw = img.width * cropState.baseScale;
    const dh = img.height * cropState.baseScale;
    cropState.offX = (CROP_W - dw) / 2;
    cropState.offY = (CROP_H - dh) / 2;
    cropOverlay.classList.add('open');
    renderCrop();
  };

  const closeCrop = () => { cropOverlay.classList.remove('open'); cropImg = null; };

  // Pointer drag for panning
  const stageToCanvas = (clientX, clientY) => {
    const rect = cropCanvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CROP_W / rect.width),
      y: (clientY - rect.top) * (CROP_H / rect.height),
    };
  };
  cropCanvas.addEventListener('pointerdown', (e) => {
    cropState.dragging = true;
    const p = stageToCanvas(e.clientX, e.clientY);
    cropState.lastX = p.x; cropState.lastY = p.y;
    cropCanvas.setPointerCapture(e.pointerId);
  });
  cropCanvas.addEventListener('pointermove', (e) => {
    if (!cropState.dragging) return;
    const p = stageToCanvas(e.clientX, e.clientY);
    cropState.offX += p.x - cropState.lastX;
    cropState.offY += p.y - cropState.lastY;
    cropState.lastX = p.x; cropState.lastY = p.y;
    renderCrop();
  });
  cropCanvas.addEventListener('pointerup', (e) => {
    cropState.dragging = false;
    try { cropCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
  });
  cropZoom.addEventListener('input', () => {
    const newScale = Number(cropZoom.value);
    // Zoom around the center of the crop frame.
    const cxOld = (CROP_W / 2 - cropState.offX) / (cropState.baseScale * cropState.scale);
    const cyOld = (CROP_H / 2 - cropState.offY) / (cropState.baseScale * cropState.scale);
    cropState.scale = newScale;
    cropState.offX = CROP_W / 2 - cxOld * cropState.baseScale * cropState.scale;
    cropState.offY = CROP_H / 2 - cyOld * cropState.baseScale * cropState.scale;
    renderCrop();
  });

  cropCancel.addEventListener('click', closeCrop);
  cropApply.addEventListener('click', () => {
    // Render the cropped result at the share canvas resolution (1080x1920).
    const out = document.createElement('canvas');
    out.width = 1080; out.height = 1920;
    const octx = out.getContext('2d');
    const ratio = 1080 / CROP_W;
    const s = cropState.baseScale * cropState.scale * ratio;
    const dw = cropImg.width * s;
    const dh = cropImg.height * s;
    octx.drawImage(cropImg, cropState.offX * ratio, cropState.offY * ratio, dw, dh);
    const finalImg = new Image();
    finalImg.onload = () => {
      backgroundImage = finalImg;
      buildThumbnails();
      drawShare();
    };
    finalImg.src = out.toDataURL('image/png');
    closeCrop();
  });

  const handleBackground = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => openCrop(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const clearBackground = () => {
    backgroundImage = null;
    backgroundInput.value = '';
    drawShare();
  };

  const fileName = () => `fitness-ed-story-${sessionId || Date.now()}.png`;

  const saveImage = () => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = fileName();
    a.click();
  };

  const shareCaption = () => {
    if (!run) return 'My FITNESS-ED activity. #fitnessed';
    return `I covered ${Number(run.distance_km).toFixed(2)} km at ${run.pace_per_km} pace with FITNESS-ED. #fitnessed #runstory`;
  };

  const canvasToBlob = () => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

  const shareImage = async () => {
    const blob = await canvasToBlob();
    if (!blob) { saveImage(); return; }
    const file = new File([blob], fileName(), { type: 'image/png' });
    const data = { title: 'My FITNESS-ED Story', text: shareCaption(), files: [file] };

    // Always save the photo first so the user has a copy on their device.
    saveImage();

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share(data); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    // Fallback: copy caption + tell the user the photo was saved.
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(shareCaption()); } catch (e) {}
    }
    if (typeof showToast === 'function') {
      showToast('Saved', 'Photo saved to your device. Caption copied — paste it in any app.');
    } else {
      alert('Photo saved to your device. Open any app and attach the saved image.');
    }
  };

  pickBgBtn.addEventListener('click', () => backgroundInput.click());
  backgroundInput.addEventListener('change', handleBackground);
  clearBgBtn.addEventListener('click', clearBackground);
  saveBtn.addEventListener('click', saveImage);
  shareBtn.addEventListener('click', shareImage);

  loadRun();
})();
