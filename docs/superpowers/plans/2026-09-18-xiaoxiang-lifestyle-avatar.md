# 小象生活系頭像 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 以母專案《就快到了》與《單單環島》的角色畫法，使用 Google Cloud Vertex AI 額度生成小象生活系頭像，並接入印象魔法助手的多狀態表情與離線快取。

**Architecture:** 新增一支可重複執行的 Vertex AI 生成器，先建立小象母版，再以母版生成五種狀態與眨眼版本，成功後以原子寫入保存圖片與 provenance。前端以獨立的頭像狀態映射模組管理 `idle`、`hello`、`think`、`thumbs`、`cheer` 及 fallback，`XiaoxiangAssistant` 只負責依應用狀態呼叫它。Service worker 預快取全部正式素材，任何資產缺失都退回既有 `xiaoxiang.jpg`。

**Tech Stack:** Node.js 22 ESM、Google Cloud Vertex AI REST API、原生 TypeScript/DOM、Vite、Vitest、PowerShell image inspection。

## Global Constraints

- 小象必須是約 28–32 歲的年輕成年擬人角色，金髮武士頭，乾淨年輕臉，可靠而略慵懶。
- 固定穿霧藍色針織上衣與卡其色休閒褲；不得出現墨鏡、車衣、車褲、單車、健身房制服、帽子、背包、Logo 或可讀文字。
- 五種核心狀態各有自然眨眼版本，共十張 1:1 頭像；同一組臉型、髮型、身形、服裝與裁切位置。
- 優先使用 Google Cloud Vertex AI `gemini-3.1-flash-lite-image`；429 時改用同一專案 `gemini-2.5-flash-image`。
- 憑證只讀本機 gcloud ADC 或既有 Google Cloud 環境變數，不寫入原始碼、前端 bundle、manifest 或 Git。
- 無 project、token、權限或生成失敗時不建立假圖、不破壞既有 `public/xiaoxiang.jpg`，前端仍可啟動。
- 在所有實作完成前，不宣稱 Google Cloud 生成成功；需以檔案簽名、尺寸、視覺檢查、typecheck、build 與測試結果為準。

---

### Task 1: 建立 Vertex AI 生活系頭像生成器與資產測試

**Files:**
- Create: `tools/generate-xiaoxiang-lifestyle-assets.mjs`
- Create: `tests/xiaoxiang-avatar-assets.test.mjs`
- Create: `public/xiaoxiang/avatar-provenance.json`（由成功生成器寫入）
- Create: `public/xiaoxiang/*.webp`（由成功生成器寫入）

**Interfaces:**
- `tools/generate-xiaoxiang-lifestyle-assets.mjs` 支援 `--dry-run`、`--force`、`--only=<id>`，輸出 `public/xiaoxiang/<id>.webp` 與 `<id>-blink.webp`。
- 生成器使用 workspace 母版參考 `../bike-training/小象/小象.png`；若檔案不存在，改用 `public/xiaoxiang.jpg` 作為 fallback 參考，不能因此刪除既有檔案。
- `tests/xiaoxiang-avatar-assets.test.mjs` 驗證正式資產路徑、WebP/PNG/JPEG 最小簽名、provenance 欄位與狀態清單；沒有正式生成資產時測試只驗證 generator dry-run 匯出的清單，不要求偽造圖片。

- [ ] **Step 1: 寫資產清單與 dry-run 測試**

```js
const STATES = ['idle', 'hello', 'think', 'thumbs', 'cheer'];
const ASSETS = STATES.flatMap((state) => [state, `${state}-blink`]);

test('generator exposes the ten approved avatar states', async () => {
  const source = await readFile('tools/generate-xiaoxiang-lifestyle-assets.mjs', 'utf8');
  for (const id of ASSETS) assert.match(source, new RegExp(`['"]${id}['"]`));
});
```

- [ ] **Step 2: 執行測試確認目前尚未通過**

Run: `node --test tests/xiaoxiang-avatar-assets.test.mjs`

Expected: FAIL because the generator and asset manifest do not exist yet.

- [ ] **Step 3: 實作生成器的請求、憑證與原子寫入**

實作下列固定邏輯：

```js
const MODELS = ['gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image'];
const STATES = ['idle', 'hello', 'think', 'thumbs', 'cheer'];
const COMMON_LOCK = 'the exact same young adult male Xiao-Xiang character, age 28 to 32, clean youthful face, blond high samurai bun, calm reliable slightly lazy personality, mist-blue knit top, khaki casual trousers, no accessories';
const NEGATIVE_LOCK = 'no sunglasses, no cycling jersey, no cycling shorts, no bicycle, no gym uniform, no hat, no bag, no logo, no readable text, no watermark, no extra person, no extra limbs';

