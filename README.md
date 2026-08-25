# PrintMagic Studio 3.1 Pro 🖨️✨

> **「把任何圖片，變成印刷廠能直接出機的工業級合格檔」**
> 全自動 10 大印前防護流水線 ｜ 決定性影像演算法引擎 ｜ 2 項真實開源工具整合（OCR / 向量化）｜ 智慧場景自動分流 ｜ 多格式出機中心 (PDF / TIFF / SVG / ZIP)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-purple)](https://vitejs.dev/)
[![Docker Microservices](https://img.shields.io/badge/Docker-3%20Containers-blue)](./docker-compose.yml)
[![Tests](https://img.shields.io/badge/Tests-222%2F222%20Passed-brightgreen)](./tests)
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

### ✅ 自建服務（3 項，透過 Docker 微服務運行）
| 服務 | 是什麼 | 用途 |
| :--- | :--- | :--- |
| **Tesseract 5**（`docker/tesseract/`） | 真實開源 OCR 引擎，Dockerfile 與程式碼一致，可正常建置運作 | 文字辨識（`/api/ocr`），支援繁中/英/日 |
| **VTracer**（`docker/vtracer/`） | 真實開源 Rust 向量化工具。⚠️ 2026-08-25 前 Dockerfile 引用了從未存在過的 `Cargo.toml`/`src/`，建置必定失敗；已修正為安裝真正發布的 `vtracer` crate + Python 包裝層 | 點陣轉 SVG 向量（`/api/vectorize`） |
| **Zero-DCE++**（`docker/zero-dce/`） | ⚠️ **不是訓練過的模型。** 網路架構程式碼是真的 Zero-DCE++，但從未載入訓練權重——整個 repo 歷史裡沒有出現過 `.pth`/`.pt` 檔案，程式碼裡也沒有 `torch.load()`。目前用隨機初始化權重推論，輸出品質不代表真正訓練過的模型 | 低光照片提亮（`/api/ai/lowlight`），現況僅供參考 |

Tesseract/VTracer 離線時，系統會自動退回下方的本機決定性演算法，並在結果標籤上誠實標示「本機」而非假冒雲端模型名稱。Zero-DCE++ 目前沒有「真的模型」可退回比較，本機版與伺服器版都是未訓練/簡化版本，見下方對照表。

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

本專案基於 **MIT License** 授權開源。真實整合的開源工具各自遵循其原作者授權：Tesseract（Apache 2.0）、VTracer（MIT）。Zero-DCE++ 的網路架構程式碼參考自 Zero-DCE 論文（原專案 MIT），但本專案未附上訓練權重，現況見上方引擎組成說明。

---

> 💡 **進一步了解底層架構？** 請參閱 **[📑 PrintMagic Studio 3.1 系統產品規格說明書 (docs/SPEC.md)](./docs/SPEC.md)**。
