(function () {
  const sectionLinks = Array.from(document.querySelectorAll('.nav-link[data-section]'));
  const sections = { dashboard: document.getElementById('section-dashboard'), tracker: document.getElementById('section-tracker') };
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
  const historyList = document.getElementById('historyList');

  const dashCalories = document.getElementById('dashCalories');
  const dashSessions = document.getElementById('dashSessions');
  const dashStreak = document.getElementById('dashStreak');
  const dashDistance = document.getElementById('dashDistance');
  const dashSteps = document.getElementById('dashSteps');
  const dashMinutes = document.getElementById('dashMinutes');
  const userMenuBtn = document.getElementById('userMenuBtn');
  const profileMenu = document.getElementById('profileMenu');
  const profileMenuName = document.getElementById('profileMenuName');
  const profileMenuEmail = document.getElementById('profileMenuEmail');
  const profileAvatarPreview = document.getElementById('profileAvatarPreview');
  const profileAvatarFallback = document.getElementById('profileAvatarFallback');
  const profileManageBtn = document.getElementById('profileManageBtn');
  const profileSettingsBtn = document.getElementById('profileSettingsBtn');
  const profilePhotoBtn = document.getElementById('profilePhotoBtn');
  const profilePhotoInput = document.getElementById('profilePhotoInput');
  const profileCropOverlay = document.getElementById('profileCropOverlay');
  const cropCanvas = document.getElementById('profileCropCanvas');
  const roundPreview = document.getElementById('profileRoundPreview');
  const zoomRange = document.getElementById('cropZoomRange');
  const cropCancelBtn = document.getElementById('cropCancelBtn');
  const cropSaveBtn = document.getElementById('cropSaveBtn');

  let watchId = null;
  let sessionStartedAt = null;
  let timerId = null;
  let totalDistanceMeters = 0;
  let routePoints = [];
  let startMarker = null;
  let liveMarker = null;
  let progressChart = null;
  let baseSummary = null;
  let recentHistory = [];
  let mobileTrackerBanner = null;
  let profileState = { username: '', email: '', avatar_data: '' };
  let cropImage = null;
  let cropScale = 1.2;
  let cropX = 0;
  let cropY = 0;
  let draggingCrop = false;
  let dragStartX = 0;
  let dragStartY = 0;

  const map = L.map('map', { zoomControl: false }).setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const routeLine = L.polyline([], { color: '#4ef2b3', weight: 5, opacity: 0.9 }).addTo(map);

  const formatElapsed = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const paceToSeconds = (text) => {
    const p = String(text || '0:00').split(':');
    return p.length === 2 ? Number(p[0]) * 60 + Number(p[1]) : 0;
  };
  const formatPace = (distanceMeters = totalDistanceMeters, startedAt = sessionStartedAt) => {
    if (!startedAt || distanceMeters < 10) return '0:00';
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    const paceSeconds = elapsedSeconds / (distanceMeters / 1000);
    return `${Math.floor(paceSeconds / 60)}:${String(Math.floor(paceSeconds % 60)).padStart(2, '0')}`;
  };
  const estimateLiveCalories = (distanceKm, activeMinutes) => Math.max(0, Math.round(distanceKm * 62 + activeMinutes * 3.5));

  const getLiveSnapshot = () => {
    const durationSeconds = sessionStartedAt ? Math.round((Date.now() - sessionStartedAt) / 1000) : 0;
    const distanceKm = totalDistanceMeters / 1000;
    // Use 1.35m per step â€” accurate for running/jogging cadence
    const steps = Math.max(0, Math.round(totalDistanceMeters / 1.35));
    const activeMinutes = Math.max(0, Math.round(durationSeconds / 60));
    return {
      distance_km: Number(distanceKm.toFixed(2)),
      steps,
      active_minutes: activeMinutes,
      calories: estimateLiveCalories(distanceKm, activeMinutes),
    };
  };

  const syncDashboardCards = () => {
    if (!baseSummary) return;
    const today = { ...baseSummary.today };
    if (sessionStartedAt) {
      const live = getLiveSnapshot();
      today.distance_km = Number(today.distance_km || 0) + live.distance_km;
      today.steps = Number(today.steps || 0) + live.steps;
      today.active_minutes = Number(today.active_minutes || 0) + live.active_minutes;
      today.calories = Number(today.calories || 0) + live.calories;
    }
    dashCalories.textContent = Math.round(today.calories || 0).toLocaleString();
    dashSessions.textContent = Number(baseSummary.sessions_week || 0).toLocaleString();
    const streakCount = Number(baseSummary.streak_days || 0);
    dashStreak.textContent = `${streakCount} ${streakCount === 1 ? 'Day' : 'Days'}`;
    dashDistance.textContent = `${Number(today.distance_km || 0).toFixed(2)} km`;
    dashSteps.textContent = Math.round(today.steps || 0).toLocaleString();
    dashMinutes.textContent = `${Math.round(today.active_minutes || 0)} min`;

    // Progress Now widget â€” uses customizable goals
    const stepsVal = Math.round(today.steps || 0);
    const distanceVal = Number(today.distance_km || 0);
    const activeMin = Number(today.active_minutes || 0);

    // Live pace if tracking; otherwise today's avg pace from accumulated minutes/distance
    let paceSecPerKm = 0;
    if (sessionStartedAt && totalDistanceMeters >= 50) {
      paceSecPerKm = (Date.now() - sessionStartedAt) / 1000 / (totalDistanceMeters / 1000);
    } else if (distanceVal > 0 && activeMin > 0) {
      paceSecPerKm = (activeMin * 60) / distanceVal;
    }

    const setProg = (id, val, pct) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
      const bar = document.getElementById(id + 'Bar');
      if (bar) bar.style.width = Math.min(100, Math.max(0, pct)) + '%';
    };
    setProg('progSteps', stepsVal.toLocaleString(), (stepsVal / goals.steps) * 100);
    setProg('progDistance', distanceVal.toFixed(2), (distanceVal / goals.distance) * 100);
    if (paceSecPerKm > 0) {
      setProg('progPace', formatPaceSeconds(paceSecPerKm), (goals.pace / paceSecPerKm) * 100);
    } else {
      const el = document.getElementById('progPace');
      if (el) el.textContent = '--:--';
      const bar = document.getElementById('progPaceBar');
      if (bar) bar.style.width = '0%';
    }
  };

  // ---------- Customizable goals ----------
  const STEP_LENGTH_M = 1.35; // shared with tracking
  const GOALS_KEY = 'fitnessed.goals';
  const defaultGoals = { steps: 8000, distance: 5.0, pace: 360 }; // pace seconds/km
  let goals = { ...defaultGoals };
  try {
    const saved = JSON.parse(localStorage.getItem(GOALS_KEY) || 'null');
    if (saved && typeof saved === 'object') goals = { ...defaultGoals, ...saved };
  } catch (e) {}

  const formatPaceSeconds = (sec) => {
    if (!sec || sec <= 0) return '--:--';
    return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  };

  const editBtn = document.getElementById('progressEditBtn');
  const editPanel = document.getElementById('progressEditPanel');
  const stepsSlider = document.getElementById('goalStepsSlider');
  const distanceSlider = document.getElementById('goalDistanceSlider');
  const paceSlider = document.getElementById('goalPaceSlider');
  const stepsLabel = document.getElementById('goalStepsLabel');
  const distanceLabel = document.getElementById('goalDistanceLabel');
  const paceLabel = document.getElementById('goalPaceLabel');
  const stepsGoalText = document.getElementById('progStepsGoal');
  const distanceGoalText = document.getElementById('progDistanceGoal');
  const paceGoalText = document.getElementById('progPaceGoal');

  const renderGoalLabels = () => {
    stepsSlider.value = String(goals.steps);
    distanceSlider.value = String(goals.distance);
    paceSlider.value = String(goals.pace);
    stepsLabel.textContent = goals.steps.toLocaleString();
    distanceLabel.textContent = goals.distance.toFixed(2);
    paceLabel.textContent = formatPaceSeconds(goals.pace);
    stepsGoalText.textContent = goals.steps.toLocaleString();
    distanceGoalText.textContent = goals.distance.toFixed(2);
    paceGoalText.textContent = formatPaceSeconds(goals.pace);
  };

  const persistGoals = () => {
    try { localStorage.setItem(GOALS_KEY, JSON.stringify(goals)); } catch (e) {}
  };

  if (editBtn && editPanel) {
    editBtn.addEventListener('click', () => {
      const open = editPanel.classList.toggle('open');
      editBtn.classList.toggle('active', open);
      editBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
      editBtn.textContent = open ? 'Done' : 'Edit Goals';
    });

    stepsSlider.addEventListener('input', () => {
      goals.steps = Number(stepsSlider.value);
      // Auto-sync distance from steps using 1.35 m/step
      goals.distance = Number(((goals.steps * STEP_LENGTH_M) / 1000).toFixed(2));
      goals.distance = Math.min(30, Math.max(0.5, goals.distance));
      renderGoalLabels();
      persistGoals();
      syncDashboardCards();
    });
    distanceSlider.addEventListener('input', () => {
      goals.distance = Number(Number(distanceSlider.value).toFixed(2));
      renderGoalLabels();
      persistGoals();
      syncDashboardCards();
    });
    paceSlider.addEventListener('input', () => {
      goals.pace = Number(paceSlider.value);
      renderGoalLabels();
      persistGoals();
      syncDashboardCards();
    });

    renderGoalLabels();
  }

  const setAvatarVisual = (avatarData) => {
    const snapAvatar = document.querySelector('.snap-avatar');
    const topAvatarText = document.querySelector('.avatar span');
    if (avatarData) {
      if (profileAvatarPreview) {
        profileAvatarPreview.src = avatarData;
        profileAvatarPreview.classList.add('show');
      }
      if (profileAvatarFallback) profileAvatarFallback.style.display = 'none';
      if (snapAvatar) snapAvatar.innerHTML = `<img src="${avatarData}" alt="Profile" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      if (topAvatarText) topAvatarText.style.display = 'none';
      const topAvatar = document.querySelector('.avatar');
      if (topAvatar) topAvatar.style.backgroundImage = `url(${avatarData})`;
      if (topAvatar) {
        topAvatar.style.backgroundSize = 'cover';
        topAvatar.style.backgroundPosition = 'center';
      }
      return;
    }

    if (profileAvatarPreview) {
      profileAvatarPreview.removeAttribute('src');
      profileAvatarPreview.classList.remove('show');
    }
    if (profileAvatarFallback) profileAvatarFallback.style.display = 'grid';
    if (topAvatarText) topAvatarText.style.display = 'inline';
    const topAvatar = document.querySelector('.avatar');
    if (topAvatar) topAvatar.style.backgroundImage = '';
  };

  const loadProfile = async () => {
    if (!profileMenu) return;
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) return;
      profileState = await res.json();
      if (profileMenuName) profileMenuName.textContent = profileState.username || 'User';
      if (profileMenuEmail) profileMenuEmail.textContent = profileState.email || '';
      setAvatarVisual(profileState.avatar_data || '');
    } catch (e) {}
  };

  const toggleProfileMenu = (open) => {
    if (!profileMenu || !userMenuBtn) return;
    const next = typeof open === 'boolean' ? open : !profileMenu.classList.contains('open');
    profileMenu.classList.toggle('open', next);
    profileMenu.setAttribute('aria-hidden', next ? 'false' : 'true');
    userMenuBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
  };

  const drawCropCanvas = () => {
    if (!cropCanvas || !cropImage) return;
    const ctx = cropCanvas.getContext('2d');
    const w = cropCanvas.width;
    const h = cropCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f0f12';
    ctx.fillRect(0, 0, w, h);

    const drawW = cropImage.width * cropScale;
    const drawH = cropImage.height * cropScale;
    const x = (w - drawW) / 2 + cropX;
    const y = (h - drawH) / 2 + cropY;
    ctx.drawImage(cropImage, x, y, drawW, drawH);
    drawRoundPreview();
  };

  const drawRoundPreview = () => {
    if (!roundPreview || !cropCanvas) return;
    const pctx = roundPreview.getContext('2d');
    const size = roundPreview.width;
    pctx.clearRect(0, 0, size, size);
    pctx.save();
    pctx.beginPath();
    pctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    pctx.closePath();
    pctx.clip();
    pctx.drawImage(cropCanvas, 36, 36, 248, 248, 0, 0, size, size);
    pctx.restore();
  };

  const openCropOverlay = () => {
    if (!profileCropOverlay) return;
    profileCropOverlay.classList.add('open');
    profileCropOverlay.setAttribute('aria-hidden', 'false');
  };

  const closeCropOverlay = () => {
    if (!profileCropOverlay) return;
    profileCropOverlay.classList.remove('open');
    profileCropOverlay.setAttribute('aria-hidden', 'true');
  };

  const saveCroppedAvatar = async () => {
    if (!roundPreview) return;
    const imageData = roundPreview.toDataURL('image/png', 0.9);
    const res = await fetch('/api/profile/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_data: imageData }),
    });
    if (!res.ok) {
      showToast('Profile', 'Could not save your photo.');
      return;
    }
    profileState.avatar_data = imageData;
    setAvatarVisual(imageData);
    showToast('Profile', 'Profile picture updated.');
    closeCropOverlay();
  };

  const ensureMobileTrackingBanner = () => {
    if (!window.matchMedia('(max-width: 1024px)').matches) return;
    if (mobileTrackerBanner) return;
    mobileTrackerBanner = document.createElement('div');
    mobileTrackerBanner.id = 'mobileTrackingBanner';
    mobileTrackerBanner.style.position = 'fixed';
    mobileTrackerBanner.style.left = '12px';
    mobileTrackerBanner.style.right = '12px';
    mobileTrackerBanner.style.bottom = '84px';
    mobileTrackerBanner.style.padding = '10px 12px';
    mobileTrackerBanner.style.borderRadius = '12px';
    mobileTrackerBanner.style.background = 'var(--panel-strong)';
    mobileTrackerBanner.style.border = '1px solid var(--accent)';
    mobileTrackerBanner.style.boxShadow = 'var(--shadow)';
    mobileTrackerBanner.style.fontSize = '0.82rem';
    mobileTrackerBanner.style.display = 'none';
    mobileTrackerBanner.style.zIndex = '9500';
    document.body.appendChild(mobileTrackerBanner);
  };

  const updateMobileTrackingBanner = (active) => {
    ensureMobileTrackingBanner();
    if (!mobileTrackerBanner) return;
    if (!active) {
      mobileTrackerBanner.style.display = 'none';
      return;
    }
    const distance = Number(totalDistanceMeters / 1000).toFixed(2);
    const steps = Math.max(0, Math.round(totalDistanceMeters / 1.35)).toLocaleString();
    mobileTrackerBanner.textContent = `Tracking active: ${distance} km â€¢ ${steps} steps`;
    mobileTrackerBanner.style.display = 'block';
  };

  const setTrackingState = (active, text) => {
    trackingStatus.textContent = text;
    statusDot.classList.toggle('live', active);
    mapLabel.textContent = active ? 'Tracking live' : 'Map ready';
  };

  const updateStats = (lat, lng) => {
    stepsValue.textContent = Math.max(0, Math.round(totalDistanceMeters / 1.35)).toLocaleString();
    distanceValue.textContent = `${(totalDistanceMeters / 1000).toFixed(2)} km`;
    // Pace: only show once we have at least 50m to avoid wild early numbers
    if (sessionStartedAt && totalDistanceMeters >= 50) {
      const elapsedSec = (Date.now() - sessionStartedAt) / 1000;
      const paceSecPerKm = elapsedSec / (totalDistanceMeters / 1000);
      paceValue.textContent = `${Math.floor(paceSecPerKm / 60)}:${String(Math.floor(paceSecPerKm % 60)).padStart(2, '0')}`;
    } else {
      paceValue.textContent = '--:--';
    }
    locationValue.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    syncDashboardCards();
    updateMobileTrackingBanner(Boolean(sessionStartedAt));
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
    if (!sessionStartedAt) {
      elapsedTime.textContent = '00:00';
      return;
    }
    elapsedTime.textContent = formatElapsed((Date.now() - sessionStartedAt) / 1000);
    paceValue.textContent = formatPace();
    syncDashboardCards();
    updateLiveNotification();
    updateMobileTrackingBanner(Boolean(sessionStartedAt));
  };

  // Filter constants for sane GPS readings.
  const GPS_MIN_ACCURACY_M = 25;     // ignore readings worse than this
  const GPS_MIN_STEP_M = 3;          // ignore tiny jitters when standing still
  const GPS_MAX_SPEED_MPS = 8;       // 28.8 km/h â€” faster than recreational runners
  const GPS_WARMUP_FIXES = 2;        // require this many "good" fixes before counting distance
  let lastFixTime = null;
  let goodFixCount = 0;

  const handlePosition = (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    const now = Date.now();

    // 1) Reject low-accuracy readings entirely.
    if (accuracy && accuracy > GPS_MIN_ACCURACY_M) {
      mapLabel.textContent = `Searching for GPS lock... (+/-${Math.round(accuracy)} m)`;
      return;
    }
    goodFixCount += 1;

    const nextPoint = [latitude, longitude];

    if (routePoints.length === 0) {
      // First accepted fix: place start marker, do not credit distance yet.
      startMarker = L.marker(nextPoint).addTo(map).bindPopup('Start point');
      routePoints.push(nextPoint);
      lastFixTime = now;
    } else {
      const prev = routePoints[routePoints.length - 1];
      const segMeters = map.distance(prev, nextPoint);
      const segSeconds = lastFixTime ? Math.max(0.001, (now - lastFixTime) / 1000) : 1;
      const segSpeed = segMeters / segSeconds;

      // 2) Drop standing-still jitter (< 3 m).
      // 3) Drop GPS jumps (impossible speed) â€” keeps map fluid but doesn't credit distance.
      // 4) Skip distance for the very first couple of fixes (warm-up).
      if (segMeters < GPS_MIN_STEP_M || segSpeed > GPS_MAX_SPEED_MPS || goodFixCount <= GPS_WARMUP_FIXES) {
        // Update marker position only; do NOT push or accumulate.
        if (liveMarker) liveMarker.setLatLng(nextPoint);
        else liveMarker = L.circleMarker(nextPoint, { radius: 8, color: '#ffd36e', fillColor: '#ffd36e', fillOpacity: 0.9 }).addTo(map);
        mapLabel.textContent = `Stabilising GPS... (+/-${Math.round(accuracy)} m)`;
        lastFixTime = now;
        updateStats(latitude, longitude);
        return;
      }

      totalDistanceMeters += segMeters;
      routePoints.push(nextPoint);
      lastFixTime = now;
    }

    routeLine.setLatLngs(routePoints);

    if (!liveMarker) {
      liveMarker = L.circleMarker(nextPoint, { radius: 8, color: '#ffd36e', fillColor: '#ffd36e', fillOpacity: 0.9 }).addTo(map);
    } else {
      liveMarker.setLatLng(nextPoint);
    }

    if (routePoints.length > 1) map.fitBounds(routeLine.getBounds(), { padding: [28, 28], maxZoom: 17 });

    mapLabel.textContent = `Accuracy +/- ${Math.round(accuracy)} m`;
    updateStats(latitude, longitude);
  };

  const logSessionToBackend = async () => {
    if (!sessionStartedAt) return null;
    const endedAt = new Date();
    const durationSeconds = Math.round((endedAt.getTime() - sessionStartedAt) / 1000);
    const distanceKm = totalDistanceMeters / 1000;
    const steps = Math.max(0, Math.round(totalDistanceMeters / 1.35));
    if (durationSeconds < 10 && distanceKm < 0.03) return null;

    const res = await fetch('/api/activity/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        started_at: new Date(sessionStartedAt).toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        distance_km: Number(distanceKm.toFixed(3)),
        steps,
        route_points: routePoints,
      }),
    });

    if (!res.ok) return null;
    const payload = await res.json();
    return payload.session || null;
  };

  // ---------- Live tracking notifications ----------
  let notifEnabled = false;
  let lastNotifAt = 0;
  let activeNotif = null;

  const ensureNotifPermission = async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch (e) { return false; }
  };

  const updateLiveNotification = (force = false) => {
    if (!notifEnabled || !sessionStartedAt) return;
    const now = Date.now();
    if (!force && now - lastNotifAt < 5000) return; // throttle 5s
    lastNotifAt = now;

    const distanceKm = totalDistanceMeters / 1000;
    const steps = Math.max(0, Math.round(totalDistanceMeters / 1.35));
    let paceText = '--:--';
    if (totalDistanceMeters >= 50) {
      const elapsedSec = (now - sessionStartedAt) / 1000;
      const paceSec = elapsedSec / (totalDistanceMeters / 1000);
      paceText = formatPaceSeconds(paceSec);
    }
    const body = `Steps: ${steps.toLocaleString()}  â€¢  Distance: ${distanceKm.toFixed(2)} km  â€¢  Pace: ${paceText}/km`;
    try {
      if (activeNotif) { try { activeNotif.close(); } catch (e) {} }
      activeNotif = new Notification('FITNESS ED â€” Live Run', {
        body,
        tag: 'fitnessed-live',
        renotify: false,
        silent: true,
      });
    } catch (e) {}
  };

  const closeLiveNotification = () => {
    if (activeNotif) { try { activeNotif.close(); } catch (e) {} activeNotif = null; }
  };

  const startTracking = () => {
    if (!navigator.geolocation) return setTrackingState(false, 'Geolocation not supported');
    // Fire-and-forget permission request; notifications enable as soon as granted.
    ensureNotifPermission().then((ok) => {
      notifEnabled = ok;
      if (ok) updateLiveNotification(true);
    });
    resetTracking();
    totalDistanceMeters = 0;
    routePoints = [];
    goodFixCount = 0;
    lastFixTime = null;
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

    sessionStartedAt = Date.now();
    updateTimer();
    timerId = window.setInterval(updateTimer, 1000);
    setTrackingState(true, 'Tracking in progress');
    updateMobileTrackingBanner(true);
    showToast('Tracker', 'Tracking started.');
    if (navigator.vibrate) navigator.vibrate([90, 40, 90]);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('FITNESS ED Tracking', {
          body: 'Tracking is now active. Keep moving.',
          tag: 'fitnessed-start',
          renotify: true,
          requireInteraction: false,
        });
      } catch (e) {}
    }

    watchId = navigator.geolocation.watchPosition(
      handlePosition,
      (error) => {
        const messages = { 1: 'Location permission denied', 2: 'Location unavailable', 3: 'Location request timed out' };
        setTrackingState(false, messages[error.code] || 'Unable to fetch location');
        resetTracking();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  };

  const stopTracking = async () => {
    resetTracking();
    closeLiveNotification();
    setTrackingState(false, routePoints.length ? 'Tracking stopped' : 'Waiting to start');
    updateMobileTrackingBanner(false);
    const savedSession = await logSessionToBackend();
    sessionStartedAt = null;

    if (savedSession) {
      showToast('Session saved', 'History and dashboard updated.');
      await Promise.all([loadDashboardSummary(), loadRecentHistory()]);
    } else {
      syncDashboardCards();
    }
  };

  const openSection = (sectionName) => {
    Object.entries(sections).forEach(([name, el]) => el.classList.toggle('active', name === sectionName));
    sectionLinks.forEach((link) => link.classList.toggle('active', link.dataset.section === sectionName));
    if (sectionName === 'tracker') window.setTimeout(() => map.invalidateSize(), 120);
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
        datasets: [{ label: 'Active Minutes', data: [0, 0, 0, 0, 0, 0, 0], borderColor: '#4ef2b3', backgroundColor: gradient, borderWidth: 3, tension: 0.35, pointBackgroundColor: '#071311', pointBorderColor: '#4ef2b3', pointBorderWidth: 2, pointRadius: 4, fill: true }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false, drawBorder: false }, ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Space Grotesk' } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Space Grotesk' } } },
        },
      },
    });
  };

  const loadDashboardSummary = async () => {
    const response = await fetch('/api/activity/summary');
    if (!response.ok) return;
    baseSummary = await response.json();

    if (progressChart) {
      progressChart.data.labels = baseSummary.chart.labels;
      progressChart.data.datasets[0].data = baseSummary.chart.active_minutes;
      progressChart.update();
    }

    syncDashboardCards();
  };

  // Format using the user's device timezone with Indian locale style.
  const fmtDate = (iso, fallback) => {
    if (!iso) return fallback || '';
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return fallback || ''; }
  };
  const fmtTime = (iso, fallback) => {
    if (!iso) return fallback || '';
    try {
      return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) { return fallback || ''; }
  };

  const renderHistory = () => {
    if (!recentHistory.length) {
      historyList.innerHTML = '<div class="history-empty">No runs in the last 4 days yet. Start tracking to build history.</div>';
      return;
    }

    historyList.innerHTML = recentHistory
      .map(
        (session) => `
          <article class="history-item">
            <div>
              <strong>${fmtDate(session.started_at_iso, session.date_label)} â€¢ ${fmtTime(session.started_at_iso, session.time_label)}</strong>
              <div class="history-metrics">
                <span>${Number(session.distance_km).toFixed(2)} km</span>
                <span>${session.pace_per_km} pace</span>
                <span>${Number(session.steps).toLocaleString()} steps</span>
              </div>
            </div>
            <button class="history-share" type="button" data-session-id="${session.id}">Share</button>
          </article>
        `,
      )
      .join('');

    Array.from(historyList.querySelectorAll('.history-share')).forEach((button) => {
      button.addEventListener('click', () => {
        const sessionId = Number(button.dataset.sessionId);
        window.location.href = `/share?session_id=${sessionId}`;
      });
    });
  };

  const loadRecentHistory = async () => {
    const res = await fetch('/api/activity/history');
    if (!res.ok) return;
    const data = await res.json();
    recentHistory = data.sessions || [];
    renderHistory();
  };

  sectionLinks.forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); openSection(link.dataset.section); }));
  openSectionButtons.forEach((button) => button.addEventListener('click', () => openSection(button.dataset.openSection)));
  startButton.addEventListener('click', startTracking);
  stopButton.addEventListener('click', stopTracking);

  if (userMenuBtn && profileMenu) {
    userMenuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleProfileMenu();
    });
    userMenuBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleProfileMenu();
      }
    });
    document.addEventListener('click', (e) => {
      if (!profileMenu.contains(e.target) && !userMenuBtn.contains(e.target)) {
        toggleProfileMenu(false);
      }
    });
  }

  if (profileManageBtn) {
    profileManageBtn.addEventListener('click', async () => {
      const nextName = window.prompt('Update display name:', profileState.username || '');
      if (!nextName) return;
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nextName }),
      });
      if (res.ok) {
        profileState.username = nextName;
        if (profileMenuName) profileMenuName.textContent = nextName;
        const topName = document.querySelector('.user-name');
        if (topName) topName.textContent = nextName;
        showToast('Profile', 'Name updated.');
      } else {
        showToast('Profile', 'Unable to update name.');
      }
    });
  }

  if (profileSettingsBtn) {
    profileSettingsBtn.addEventListener('click', () => {
      showToast('Settings', 'More settings will be added here.');
    });
  }

  if (profilePhotoBtn && profilePhotoInput) {
    profilePhotoBtn.addEventListener('click', () => profilePhotoInput.click());
    profilePhotoInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          cropImage = img;
          cropScale = 1.2;
          cropX = 0;
          cropY = 0;
          if (zoomRange) zoomRange.value = String(cropScale);
          drawCropCanvas();
          openCropOverlay();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      profilePhotoInput.value = '';
    });
  }

  if (zoomRange) {
    zoomRange.addEventListener('input', () => {
      cropScale = Number(zoomRange.value);
      drawCropCanvas();
    });
  }

  if (cropCanvas) {
    cropCanvas.addEventListener('mousedown', (e) => {
      draggingCrop = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    });
    window.addEventListener('mouseup', () => { draggingCrop = false; });
    window.addEventListener('mousemove', (e) => {
      if (!draggingCrop) return;
      cropX += e.clientX - dragStartX;
      cropY += e.clientY - dragStartY;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      drawCropCanvas();
    });
    cropCanvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      draggingCrop = true;
      dragStartX = t.clientX;
      dragStartY = t.clientY;
    }, { passive: true });
    window.addEventListener('touchend', () => { draggingCrop = false; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!draggingCrop) return;
      const t = e.touches[0];
      cropX += t.clientX - dragStartX;
      cropY += t.clientY - dragStartY;
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      drawCropCanvas();
    }, { passive: true });
  }

  if (cropCancelBtn) cropCancelBtn.addEventListener('click', closeCropOverlay);
  if (cropSaveBtn) cropSaveBtn.addEventListener('click', () => saveCroppedAvatar().catch(() => showToast('Profile', 'Could not save image.')));

  // ---------- Streak modal + warning notifications ----------
  const streakPill = document.getElementById('streakPill');
  const streakOverlay = document.getElementById('streakOverlay');
  const streakClose = document.getElementById('streakClose');
  const streakBigCount = document.getElementById('streakBigCount');
  const streakUnitLabel = document.getElementById('streakUnitLabel');
  const streakLastActive = document.getElementById('streakLastActive');
  const streakTimeRemaining = document.getElementById('streakTimeRemaining');

  let streakInfo = { count: 0, last_visit_at: null, window_hours: 35 };

  const formatHoursRemaining = (hoursLeft) => {
    if (hoursLeft <= 0) return 'Streak has ended';
    const h = Math.floor(hoursLeft);
    const m = Math.round((hoursLeft - h) * 60);
    if (h <= 0) return `${m} min left`;
    if (m <= 0) return `${h} h left`;
    return `${h} h ${m} min left`;
  };

  const renderStreakModal = () => {
    const count = Number(streakInfo.count || 0);
    streakBigCount.textContent = count;
    streakUnitLabel.textContent = count === 1 ? 'day in a row' : 'days in a row';
    if (streakInfo.last_visit_at) {
      const lastDate = new Date(streakInfo.last_visit_at);
      streakLastActive.textContent = `${fmtDate(streakInfo.last_visit_at)} at ${fmtTime(streakInfo.last_visit_at)}`;
      const elapsedHours = (Date.now() - lastDate.getTime()) / 3600000;
      const hoursLeft = (streakInfo.window_hours || 35) - elapsedHours;
      streakTimeRemaining.textContent = formatHoursRemaining(hoursLeft);
    } else {
      streakLastActive.textContent = 'Just now';
      streakTimeRemaining.textContent = `${streakInfo.window_hours || 35} h left`;
    }
  };

  const openStreakModal = () => { renderStreakModal(); streakOverlay.classList.add('open'); };
  const closeStreakModal = () => streakOverlay.classList.remove('open');

  if (streakPill) {
    streakPill.addEventListener('click', openStreakModal);
    streakPill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStreakModal(); }
    });
  }
  if (streakClose) streakClose.addEventListener('click', closeStreakModal);
  if (streakOverlay) {
    streakOverlay.addEventListener('click', (e) => { if (e.target === streakOverlay) closeStreakModal(); });
  }

  // ---------- Calories and Sessions modals ----------
  const caloriesPill = document.getElementById('caloriesPill');
  const caloriesOverlay = document.getElementById('caloriesOverlay');
  const caloriesClose = document.getElementById('caloriesClose');
  const caloriesBigCount = document.getElementById('caloriesBigCount');

  const sessionsPill = document.getElementById('sessionsPill');
  const sessionsOverlay = document.getElementById('sessionsOverlay');
  const sessionsClose = document.getElementById('sessionsClose');
  const sessionsBigCount = document.getElementById('sessionsBigCount');

  const openCaloriesModal = () => { 
    if (caloriesBigCount) caloriesBigCount.textContent = dashCalories ? dashCalories.textContent : '0';
    if (caloriesOverlay) caloriesOverlay.classList.add('open'); 
  };
  const closeCaloriesModal = () => { if (caloriesOverlay) caloriesOverlay.classList.remove('open'); };

  const openSessionsModal = () => { 
    if (sessionsBigCount) sessionsBigCount.textContent = dashSessions ? dashSessions.textContent : '0';
    if (sessionsOverlay) sessionsOverlay.classList.add('open'); 
  };
  const closeSessionsModal = () => { if (sessionsOverlay) sessionsOverlay.classList.remove('open'); };

  if (caloriesPill) {
    caloriesPill.addEventListener('click', openCaloriesModal);
    caloriesPill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCaloriesModal(); }
    });
  }
  if (caloriesClose) caloriesClose.addEventListener('click', closeCaloriesModal);
  if (caloriesOverlay) {
    caloriesOverlay.addEventListener('click', (e) => { if (e.target === caloriesOverlay) closeCaloriesModal(); });
  }

  if (sessionsPill) {
    sessionsPill.addEventListener('click', openSessionsModal);
    sessionsPill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSessionsModal(); }
    });
  }
  if (sessionsClose) sessionsClose.addEventListener('click', closeSessionsModal);
  if (sessionsOverlay) {
    sessionsOverlay.addEventListener('click', (e) => { if (e.target === sessionsOverlay) closeSessionsModal(); });
  }

  document.addEventListener('keydown', (e) => { 
    if (e.key === 'Escape') {
      closeStreakModal();
      closeCaloriesModal();
      closeSessionsModal();
    }
  });

  // Streak-ending warnings: notify at 8h, 16h, 24h, 32h after last visit
  // (i.e. when ~27h, 19h, 11h, 3h remain). Fires while the page is open.
  const STREAK_NOTIF_KEY = 'fitnessed.streakNotifLastVisit';
  const NOTIF_HOURS_AFTER = [8, 16, 24, 32];
  let streakNotifTimers = [];

  const fireStreakWarning = (hoursLeft) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const headline = hoursLeft <= 4 ? 'Your streak is about to end!' : 'Keep your streak alive';
    const body = hoursLeft <= 0
      ? 'Your streak just ended. Open the app to start a new one.'
      : `Open FITNESS ED in the next ${Math.max(1, Math.round(hoursLeft))} hours to keep your ${streakInfo.count}-day streak.`;
    try {
      new Notification(headline, { body, tag: 'fitnessed-streak', renotify: true, silent: false });
    } catch (e) {}
  };

  const scheduleStreakWarnings = () => {
    streakNotifTimers.forEach((id) => window.clearTimeout(id));
    streakNotifTimers = [];
    if (!streakInfo.last_visit_at) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      // Best-effort permission ask once on dashboard load.
      Notification.requestPermission().catch(() => {});
    }
    if (Notification.permission !== 'granted') return;

    const lastVisitMs = new Date(streakInfo.last_visit_at).getTime();
    const windowMs = (streakInfo.window_hours || 35) * 3600000;
    let firedKey = '';
    try { firedKey = localStorage.getItem(STREAK_NOTIF_KEY) || ''; } catch (e) {}
    const sameVisit = firedKey.startsWith(String(lastVisitMs));
    const firedHours = sameVisit ? new Set(firedKey.split('|').slice(1).map(Number)) : new Set();

    NOTIF_HOURS_AFTER.forEach((h) => {
      if (firedHours.has(h)) return;
      const fireAt = lastVisitMs + h * 3600000;
      const delay = fireAt - Date.now();
      if (delay <= 0) {
        // Already past this point — only fire if the streak window hasn't closed yet.
        if (Date.now() - lastVisitMs < windowMs) {
          fireStreakWarning((windowMs - (Date.now() - lastVisitMs)) / 3600000);
          firedHours.add(h);
        }
        return;
      }
      const id = window.setTimeout(() => {
        const elapsed = Date.now() - lastVisitMs;
        if (elapsed >= windowMs) return;
        fireStreakWarning((windowMs - elapsed) / 3600000);
        firedHours.add(h);
        try { localStorage.setItem(STREAK_NOTIF_KEY, [lastVisitMs, ...Array.from(firedHours)].join('|')); } catch (e) {}
      }, delay);
      streakNotifTimers.push(id);
    });
    try { localStorage.setItem(STREAK_NOTIF_KEY, [lastVisitMs, ...Array.from(firedHours)].join('|')); } catch (e) {}
  };

  const loadStreak = async () => {
    try {
      const res = await fetch('/api/streak');
      if (!res.ok) return;
      streakInfo = await res.json();
      scheduleStreakWarnings();
    } catch (e) {}
  };

  initChart();
  loadDashboardSummary();
  loadRecentHistory();
  loadStreak();
  loadProfile();
  openSection(initialSection);
})();
