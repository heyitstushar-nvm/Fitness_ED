(function () {
  const KEY = 'fitnessed-theme';
  const root = document.documentElement;

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀' : '☾';
      btn.title = theme === 'dark' ? 'Light mode' : 'Dark mode';
    }
    const mtBtn = document.getElementById('mt-theme-btn');
    if (mtBtn) mtBtn.textContent = theme === 'dark' ? '☀' : '☾';
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

  // ---------- Mobile App Shell (header + bottom tabbar) ----------
  // Routes are resolved from anchors already on the page when possible,
  // with sensible fallbacks.
  const PAGES = {
    home:      { title: 'Dashboard',  back: null,    icon: '⌂' },
    todo:      { title: 'Daily Tasks', back: '/home', icon: '✓' },
    nutrition: { title: 'Nutrition',  back: '/home', icon: '🍽' },
    analytics: { title: 'Analytics',  back: '/home', icon: '📊' },
    history:   { title: 'History',    back: '/home', icon: '⏱' },
    share:     { title: 'Share',      back: '/home', icon: '↗' },
    more:      { title: 'About',      back: '/home', icon: '☰' },
  };

  const TABS = [
    { key: 'home',      href: '/home',                          label: 'Home',      icon: '⌂' },
    { key: 'todo',      href: '/todo',                          label: 'Tasks',     icon: '✓' },
    { key: 'nutrition', href: '/nutrition',                     label: 'Meals',     icon: '🍽' },
    { key: 'analytics', href: '/analytics',                     label: 'Stats',     icon: '📊' },
    { key: 'history',   href: '/history',                       label: 'History',   icon: '⏱' },
  ];

  function mountMobileShell() {
    const body = document.body;
    if (!body.classList.contains('app-page')) return;
    if (document.querySelector('.mobile-topbar')) return;

    const page = body.dataset.page || 'home';
    const meta = PAGES[page] || PAGES.home;

    // Top bar
    const top = document.createElement('header');
    top.className = 'mobile-topbar';
    const backBtn = meta.back
      ? `<a class="mt-back" href="${meta.back}" aria-label="Back">‹</a>`
      : '';
    top.innerHTML = `
      <div class="mt-left">
        ${backBtn}
        <div class="mt-title">${meta.title}</div>
      </div>
      <div class="mt-actions">
        <button class="mt-icon-btn" id="mt-menu-btn" type="button" aria-label="Open menu">☰</button>
      </div>
    `;
    body.prepend(top);

    // Slide-down menu panel
    const panel = document.createElement('div');
    panel.className = 'mt-menu-panel';
    panel.id = 'mt-menu-panel';
    panel.innerHTML = `
      <button class="mt-menu-item" id="mt-theme-btn" type="button">
        <span id="mt-theme-icon">☾</span><span>Toggle theme</span>
      </button>
      <a class="mt-menu-item" href="/home"><span>⌂</span><span>Dashboard</span></a>
      <a class="mt-menu-item" href="/todo"><span>✓</span><span>Daily Tasks</span></a>
      <a class="mt-menu-item" href="/nutrition"><span>🍽</span><span>Nutrition</span></a>
      <a class="mt-menu-item" href="/analytics"><span>📊</span><span>Analytics</span></a>
      <a class="mt-menu-item" href="/history"><span>⏱</span><span>History</span></a>
      <a class="mt-menu-item mt-menu-danger" href="/logout"><span>⏻</span><span>Sign out</span></a>
    `;
    body.appendChild(panel);

    const backdrop = document.createElement('div');
    backdrop.className = 'mt-menu-backdrop';
    backdrop.id = 'mt-menu-backdrop';
    body.appendChild(backdrop);

    function closeMenu() {
      panel.classList.remove('open');
      backdrop.classList.remove('open');
    }
    function openMenu() {
      panel.classList.add('open');
      backdrop.classList.add('open');
    }
    document.getElementById('mt-menu-btn').addEventListener('click', () => {
      panel.classList.contains('open') ? closeMenu() : openMenu();
    });
    backdrop.addEventListener('click', closeMenu);
    document.getElementById('mt-theme-btn').addEventListener('click', () => {
      toggleTheme();
      const ico = document.getElementById('mt-theme-icon');
      if (ico) ico.textContent = root.getAttribute('data-theme') === 'dark' ? '☀' : '☾';
    });

    // Bottom nav
    const nav = document.createElement('nav');
    nav.className = 'mobile-tabbar';
    nav.innerHTML = TABS.map(t => `
      <a href="${t.href}" data-tab="${t.key}" class="${t.key === page ? 'active' : ''}">
        <span class="tab-ico">${t.icon}</span>
        <span>${t.label}</span>
      </a>
    `).join('');
    body.appendChild(nav);

    // Sync theme button label
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
