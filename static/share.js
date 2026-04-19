(function () {
  const templateSelect = document.getElementById('templateSelect');
  const verticalSelect = document.getElementById('verticalSelect');
  const horizontalSelect = document.getElementById('horizontalSelect');
  const backgroundInput = document.getElementById('backgroundInput');
  const canvas = document.getElementById('shareCanvas');

  const saveBtn = document.getElementById('saveBtn');
  const igBtn = document.getElementById('igBtn');
  const snapBtn = document.getElementById('snapBtn');
  const waBtn = document.getElementById('waBtn');

  const params = new URLSearchParams(window.location.search);
  const sessionId = Number(params.get('session_id'));

  let run = null;
  let backgroundImage = null;

  const templateConfig = () => {
    const set = {
      summit: { route: '#84ffd1', block: 'rgba(10, 27, 23, 0.82)', accent: '#84ffd1', text: '#e9fff6' },
      sunset: { route: '#ffc37f', block: 'rgba(36, 20, 12, 0.82)', accent: '#ffc37f', text: '#fff6ea' },
      night: { route: '#8ab6ff', block: 'rgba(14, 22, 40, 0.82)', accent: '#8ab6ff', text: '#edf3ff' },
    };
    return set[templateSelect.value];
  };

  const drawRouteOnlyTop = (ctx, width, topHeight, points, color) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (!points || points.length < 2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.strokeRect(64, 64, width - 128, topHeight - 128);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '600 40px Space Grotesk';
      ctx.fillText('Route preview unavailable', 120, topHeight / 2);
      ctx.restore();
      return;
    }

    const lats = points.map((p) => p[0]);
    const lngs = points.map((p) => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latRange = maxLat - minLat || 0.0001;
    const lngRange = maxLng - minLng || 0.0001;

    // Aspect ratio correction (lng depends on lat)
    const latMid = (minLat + maxLat) / 2;
    const lngScale = Math.cos(latMid * Math.PI / 180);
    const trueLngRange = lngRange * lngScale;

    // Increased padding to make the route look better and not overwhelmingly big
    const padding = 300;
    const boxWidth = width - padding * 2;
    const boxHeight = topHeight - padding * 2;

    const scaleX = boxWidth / trueLngRange;
    const scaleY = boxHeight / latRange;
    const scale = Math.min(scaleX, scaleY);

    const cx = width / 2;
    const cy = topHeight / 2;
    const lngMid = (minLng + maxLng) / 2;

    const px = (lng) => cx + (lng - lngMid) * lngScale * scale;
    const py = (lat) => cy - (lat - latMid) * scale;

    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(px(p[1]), py(p[0]));
      else ctx.lineTo(px(p[1]), py(p[0]));
    });
    ctx.stroke();

    const start = points[0];
    const end = points[points.length - 1];
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px(start[1]), py(start[0]), 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd36e'; ctx.beginPath(); ctx.arc(px(end[1]), py(end[0]), 12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const drawShare = () => {
    if (!run) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const conf = templateConfig();

    if (backgroundImage) {
      ctx.drawImage(backgroundImage, 0, 0, width, height);
      const overlay = ctx.createLinearGradient(0, 0, 0, height);
      overlay.addColorStop(0, 'rgba(0,0,0,0.15)');
      overlay.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, width, height);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#091613');
      gradient.addColorStop(1, '#12211f');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    const topHeight = Math.round(height * 0.18);
    drawRouteOnlyTop(ctx, width, topHeight, run.route_points || [], conf.route);

    const cardWidth = 520;
    const cardHeight = 430;
    const cardX = horizontalSelect.value === 'left' ? 56 : width - cardWidth - 56;
    const cardY = verticalSelect.value === 'top' ? topHeight + 24 : height - cardHeight - 72;

    ctx.fillStyle = conf.block;
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

    ctx.fillStyle = conf.accent;
    ctx.font = '600 30px Space Grotesk';
    ctx.fillText('DISTANCE', cardX + 28, cardY + 56);
    ctx.fillStyle = conf.text;
    ctx.font = '700 62px Space Grotesk';
    ctx.fillText(`${Number(run.distance_km).toFixed(2)} km`, cardX + 28, cardY + 120);

    ctx.fillStyle = conf.accent;
    ctx.font = '600 26px Space Grotesk';
    ctx.fillText('PACE / KM', cardX + 28, cardY + 182);
    ctx.fillStyle = conf.text;
    ctx.font = '700 48px Space Grotesk';
    ctx.fillText(run.pace_per_km, cardX + 28, cardY + 236);

    ctx.fillStyle = conf.accent;
    ctx.font = '600 26px Space Grotesk';
    ctx.fillText('STEPS', cardX + 28, cardY + 292);
    ctx.fillStyle = conf.text;
    ctx.font = '700 48px Space Grotesk';
    ctx.fillText(Number(run.steps).toLocaleString(), cardX + 28, cardY + 346);

    ctx.fillStyle = conf.text;
    ctx.font = '600 28px Space Grotesk';
    ctx.fillText('FITNESS-ED', cardX + 28, cardY + 400);
  };

  const loadRun = async () => {
    if (!sessionId) {
      showToast('Share', 'Session not selected.');
      return;
    }

    const res = await fetch(`/api/activity/session/${sessionId}`);
    if (!res.ok) {
      showToast('Share', 'Session not found.');
      return;
    }

    const data = await res.json();
    run = data.session;
    drawShare();
  };

  const handleBackground = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      backgroundImage = null;
      drawShare();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        backgroundImage = img;
        drawShare();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const saveImage = () => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `fitness-ed-story-${sessionId || Date.now()}.png`;
    a.click();
  };

  const shareText = () => {
    if (!run) return 'My FITNESS-ED activity.';
    return `I covered ${Number(run.distance_km).toFixed(2)} km at ${run.pace_per_km} pace with FITNESS-ED.`;
  };

  const shareWA = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, '_blank');
  };

  const nativeShare = async (platform) => {
    const text = `${shareText()} #fitnessed #runstory`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My FITNESS-ED Story', text });
        return;
      } catch (err) {
        console.error(err);
      }
    }
    navigator.clipboard.writeText(text).then(() => showToast(platform, `Caption copied. Open ${platform} and upload saved image.`));
  };

  [templateSelect, verticalSelect, horizontalSelect].forEach((el) => el.addEventListener('change', drawShare));
  backgroundInput.addEventListener('change', handleBackground);

  saveBtn.addEventListener('click', saveImage);
  igBtn.addEventListener('click', () => nativeShare('Instagram Stories'));
  snapBtn.addEventListener('click', () => nativeShare('Snapchat'));
  waBtn.addEventListener('click', shareWA);

  loadRun();
})();
