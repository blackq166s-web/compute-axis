const http = require('node:http');
const fs = require('node:fs/promises');
const { createReadStream, existsSync } = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');
const { clientSnapshotScript, loadApi, readSnapshot, writeSnapshot } = require('./import_aa.cjs');
const { syncCapabilities, targets, fields, documentation } = require('./aa-sync.cjs');
const { loadKey, saveKey, keyPattern } = require('./aa-key-store.cjs');

const site = path.resolve(__dirname, '..');
const siteLogo = existsSync(path.join(site, 'assets/site-logo.ico')) ? 'assets/site-logo.ico' : 'assets/compute-axis.svg';
const hostedOrigin = process.env.COMPUTE_AXIS_ORIGIN ? new URL(process.env.COMPUTE_AXIS_ORIGIN) : null;
const port = Number(process.argv[2] ?? process.env.PORT ?? 8766);
const publicAA = !hostedOrigin || process.env.AA_PUBLIC_DATA === '1';
const adminPassword = process.env.COMPUTE_AXIS_ADMIN_PASSWORD;
const aaStatePath = process.env.AA_STATE_FILE;
const aaTier = process.env.AA_API_TIER ?? 'free';
if (hostedOrigin) {
  if (hostedOrigin.protocol !== 'https:' || hostedOrigin.href !== hostedOrigin.origin + '/') {
    throw new Error('COMPUTE_AXIS_ORIGIN 必须为完整的 HTTPS 源站地址。');
  }
  if (!adminPassword || adminPassword.length < 24) {
    throw new Error('请在服务端配置至少 24 个字符的 COMPUTE_AXIS_ADMIN_PASSWORD。');
  }
  if (!['free', 'pro'].includes(aaTier)) {
    throw new Error('AA_API_TIER 必须为 free 或 pro。');
  }
  const relativeState = aaStatePath && path.relative(site, aaStatePath);
  if (!aaStatePath || !path.isAbsolute(aaStatePath) || !relativeState ||
      (!relativeState.startsWith('..' + path.sep) && !path.isAbsolute(relativeState))) {
    throw new Error('AA_STATE_FILE 必须指向站点目录之外的持久化文件。');
  }
}
const authDigest = value => createHash('sha256').update(value).digest();
const adminDigest = hostedOrigin &&
  authDigest(Buffer.from(`admin:${adminPassword}`, 'utf8').toString('base64'));
const admin = '/admin/aa';
const agentationRoute = '__dev/agentation.js';
const agentationBundle = path.join(__dirname, 'agentation', 'dist', 'agentation.js');
const agentationEnabled = !hostedOrigin && existsSync(agentationBundle);
const csrf = randomBytes(32).toString('hex');
const dateFormat = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short', hour12: false,
});
const chinaCalendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' });
const dailyHour = '03:00';
const publicFiles = new Set([
  'index.html', 'advisor.html', 'models.html', 'style.css', 'theme.js', 'app.js', 'data.js',
  'brand-icons.js', 'brand-ui.js', 'flopper-data.js', 'advisor-data.js',
  'aa-chart-data.js', 'aa-official-data.js', 'aa-admin.css',
  'pages/hardware.js', 'pages/hardware-chart.js', 'pages/hardware.css',
  'pages/advisor.js', 'pages/advisor.css',
  'pages/model-comparison.js', 'pages/model-comparison.css', 'pages/aa-charts.js', 'pages/aa-charts.css',
]);
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};

