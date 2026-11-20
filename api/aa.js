const { createHash, timingSafeEqual } = require('node:crypto');
const { get, head, put, BlobNotFoundError, BlobPreconditionFailedError } = require('@vercel/blob');
const { clientSnapshotScript, loadApi, readSnapshot } = require('../scripts/import_aa.cjs');

const pathname = 'compute-axis/aa-snapshot.json';
const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' });
const time = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short', hour12: false,
});
const digest = value => createHash('sha256').update(value).digest();
const matches = (request, expected) => timingSafeEqual(digest(request ?? ''), digest(expected));
const configuredStorage = () => process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN;
const bundledSnapshot = () => readSnapshot({ allowMissing: true });

async function currentSnapshot(consistent = false) {
  if (configuredStorage()) {
    const result = await get(pathname, { access: 'private', useCache: !consistent });
    if (result?.statusCode === 200) {
      return { data: await new Response(result.stream).json(), etag: result.blob.etag };
    }
  }
  return { data: bundledSnapshot() };
}

async function synchronize(automatic) {
  const key = process.env.AA_API_KEY?.trim();
  if (!key || !configuredStorage()) return 'missing';
  const version = await head(pathname).then(blob => blob.etag).catch(error => {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  });
  const previous = await currentSnapshot(true);
  // Use the storage metadata ETag for writes; a read can carry a CDN ETag.
  if (version && previous.etag !== version) {
    const metadata = await head(pathname);
    if (metadata.etag !== version) return 'conflict';
  }
  if (!version && previous.etag) return 'conflict';
  const checkedAt = previous.data.api?.checkedAt;
  if (automatic && checkedAt && day.format(new Date(checkedAt)) === day.format(new Date())) return 'skipped';
  const api = await loadApi(process.env.AA_API_TIER === 'pro' ? 'pro' : 'free', key);
  try {
    await put(pathname, JSON.stringify({ ...previous.data, api: { ...api, checkedAt: new Date().toISOString() } }), {
      access: 'private',
      contentType: 'application/json',
      cacheControlMaxAge: 60,
      ...(version ? { allowOverwrite: true, ifMatch: version } : { allowOverwrite: false }),
    });
    return 'ok';
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return 'conflict';
    throw error;
  }
}

function reply(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(text);
}

async function admin(req, res, url) {
  const password = process.env.COMPUTE_AXIS_ADMIN_PASSWORD;
  if (!password || password.length < 24) return reply(res, 503, '管理后台等待配置。');
  const expected = 'Basic ' + Buffer.from(`admin:${password}`).toString('base64');
  if (!matches(req.headers.authorization, expected)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Compute Axis AA", charset="UTF-8"');
    return reply(res, 401, '请输入管理账号和密码。');
  }
  if (req.method === 'POST') {
    const origin = process.env.COMPUTE_AXIS_ORIGIN ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
    if (!origin || req.headers.origin !== origin) return reply(res, 403, '请从本站管理后台提交。');
    const outcome = await synchronize(false).catch(() => 'failed');
    res.writeHead(303, { Location: `/admin/aa?sync=${outcome}` });
    return res.end();
  }
  if (req.method !== 'GET') return reply(res, 405, '请求方法不受支持。');
  const { data } = await currentSnapshot(true);
  const date = data.api?.checkedAt;
  const configured = Boolean(process.env.AA_API_KEY) && Boolean(configuredStorage());
  const messages = new Map([
    ['ok', '同步成功。'], ['missing', '请在 Vercel 配置 AA 密钥和存储。'],
    ['failed', '同步失败，已保留上次成功的结果。'],
    ['skipped', '已有更新，请刷新查看。'],
    ['conflict', '快照写入发生冲突，请稍后重试。'],
  ]);
  const notice = messages.get(req.query?.sync ?? url.searchParams.get('sync'));
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return reply(res, 200, `<!doctype html>
<html lang="zh-CN" data-theme="dark"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AA 数据同步 · 算力坐标</title>
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/aa-admin.css">
<script src="/theme.js"></script></head>
<body><main class="aa-admin"><a href="/models.html">← 返回模型对比</a><h1>AA 数据同步</h1>
<section class="panel aa-admin-panel">
<p>服务端密钥 ${process.env.AA_API_KEY ? '已配置' : '待配置'} · 持久化存储 ${configuredStorage() ? '已配置' : '待配置'}</p>
<p>最近成功同步 ${date ? time.format(new Date(date)) : '等待首次同步'}</p>
<p>每天北京时间 03:00 开始调度，Hobby 计划有 15 分钟触发窗口。</p>
${notice ? `<p role="status">${notice}</p>` : ''}
<form method="post" action="/admin/aa/sync"><button class="primary"${configured ? '' : ' disabled'}>立即同步</button></form>
</section></main></body></html>`, 'text/html; charset=utf-8');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  try {
    const url = new URL(req.url, 'https://compute-axis.invalid');
    const view = req.query?.view ?? url.searchParams.get('view');
    if (view === 'admin') return await admin(req, res, url);
    if (view === 'data') {
      if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, '请求方法不受支持。');
      const data = await currentSnapshot().then(result => result.data, bundledSnapshot);
      const source = clientSnapshotScript(data);
      return reply(res, 200, req.method === 'HEAD' ? undefined : source, 'text/javascript; charset=utf-8');
    }
    if (req.method !== 'GET') return reply(res, 405, '请求方法不受支持。');
    const secret = process.env.CRON_SECRET;
    if (!secret || !matches(req.headers.authorization, `Bearer ${secret}`)) return reply(res, 401, '无调度权限。');
    const result = await synchronize(true);
    return reply(res, result === 'missing' ? 503 : result === 'conflict' ? 409 : 200, result);
  } catch {
    return reply(res, 503, 'AA 服务暂时无法完成请求。');
  }
};
