const page = document.body.dataset.page;
const $ = selector => document.querySelector(selector);
const htmlEntities = {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'};
const esc = value => String(value).replace(/[&<>"']/g, char => htmlEntities[char]);
const opts = options => options.map(([value,label]) =>
  `<option value="${esc(value)}">${esc(label)}</option>`).join('');

const sections = [
  ['hardware', 'index.html', '硬件对比'],
  ['advisor', 'advisor.html', '硬件选型'],
];

const footer = `<div class="footer">
  <span>算力坐标 Compute Axis</span>
  <span>来源规格待复核 · 国内采购价与本地实测待补</span>
</div>`;

$('#app').innerHTML = `<header>
  <div class="nav">
    <div class="nav-brand">
      <a class="logo" href="index.html"><img class="site-logo" src="assets/site-logo.ico" alt="" aria-hidden="true" width="33" height="33"><span class="site-name">算力坐标 <small>Compute Axis</small></span></a>
    </div>
    <nav class="links" aria-label="主要导航">
      ${sections.map(([id, href, label]) => `<a href="${href}"${id === page ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('')}
    </nav>
    <div class="nav-actions">
      <span class="draft">交互初稿 · 数据待核验</span>
      <button class="theme-toggle" id="theme-toggle" type="button"></button>
    </div>
  </div>
</header>
<main id="main"></main>
<dialog id="dialog"><button class="outline close" aria-label="关闭">✕</button><div id="dialog-body"></div></dialog>`;

const themeToggle = $('#theme-toggle');
const dialog = $('#dialog');
const sunIcon = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>';
const moonIcon = '<path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/>';

function updateThemeToggle() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const label = dark ? '切换到浅色模式' : '切换到深色模式';
  themeToggle.setAttribute('aria-label', label);
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.title = label;
  themeToggle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${dark ? sunIcon : moonIcon}</svg><span>${dark ? '日间' : '夜间'}</span>`;
  updateBrandIconTheme(dark);
}

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applySiteTheme(theme);
  try { localStorage.setItem(siteThemeStorageKey, theme); } catch {}
  updateThemeToggle();
});
window.addEventListener('pageshow', () => {
  applySiteTheme(readSiteTheme(document.documentElement.dataset.theme));
  updateThemeToggle();
});
updateThemeToggle();

dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

switch (page) {
  case 'hardware': hardware(); break;
  case 'advisor': advisor(); break;
}
