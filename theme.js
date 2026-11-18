const siteThemeStorageKey = 'suanxuan-theme';

function readSiteTheme(fallback = 'dark') {
  try { return localStorage.getItem(siteThemeStorageKey) === 'light' ? 'light' : 'dark'; }
  catch { return fallback; }
}

function applySiteTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

applySiteTheme(readSiteTheme());