async function generateImage({ project, token, model, prompt, references }) {
  const endpoint = `https://aiplatform.googleapis.com/v1beta1/projects/${encodeURIComponent(project)}/locations/global/publishers/google/models/${model}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [
        { text: prompt },
        ...references.map(({ mimeType, data }) => ({ inlineData: { mimeType, data } })),
      ] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Vertex AI HTTP ${response.status}: ${body?.error?.message || 'unknown error'}`);
  const part = body?.candidates?.flatMap((candidate) => candidate?.content?.parts || [])
    .find((candidatePart) => candidatePart?.inlineData?.data || candidatePart?.inline_data?.data);
  const base64 = part?.inlineData?.data || part?.inline_data?.data;
  if (!base64) throw new Error('Vertex AI response did not contain image data');
  return Buffer.from(base64, 'base64');
}

function atomicWrite(file, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length <= 1024) throw new Error('refusing to write an invalid image');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
}
```

請求 endpoint 使用 `https://aiplatform.googleapis.com/v1beta1/projects/<project>/locations/global/publishers/google/models/<model>:generateContent`，body 使用 `responseModalities: ['IMAGE']`。先生成 `idle` 母版；其餘九張都附帶母版 inline image reference。每一張狀態只替換狀態描述，不重新改寫角色鎖定。429 才嘗試下一個模型；其他 HTTP 錯誤直接保留既有圖片並記錄失敗。

`--dry-run` 只檢查 project/token 來源、列出十張輸出檔與模型順序，不呼叫 Vertex AI、不寫入圖片。生成成功後以 SHA-256 寫入 `avatar-provenance.json`，且不寫 access token。

- [ ] **Step 4: 執行 dry-run**

Run: `node tools/generate-xiaoxiang-lifestyle-assets.mjs --dry-run`

Expected: 列出十個狀態、參考圖路徑、首選模型與 fallback 模型；不新增或覆蓋圖片。

- [ ] **Step 5: 執行生成**

Run: `node tools/generate-xiaoxiang-lifestyle-assets.mjs --force`

Expected with credentials: Vertex AI 生成十張圖片、寫入 `public/xiaoxiang/`、更新 provenance，並輸出每張檔案的尺寸與 SHA-256。

Expected without credentials: 明確輸出 project/token 未設定，退出碼 0，不更動 `public/xiaoxiang.jpg`。

- [ ] **Step 6: 執行資產測試**

Run: `node --test tests/xiaoxiang-avatar-assets.test.mjs`

Expected: PASS；若生成尚未可用，測試只允許 dry-run／pending 狀態，不接受小於 1 KB 或錯誤副檔名的檔案。

- [ ] **Step 7: Commit generator and provenance changes**

```powershell
git add tools/generate-xiaoxiang-lifestyle-assets.mjs tests/xiaoxiang-avatar-assets.test.mjs public/xiaoxiang
git commit -m "feat: add Vertex AI lifestyle avatar generator"
```

### Task 2: 加入小象頭像狀態映射與眨眼 fallback

**Files:**
- Create: `src/ui/xiaoxiang-avatar.ts`
- Create: `tests/xiaoxiang-avatar.test.ts`
- Modify: `src/ui/xiaoxiang-assistant.ts`

**Interfaces:**
- `XiaoxiangAvatarState = 'idle' | 'hello' | 'think' | 'thumbs' | 'cheer'`
- `avatarAssetPath(state: XiaoxiangAvatarState, blink: boolean): string`
- `fallbackAvatarAssetPath(state: XiaoxiangAvatarState, blink: boolean, available: Set<string>): string`
- `XiaoxiangAssistant.setAvatarState(state: XiaoxiangAvatarState): void`

- [ ] **Step 1: 寫純函式失敗測試**

```ts
it('maps states to the new public assets', () => {
  expect(avatarAssetPath('think', false)).toBe('xiaoxiang/think.webp');
  expect(avatarAssetPath('think', true)).toBe('xiaoxiang/think-blink.webp');
});

it('falls back to idle and then the legacy JPG', () => {
  const available = new Set(['xiaoxiang/idle.webp']);
  expect(fallbackAvatarAssetPath('cheer', false, available)).toBe('xiaoxiang/idle.webp');
  expect(fallbackAvatarAssetPath('cheer', true, new Set())).toBe('xiaoxiang.jpg');
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm test -- --run tests/xiaoxiang-avatar.test.ts`

Expected: FAIL because the mapping module does not exist.

- [ ] **Step 3: 實作映射與安全 fallback**

`avatarAssetPath` 只組合固定狀態名稱，不接受任意使用者輸入；`fallbackAvatarAssetPath` 的順序固定為指定狀態 → `idle` → `xiaoxiang.jpg`。不要在映射模組發出網路請求。

- [ ] **Step 4: 將 `XiaoxiangAssistant` 接入狀態切換與眨眼**

