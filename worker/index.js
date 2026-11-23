// GAMEZH Cloudflare Worker
// - 一般網頁：直接交給靜態檔案（ASSETS）
// - /download/windows、/download/mac：轉到 GitHub Releases 最新版安裝檔（連結固定，換版本不用改網站）
// - /download/latest.json：最新版資訊（版本、檔名、大小），給下載按鈕顯示用

const REPO = '992851qaz-bot/-';
const STORE_URL = 'https://apps.microsoft.com/detail/9N19LCKX2NSW';
const FALLBACK_PAGE = '/exe.html#download';
const CACHE_SECONDS = 600; // GitHub API 結果在邊緣快取 10 分鐘，避免撞到 API 次數上限

const PLATFORMS = {
  windows: (name) => /\.(exe|msi|msix|msixbundle)$/i.test(name),
  mac: (name) => /\.(dmg|pkg)$/i.test(name) || /mac.*\.zip$/i.test(name)
};

async function latestRelease(env, ctx) {
  const api = `https://api.github.com/repos/${REPO}/releases/latest`;
  const cache = caches.default;
  const key = new Request(api);
  let res = await cache.match(key);
  if (!res) {
    const headers = { 'User-Agent': 'gamezh-download-worker', Accept: 'application/vnd.github+json' };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const upstream = await fetch(api, { headers });
    if (!upstream.ok) return null;
    res = new Response(upstream.body, upstream);
    res.headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    ctx.waitUntil(cache.put(key, res.clone()));
  }
  return res.json();
}

// 從 tag 或檔名抓出版本號，例如 "GameZH_.HUD_v4.0.14.exe" → "v4.0.14"
function versionOf(release) {
  const names = [release.tag_name, release.name].concat((release.assets || []).map((a) => a.name));
  for (const n of names) {
    const m = /v?(\d+(?:\.\d+){1,3})/i.exec(n || '');
    if (m) return 'v' + m[1];
  }
  return release.tag_name || null;
}

function pickAsset(release, platform) {
  const test = PLATFORMS[platform];
  if (!release || !test) return null;
  return (release.assets || []).find((a) => test(a.name)) || null;
}

