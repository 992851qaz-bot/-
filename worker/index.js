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
    if (url.pathname === '/download' || url.pathname.startsWith('/download/')) {
      return handleDownload(url, env, ctx);
    }
    return env.ASSETS.fetch(request);
  }
};
