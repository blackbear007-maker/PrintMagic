# PrintMagic Studio 3.1 系統產品規格說明書 (System & Product SPEC)

> **版本**：v3.1.0-Release  
> **最後更新日期**：2026-08-23  
> **系統定位**：全自動商業印前修復與出機工作站 (AI Pre-Press Engine & Multi-Format Exporter)  
> **核心哲學**：100% 自由開源商用架構 · 0 外部收費 API 依賴 · 新手無腦一鍵出機 · 商業合規舉證  

> ⚠️ **誠實性附註（2026-08-25，後更新）**：本文件曾經在第 2、3、7 節列出大量從未實作的「模型」與功能（HAT-S、SwinIR、AOT-GAN、MAT-Lite、DexiNed、CodeFormer、GAIC、FontMatcher、桌面版效能數字等）——這些內容已於 2026-08-25 全面核實並改寫。第一輪核實時誤把 Zero-DCE++ 當成「真正訓練過的模型」，後來進一步查證發現它的 Docker 建置設定引用了從未存在過的權重檔案，程式碼裡也從未載入任何訓練權重（隨機初始化，非訓練結果）；VTracer 的 Dockerfile 同樣引用了從未存在過的原始碼，導致建置必定失敗，現已修正為安裝真正發布的 vtracer crate。目前唯一從頭到尾一致、可正常建置運作的自建服務是 **Tesseract**（OCR）；**VTracer**（向量化）已於本次更新修正為可建置；**Zero-DCE++**（低光提亮）架構程式碼是真的，但輸出品質不代表訓練過的模型。其餘全部是決定性演算法（無 AI 模型），詳見 [README](../README.md#️-引擎組成真實模型-vs-決定性演算法)。

---

## 1. 系統全景與技術架構 (System Architecture)

### 1.1 雲端微服務矩陣 (Railway Docker Multi-Container Architecture)
系統在雲端採用 4 大獨立輕量化容器，記憶體硬體上限嚴格鎖定在 1.4 GB 內，確保每月主機總開銷控制在 **$6.5 美元 (約 NT$ 210)** 內：

| 服務容器名稱 | 執行語言 / 運行環境 | 端口 (Port) | RAM 硬上限 | 核心職責與承載模組 |
| :--- | :--- | :---: | :---: | :--- |
| **`printmagic`** | Node.js 22 (Alpine) + Vite SSR | `3000` | **256 MB** | 主應用入口、UI 渲染、合版拼版算力、印前 PDF 出機檔壓製（非通過驗證的 PDF/X-1a，見第 5 節）。 |
| **`vtracer`** | Rust 1.78 (Distroless) | `8080` | **128 MB** | 真實 VTracer 向量化引擎（點陣轉 SVG）。「Kurbo 2mm 刀模幾何運算」實際跑在主應用內的 `src/core/kurbo-geometry.ts`（純 TypeScript），不在這個容器裡；「OxiPNG 無損壓縮」查無實作，本服務不做 PNG 壓縮，已移除該說法。 |
| **`tesseract`** | Python 3.11 + Tesseract 5.3 C++ | `8081` | **384 MB** | 繁中/英/日 OCR 文字辨識（真實 Tesseract，非 PP-OCR——PP-OCR 從未在本專案中實作）。 |
| **`zero-dce`** | Python 3.11 + PyTorch 2.3+ (CPU) | `8082` | **640 MB** | Zero-DCE++ 低光照片提亮。⚠️ 網路架構程式碼是真的，但從未載入訓練權重（隨機初始化，見 `docker/zero-dce/server.py` 內的說明）；歷史上曾對外宣稱承載 10+ 款模型，實際上其餘端點是回傳原圖的空殼，已於 2026-08-25 移除。 |

### 1.2 零外部付費 API 規則 (Strict 100% Zero-Commercial-API Policy)
- ❌ 徹底剔除 Google Cloud Vision、Remove.bg、PhotoRoom、Midjourney 等任何需第三方 Token/按次計費之商業 API。
- ✅ 100% 採用 **MIT / Apache 2.0 / BSD** 開源協議之演算法與模型，杜絕任何隱形成本與超額扣款風險。

### 1.3 🛡️ 絕不能移除的【黃金核心護城河】（Golden Core Moat Modules - 永久保留清單）
以下模組是真正**解決印刷翻車痛點、支撐產品付費轉換與商業護城河**的核心資產，**任何架構精簡或重構均嚴禁移除**：

全部是決定性演算法（無 AI 模型），檔名為 `src/core/` 中的真實檔案：

#### 🎨 1. 動漫 / 文創周邊剛需（創作者變現主力）
- **`sticker-kisscut-builder.ts` (手帳貼紙刀模線 + 0.2mm 內縮白墨)**：解決透明/PVC 貼紙透光問題，自動生成洋紅刀模與白墨遮罩層。
- **`acrylic-charm-builder.ts` (壓克力立牌/吊飾外框與打孔)**：自動生成 2mm 圓滑邊界向量刀模與頂部打孔圈。
- **`tshirt-color-knockout.ts` (衣服膠印底色去色透氣)**：智慧扣除同色衣物底色，使熱轉印膠膜柔軟透氣不悶熱。
- **`line-art-upscaler.ts` (二次元插畫放大)**：雙線性放大 + 邊緣壓黑，強化墨線輪廓（不是 Anime4K 官方實作，僅技法取向相近）。

#### 🖼️ 2. 相片與生活輸出剛需（大眾消費轉化主力）
- **`edge-aware-upscaler.ts` (金字塔超解析度)**：雙線性插值 + 邊緣強化演算法（非神經網路，不會生成原本不存在的細節）。
- **`canvas-wrap-mirror.ts` (無框畫 3.5cm 立體包邊鏡像)**：四面包邊鏡像延伸，正面構圖 100% 完整不切人臉與重要細節。
- **`real-paper-simulator.ts` (畫廊卡紙裝裱內襯白邊)**：自動計算 2:3/3:4 比例與 45° 倒角陰影，營造美術館級裝裱質感。
- **`passport-modal.ts`（UI）+ 相關比例計算 (2 吋護照大頭照頭頂自動校準)**：精確定位台灣與國際 2 吋大頭照 3.2~3.6cm 官方頭部比例。
- **`object-eraser.ts` (智慧消除筆)**：Fast Marching 快速前進法補景演算法，筆刷塗抹秒除路人、雜物、反光斑點與浮水印。

#### 🖨️ 3. 工業級印前物理與色彩安全（印刷廠零退件保證）
- **`bleed-expander.ts` (3mm 智慧出血背景生長)**：鏡像外推 + 接縫混合，徹底杜絕裁切白邊與文字切除。
- **`cmyk-engine.ts` / `ink-limiter.ts` (控墨防死黑、軟打樣)**：物理減法混色預測 + 總墨量 TAC ≤ 300% 限制。
- **`foil-simulator.ts` (亮金/玫瑰金/局部光 3D 擬真與獨立黑版分離)**：即時反光模擬並自動生成 100% K100 菲林鋅版遮罩。
- **`qr-preflight-enhancer.ts` (純黑 K100 向量小字與 QR 碼對比檢查)**：高反差對比驗證與純黑向量重構。
- **`imposition-engine.ts` (A4/A3 智慧合版拼模)**：多模自動排滿大版，大幅節省實體合版印刷費。
- **`engines/pdf-exporter.ts` (印前 PDF 壓製)**：內嵌向量角線、十字規矩線、出血框，見第 5 節關於 PDF/X-1a 合規現況的誠實說明。

---

## 2. 印前演算法陣列 (Pre-Press Algorithm Matrix)

跑在 Docker 微服務裡、程式碼與部署設定完整一致的服務只有 **Tesseract**（OCR）與 **VTracer**（向量化，見 1.1 節）。**Zero-DCE++**（低光提亮）的網路架構程式碼是真的，但從未載入訓練權重，不能算是「真正跑推論的 AI 模型」——它現在只是跑在伺服器上的一個未訓練網路。以下全部是 `src/core/` 或 `src/engines/` 裡實際存在的決定性演算法（無 AI 模型、無框架依賴、無授權條款可標——這些都是純 TypeScript 數學運算，不是打包發布的第三方模型），依功能分類：

### 2.1 放大與清晰化
- **`edge-aware-upscaler.ts`**：雙線性插值 + 局部梯度邊緣強化。用於相片、包裝設計放大。
- **`line-art-upscaler.ts`**：雙線性放大 + 邊緣壓黑，強化墨線輪廓。用於動漫插畫。
- **`engines/lanczos.ts`**：多階漸進式 Lanczos-3 sinc 濾波重取樣（線性光空間運算，防止高反差邊緣產生黑暈）。
- **`sharpen-deblur-filter.ts`**：固定 5×5 反卷積核銳化，緩解輕微手震模糊。
- **`unsharp-mask.ts`**：USM 邊緣銳化，補償紙張吸墨網點擴大 (Dot Gain)。
- **`contrast-stretch-filter.ts`**：全域冪次曲線對比拉伸。
- **`rollup-banner-scaler.ts`**：巨幅展架瓦片分塊放大，避免記憶體爆量。

### 2.2 出血外推與修補
- **`bleed-expander.ts`**：鏡像外推 + 接縫余弦混合 + 四角交叉修補 + 接縫色溫微調，生成 3mm 印刷出血。
- **`edge-extend-inpaint.ts`**：鏡像外推填色，生成畫布邊緣延伸。
- **`object-eraser.ts`**：Fast Marching 快速前進法補景，塗抹消除路人/雜物/浮水印。

### 2.3 去背與區域選取
- **`ai-matting.ts`**：角落取樣背景色 + 顏色距離去背（色鍵去背，非神經網路）。
- **`edge-choke-matting.ts`**：四角取樣顏色距離去背 + 邊緣縮邊，防止白邊溢出。
- **`color-region-selector.ts`**：顏色距離 flood-fill 區域選取，用於專色/燙金分版標記。

### 2.4 去噪、去模糊、去雜訊
- **`smoothing-denoise-filter.ts`**：經典雙邊濾波（空間核 × 色彩範圍核）。
- **`descreen-engine.ts`**：過濾翻拍印刷品網點與摩爾紋。
- **`fabric-moire-neutralizer.ts`**：Gabor 濾波消除布料千鳥格撞網干涉。
- **`chromatic-aberration-corrector.ts`**：邊緣色差消減。
- **`flatfield-vignette-corrector.ts`**：廣角鏡頭暗角平坦化校正。

### 2.5 光照與色調
- **`zero-dce-enhancer.ts`**：Zero-DCE 論文曲線公式的本機簡化版（單一全域參數，非學習式逐像素參數圖）。Docker `zero-dce` 服務跑的是同一篇論文的完整網路架構，但同樣沒有訓練權重——兩邊目前都不是「訓練過的模型」，只是簡化程度不同。
- **`hand-shadow-balancer.ts`**：24×24 網格光照插值，均化手機翻拍陰影。
- **`shadow-lift.ts`**：暗部階調提亮，防止實體印刷死黑糊成一片。
- **`contrast-dehaze-filter.ts`**：He et al. 經典大氣散射模型去霧（非神經網路，是真實存在的古典電腦視覺演算法）。
- **`giclee-fineart-dmax.ts`**：博物館級微噴黑階動態增強。
- **`food-menu-mouthwatering.ts`**：暖色調增豔，用於餐飲菜單。
- **`wedding-skin-pore-preserver.ts`**：高低頻空間分離磨皮。

### 2.6 幾何校正與版面
- **`curved-page-flattener.ts`**：固定拋物線位移公式，粗略校正翻拍書頁曲面（非學習式 3D 網格估算）。
- **`perspective-rectifier.ts`**：四角點單應性幾何變換，校正斜拍視角。
- **`kurbo-geometry.ts`**：2D 多邊形內縮/外擴幾何運算（純 TypeScript，非 Rust）。
- **`imposition-engine.ts` / `imposition-calculator.ts`**：A4/A3 智慧合版拼模計算。
- **`nesting-optimizer.ts`**：異形貼紙 2D 凸包旋轉排版。
- **`packaging-box-dieline.ts` / `packaging-3d-mockup-renderer.ts`**：包裝紙盒刀模與 3D 預覽。

### 2.7 印刷色彩與物理防護
- **`cmyk-engine.ts`**：RGB→CMYK 減法混色預測，Bradford 色適應轉換 + GCR 灰版替代。
- **`ink-limiter.ts`**：總墨量 (TAC) ≤ 300% 限制與壓制。
- **`icc-profiles.ts`**：ICC 描述檔參數參考（公開已知標準的名稱/TAC 上限；沒有真正的 `.icc` 描述檔案，不做真正的色彩轉換——詳見 README 誠實說明）。
- **`pantone-matcher.ts`**：真實 CIE Lab 轉換 + CIEDE2000 色差公式，比對一份精選的 Pantone 色票近似表（非官方授權完整資料庫）。
- **`trapping-master.ts`**：自動印刷補邊與陷印。
- **`spot-uv-dilator.ts`**：局部上光套準溢光補償。
- **`metallic-foil-separator.ts`**：燙金/燙銀獨立 K100 出片遮罩。
- **`crystal-uv-heightmap.ts`**：UV 水晶標立體浮雕高度圖。
- **`luxury-embossing-bevel.ts`**：立體打凸浮雕高度圖。
- **`ogv-separator.ts`**：擴色域分色（Orange/Green/Violet 專色版）。
- **`neon-halation-compressor.ts`**：發光招牌防死白光暈壓縮。
- **`fluorescent-neon-extractor.ts`**：螢光專色獨立分版。

### 2.8 文字、條碼與防呆
- **`text-inspector.ts`**：文字區域偵測（對比/邊緣啟發式，非 OCR）+ 錯字檢查。錯字檢查完全是本機的，透過 `free-spellcheck-client.ts` 的 ~18 條正規表示式規則比對——儘管兩個檔案的舊版註解都聲稱有打 LanguageTool 免費 API，實際上整條路徑裡沒有任何一次網路請求，純粹是本機規則比對，已於 2026-08-25 修正說明文字。
- **`text-zone-detector.ts`**：深色像素密度網格掃描，標示可能的文字區域（不做文字辨識）。
- **`hairline-thickener.ts`**：細線防斷印自動增厚。
- **`k100-barcode-generator.ts`**：⚠️ 目前產生的 QR/條碼圖案**不是真正可掃描的編碼**（QR 沒有糾錯碼與遮罩、Code128 缺少檢查碼），且未被任何 UI 呼叫（死代碼）。列在此處是為了誠實揭露現況，不是推薦使用。
- **`barcode-verifier.ts`**：真實的對比度/尺寸預檢啟發式（不是解碼器，無法確認條碼本身正確，只能檢查印刷可讀性風險）。
- **`qr-preflight-enhancer.ts`**：QR 對比度與純黑向量重構檢查。

### 2.9 場景分類與版面工具
- **`scene-classifier.ts`**：EXIF 特徵 + YCbCr 膚色模型 + Otsu 雙峰方差 + 飽和度/邊緣統計的決策樹分類器（純像素統計，非訓練分類模型）。
- **`gradient-centroid-cropper.ts`**：梯度能量加權 + 中心偏向的焦點裁切估算（非物件偵測模型）。
- **`dpi-calculator.ts`**：DPI 與放大倍率計算。
- **`print-score.ts`**：依實際分析數據（DPI、墨量、對比等）加權計算的印前健檢分數（本機自我評分，非第三方驗證）。
- **`svg-path-optimizer.ts`**：SVG 路徑精度裁剪與空白壓縮（非 SVGO 完整實作）。
- **`exif-metadata-sniffer.ts`**：EXIF/PNG metadata 讀取，辨識拍攝軟體/AI 生圖工具簽名。
- **`geo-distance.ts`**：Haversine 距離計算，用於鄰近印刷廠定位。
- **`ai-vectorizer.ts`**：LAB 顏色量化 + Douglas-Peucker 化簡 + 三次貝茲曲線擬合的本機向量化引擎（VTracer 離線時的備援，非 VTracer 本身）。

---

## 3. 智慧照片類型自動偵測分流 (SceneClassifier Auto-Routing)

系統於圖片上傳後完成特徵分析（純像素統計，非模型推論），自動套用對應的演算法組合：

```
                              【5 大場景自動分流路徑】
┌─────────────────────────────┬────────────────────────────────────────────────────────┐
│ 1. 🎨 動漫 / 二次元插畫     │ ➔ LineArtUpscaler 墨線銳化 + EdgeChokeMatting 去背 + Kurbo 2mm 刀模 │
├─────────────────────────────┼────────────────────────────────────────────────────────┤
│ 2. 📷 寫實人像 / 婚紗寫真   │ ➔ EdgeAwareUpscaler 放大 + HandShadowBalancer 去陰影 + SmoothingDenoiseFilter 去噪 │
├─────────────────────────────┼────────────────────────────────────────────────────────┤
│ 3. 📄 文件 / 名片 / 證書    │ ➔ 純黑 K100 向量轉曲 + OpenCV 歪斜校正 + CurvedPageFlattener 曲面拉平 │
├─────────────────────────────┼────────────────────────────────────────────────────────┤
│ 4. 🏞️ 風景 / 建築 / 展覽    │ ➔ EdgeExtendInpaint 背景生長 + 防斷階平滑 │
├─────────────────────────────┼────────────────────────────────────────────────────────┤
│ 5. 🏷️ 模切貼紙 / 圖標       │ ➔ VTracer 轉向量 + 0.2mm 白墨 + 2mm 洋紅刀模 │
└─────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 4. 簡易模式與極致新手體驗 (Simple Mode & Beginner UX)

1. **預設簡易模式 (Simple Mode by Default)**：
   - 漸進式揭露 (Progressive Disclosure)，隱藏 90% 複雜技術參數。
   - 展現 **「🛡️ 10 大商業印前守護 · 100% 完美就緒」** 綠色徽章網格。
2. **0-Click 全自動背景流水線**：
   - 丟圖即自動完成：比例適配、300DPI 補齊、3mm 出血、暗部防死黑、TAC 300% 控墨、K100 文字純黑。
3. **小象印前助理 (Xiaoxiang Assistant)**：
   - 擬人化白話語音引導與即時反饋。
4. **超商列印檔案產生器與送印小抄**：
   - 一鍵下載符合 7-11 ibon / 全家規格的 300 DPI 列印檔；取件碼需透過超商官方網站/App 取得（本工具不接超商訂單系統，過去曾用 `Math.random()` 產生假取件碼與不可掃描的假 QR，已於 2026-08-25 移除）。
   - 下載 PDF 時自動複製標準送印規格小抄至剪貼簿（便於 LINE 給印刷廠）。

---

## 5. 多格式商業印刷出機中心 (Multi-Format Pre-Press Export)

原生支援印刷廠與製版要求的 6 大標準格式：

1. **📄 標準印刷 PDF (300 DPI)**：3mm 物理出血、向量角線裁切標記、色條、來源圖片 SHA-256 內容雜湊。⚠️ **不是通過驗證的 PDF/X-1a / ISO 15930 檔案**——沒有 OutputIntent、沒有嵌入 ICC 描述檔，圖片內容仍是 RGB（未做 CMYK 分色）。印刷廠仍須自行執行標準 CMYK 轉換流程，見 `server/services/pdfx-service.ts` 內的誠實性註解。真正的 PDF/X-1a 合規（OutputIntent + 嵌入 ICC + CMYK 內容）是尚待完成的功能缺口，不是現況。
2. **🖨️ 工業級無損 TIFF (.tif 300 DPI)**：Tag 282/283 內嵌 300DPI 點陣檔，無失真分色首選。
3. **📥 高清透明 PNG (.png 300 DPI)**：保留 8-bit Alpha 透明通道，貼紙/立牌預覽。
4. **🖼️ 商用高畫質 JPG (.jpg 300 DPI)**：100% 最高畫質 JPEG，相片沖印必備。
5. **✂️ 向量刀模與白墨 SVG (.svg)**：100% 洋紅 (Spot Magenta) 向量激光割字線與 0.2mm 內縮白墨。
6. **📦 印刷廠出機全套包 (.zip)**：一鍵打包 PDF + TIFF + PNG + JPG + 刀模 SVG + 印前檢查報告（本機自動檢查，非第三方獨立驗證，見下方 PrintPass 說明）。

---

## 6. 會員分級與商業模式規格

> ⚠️ **2026-08-25 更新**：下方的 Free/Pro/VIP 三級表是規劃階段留下的**尚未實裝**方案——程式碼裡從未真的接上付費閘門，`SubscriptionManager` 目前對所有功能一律回傳「已解鎖」（見 `src/core/subscription-tier.ts`），實際對外顯示的也是「公開測試版，全功能免費」（見 `src/ui/pricing-modal.ts`）。目前**沒有生效中的分級**，以下內容僅供未來重新設計定價策略時參考，不代表現況。

```
┌─────────────────────────────────────────────────────────────┐
│ （規劃中，尚未實裝）🟢 Free 完整體驗版 (NT$ 0 永久免費)：    │
│    • 100% 享受全部功能 (無閹割、無浮水印)                   │
│    • 每日處理上限：3 張 / 天                                │
│    • 單張上傳、標準佇列、超商 30 秒立印                     │
├─────────────────────────────────────────────────────────────┤
│ （規劃中，尚未實裝）🔵 Pro 專業生產力版 (建議 NT$ 199 /月)： │
│    • Web 雲端每日 100 張 + 【下載 Mac / Windows 原生桌面版】│
│    • 20 張多圖批次連續製版 (一鍵打包 ZIP)                   │
│    • A4/A3 智慧合版拼模試算 (省 70% 費用)                   │
│    • 雙面合版綁定 (正面 + 背面 2 頁 PDF)                    │
│    • 高速運算佇列 (快 3 倍)                                 │
├─────────────────────────────────────────────────────────────┤
│ （規劃中，尚未實裝）👑 VIP 企業工作室版 (建議 NT$ 699 /月)： │
│    • Web 雲端 + 原生桌面版【無上限張數 (Unlimited)】         │
│    • 專屬 VIP 0 秒插隊算力通道 (最高優先級 GPU/CPU)         │
│    • 20,000px 巨幅戶外看板 / 車體廣告串流 (pyvips)          │
│    • 自訂上傳印刷廠機台 ICC 描述檔                          │
│    • 3~5 人團隊席位 + 統一開立公司統編發票報帳              │
└─────────────────────────────────────────────────────────────┘
```

> 註：PDF 內容 SHA-256 雜湊（來源圖片的內容完整性校驗，見第 5 節）已於 2026-08-25 對所有人開放，不是 VIP 專屬——它取代了原本 `mockChecksum`（未加密、非真實雜湊的假認證碼）。它是一個真實可重現的內容雜湊，不是「PrintPass™ ISO 15930 合格證書」或任何形式的防偽認證，因為本專案目前不產生真正通過 ISO 15930 驗證的 PDF/X 檔案。

---

## 7. 桌面離線版與 Mac (Apple Silicon) — 概念構想，尚未開發

> ⚠️ **現況：這整節描述的桌面版完全不存在。** 專案裡沒有 Tauri 設定檔、沒有 Cargo.toml、沒有 Swift 程式碼——搜尋整個 repo 找不到任何桌面殼層的痕跡。下方的效能數字（「0.1~0.2 秒」）雙重不成立：不只沒有桌面版可以測，連被拿來換算的 Real-ESRGAN / HAT-S 本身在網頁版裡也從未實作過（見第 2 節）。保留本節純粹作為未來的產品構想紀錄，不代表任何已承諾或已排入時程的開發項目。

### 7.1 構想中的雙棲模式授權機制
- 登入一次、離線可用一段時間：概念上會透過加密 Token 記錄離線授權心跳包。
- 實體斷網場景：概念上會支援讀取機器碼產生離線授權檔。
- 商業假設：重度設計師使用本地算力可望降低雲端伺服器成本，但沒有任何原型或數據驗證過這個假設。

### 7.2 構想中的 macOS (Apple Silicon) 原生化方向
- 若真的開發原生殼層（例如 Tauri），可以善用 macOS 原生 UI 與 Retina 螢幕顯示。
- 若之後真的做出本機神經網路放大模型，理論上可以利用 Apple Neural Engine 加速——但目前連網頁版的放大演算法都不是神經網路（見 2.1 節），所以這一項本質上是「如果我們先做出 A，再做 B，也許能加速」，兩個前提都還沒發生。
- ColorSync 色彩管理整合：構想階段，未實作。
