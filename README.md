# PrintMagic Studio 3.1 Pro 🖨️✨

> **「用開源 AI 把任何圖片，秒變印刷廠 100% 絕不退件的工業級合格出機檔」**  
> 全自動 10 大印前防護流水線 ｜ 19 款開源商用 AI 模型 ｜ 零外部付費 API ｜ 智慧場景自動分流 ｜ 多格式出機中心 (PDF / TIFF / SVG / ZIP)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-purple)](https://vitejs.dev/)
[![Docker Microservices](https://img.shields.io/badge/Docker-4%20Containers-blue)](./docker-compose.yml)
[![Tests Passing](https://img.shields.io/badge/Tests-83%2F83%20Passed-brightgreen)](./tests)
[![SPEC](https://img.shields.io/badge/System%20SPEC-v3.1.0-orange)](./docs/SPEC.md)

---

### 📑 核心文檔導航 (Documentation Sitemap)
- 🚀 **[快速開始與安裝指南 (Getting Started)](#-快速開始與本機運行)**
- 🤖 **[10 大全自動印前流水線 (10-Pass Auto Pipeline)](#-10-大全自動印前守護流水線)**
- 🧠 **[19 款開源 AI 模型陣列 (Open-Source AI Models)](#-19-款開源商用-ai-模型陣列)**
- 🎯 **[5 大場景自動偵測分流 (SceneClassifier)](#-5-大場景自動偵測與專屬模型派發)**
- 🖨️ **[多格式商業出機中心 (Multi-Format Pre-Press Export)](#-多格式商業出機中心)**
- 💎 **[商業會員分級與 M365 混合架構 (Pricing & Tiers)](#-會員分級與商業模式規格-m365-混合雙棲架構)**
- 📑 **[查閱完整系統與產品規格說明書 (docs/SPEC.md)](./docs/SPEC.md)**

---

## 🌟 核心哲學 (Core Philosophy)

> **「零退件、零操心、零專業知識門檻」**

一般新手或繪師將手機照片或 AI 生成圖拖入系統，**0.01 秒內自動完成尺寸比例適配、300 DPI 補齊、3mm 物理出血、暗部防死黑、總墨量 TAC 壓制與純黑 K100 向量轉曲**，點擊一鍵直接下載合版印刷廠標準出機檔！

---

## 🤖 10 大全自動印前守護流水線

```
                               【10-Pass 全自動印前守護流水線】
┌───────────────────────────────┬───────────────────────────────┬───────────────────────────────┐
│ 1. 🔍 實體比例智慧適配       │ 2. ⚡ 300 DPI 超解析度補齊     │ 3. 📐 3mm 物理出血背景生長     │
│   • 0.01s 識別長寬比匹配規格  │   • Real-ESRGAN / Lanczos-3   │   • AOT-GAN / 鏡像 100%防白邊 │
├───────────────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ 4. ☀️ 手機拍照光照均勻化     │ 5. 🌊 漸層防斷階去階梯紋      │ 6. 🔪 印刷微細邊緣 USM 銳化   │
│   • Deshadow 抹除手部陰影     │   • DGF-Net + 藍噪點抖動      │   • 補償紙張吸墨擴散 (Dot Gain)│
├───────────────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ 7. 🌓 暗部階調防死黑 (Lift)   │ 8. 🛡️ 總墨量 TAC ≤300% 壓制   │ 9. 🔤 純黑 K100 向量文字轉曲  │
│   • S 曲線提升暗部細節防暗沉  │   • 防止背面吸墨沾黏          │   • 消除 4 色混墨重影毛邊     │
├───────────────────────────────┴───────────────────────────────┴───────────────────────────────┤
│ 10. 🎯 7 大維度印前公證評分 (PrintScore 0~100 分) + Pantone 色票配對 + 條碼光學驗證           │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 19 款開源商用 AI 模型陣列

全站堅持 **100% 自由開源商用協議（MIT / Apache 2.0 / BSD）**，絕無任何外部按次收費 API 帳單：

### 1. 超解析度與修復 (Super-Resolution Suite)
- **`Real-ESRGAN Compact`** (12 MB, BSD-3)：文字、插畫與包裝設計綜合重構王者。
- **`HAT-S`** (28 MB, Apache 2.0)：2024 SOTA 混合注意力 Transformer，真實重構寫實攝影毛孔與布料紋理。
- **`Anime4K`** (5 MB, MIT)：動漫二次元墨線銳化，墨色如向量貝茲曲線般漆黑結實。
- **`SwinIR-Lite`** (24 MB, Apache 2.0)：去 8x8 DCT JPEG 壓縮雜訊 + 4x 超解析二合一。
- **`FSRCNN`** (150 KB, BSD)：畫布 20x 放大鏡即時預覽。
- **`本機 Lanczos-3`** (0 KB, MIT)：0ms 純本機離線 Sinc 濾波插值。

### 2. 出血外推與影像生長 (Bleed Outpainting Suite)
- **`AOT-GAN Lite`** (28 MB, Apache 2.0)：多孔徑上下文聚合，大自然風景/天空/草地自然外推。
- **`MAT-Lite`** (32 MB, MIT)：遮罩感知 Transformer，深遠透視地平線與建築空間延伸。
- **`LaMa-Lite`** (25 MB, Apache 2.0)：快速傅立葉頻域卷積，幾何磚牆與重複圖騰外推。
- **`OpenCV Telea`** (2 MB, Apache 2.0)：Navier-Stokes 流體力學偏微分平滑過渡。
- **`基礎邊界拉伸`** (0 KB, MIT)：0ms 極速 100% 防白邊。

### 3. 印前色彩與特殊工藝模型
- **`Trapping-Master`** (0 KB)：自動印刷補邊與陷印，消除機台套準震動漏白。
- **`MetallicFoil-Separator`** (2 MB)：燙金/燙銀/燙雷射獨立 100% K100 鋅版出片遮罩。
- **`UCR/GCR Under-Color-Removal`** (0 KB)：底色去除與黑版替代，減少 30% 暗部油墨防背印。
- **`Nesting-Optimizer`** (2 MB)：異形貼紙 2D 凸包旋轉排版，A3/A4 紙張利用率達 90%。
- **`CMYK-DotGain-Predictor`** (0 KB)：Murray-Davies 實體網點擴大預補償，消除印刷變黑。
- **`Barcode-Vector-Synthesizer`** (500 KB)：GS1 EAN-13 / Code-128 純向量 K100 條碼重構。
- **`Varnish-SpotUV-Dilator`** (0 KB)：局部上光 (Spot UV) 0.15mm 套準溢光補償。
- **`Packaging-Crease-Fold3D`** (4 MB)：包裝紙盒 2D 刀模壓痕驗證與 3D 摺疊網格推導。
- **`SpineWidth-Calculator`** (0 KB)：基重 (gsm) 與頁數精確推導 0.1mm 級膠裝/精裝書背厚度。
- **`DeltaE-Gamut-Remapper`** (1 MB)：CIECAM02 視覺感知色域映射，保留 RGB 霓虹色印刷活力。
- **`ShadowHighlight-HDR-Toner`** (3 MB)：14 EV 手機 HDR 動態範圍平滑壓縮至 5.5 EV 紙張反射率。
- **`TextCurvature-Unbender`** (3 MB)：圓形印章與瓶身杯身環狀弧形文字展開拉直。
- **`Photo-To-Vector-Silhouette`** (4 MB)：照片一鍵生成高對比純單色向量剪影刀模。
- **`GripMargin-Checker`** (0 KB)：平版印刷機 10mm 夾爪咬口 (Gripper Margin) 碰撞預警。
- **`Metallic-Sheen-Renderer`** (2 MB)：薄膜干涉與 BRDF 物理渲染鐳射彩虹反光動態。
- **`ColorFont-Layer-Splitter`** (1 MB)：OpenType-SVG / COLR 彩色字體 CMYK 四色版拆解。
- **`HDP-Detail-Booster`** (8 MB)：手錶面盤與精密銘牌 0.1mm 級微刻度高頻增強。
- **`Woodblock-Halftone-Stipple`** (1 MB)：復古美式漫畫點陣與浮世繪木刻版畫抖動。
- **`ScreenAngle-Optimizer`** (0 KB)：ISO 12647-2 四色網點角度 (C:15, M:75, Y:0, K:45) 撞網防護。
- **`LineArt-Extractor`** (9 MB)：彩色插畫/照片一鍵提取純黑 K100 單色線稿。
- **`PaperTexture-Engine`** (2 MB)：3D 物理法線貼圖模擬萊妮、牛皮、水彩紙微觀手感。
- **`RisoSeparator`** (1 MB)：衣服網版絹印 / Risograph 孔版印刷 2~6 專色分色膠片。
- **`QR-Preflight-Enhancer`** (1.5 MB)：菜單 QR Code 容錯率驗證與純黑向量重構。
- **`Braille-Builder`** (0 KB)：標準 6 點盲文點字轉譯與 0.3mm 打凸鋅版生成。
- **`DeGlare-Net`** (12 MB)：自動抹除玻璃裱框與壓克力反光眩光。
- **`AOD-Net DeHaze`** (5 MB)：大氣透霧水氣穿透，還原深邃藍天與高對比。
- **`Homography-Net`** (4 MB)：斜拍梯形視角單應性變換 90° 垂直拉正。
- **`Scratch-Net`** (14 MB)：實體老照片紙張折痕、白色裂紋與霉斑修補。
- **`GuillocheGuard`** (0 KB)：0.5pt 防偽微文字與扭索紋開口率安全檢驗。
- **`Moiré-Lite / DeScreen`** (8 MB)：過濾翻拍實體印刷品網點與二次摩爾紋。
- **`CodeFormer-Lite / FaceRestorer`** (18 MB)：人像瞳孔、睫毛與自然笑臉微對比重構。
- **`GAIC-Lite / SmartCropper`** (3 MB)：跨長寬比黃金分割構圖與防切頭保護。
- **`DDColor-Lite`** (22 MB)：黑白/復古歷史老照片智慧擬真上色。
- **`FontMatcher-Lite`** (6 MB)：視覺字體辨識與 Google Fonts 開源字庫配對。
- **`Zero-DCE++`** (79 KB)：暗部防死黑曲線調光。
- **`Deshadow-Net`** (5 MB)：手機光照均勻化。
- **`SCUNet-Lite`** (15 MB)：實用盲去噪。
- **`NAFNet-Lite`** (16 MB)：運動模糊與脫焦還原。
- **`DocTr-Dewarp`** (18 MB)：翻拍書頁圓柱曲面拉平。
- **`MODNet / BiRefNet`** (6~18 MB)：髮絲級透明通道去背。
- **`TinySAM`** (28 MB)：1-Click 智慧物件消除筆。
- **`Kurbo Geometry (Rust)`**：2mm 壓克力激光刀模與 0.2mm 內縮白墨。
- **`PyVips SIMD 串流`**：20,000px 巨幅看板記憶體控制在 30MB 內。

---

## 🎯 5 大場景自動偵測與專屬模型派發

丟入圖片後，`SceneClassifier` 於 0.01 秒內完成特徵辨識並自動派發模型：

| 偵測場景分類 | 視覺特徵辨識演算法 | 系統全自動套用的最佳模型組合 |
| :--- | :--- | :--- |
| **🎨 1. 動漫 / 二次元插畫** | 飽和度高、封閉黑色墨線輪廓 | ➔ `Anime4K` 墨線銳化 + `MODNet` 角色立牌 + `Kurbo 2mm` 刀模 |
| **📷 2. 寫實人像 / 婚紗寫真** | 肌膚暖色溫、微細毛孔、景深 | ➔ `HAT-S` 毛孔真細節 + `Deshadow` 去陰影 + `SCUNet` 去噪 |
| **📄 3. 文件 / 名片 / 證書** | 白底黑字、高密度文字條紋 | ➔ `純黑 K100 向量轉曲` + `OpenCV Radon 歪斜校正` + `DocTr` |
| **🏞️ 4. 風景 / 建築 / 展覽** | 寬廣漸層天空、深遠地平線 | ➔ `AOT-GAN` 背景生長 + `MAT-Lite` 深度透視 + `DGF` 防斷階 |
| **🏷️ 5. 模切貼紙 / 標誌圖標** | 帶有 Alpha 透明通道、純幾何 | ➔ `Rust VTracer 轉向量` + `0.2mm 內縮白墨` + `2mm 刀模` |

---

## 🖨️ 多格式商業出機中心

原生支援印刷廠與製版機台指定的 6 大標準格式：

```
                        【PrintMagic 多格式商業出機中心】
┌─────────────────────────────┬─────────────────────────────┬─────────────────────────────┐
│ 📄 PDF/X-1a (300 DPI)       │ 🖨️ 工業級無損 TIFF (300 DPI)│ 📥 高清透明 PNG (300 DPI)   │
│   • 3mm 出血 + 向量裁切標記 │   • Tag 282/283 二進位分色  │   • 保留 8-bit Alpha 通道   │
├─────────────────────────────┼─────────────────────────────┼─────────────────────────────┤
│ 🖼️ 最高畫質 JPG (300 DPI)   │ ✂️ 向量刀模與白墨 SVG       │ 📦 印刷廠出機全套包 (.zip)  │
│   • 100% 最高品質相片沖印   │   • 100% 洋紅激光切割線     │   • 包含 5 大格式 + 檢驗證書│
└─────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

---

## 💎 會員分級與商業模式規格 (M365 混合雙棲架構)

支援 **「Web 雲端版（手機/隨處可用）」** 與 **「Mac / Windows 原生桌機版（100% 離線硬體加速）」**：

| 會員層級 | 建議定價 | 每日處理張數 | 批次處理能力 | 桌面版支援 | 專屬商業特權 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **🟢 Free 完整體驗版** | **NT$ 0** | **3 張 / 天** | 單張上傳 | Web 雲端 | **100% 享受全功能 (無浮水印、無閹割)**、超商立印。 |
| **🔵 Pro 專業生產力版** | **NT$ 199 /月** | **100 張 / 天** | **一次 20 張批次** | ✅ Mac / Win | **A4/A3 智慧拼模 (省70%)**、雙面合版、全套 ZIP 包。 |
| **👑 VIP 企業工作室版** | **NT$ 699 /月** | **🔥 無上限** | **一次 100+ 張** | ✅ Mac / Win | **20,000px 巨幅看板**、**隱私保護盾**、**SHA-256 舉證證書**、統編發票。 |

---

## 🚀 快速開始與本機運行

### 1. 環境需求
- Node.js 18+ (建議 Node.js 22 LTS)
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
# 執行 17 大測試套件 (83 項單元測試)
npm run test

# 執行 TypeScript 類型檢查
npm run typecheck

# 構建生產環境 Bundle
npm run build
```

---

## 📄 開源授權條款 (License)

本專案基於 **MIT License** 授權開源。所有內建神經網絡模型均遵循其原作者之商業開源協議（MIT / Apache 2.0 / BSD）。

---

> 💡 **進一步了解底層架構？** 請參閱 **[📑 PrintMagic Studio 3.1 系統產品規格說明書 (docs/SPEC.md)](./docs/SPEC.md)**。