const environmentKey = process.env.AA_API_KEY?.trim() ?? '';
const managesKey = !hostedOrigin && !environmentKey;
let apiKey = environmentKey;
let keySource = environmentKey ? '托管环境变量' : '';
let keyNotice = '';
if (managesKey) {
  try {
    apiKey = loadKey();
    if (apiKey) keySource = '服务端已加密保存';
    else keyNotice = '本机尚无已保存的 AA 密钥。请在上方录入并保存。';
  } catch {
    keyNotice = '无法读取已保存的密钥，请用保存密钥时的 Windows 账户启动服务，或重新录入。';
  }
}
let syncing = false;
let notice = '';
let outcomes;
let lastAutomaticDay = '';

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function adminPage() {
  const snapshot = readSnapshot({ allowMissing: true });
  const patch = snapshot.capabilityPatch;
  const syncedAt = hostedOrigin ? snapshot.api?.checkedAt : patch?.checkedAt;
  const rows = targets.map(model => {
    const scores = patch?.models?.[model.id];
    const apiScores = hostedOrigin && snapshot.api?.models.find(row => row.id === model.id)?.capabilityScores;
    return `<tr><th scope="row">${escapeHtml(model.name)}</th>${fields.map(([field]) => {
      const score = apiScores ? apiScores[field === 'engineering' ? 4 : 5] : scores?.[field]?.score;
      const outcome = outcomes?.[model.id]?.[field];
      return `<td><strong>${score ?? '—'}</strong>${outcome
        ? `<span>${escapeHtml(outcome)}</span>` : ''}</td>`;
    }).join('')}</tr>`;
  }).join('');
  return `<!doctype html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${syncing ? '<meta http-equiv="refresh" content="3">' : ''}
  <title>AA 数据同步 · 算力坐标 Compute Axis</title>
  <link rel="icon" href="/${siteLogo}"><script src="/theme.js"></script>
  <link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/aa-admin.css">
</head>
<body>
  <main class="aa-admin">
    <a href="/models.html" class="aa-back">← 返回模型对比</a>
    <h1>AA 数据同步</h1>
    <p class="aa-muted-text">${hostedOrigin ? '同步本站模型的 AA 评测。下表核对三款开放权重模型的分数。' : '同步三款开放权重模型的工程与经济学分数'}</p>
    <section class="panel aa-admin-panel" aria-labelledby="aa-key-title">
      <div class="aa-admin-heading"><h2 id="aa-key-title">API 密钥</h2>
        <span class="aa-status">${apiKey ? `已配置 · ${keySource}` : '待配置'}</span></div>
      ${!managesKey ? '' : `<form method="post" action="${admin}/key" autocomplete="off">
        <input type="hidden" name="csrf" value="${csrf}">
        <label for="aa-key">AA Free API 密钥</label>
        <div class="aa-key-input"><input id="aa-key" name="key" type="password" required
          autocomplete="new-password" spellcheck="false" maxlength="512" ${syncing ? 'disabled' : ''}>
          <button class="primary" type="submit" ${syncing ? 'disabled' : ''}>保存密钥</button></div>
      </form>`}
      <p class="aa-muted-text">${!managesKey ? '请在托管平台的密钥管理中更新 <code>AA_API_KEY</code>。'
        : '密钥加密保存在服务端。使用同一 Windows 账户重启后可继续同步。'}</p>
      ${keyNotice ? `<p class="aa-notice" role="status">${escapeHtml(keyNotice)}</p>` : ''}
    </section>
    <section class="panel aa-admin-panel" aria-labelledby="aa-sync-title">
      <div class="aa-admin-heading"><h2 id="aa-sync-title">分数同步</h2>
        <form method="post" action="${admin}/sync">
          <input type="hidden" name="csrf" value="${csrf}">
          <button class="primary" type="submit" ${!apiKey || syncing ? 'disabled' : ''}>${syncing ? '同步中…' : '同步 AA 分数'}</button>
        </form>
      </div>
      <p class="aa-muted-text">每天北京时间 ${dailyHour} 自动同步 · ${apiKey ? '已启用' : '待配置密钥'}</p>
      ${notice ? `<p class="aa-notice" role="status">${escapeHtml(notice)}</p>` : ''}
      <div class="aa-table-scroll"><table>
        <thead><tr><th scope="col">模型</th>${fields.map(([, label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="aa-admin-heading aa-admin-footer">
        <span>${syncedAt ? `最近写入 ${dateFormat.format(new Date(syncedAt))}` : '等待首次同步'}</span>
        <a href="${aaTier === 'pro' && hostedOrigin ? 'https://artificialanalysis.ai/data-api/docs/reference' : documentation}" target="_blank" rel="noopener">来源 · Artificial Analysis</a>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function safeSyncError(error) {
  const status = /^AA API 返回 HTTP (\d{3})/.exec(error.message)?.[1];
  if (status === '401' || status === '403') return `AA 返回 ${status}，请检查密钥及 API 访问权限。`;
  if (status === '429') return 'AA 请求额度已用完，请稍后再试。';
  if (status) return `AA 返回 ${status}，请稍后重试。`;
  if (error.name === 'TimeoutError') return 'AA 请求超时，请稍后重试。';
  return '未能完成同步。请检查网络、AA 响应或本地数据文件后重试。';
}

async function runSync() {
  syncing = true;
  outcomes = undefined;
  notice = '正在读取 AA 官方数据…';
  try {
    if (hostedOrigin) {
      const api = await loadApi(aaTier, apiKey);
      const snapshot = readSnapshot({ allowMissing: true });
      writeSnapshot({ ...snapshot, api: { ...api, checkedAt: new Date().toISOString() } });
      notice = `已同步 ${api.models.length} 款模型。打开模型对比可查看最新评测。`;
      return;
    }
    const result = await syncCapabilities(apiKey);
    outcomes = result.rows;
    notice = result.stored
      ? `已同步 ${result.stored} / 6 项分数。打开模型对比可查看新排名。`
      : 'AA 暂未返回目标分数，已保留网站现有数据。';
  } catch (error) {
    notice = `${safeSyncError(error)} 已保留网站现有数据。`;
  } finally {
    syncing = false;
  }
}

function automaticSync() {
  if (!apiKey || syncing) return;
  const now = new Date();
  const today = chinaCalendar.format(now);
  if (lastAutomaticDay === today || now.getTime() < Date.parse(`${today}T${dailyHour}:00+08:00`)) return;
  try {
    const snapshot = readSnapshot({ allowMissing: true });
    const checkedAt = hostedOrigin ? snapshot.api?.checkedAt : snapshot.capabilityPatch?.checkedAt;
    if (checkedAt && chinaCalendar.format(new Date(checkedAt)) === today) return;
    lastAutomaticDay = today;
    void runSync();
  } catch {
    lastAutomaticDay = today;
    notice = '读取本地分数失败，请检查数据文件后手动重试。';
  }
}

async function readForm(req) {
  if (req.headers['content-type']?.split(';', 1)[0] !== 'application/x-www-form-urlencoded') return null;
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function reply(res, status, body = '') {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

async function serveAdmin(req, res, route, origin) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('Referrer-Policy', 'same-origin');
  if (adminDigest) {
    const credentials = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(req.headers.authorization ?? '')?.[1] ?? '';
    if (!timingSafeEqual(authDigest(credentials), adminDigest)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Compute Axis AA", charset="UTF-8"');
      return reply(res, 401, '请输入管理账号和密码。');
    }
  }
  if (req.method === 'GET' && route === admin) {
    const html = adminPage();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }
  if (req.method !== 'POST' || ![`${admin}/key`, `${admin}/sync`].includes(route)) {
    return reply(res, 404, '页面不存在。');
  }
  if (req.headers.origin !== origin) return reply(res, 403, '请从后台页面提交。');
  const form = await readForm(req);
  if (form?.get('csrf') !== csrf) return reply(res, 403, '页面已过期，请刷新后重试。');
  if (syncing) return reply(res, 409, '同步正在进行，请稍后刷新后台。');
  if (route.endsWith('/key')) {
    if (!managesKey) return reply(res, 409, '密钥由托管环境管理。');
    const key = form.get('key')?.trim();
    if (!key || !keyPattern.test(key)) return reply(res, 400, '密钥格式无效。');
    try {
      const firstConfiguration = !apiKey;
      saveKey(key);
      apiKey = key;
      keySource = '服务端已加密保存';
      keyNotice = '';
      notice = '密钥已保存，可以手动同步。';
      if (firstConfiguration) {
        lastAutomaticDay = chinaCalendar.format(new Date());
        void runSync();
      } else {
        lastAutomaticDay = '';
        automaticSync();
      }
    } catch {
      keyNotice = '密钥保存失败，请检查 Windows 账户和服务端目录权限。';
    }
  } else if (apiKey) {
    lastAutomaticDay = chinaCalendar.format(new Date());
    void runSync();
  } else {
    notice = '请先配置 AA API 密钥。';
  }
  res.writeHead(303, { Location: admin });
  res.end();
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  const actualPort = server.address().port;
  const acceptedHosts = hostedOrigin
    ? [hostedOrigin.host]
    : [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`];
  if (!acceptedHosts.includes(req.headers.host)) {
    return reply(res, 403, '请求地址无效。');
  }
  const origin = hostedOrigin?.origin ?? `http://${req.headers.host}`;
  try {
    const url = new URL(req.url, origin);
    if (url.origin !== origin) return reply(res, 403, '请求地址无效。');
    if (url.pathname === admin || url.pathname.startsWith(`${admin}/`)) {
      return await serveAdmin(req, res, url.pathname, origin);
    }
    const file = url.pathname === '/' || url.pathname === '/favicon.ico'
      ? (url.pathname === '/' ? 'index.html' : siteLogo) : url.pathname.slice(1);
    const asset = /^assets\/(brands\/)?[\w.-]+\.(?:ico|png|svg|webp|jpe?g)$/.test(file)
      || /^assets\/brands\/transparent\/[a-z0-9-]+\.png$/.test(file);
    const agentation = agentationEnabled && file === agentationRoute;
    if (!['GET', 'HEAD'].includes(req.method) || (!asset && !agentation && !publicFiles.has(file))) {
      return reply(res, 404, '页面不存在。');
    }
    if (!publicAA && ['aa-chart-data.js', 'aa-official-data.js'].includes(file)) {
      return reply(res, 404, '页面不存在。');
    }
    if (file === 'aa-official-data.js') {
      const javascript = clientSnapshotScript(readSnapshot({ allowMissing: true }));
      res.writeHead(200, { 'Content-Type': contentTypes['.js'], 'Content-Length': Buffer.byteLength(javascript) });
      return res.end(req.method === 'HEAD' ? undefined : javascript);
    }
    const absolutePath = agentation ? agentationBundle : path.join(site, file);
    if (hostedOrigin && file === 'models.html') {
      let html = await fs.readFile(absolutePath, 'utf8');
      html = html.replace('data-page="models"', 'data-page="models" data-hosted="true"');
      if (!publicAA) html = html.replace(/^  <script defer data-aa-chart .+?<\/script>\r?\n/gm, '');
      res.writeHead(200, { 'Content-Type': contentTypes['.html'], 'Content-Length': Buffer.byteLength(html) });
      return res.end(req.method === 'HEAD' ? undefined : html);
    }
    if (agentationEnabled && file.endsWith('.html')) {
      const html = await fs.readFile(absolutePath, 'utf8');
      const preview = html.replace('</body>', `<script defer src="/${agentationRoute}"></script></body>`);
      res.writeHead(200, { 'Content-Type': contentTypes['.html'], 'Content-Length': Buffer.byteLength(preview) });
      return res.end(req.method === 'HEAD' ? undefined : preview);
    }
    const info = await fs.stat(absolutePath);
    if (!info.isFile()) return reply(res, 404, '页面不存在。');
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)], 'Content-Length': info.size });
    if (req.method === 'HEAD') return res.end();
    createReadStream(absolutePath).on('error', () => res.destroy()).pipe(res);
  } catch (error) {
    if (!res.headersSent) reply(res, error.code === 'ENOENT' ? 404 : 500, '读取失败，请重试。');
    else res.destroy();
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`后台 ${hostedOrigin?.origin ?? `http://127.0.0.1:${server.address().port}`}${admin}`);
  automaticSync();
  setInterval(automaticSync, 30_000).unref();
});
