(function () {
  const KEY = 'fitnessed-theme';
  const root = document.documentElement;

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? '&#9728;' : '&#9790;';
      btn.title = theme === 'dark' ? 'Light mode' : 'Dark mode';
    }

    const mtBtn = document.getElementById('mt-theme-btn');
    if (mtBtn) mtBtn.innerHTML = theme === 'dark' ? '&#9728; Light mode' : '&#9790; Dark mode';
  }

  let saved = 'light';
  try { saved = localStorage.getItem(KEY) || 'light'; } catch (e) {}
  apply(saved);

  function toggleTheme() {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
  }

  function mountFloatingToggle() {
    if (document.getElementById('theme-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.type = 'button';
    btn.addEventListener('click', toggleTheme);
    document.body.appendChild(btn);
  }

  const PAGES = {
    home: { title: 'Dashboard', back: null },
    workouts: { title: 'Workouts', back: '/home' },
    notes: { title: 'Notes', back: '/home' },
    todo: { title: 'Daily Tasks', back: '/home' },
    nutrition: { title: 'Nutrition', back: '/home' },
    analytics: { title: 'Analytics', back: '/home' },
    history: { title: 'History', back: '/home' },
    share: { title: 'Share', back: '/home' },
    more: { title: 'Menu', back: '/home' },
  };

  const TABS = [
    { key: 'home', href: '/home', label: 'Home', icon: '&#8962;' },
    { key: 'todo', href: '/todo', label: 'Tasks', icon: '&#10003;' },
    { key: 'workouts', href: '/workouts', label: 'Workout', icon: '&#9874;' },
    { key: 'notes', href: '/notes', label: 'Notes', icon: '&#9998;' },
    { key: 'history', href: '/history', label: 'History', icon: '&#9201;' },
  ];

  function mountMobileShell() {
    const body = document.body;
    if (!body.classList.contains('app-page')) return;
    if (document.querySelector('.mobile-topbar')) return;

    const page = body.dataset.page || 'home';
    const meta = PAGES[page] || PAGES.home;

    const top = document.createElement('header');
    top.className = 'mobile-topbar';
    const backBtn = meta.back ? `<a class="mt-back" href="${meta.back}" aria-label="Back"><</a>` : '';
    top.innerHTML = `
      <div class="mt-left">
        ${backBtn}
        <div class="mt-title">${meta.title}</div>
      </div>
      <div class="mt-actions">
        <button class="mt-icon-btn" id="mt-menu-btn" type="button" aria-label="Open menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
      </div>
    `;
    body.prepend(top);

    const panel = document.createElement('div');
    panel.className = 'mt-menu-panel';
    panel.id = 'mt-menu-panel';
    panel.innerHTML = `
      <button class="mt-menu-item" id="mt-theme-btn" type="button">Theme</button>
      <a class="mt-menu-item" href="/home">Dashboard</a>
      <a class="mt-menu-item" href="/workouts">Workouts</a>
      <a class="mt-menu-item" href="/notes">Notes</a>
      <a class="mt-menu-item" href="/todo">Daily Tasks</a>
      <a class="mt-menu-item" href="/nutrition">Nutrition</a>
      <a class="mt-menu-item" href="/analytics">Analytics</a>
      <a class="mt-menu-item" href="/history">History</a>
      <a class="mt-menu-item mt-menu-danger" href="/logout">Sign out</a>
    `;
    body.appendChild(panel);

    const backdrop = document.createElement('div');
    backdrop.className = 'mt-menu-backdrop';
    backdrop.id = 'mt-menu-backdrop';
    body.appendChild(backdrop);

    const closeMenu = () => {
      panel.classList.remove('open');
      backdrop.classList.remove('open');
    };

    const openMenu = () => {
      panel.classList.add('open');
      backdrop.classList.add('open');
    };

    document.getElementById('mt-menu-btn').addEventListener('click', () => {
      panel.classList.contains('open') ? closeMenu() : openMenu();
    });

    backdrop.addEventListener('click', closeMenu);

    document.getElementById('mt-theme-btn').addEventListener('click', () => {
      toggleTheme();
      closeMenu();
    });

    const nav = document.createElement('nav');
    nav.className = 'mobile-tabbar';
    nav.innerHTML = TABS.map((t) => `
      <a href="${t.href}" data-tab="${t.key}" class="${t.key === page ? 'active' : ''}">
        <span class="tab-ico">${t.icon}</span>
        <span>${t.label}</span>
      </a>
    `).join('');
    body.appendChild(nav);

    apply(root.getAttribute('data-theme') || 'light');
  }

  function init() {
    mountFloatingToggle();
    mountMobileShell();
    apply(root.getAttribute('data-theme') || 'light');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
