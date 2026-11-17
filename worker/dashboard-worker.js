// GAMEZH 網站 Worker（單一檔案版，直接貼進 Cloudflare 線上編輯器）
// 部署到：https://www.992851qaz.workers.dev
//
// 運作方式：
// - 網頁內容從 GitHub Pages（https://992851qaz-bot.github.io/-/）取得，所以只要 push 到 GitHub，這裡會自動是最新版，不用再改這個檔案。
// - /download/windows ：直接下載 GitHub Releases 最新版的 .exe / .msi / .msix
// - /download/mac     ：最新版的 .dmg / .pkg
// - /download/latest.json ：最新版資訊（版本、檔名、大小）
// - /api/beta ：手機版測試申請（Email 轉送到 Discord；Webhook 存在 Cloudflare 加密變數 BETA_WEBHOOK_URL）

const ORIGIN = 'https://992851qaz-bot.github.io/-';
const REPO = '992851qaz-bot/-';
const STORE_URL = 'https://apps.microsoft.com/detail/9N19LCKX2NSW';
const RELEASES_URL = 'https://github.com/' + REPO + '/releases/latest';
const PAGE_CACHE_SECONDS = 300;   // 網頁在 Cloudflare 邊緣快取 5 分鐘
const API_CACHE_SECONDS = 600;    // GitHub 最新版資訊快取 10 分鐘

const PLATFORMS = {
  windows: (n) => /\.(exe|msi|msix|msixbundle)$/i.test(n),
  mac: (n) => /\.(dmg|pkg)$/i.test(n) || /mac.*\.zip$/i.test(n)
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/beta') return handleBeta(request, env, ctx);
    if (url.pathname === '/download' || url.pathname.startsWith('/download/')) {
      return handleDownload(url, env, ctx);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    return proxyPage(request, url);
  }
};

// ---------- 網頁：轉給 GitHub Pages ----------
async function proxyPage(request, url) {
  const upstreamUrl = ORIGIN + (url.pathname === '/' ? '/' : url.pathname) + url.search;
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: { 'User-Agent': 'gamezh-site-worker', Accept: request.headers.get('Accept') || '*/*' },
    redirect: 'manual',
    cf: { cacheTtl: PAGE_CACHE_SECONDS, cacheEverything: true }
  });

  const headers = new Headers(upstream.headers);
  // GitHub Pages 的轉址（例如補斜線）改回本站網址
  const loc = headers.get('Location');
  if (loc) headers.set('Location', loc.replace(/^https?:\/\/992851qaz-bot\.github\.io\/-/, url.origin));
  headers.set('Cache-Control', 'public, max-age=' + PAGE_CACHE_SECONDS);
  headers.delete('x-github-request-id');
  headers.delete('via');
  headers.set('X-Served-By', 'gamezh-worker');

  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

// ---------- 下載：轉到 GitHub Releases 最新版 ----------
async function latestRelease(env, ctx) {
  const api = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  const cache = caches.default;
  const key = new Request(api);
  let res = await cache.match(key);
  if (!res) {
    const headers = { 'User-Agent': 'gamezh-download-worker', Accept: 'application/vnd.github+json' };
    if (env && env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + env.GITHUB_TOKEN;
    const upstream = await fetch(api, { headers });
    if (!upstream.ok) return null;
    res = new Response(upstream.body, upstream);
    res.headers.set('Cache-Control', 'public, max-age=' + API_CACHE_SECONDS);
    ctx.waitUntil(cache.put(key, res.clone()));
  }
  return res.json();
}

// 從 tag 或檔名抓版本號，例如 "GameZH_.HUD_v4.0.14.exe" → "v4.0.14"
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
  const what = url.pathname.replace(/\/+$/, '').split('/')[2] || 'windows';
  let release = null;
  try { release = await latestRelease(env, ctx); } catch (e) { release = null; }

  if (what === 'latest.json') {
    const info = { version: release ? versionOf(release) : null, published: release ? release.published_at : null, assets: {} };
    for (const p of Object.keys(PLATFORMS)) {
      const a = pickAsset(release, p);
      if (a) info.assets[p] = { name: a.name, size: a.size, url: '/download/' + p };
    }
    return new Response(JSON.stringify(info), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=' + API_CACHE_SECONDS, 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (!PLATFORMS[what]) return Response.redirect(url.origin + '/exe.html#download', 302);
  const asset = pickAsset(release, what);
  if (asset) return Response.redirect(asset.browser_download_url, 302);
  return Response.redirect(what === 'windows' ? STORE_URL : RELEASES_URL, 302);
}

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