在既有 `render()` 的 `#xiangFace` 保留 alt 與 class，新增 `data-avatar-state="idle"`。加入 `setAvatarState`，使用 `HTMLImageElement.src` 切換資產；切換前預載入候選圖片，`error` 事件改用 fallback 且只重試一次。使用一個 timeout 做 2.8–4.6 秒間隔的自然眨眼，先檢查目前 state token，避免舊 timer 把新狀態換回去。`prefers-reduced-motion: reduce` 時不啟動眨眼 timer。

狀態呼叫規則：

```ts
// constructor/render 完成後
this.setAvatarState('idle');
// 收到新圖或處理中
this.setAvatarState('think');
// 處理完成
this.setAvatarState('thumbs');
// welcome / 點擊頭像的打招呼情境
this.setAvatarState('hello');
// 完成輸出或匯出成功
this.setAvatarState('cheer');
```

- [ ] **Step 5: 執行頭像單元測試與 typecheck**

Run: `npm test -- --run tests/xiaoxiang-avatar.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS with no new TypeScript errors.

- [ ] **Step 6: Commit avatar state integration**

```powershell
git add src/ui/xiaoxiang-avatar.ts src/ui/xiaoxiang-assistant.ts tests/xiaoxiang-avatar.test.ts
git commit -m "feat: add Xiaoxiang avatar expression states"
```

### Task 3: 更新 PWA 快取與站內主圖引用

**Files:**
- Modify: `public/sw.js`
- Modify: `index.html`
- Modify: `public/manifest.json`
- Modify: `public/sw.js` cache version

**Interfaces:**
- `ASSETS_TO_CACHE` 必須包含十張 `./xiaoxiang/*.webp` 正式資產與既有 `./xiaoxiang.jpg`。
- 網站 favicon、apple-touch-icon、manifest icon 與 header brand 維持 `xiaoxiang.jpg`，避免把狀態動畫當成 app icon。

- [ ] **Step 1: 擴充 precache 清單**

將以下路徑加入 `ASSETS_TO_CACHE`：

```js
'./xiaoxiang/idle.webp', './xiaoxiang/idle-blink.webp',
'./xiaoxiang/hello.webp', './xiaoxiang/hello-blink.webp',
'./xiaoxiang/think.webp', './xiaoxiang/think-blink.webp',
'./xiaoxiang/thumbs.webp', './xiaoxiang/thumbs-blink.webp',
'./xiaoxiang/cheer.webp', './xiaoxiang/cheer-blink.webp'
```

將 `CACHE_NAME` 升版，避免舊 service worker 永久保留舊頭像。

- [ ] **Step 2: 保留既有主圖與 fallback**

確認 `index.html` 與 `public/manifest.json` 的 `xiaoxiang.jpg` 仍存在；若資產尚未生成，主頁仍使用原圖正常載入。

- [ ] **Step 3: 加入離線資產測試**

在既有離線測試或新測試中檢查十張路徑與 legacy JPG 都出現在 `public/sw.js`，並檢查 cache version 不再是 `printmagic-v3.2.0-offline`。

- [ ] **Step 4: Commit PWA cache changes**

```powershell
git add public/sw.js index.html public/manifest.json tests
git commit -m "feat: precache Xiaoxiang avatar states offline"
```

### Task 4: 全量驗證與視覺檢查

**Files:**
- Inspect: `public/xiaoxiang/*.webp`, `public/xiaoxiang/avatar-provenance.json`
- Inspect: `src/ui/xiaoxiang-assistant.ts`, `src/ui/xiaoxiang-avatar.ts`, `public/sw.js`

- [ ] **Step 1: 檢查所有圖片簽名與尺寸**

Run: `node --test tests/xiaoxiang-avatar-assets.test.mjs`

Expected: 十張正式資產均為可讀 WebP，尺寸一致，檔案大於 1 KB；pending 狀態只能在無 Google Cloud 憑證時出現。

- [ ] **Step 2: 視覺檢查原生尺寸與縮圖**

使用圖片檢視工具逐張檢查：同一張臉與衣服、沒有車衣／制服／墨鏡／Logo／文字，且在 32px、64px、96px 模擬尺寸下能辨識狀態。若任何一張漂移，保留既有素材並只重生成該狀態，不重跑已通過的圖片。

- [ ] **Step 3: 執行完整測試**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm test`

Expected: all existing and new tests PASS.

Run: `npm run build`

Expected: Vite production build PASS and includes the new public assets.

- [ ] **Step 4: 檢查 Git diff 與服務 worker 路徑**

Run: `git diff --check; git status --short`

Expected: no whitespace errors; only intended generator, docs, tests, avatar assets, UI and service worker changes remain.

- [ ] **Step 5: Commit verified implementation**

```powershell
git add .
git commit -m "feat: ship Xiaoxiang lifestyle avatar series"
```
