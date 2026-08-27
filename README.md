# PrintMagic Studio 3.1 Pro 🖨️✨

> **「把任何圖片，變成印刷廠能直接出機的工業級合格檔」**
> 全自動 10 大印前防護流水線 ｜ 決定性影像演算法引擎 ｜ 真實開源向量化工具整合 ｜ 智慧場景自動分流 ｜ 多格式出機中心 (PDF / TIFF / SVG / ZIP)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-purple)](https://vitejs.dev/)
[![Docker Microservices](https://img.shields.io/badge/Docker-2%20Containers-blue)](./docker-compose.yml)
[![Tests](https://img.shields.io/badge/Tests-230%2F230%20Passed-brightgreen)](./tests)
[![SPEC](https://img.shields.io/badge/System%20SPEC-v3.1.0-orange)](./docs/SPEC.md)

---

### 📑 核心文檔導航 (Documentation Sitemap)
- 🚀 **[快速開始與安裝指南 (Getting Started)](#-快速開始與本機運行)**
- 🤖 **[10 大全自動印前流水線 (10-Pass Auto Pipeline)](#-10-大全自動印前守護流水線)**
- ⚙️ **[引擎組成：真實模型 vs. 決定性演算法](#️-引擎組成真實模型-vs-決定性演算法)**
- 🎯 **[5 大場景自動偵測分流 (SceneClassifier)](#-5-大場景自動偵測與分流)**
- 🖨️ **[多格式商業出機中心 (Multi-Format Pre-Press Export)](#-多格式商業出機中心)**
- 📑 **[查閱完整系統與產品規格說明書 (docs/SPEC.md)](./docs/SPEC.md)**

---

## 🌟 核心哲學 (Core Philosophy)

> **「零退件、零操心、零專業知識門檻」**

一般新手或繪師將手機照片或 AI 生成圖拖入系統，自動完成尺寸比例適配、300 DPI 補齊、3mm 物理出血、暗部防死黑、總墨量 TAC 壓制與純黑 K100 向量轉曲，點擊一鍵直接下載合版印刷廠標準出機檔。

**這個專案真正的價值在印前物理與色彩安全引擎**（CMYK 減色模型、TAC 總墨量壓制、K100 純黑向量化、出血生成、拼版計算）—— 這些是決定性數學/幾何演算法，不依賴任何 AI 模型，也是大多數同類工具懶得做的印刷業硬知識。下方會誠實區分哪些功能是真實模型、哪些是純演算法。

---

## 🛡️ 黃金核心護城河（Golden Core Moat Modules）

以下模組是真正**解決印刷翻車痛點、支撐產品付費轉換與商業護城河**的核心資產，全部是決定性數學/幾何演算法（非 AI 模型）：

### 🎨 1. 動漫 / 文創周邊剛需
- **`Sticker-KissCut-Builder`**（手帳貼紙刀模線 + 0.2mm 內縮白墨）：解決透明/PVC 貼紙透光問題，自動生成洋紅刀模與白墨遮罩層。
- **`Acrylic-Charm-Builder`**（壓克力立牌/吊飾外框與打孔）：自動生成 2mm 圓滑邊界向量刀模與頂部打孔圈。
- **`TShirt-Color-Knockout`**（衣服膠印底色去色透氣）：智慧扣除同色衣物底色，使熱轉印膠膜柔軟透氣不悶熱。

### 🖼️ 2. 相片與生活輸出剛需
- **`Canvas-Wrap-Mirror`**（無框畫 3.5cm 立體包邊鏡像）：四面包邊鏡像延伸，正面構圖完整不切人臉與重要細節。
- **`Photo-Frame-Mat`**（畫廊卡紙裝裱內襯白邊）：自動計算 2:3/3:4 比例與 45° 倒角陰影。
- **`Passport-Proportion-Aligner`**（2 吋護照大頭照頭頂自動校準）：精確定位台灣與國際 2 吋大頭照官方頭部比例。

### 🖨️ 3. 工業級印前物理與色彩安全（印刷廠零退件保證）
- **`Bleed-Expander`**（3mm 智慧出血背景生長）：鏡像外推演算法，杜絕裁切白邊與文字切除。
- **`CMYK-Engine / Kubelka-Munk / GCR-Gray`**（控墨防死黑、軟打樣、省墨）：物理減法混色預測 + 總墨量 TAC ≤ 300% 限制。
- **`Foil-Simulator`**（亮金/玫瑰金/局部光 3D 擬真與獨立黑版分離）：即時反光模擬並自動生成 K100 菲林鋅版遮罩。
- **`Barcode-QR-Fixer`**（純黑 K100 向量小字與保證秒掃的 QR 碼）：重構純黑向量碼與高反差對比驗證。
- **`Imposition-Engine`**（A4/A3 智慧合版拼模）：多模自動排滿大版，節省合版印刷費。
- **`PDF/X-1a 出機壓製`**（零退件標準出機檔）：內嵌向量角線、十字規矩線、出血框與 CMYK 描述檔。

---

## 🤖 10 大全自動印前守護流水線

```
                               【10-Pass 全自動印前守護流水線】
┌───────────────────────────────┬───────────────────────────────┬───────────────────────────────┐
│ 1. 🔍 實體比例智慧適配       │ 2. ⚡ 300 DPI 解析度補齊       │ 3. 📐 3mm 物理出血背景生長     │
│   • 識別長寬比匹配規格        │   • 邊緣強化插值 / Lanczos-3   │   • 鏡像外推防白邊             │
├───────────────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ 4. ☀️ 手機拍照光照均勻化     │ 5. 🌊 漸層防斷階去階梯紋      │ 6. 🔪 印刷微細邊緣 USM 銳化   │
│   • 網格插值光照平衡          │   • 藍噪點抖動                 │   • 補償紙張吸墨擴散 (Dot Gain)│
├───────────────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ 7. 🌓 暗部階調防死黑 (Lift)   │ 8. 🛡️ 總墨量 TAC ≤300% 壓制   │ 9. 🎯 純黑 K100 向量轉曲      │
│   • Lab 亮度軸曲線提升         │   • GCR 灰版替代               │   • 文字/條碼防偏移銳化         │
├───────────────────────────────┴───────────────────────────────┴───────────────────────────────┤
│ 10. ✅ PDF/X-1a 出機壓製：內嵌向量角線、十字規矩線、出血框與 CMYK 描述檔                          │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

以上全部是**決定性數學/幾何演算法**（矩陣運算、色彩空間轉換、卷積濾波），輸入相同必然輸出相同，不依賴任何 AI 模型推論。

---

## ⚙️ 引擎組成：真實模型 vs. 決定性演算法

早期版本的說明文件把每一個影像處理函式都貼上一個知名 SOTA 論文名字（SAM 2.1、CLIP-IQA+、RealESRGAN、BiRefNet、DehazeFormer……），並宣稱整合「19 款開源商用 AI 模型」。這不準確——本專案沒有內嵌任何 ONNX / TensorFlow.js / WASM 推論引擎，前端從未載入過模型權重檔。以下是誠實的拆分：

### ✅ 自建服務（2 個 Docker 容器，共 9 項功能）
| 服務 | 是什麼 | 用途 |
| :--- | :--- | :--- |
| **VTracer**（`docker/vtracer/`） | 真實開源 Rust 向量化工具。⚠️ 2026-08-25 前 Dockerfile 引用了從未存在過的 `Cargo.toml`/`src/`，建置必定失敗；已修正為安裝真正發布的 `vtracer` crate + Python 包裝層 | 點陣轉 SVG 向量（`/api/vectorize`） |
| **Real-ESRGAN**（`docker/zero-dce/`） | 真實開源模型，官方發布的 `realesr-general-x4v3` 訓練權重（BSD-3-Clause），開箱即用 | 4x 超解析度放大（`/api/ai/upscale`） |
| **ARNIQA**（`docker/zero-dce/`） | 真實開源模型，官方發布的訓練權重（Apache-2.0，WACV 2024），開箱即用 | 無參考影像品質評分（`/api/ai/quality`） |
| **DehazeFormer-T**（`docker/zero-dce/`） | 真實開源模型（MIT）。作者只透過 Google Drive 資料夾發布權重，沒有可自動下載的網址，但權重檔（2.9MB）已於 2026-08-26 直接下載並提交進 git（`docker/zero-dce/weights/dehazeformer-t.pth`，見該目錄 README）——因為 Railway 是從 git 儲存庫建置，不是本機硬碟，只存在本機的權重檔永遠不會真正部署上去。**已用真實下載的權重檔驗證**：`strict=True` 完整載入 258 個張量、零缺漏零多餘，真實推論在模擬霧霾測試圖上讓對比度從 0.0245 提升到 0.0763 | 去霧（`/api/ai/dehaze`），開箱即用 |
| **Retinexformer**（`docker/zero-dce/`） | 真實開源模型（MIT，ICCV 2023）。2026-08-26 取代原本從未載入訓練權重的 Zero-DCE++——權重同樣只能從 Google Drive/百度網盤手動下載，但已下載並提交進 git（`docker/zero-dce/weights/LOL_v2_real.pth`，原因同上：Railway 從 git 建置）。**已用真實下載的權重檔驗證**：`strict=True` 完整載入 122 個張量、零缺漏零多餘，真實推論成功讓測試圖片從平均亮度 0.082 提升到 0.399 | 低光照片提亮（`/api/ai/lowlight`），開箱即用 |
| **LaMa**（`docker/zero-dce/`） | 真實開源模型（Apache-2.0，Samsung Research）。TorchScript 匯出的 `big-lama.pt`，有可自動下載的 GitHub Release 網址，建置時自動下載，開箱即用。**已用真實下載的權重檔驗證**：`torch.jit.load()` 成功，真實推論在模擬「浮水印」色塊測試圖上完全移除目標色塊（移除區域內 0% 殘留原色），並修正了上游 `simple-lama-inpainting` 套件遺漏「輸出裁切回原始尺寸」的錯誤 | 物件／浮水印移除（`/api/ai/inpaint`），需同時提供來源圖與遮罩圖 |
| **rembg**（`docker/zero-dce/`） | 真實開源模型（MIT），固定使用 `u2netp` session（刻意不用 rembg 預設 session，因為那可能解析到非商用授權的模型）。權重（~4.6MB）由 rembg 自行於建置時自動下載。**已用真實下載的權重檔驗證**：在有紋理漸層背景的合成測試圖上，主體中心 alpha 254/255（近乎完全不透明）、四角 alpha 0/255（完全透明），確認能處理現有色鍵去背無法處理的非單一色背景 | 髮絲級去背（`/api/ai/matting`），開箱即用 |
| **YuNet**（`docker/zero-dce/`） | 真實開源模型（Apache-2.0/MIT），透過 OpenCV 內建的 `cv2.FaceDetectorYN` 載入，不需額外套件（沿用既有的 opencv-python-headless）。權重（~0.23MB）為可自動下載的 Git-LFS Release 資產。**已用真實下載的權重檔驗證**：對合成人臉測試圖成功偵測 1 張臉，信心分數 84.2% | 人臉偵測（`/api/ai/detect-face`），回傳座標 JSON（非圖片），開箱即用 |
| **ICC 真實色彩管理**（`docker/zero-dce/`） | 不是模型，是 Pillow 的 `ImageCms` 模組本來就內建的 LittleCMS（已驗證 Pillow 10.3.0 內建 lcms2 2.16，`requirements.txt` 無需新增任何套件）。需要使用者自行上傳自己印刷廠的 CMYK ICC 描述檔（`.icc`/`.icm`）——本專案刻意不內建/散布任何具名描述檔（FOGRA／SWOP／GRACoL 等），因為查證 ICC 官方描述檔登錄庫後發現這些檔案本身「未經書面同意不得散布、出售或更改」。**已用真實 CMYK 描述檔驗證**：軟打樣色彩位移可測量（測試漸層平均 RGB 差異 19.83），逐像素總墨量（TAC）數值合理（最高 212.2%、平均 135.6%） | 真實 ICC 軟打樣＋TAC（`/api/ai/icc-soft-proof`），需同時提供來源圖與使用者自己的 CMYK 描述檔 |

⚠️ **OCR（Tesseract）已於 2026-08-26 移除**：查證後發現它從未被任何 UI 功能實際呼叫過（純死碼），而它原本想解決的問題——讀取 AI 繪圖產生的亂碼假文字——OCR 本來就解不了，因為那些筆畫通常根本不是任何文字系統的真實字元，就算讀出結果也毫無參考價值。實際可行的做法是定位文字區域＋由使用者自己輸入正確文字，見下方「文字防糊」工具。

VTracer/Real-ESRGAN/ARNIQA/DehazeFormer-T/Retinexformer/LaMa/rembg 離線或未就緒時，系統會自動退回下方的本機決定性演算法，並在結果標籤上誠實標示「本機」而非假冒雲端模型名稱。YuNet（人臉偵測）是唯一沒有本機備援的功能——本專案沒有現成的本機人臉偵測演算法，離線時就是誠實回報不可用，而不是假造一個「本機演算法」來冒充。ICC 真實色彩管理離線、或使用者未上傳描述檔時，軟打樣會退回既有的 `CmykEngine.simulatePrintProof()` 近似模擬——這個退回並非「真實 ICC 運算的本機版本」，只是既有的手刻公式近似值，兩者不應混為一談。

### 🧮 決定性演算法（前端 TypeScript，非神經網路）
以下模組過去用 SOTA 論文名稱命名，現已改用描述實際技術的名稱，程式邏輯本身沒有變動：

| 現在的名稱 | 實際技術 | 曾經借用的模型名 |
| :--- | :--- | :--- |
| `EdgeAwareUpscaler` | 雙線性插值 + 局部梯度銳化 | RealESRGAN |
| `PixelStatQualityAssessor` | 亮度/梯度/飽和度統計 | CLIP-IQA+ |
| `ColorRegionSelector` | 顏色距離 flood-fill 選取 | SAM 2.1 / MobileSAM |
| `EdgeContourDetector` | Sobel 式梯度 + 非極大值抑制 | TEED |
| `SharpenDeblurFilter` | 固定 5×5 反卷積核 | Stripformer / Restormer |
| `SmoothingDenoiseFilter` | 經典雙邊濾波 | Restormer-Denoise / NAFNet |
| `CurvedPageFlattener` | 固定拋物線位移公式 | DocTr |
| `EdgeExtendInpaint` | 鏡像外推填色 | LaMa |
| `ContrastDehazeFilter` | 經典大氣散射模型（He et al. Dark Channel Prior） | DehazeFormer |
| `LineArtUpscaler` | 雙線性放大 + 邊緣壓黑 | Anime4K |
| `EdgeChokeMatting` | 四角取樣顏色距離去背 | BiRefNet |
| `HandShadowBalancer` | 24×24 網格光照插值 | ShadowFormer |
| `TextZoneDetector` | 深色像素密度網格掃描（**不做文字辨識**，只標示可能的文字區域） | PP-OCR |

### 🎯 智慧裁切構圖建議（前端 TypeScript，真實第三方演算法函式庫）
`SmartCropClient` 直接使用真實開源的 [`smartcrop`](https://github.com/jwagner/smartcrop.js)（MIT，13k+ star）套件，而非改寫或借用它的名字——這是唯一一個既非自建 AI 服務、也非「借用 SOTA 論文名稱的本機演算法」的第三類：真實第三方演算法，誠實掛自己的原名。純瀏覽器端執行（邊緣/膚色/飽和度顯著性分析 + 滑動窗口排名），不佔用 `zero-dce` 容器一分記憶體。2026-08-27 起，若 YuNet 人臉偵測服務可用，會把偵測到的人臉位置餵給 smartcrop 的 `boost` 參數，讓建議的裁切不容易把臉裁掉；YuNet 離線時 smartcrop 仍正常運作，只是少了人臉加權。

### 🪪 2 吋證件照自動裁切（`src/core/id-photo-cropper.ts`，YuNet 真實用途）
2026-08-27 新增。尺寸（35×45mm）與頭部佔比規定（32-36mm，即畫面高度 70-80%）依外交部領事事務局公告規格核實（[boca.gov.tw/np-16-1.html](https://www.boca.gov.tw/np-16-1.html)）。選擇「2 吋證件照」預設時，會自動呼叫 YuNet 抓臉位置並**真的裁切像素**（不是像九宮格錨點那樣只改預覽 CSS，匯出的 PDF 會反映這個裁切）。

⚠️ **誠實限制**：YuNet 回傳的是「臉部偵測框」（大約眉毛到下巴），不包含頭髮，跟官方規定的「頭頂至下巴」量測基準不同，本專案沒有辦法從臉部偵測框精準推算真實髮量高度。因此這個功能**不會**宣稱「已通過官方合規檢查」，只會提供一個抓臉置中、頭部佔比抓在官方區間中段（估算值）的**起始裁切建議**，UI 上會明確提示使用者送印前仍需自行對照官方範例圖確認。YuNet 沒偵測到臉或離線時，會退回單純置中裁切（一樣是真實裁切，不是拉伸變形，只是沒有抓臉置中的精準度）。

這些演算法在乾淨、平坦色塊的素材上（貼紙、logo、簡單向量圖）表現穩定；在複雜漸層、雜訊照片或需要真正語意理解的場景上，效果會明顯不如對應的真實神經網路模型。需要真正的文字辨識、去背、或超解析度時，請走上方「真實模型」路徑。

---

## 🎯 5 大場景自動偵測與分流

丟入圖片後，`SceneClassifier` 完成特徵辨識並自動套用對應的演算法組合：

| 偵測場景分類 | 視覺特徵辨識 | 系統自動套用的處理組合 |
| :--- | :--- | :--- |
| **🎨 1. 動漫 / 二次元插畫** | 飽和度高、封閉黑色墨線輪廓 | `LineArtUpscaler` 墨線銳化 + 去背 + 刀模 |
| **📷 2. 寫實人像 / 婚紗寫真** | 肌膚暖色溫、微細毛孔、景深 | `EdgeAwareUpscaler` + `HandShadowBalancer` + `SmoothingDenoiseFilter` |
| **📄 3. 文件 / 名片 / 證書** | 白底黑字、高密度文字條紋 | 純黑 K100 向量轉曲 + 歪斜校正 + `CurvedPageFlattener` |
| **🏞️ 4. 風景 / 建築 / 展覽** | 寬廣漸層天空、深遠地平線 | `EdgeExtendInpaint` 背景生長 + 防斷階平滑 |
| **🏷️ 5. 模切貼紙 / 標誌圖標** | 帶有 Alpha 透明通道、純幾何 | VTracer 轉向量 + 內縮白墨 + 刀模 |

---

## 🖨️ 多格式商業出機中心

原生支援印刷廠與製版機台指定的標準格式：

```
                        【PrintMagic 多格式商業出機中心】
┌─────────────────────────────┬─────────────────────────────┬─────────────────────────────┐
│ 📄 PDF/X-1a (300 DPI)       │ 🖨️ 工業級無損 TIFF (300 DPI)│ 📥 高清透明 PNG (300 DPI)   │
│   • 3mm 出血 + 向量裁切標記 │   • Tag 282/283 二進位分色  │   • 保留 8-bit Alpha 通道   │
├─────────────────────────────┼─────────────────────────────┼─────────────────────────────┤
│ 🖼️ 最高畫質 JPG (300 DPI)   │ ✂️ 向量刀模與白墨 SVG       │ 📦 印刷廠出機全套包 (.zip)  │
└─────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

---

## 💎 商業模式

目前沒有 Free/Pro/VIP 分級——**全功能對所有人開放**（公開測試階段）。早期版本的 README 曾列出三個定價分級與各自的功能限制，但那張表從未真的接上任何付費閘門或功能鎖，程式碼裡的訂閱分級判斷也一律回傳「已解鎖」。已移除該分級表，避免對外承諾與實際行為不符。等正式定價策略確定後，會在這裡重新記錄。

---

## 🚀 快速開始與本機運行

### 1. 環境需求
- Node.js 18+（建議 Node.js 22 LTS）
- npm 或 pnpm

### 2. 安裝與啟動
```bash
# 複製專案
git clone https://github.com/blackbear007-maker/PrintMagic.git
cd PrintMagic

# 安裝依賴
npm install

# 啟動本機開發伺服器 (預設 Port 5173)
npm run dev
```

### 3. 單元測試與建置
```bash
# 執行測試套件 (222 項單元測試)
npm run test

# 執行 TypeScript 類型檢查
npm run typecheck

# 構建生產環境 Bundle
npm run build
```

---

## 📄 開源授權條款 (License)

本專案基於 **MIT License** 授權開源。真實整合的開源工具遵循其原作者授權：VTracer（MIT）、Real-ESRGAN（BSD-3-Clause）、ARNIQA（Apache-2.0）、DehazeFormer-T（MIT）、Retinexformer（MIT）、LaMa（Apache-2.0）。DehazeFormer-T 與 Retinexformer 的權重檔案需自行從作者發布的連結手動下載，現況見上方引擎組成說明。

---

> 💡 **進一步了解底層架構？** 請參閱 **[📑 PrintMagic Studio 3.1 系統產品規格說明書 (docs/SPEC.md)](./docs/SPEC.md)**。
