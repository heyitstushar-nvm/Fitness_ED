(function () {
  const historyList = document.getElementById('historyList');
  let sessions = [];

  const renderList = () => {
    if (!sessions.length) {
      historyList.innerHTML = '<div class="history-empty">No sessions recorded yet.</div>';
      return;
    }

    historyList.innerHTML = sessions
      .map(
        (run) => `
        <article class="history-item" style="display:flex;justify-content:space-between;align-items:center;gap:0.8rem;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);padding:0.8rem;border-radius:12px;">
          <div>
            <strong>${run.date_label} • ${run.time_label}</strong>
            <div class="history-metrics" style="display:flex;gap:0.7rem;color:var(--muted);font-size:0.86rem;margin-top:0.25rem;flex-wrap:wrap;">
              <span>${Number(run.distance_km).toFixed(2)} km</span>
              <span>${run.pace_per_km} pace</span>
              <span>${Number(run.steps).toLocaleString()} steps</span>
            </div>
          </div>
          <button class="history-share" type="button" data-id="${run.id}" style="padding:0.45rem 0.8rem;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,0.06);color:var(--text);">Share</button>
        </article>
      `,
      )
      .join('');

    Array.from(historyList.querySelectorAll('.history-share')).forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.dataset.id);
        window.location.href = `/share?session_id=${id}`;
      });
    });
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/activity/history?all=1');
      if (!res.ok) return;
      const data = await res.json();
      sessions = data.sessions || [];
      renderList();
    } catch (error) {
      console.error(error);
    }
  };

  loadHistory();
})();
