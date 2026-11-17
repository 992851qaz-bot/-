# 部署到 Cloudflare Workers：www.992851qaz.workers.dev

網站會同時在兩個地方上線：

| 網址 | 怎麼更新 |
|---|---|
| https://992851qaz-bot.github.io/-/ | push 到 `copilot/20260828` 自動部署（原本就有） |
| https://www.992851qaz.workers.dev | push 到 `copilot/20260828` 自動部署（這份文件設定） |

Cloudflare 版多了「直接下載安裝檔」：`/download/windows`、`/download/mac` 會自動轉到 GitHub Releases 的最新版。

---

## 一、第一次設定（只要做一次）

### 1. 設定 workers.dev 子網域
1. 登入 https://dash.cloudflare.com
2. 左側選 **Workers & Pages**
3. 第一次進來會要你設定子網域，輸入 **`992851qaz`**（已經設定過的話，在 Workers & Pages 右側「Subdomain」可以看到或修改）

> Worker 名稱是 `www`（寫在 `wrangler.jsonc`），所以網址會是 `www` + `.992851qaz.workers.dev`。

### 2. 建立 API Token
1. 右上角頭像 → **My Profile** → **API Tokens** → **Create Token**
2. 選範本 **Edit Cloudflare Workers** → Continue → Create Token
3. 複製產生的 Token（只會顯示一次）

### 3. 找到 Account ID
在 **Workers & Pages** 頁面右側，或任一網域的 Overview 頁右下角，可以看到 **Account ID**，複製下來。

### 4. 把兩個值存到 GitHub
1. 打開 https://github.com/992851qaz-bot/-/settings/secrets/actions
2. **New repository secret**，新增兩個：
   - `CLOUDFLARE_API_TOKEN`：第 2 步的 Token
   - `CLOUDFLARE_ACCOUNT_ID`：第 3 步的 Account ID

### 5. 觸發第一次部署
到 https://github.com/992851qaz-bot/-/actions → 左側選 **Deploy to Cloudflare Workers** → **Run workflow**。
跑完（約 1 分鐘）打開 https://www.992851qaz.workers.dev 確認。

之後每次 push 到 `copilot/20260828` 都會自動更新，不用再做任何事。

---

## 二、發布新版安裝檔（每次更新程式時）

1. 打開 https://github.com/992851qaz-bot/-/releases/new
2. **Choose a tag** 輸入版本號，例如 `v4.0.7`，選 Create new tag
3. 標題填版本號，內容寫更新內容
4. 把安裝檔拖進下方 **Attach binaries** 區塊
   - Windows：`.exe`、`.msi` 或 `.msix`
   - Mac：`.dmg` 或 `.pkg`
5. 確認 **Set as the latest release** 有勾選 → **Publish release**

完成後（最多 10 分鐘快取）：
- https://www.992851qaz.workers.dev/download/windows 會直接開始下載新版
- 電腦版頁面的「直接下載安裝檔」按鈕會自動顯示版本號和檔案大小

網站和下載連結都不用改。

### 為什麼放 GitHub Releases？
- Cloudflare Workers 單一檔案上限 25 MB，安裝檔通常超過
- GitHub Releases 單檔可到 2 GB，免費、有 CDN、不限下載次數
- 還沒上傳安裝檔時，`/download/windows` 會自動轉到微軟商城，不會壞掉

---

## 三、常見問題

**Actions 顯示「略過部署」**：還沒設定 `CLOUDFLARE_API_TOKEN`，照第一節第 4 步設定。

**下載連結轉到微軟商城而不是安裝檔**：最新的 Release 裡沒有 `.exe/.msi/.msix` 檔，或 Release 被標成 Pre-release（`latest` 不含 Pre-release）。

**下載很多人時 GitHub API 次數**：Worker 會把最新版資訊快取 10 分鐘，一般用量不會碰到上限。真的碰到時，可在 Cloudflare 的 Worker 設定 → Variables and Secrets 加一個 `GITHUB_TOKEN`（GitHub 的 fine-grained token，只要 public repo 讀取權限）。

**想用自己的網域**：Cloudflare 的 Worker 頁面 → Settings → Domains & Routes → Add Custom Domain。

## 相關檔案
- `wrangler.jsonc`：Worker 設定（名稱、靜態檔案目錄）
- `worker/index.js`：`/download` 轉址邏輯
- `.assetsignore`：不上傳到 Cloudflare 的檔案
- `.github/workflows/cloudflare.yml`：自動部署
