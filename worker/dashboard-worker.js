// GAMEZH 網站 Worker（單一檔案版，直接貼進 Cloudflare 線上編輯器）
// 部署到：https://www.992851qaz.workers.dev
//
// 運作方式：
// - 網頁內容從 GitHub Pages（https://992851qaz-bot.github.io/-/）取得，所以只要 push 到 GitHub，這裡會自動是最新版，不用再改這個檔案。
// - /download/windows ：直接下載 GitHub Releases 最新版的 .exe / .msi / .msix
// - /download/mac     ：最新版的 .dmg / .pkg
// - /download/latest.json ：最新版資訊（版本、檔名、大小）

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
