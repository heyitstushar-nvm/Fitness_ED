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
    // Use 1.35m per step — accurate for running/jogging cadence
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
    dashStreak.textContent = `${baseSummary.streak_days || 0} Days`;
    dashDistance.textContent = `${Number(today.distance_km || 0).toFixed(2)} km`;
    dashSteps.textContent = Math.round(today.steps || 0).toLocaleString();
    dashMinutes.textContent = `${Math.round(today.active_minutes || 0)} min`;

    // Progress Now widget — uses customizable goals
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
  };

  const handlePosition = (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    const nextPoint = [latitude, longitude];
    if (routePoints.length > 0) totalDistanceMeters += map.distance(routePoints[routePoints.length - 1], nextPoint);
    else startMarker = L.marker(nextPoint).addTo(map).bindPopup('Start point');

    routePoints.push(nextPoint);
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
    const body = `Steps: ${steps.toLocaleString()}  •  Distance: ${distanceKm.toFixed(2)} km  •  Pace: ${paceText}/km`;
    try {
      if (activeNotif) { try { activeNotif.close(); } catch (e) {} }
      activeNotif = new Notification('FITNESS ED — Live Run', {
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
              <strong>${session.date_label} • ${session.time_label}</strong>
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

  initChart();
  loadDashboardSummary();
  loadRecentHistory();
  openSection(initialSection);
})();