async function handleDownload(url, env, ctx) {
  const parts = url.pathname.replace(/\/+$/, '').split('/'); // ['', 'download', 'windows']
  const what = parts[2] || 'windows';

  let release = null;
  try { release = await latestRelease(env, ctx); } catch (e) { release = null; }

  if (what === 'latest.json') {
    const info = { version: release ? versionOf(release) : null, published: release ? release.published_at : null, assets: {} };
    for (const p of Object.keys(PLATFORMS)) {
      const a = pickAsset(release, p);
      if (a) info.assets[p] = { name: a.name, size: a.size, url: `/download/${p}` };
    }
    return new Response(JSON.stringify(info), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` }
    });
  }

  if (!PLATFORMS[what]) return Response.redirect(new URL(FALLBACK_PAGE, url).toString(), 302);

  const asset = pickAsset(release, what);
  if (asset) return Response.redirect(asset.browser_download_url, 302);

  // 還沒上傳安裝檔或 GitHub 暫時連不到：Windows 送去微軟商城，其他回下載說明
  return Response.redirect(what === 'windows' ? STORE_URL : new URL(FALLBACK_PAGE, url).toString(), 302);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/beta') return handleBeta(request, env, ctx);
    if (url.pathname === '/api/cheer') return handleCheer(request, env, ctx);
    if (url.pathname === '/download' || url.pathname.startsWith('/download/')) {
      return handleDownload(url, env, ctx);
    }
    return env.ASSETS.fetch(request);
  }
};

// ---------- 手機版測試申請：/api/beta ----------
// Discord Webhook 放在 Cloudflare 的加密變數 BETA_WEBHOOK_URL（Settings → Variables and Secrets），不寫在程式或網頁裡。
const BETA_ALLOWED_ORIGINS = ['https://992851qaz-bot.github.io', 'https://www.992851qaz.workers.dev'];
const BETA_CHANNELS = ['Google Play', 'APK', '雲端下載'];
const BETA_RATE_SECONDS = 60; // 同一個 IP 一分鐘只能送一次

function betaCors(origin) {
  const h = { 'Vary': 'Origin' };
  if (BETA_ALLOWED_ORIGINS.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
function betaJson(status, body, origin) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, betaCors(origin)) });
}

async function handleBeta(request, env, ctx) {
  const origin = request.headers.get('Origin') || '';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: betaCors(origin) });
  if (request.method !== 'POST') return betaJson(405, { error: 'method' }, origin);
  if (!BETA_ALLOWED_ORIGINS.includes(origin)) return betaJson(403, { error: 'origin' }, origin);
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return betaJson(415, { error: 'type' }, origin);
  const webhook = env && env.BETA_WEBHOOK_URL;
  if (!webhook || !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(webhook)) return betaJson(503, { error: 'not configured' }, origin);

  const raw = await request.text();
  if (raw.length > 2048) return betaJson(413, { error: 'too large' }, origin);
  let data;
  try { data = JSON.parse(raw); } catch (e) { return betaJson(400, { error: 'json' }, origin); }

  // 機器人防護：隱藏欄位有填、或打開不到 1.5 秒就送出 → 假裝成功但不轉送
  if (data.website || (typeof data.elapsed === 'number' && data.elapsed < 1500)) return betaJson(200, { ok: true }, origin);

  const email = String(data.email || '').trim().slice(0, 254);
  if (!/^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i.test(email)) return betaJson(400, { error: 'email' }, origin);
  const channel = BETA_CHANNELS.includes(data.channel) ? data.channel : '未指定';

  // 每個 IP 限速
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = new Request('https://rate-limit.gamezh/beta/' + encodeURIComponent(ip));
  const cache = caches.default;
  if (await cache.match(rlKey)) return betaJson(429, { error: '太頻繁' }, origin);
  ctx.waitUntil(cache.put(rlKey, new Response('1', { headers: { 'Cache-Control': 'max-age=' + BETA_RATE_SECONDS } })));

  const clean = (s, n) => String(s || '').replace(/[`@]/g, '').slice(0, n) || '—';
  const payload = {
    username: 'GAMEZH 測試申請',
    allowed_mentions: { parse: [] }, // 不讓任何內容 @ 到人
    embeds: [{
      title: '📱 手機版測試申請',
      color: 0x5cc8ff,
      fields: [
        { name: 'Email', value: '`' + email.replace(/`/g, '') + '`' },
        { name: '安裝方式', value: channel, inline: true },
        { name: '國家', value: clean(request.cf && request.cf.country, 8), inline: true },
        { name: '來源頁面', value: clean(data.page, 100), inline: true },
        { name: '裝置', value: clean(data.ua, 200) }
      ],
      timestamp: new Date().toISOString()
    }]
  };
  const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) return betaJson(502, { error: 'upstream' }, origin);
  return betaJson(200, { ok: true }, origin);
}

// ---------- 英文版應援：/api/cheer ----------
// Discord Webhook 放在 Cloudflare 的加密變數 CHEER_WEBHOOK_URL，不寫在程式或網頁裡，瀏覽器永遠拿不到。
// 防護：只收自己網站的 Origin、JSON、大小上限、隱藏欄位＋送出時間擋機器人、同 IP 10 分鐘一次、內容不能 @ 人。
const CHEER_SOURCES = ['YouTube', 'Discord', 'Reddit', 'X / Twitter', 'Google', 'Friend', 'Bahamut', 'Other'];
const CHEER_RATE_SECONDS = 600;

async function handleCheer(request, env, ctx) {
  const origin = request.headers.get('Origin') || '';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: betaCors(origin) });
  if (request.method !== 'POST') return betaJson(405, { error: 'method' }, origin);
  if (!BETA_ALLOWED_ORIGINS.includes(origin)) return betaJson(403, { error: 'origin' }, origin);
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return betaJson(415, { error: 'type' }, origin);
  const webhook = env && env.CHEER_WEBHOOK_URL;
  if (!webhook || !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(webhook)) return betaJson(503, { error: 'not configured' }, origin);

  const raw = await request.text();
  if (raw.length > 4096) return betaJson(413, { error: 'too large' }, origin);
  let data;
  try { data = JSON.parse(raw); } catch (e) { return betaJson(400, { error: 'json' }, origin); }
  if (!data || typeof data !== 'object') return betaJson(400, { error: 'json' }, origin);

  // 機器人：隱藏欄位有填、或打開不到 3 秒就送出 → 假裝成功但不轉送
  if (data.website || (typeof data.elapsed === 'number' && data.elapsed < 3000)) return betaJson(200, { ok: true }, origin);

  const reason = String(data.reason || '').trim();
  if (reason.length < 3) return betaJson(400, { error: 'reason' }, origin);
  const sources = Array.isArray(data.sources) ? data.sources.filter((s) => CHEER_SOURCES.includes(s)).slice(0, CHEER_SOURCES.length) : [];

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = new Request('https://rate-limit.gamezh/cheer/' + encodeURIComponent(ip));
  const cache = caches.default;
  if (await cache.match(rlKey)) return betaJson(429, { error: 'rate' }, origin);
  ctx.waitUntil(cache.put(rlKey, new Response('1', { headers: { 'Cache-Control': 'max-age=' + CHEER_RATE_SECONDS } })));

  // 去掉 @、反引號、Markdown 連結語法，避免 @everyone 或偽造連結
  const clean = (s, n) => String(s || '').replace(/[`@]/g, '').replace(/\]\(/g, '] (').replace(/https?:\/\//gi, (m) => m.replace('//', '/\u200b/')).trim().slice(0, n) || '—';
  const payload = {
    username: 'GAMEZH 英文版應援',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: '💛 英文版 HUD 應援',
      color: 0xe3cd9a,
      fields: [
        { name: '想用的原因', value: clean(reason, 1000) },
        { name: '得知來源', value: sources.length ? sources.join('、') : '—', inline: true },
        { name: '暱稱', value: clean(data.nickname, 40), inline: true },
        { name: '聯絡方式', value: clean(data.contact, 100), inline: true },
        { name: '國家', value: clean(request.cf && request.cf.country, 8), inline: true },
        { name: '頁面語言', value: data.lang === 'en' ? 'English' : '中文', inline: true },
        { name: '來源頁面', value: clean(data.page, 60), inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  };
  const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) return betaJson(502, { error: 'upstream' }, origin);
  return betaJson(200, { ok: true }, origin);
}
