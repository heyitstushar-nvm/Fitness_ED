(function () {
  const sectionLinks = Array.from(document.querySelectorAll('.nav-link[data-section]'));
  const sections = {
    dashboard: document.getElementById('section-dashboard'),
    tracker: document.getElementById('section-tracker'),
  };

  const openSectionButtons = Array.from(document.querySelectorAll('[data-open-section]'));
  const initialSection = document.body.dataset.initialSection === 'tracker' ? 'tracker' : 'dashboard';

  const startButton = document.getElementById('startButton');
  const stopButton = document.getElementById('stopButton');
  const trackingStatus = document.getElementById('trackingStatus');
  const statusDot = document.getElementById('statusDot');
  const elapsedTime = document.getElementById('elapsedTime');
  const stepsValue = document.getElementById('stepsValue');
  const distanceValue = document.getElementById('distanceValue');
  const paceValue = document.getElementById('paceValue');
  const locationValue = document.getElementById('locationValue');
  const mapLabel = document.getElementById('mapLabel');

  const dashCalories = document.getElementById('dashCalories');
  const dashSessions = document.getElementById('dashSessions');
  const dashStreak = document.getElementById('dashStreak');
  const dashDistance = document.getElementById('dashDistance');
  const dashSteps = document.getElementById('dashSteps');
  const dashMinutes = document.getElementById('dashMinutes');

  const shareTemplate = document.getElementById('shareTemplate');
  const shareBackground = document.getElementById('shareBackground');
  const shareCanvas = document.getElementById('shareCanvas');
  const downloadShare = document.getElementById('downloadShare');
  const shareWhatsapp = document.getElementById('shareWhatsapp');
  const shareInstagram = document.getElementById('shareInstagram');
  const shareSnapchat = document.getElementById('shareSnapchat');

  let watchId = null;
  let startTimestamp = null;
  let timerId = null;
  let totalDistanceMeters = 0;
  let routePoints = [];
  let startMarker = null;
  let liveMarker = null;
  let activeSection = initialSection;
  let progressChart = null;

  const map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  const routeLine = L.polyline([], {
    color: '#4ef2b3',
    weight: 5,
    opacity: 0.9,
  }).addTo(map);

  const formatElapsed = (seconds) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const formatPace = () => {
    if (!startTimestamp || totalDistanceMeters < 10) return '0:00';
    const elapsedSeconds = (Date.now() - startTimestamp) / 1000;
    const paceSeconds = elapsedSeconds / (totalDistanceMeters / 1000);
    const mins = Math.floor(paceSeconds / 60);
    const secs = Math.floor(paceSeconds % 60)
      .toString()
      .padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const setTrackingState = (active, text) => {
    trackingStatus.textContent = text;
    statusDot.classList.toggle('live', active);
    mapLabel.textContent = active ? 'Tracking live' : 'Map ready';
  };

  const updateStats = (lat, lng) => {
    const estimatedSteps = Math.max(0, Math.round(totalDistanceMeters / 0.78));
    stepsValue.textContent = estimatedSteps.toLocaleString();
    distanceValue.textContent = `${(totalDistanceMeters / 1000).toFixed(2)} km`;
    paceValue.textContent = formatPace();
    locationValue.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    drawShareTemplate();
  };

  const resetTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  };

  const updateTimer = () => {
    if (!startTimestamp) {
      elapsedTime.textContent = '00:00';
      return;
    }
    elapsedTime.textContent = formatElapsed((Date.now() - startTimestamp) / 1000);
    paceValue.textContent = formatPace();
    drawShareTemplate();
  };

  const handlePosition = (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    const nextPoint = [latitude, longitude];

    if (routePoints.length > 0) {
      totalDistanceMeters += map.distance(routePoints[routePoints.length - 1], nextPoint);
    } else {
      startMarker = L.marker(nextPoint).addTo(map).bindPopup('Start point');
    }

    routePoints.push(nextPoint);
    routeLine.setLatLngs(routePoints);

    if (!liveMarker) {
      liveMarker = L.circleMarker(nextPoint, {
        radius: 8,
        color: '#ffd36e',
        fillColor: '#ffd36e',
        fillOpacity: 0.9,
      }).addTo(map);
    } else {
      liveMarker.setLatLng(nextPoint);
    }

    if (routePoints.length > 1) {
      map.fitBounds(routeLine.getBounds(), {
        padding: [28, 28],
        maxZoom: 17,
      });
    }

    mapLabel.textContent = `Accuracy +/- ${Math.round(accuracy)} m`;
    updateStats(latitude, longitude);
  };

  const logSessionToBackend = async () => {
    if (!startTimestamp) return;

    const durationSeconds = Math.round((Date.now() - startTimestamp) / 1000);
    const distanceKm = totalDistanceMeters / 1000;
    const steps = Math.max(0, Math.round(totalDistanceMeters / 0.78));

    if (durationSeconds < 10 && distanceKm < 0.03) return;

    try {
      const res = await fetch('/api/activity/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_seconds: durationSeconds,
          distance_km: Number(distanceKm.toFixed(3)),
          steps,
        }),
      });

      if (res.ok) {
        showToast('Session saved', 'Dashboard metrics updated for today.');
        loadDashboardSummary();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setTrackingState(false, 'Geolocation not supported');
      return;
    }

    resetTracking();
    totalDistanceMeters = 0;
    routePoints = [];
    routeLine.setLatLngs([]);
    stepsValue.textContent = '0';
    distanceValue.textContent = '0.00 km';
    paceValue.textContent = '0:00';

    if (startMarker) {
      map.removeLayer(startMarker);
      startMarker = null;
    }

    if (liveMarker) {
      map.removeLayer(liveMarker);
      liveMarker = null;
    }

    startTimestamp = Date.now();
    elapsedTime.textContent = '00:00';
    updateTimer();
    timerId = window.setInterval(updateTimer, 1000);
    setTrackingState(true, 'Tracking in progress');

    watchId = navigator.geolocation.watchPosition(
      handlePosition,
      (error) => {
        const messages = {
          1: 'Location permission denied',
          2: 'Location unavailable',
          3: 'Location request timed out',
        };
        setTrackingState(false, messages[error.code] || 'Unable to fetch location');
        resetTracking();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );
  };

  const stopTracking = async () => {
    resetTracking();
    setTrackingState(false, routePoints.length ? 'Tracking stopped' : 'Waiting to start');
    await logSessionToBackend();
    startTimestamp = null;
  };

  const openSection = (sectionName) => {
    activeSection = sectionName;
    Object.entries(sections).forEach(([name, el]) => {
      el.classList.toggle('active', name === sectionName);
    });

    sectionLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.section === sectionName);
    });

    if (sectionName === 'tracker') {
      window.setTimeout(() => map.invalidateSize(), 120);
    }
  };

  const initChart = () => {
    const ctx = document.getElementById('progressChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(78, 242, 179, 0.4)');
    gradient.addColorStop(1, 'rgba(78, 242, 179, 0.0)');

    progressChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Active Minutes',
            data: [0, 0, 0, 0, 0, 0, 0],
            borderColor: '#4ef2b3',
            backgroundColor: gradient,
            borderWidth: 3,
            tension: 0.35,
            pointBackgroundColor: '#071311',
            pointBorderColor: '#4ef2b3',
            pointBorderWidth: 2,
            pointRadius: 4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(4, 13, 11, 0.9)',
            titleColor: '#fff',
            bodyColor: '#4ef2b3',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label(context) {
                return `${context.parsed.y} minutes`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Space Grotesk' } },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
            ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Space Grotesk' } },
          },
        },
      },
    });
  };

  const loadDashboardSummary = async () => {
    try {
      const response = await fetch('/api/activity/summary');
      if (!response.ok) return;
      const data = await response.json();

      dashCalories.textContent = Number(data.today.calories || 0).toLocaleString();
      dashSessions.textContent = Number(data.sessions_week || 0).toLocaleString();
      dashStreak.textContent = `${data.streak_days || 0} Days`;
      dashDistance.textContent = `${Number(data.today.distance_km || 0).toFixed(2)} km`;
      dashSteps.textContent = Number(data.today.steps || 0).toLocaleString();
      dashMinutes.textContent = `${Number(data.today.active_minutes || 0)} min`;

      if (progressChart) {
        progressChart.data.labels = data.chart.labels;
        progressChart.data.datasets[0].data = data.chart.active_minutes;
        progressChart.update();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getTemplateConfig = () => {
    const templateKey = shareTemplate.value;
    const backgroundKey = shareBackground.value;

    const templates = {
      summit: { accent: '#8ef4ca', secondary: '#ffd36e' },
      sunset: { accent: '#ffb36d', secondary: '#ffd4a8' },
      night: { accent: '#8db8ff', secondary: '#66ffd7' },
    };

    const backgrounds = {
      gradient: ['#08110f', '#11372f'],
      forest: ['#0e2f1f', '#14261b'],
      city: ['#131a29', '#1e344d'],
    };

    return {
      ...templates[templateKey],
      bg: backgrounds[backgroundKey],
    };
  };

  const drawRoutePreview = (ctx, x, y, width, height, color) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (routePoints.length < 2) {
      ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '34px Space Grotesk';
      ctx.fillText('Start a run to draw route', x + 36, y + height / 2);
      ctx.restore();
      return;
    }

    const lats = routePoints.map((p) => p[0]);
    const lngs = routePoints.map((p) => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = maxLat - minLat || 0.0001;
    const lngRange = maxLng - minLng || 0.0001;

    ctx.beginPath();
    routePoints.forEach((point, index) => {
      const px = x + ((point[1] - minLng) / lngRange) * width;
      const py = y + height - ((point[0] - minLat) / latRange) * height;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    const start = routePoints[0];
    const end = routePoints[routePoints.length - 1];
    const startX = x + ((start[1] - minLng) / lngRange) * width;
    const startY = y + height - ((start[0] - minLat) / latRange) * height;
    const endX = x + ((end[1] - minLng) / lngRange) * width;
    const endY = y + height - ((end[0] - minLat) / latRange) * height;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(startX, startY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffd36e';
    ctx.beginPath();
    ctx.arc(endX, endY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawShareTemplate = () => {
    const ctx = shareCanvas.getContext('2d');
    const { accent, secondary, bg } = getTemplateConfig();
    const width = shareCanvas.width;
    const height = shareCanvas.height;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, bg[0]);
    gradient.addColorStop(1, bg[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(70, 90, width - 140, 740);
    drawRoutePreview(ctx, 110, 140, width - 220, 640, accent);

    const distanceKm = (totalDistanceMeters / 1000).toFixed(2);
    const steps = Math.round(totalDistanceMeters / 0.78).toLocaleString();
    const pace = formatPace();
    const timerText = elapsedTime.textContent;

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 62px Space Grotesk';
    ctx.fillText('FITNESS ED TRACKER', 80, 920);

    ctx.font = '500 36px Space Grotesk';
    ctx.fillStyle = secondary;
    ctx.fillText(`Template: ${shareTemplate.options[shareTemplate.selectedIndex].text}`, 80, 980);

    const stats = [
      { label: 'Distance', value: `${distanceKm} km` },
      { label: 'Pace / km', value: pace },
      { label: 'Steps', value: steps },
      { label: 'Time', value: timerText },
    ];

    stats.forEach((stat, index) => {
      const rowY = 1080 + index * 180;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(80, rowY, width - 160, 140);
      ctx.fillStyle = accent;
      ctx.font = '500 34px Space Grotesk';
      ctx.fillText(stat.label, 120, rowY + 56);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 52px Space Grotesk';
      ctx.fillText(stat.value, 120, rowY + 110);
    });
  };

  const downloadShareCard = () => {
    const link = document.createElement('a');
    link.href = shareCanvas.toDataURL('image/png');
    link.download = `fitness-ed-run-${Date.now()}.png`;
    link.click();
  };

  const shareText = () => {
    const distanceKm = (totalDistanceMeters / 1000).toFixed(2);
    return `Today I covered ${distanceKm} km at ${formatPace()} pace with FITNESS ED.`;
  };

  const shareToWhatsapp = () => {
    const text = encodeURIComponent(shareText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const tryNativeShare = async (platformName) => {
    const text = `${shareText()} #fitness #tracker`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My FITNESS ED Run',
          text,
        });
        return;
      } catch (error) {
        console.error(error);
      }
    }

    navigator.clipboard.writeText(text).then(() => {
      showToast(platformName, `Caption copied. Open ${platformName} and upload downloaded template.`);
    });
  };

  sectionLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openSection(link.dataset.section);
    });
  });

  openSectionButtons.forEach((button) => {
    button.addEventListener('click', () => openSection(button.dataset.openSection));
  });

  startButton.addEventListener('click', startTracking);
  stopButton.addEventListener('click', stopTracking);

  shareTemplate.addEventListener('change', drawShareTemplate);
  shareBackground.addEventListener('change', drawShareTemplate);
  downloadShare.addEventListener('click', downloadShareCard);
  shareWhatsapp.addEventListener('click', shareToWhatsapp);
  shareInstagram.addEventListener('click', () => tryNativeShare('Instagram'));
  shareSnapchat.addEventListener('click', () => tryNativeShare('Snapchat'));

  initChart();
  loadDashboardSummary();
  openSection(initialSection);
  drawShareTemplate();
})();
