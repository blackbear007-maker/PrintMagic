# PrintMagic Studio (v3.0)

> **"From AI Pixels to Physical Masterpiece"**  
> 純瀏覽器端專業級 AI 圖片印刷準備工作室。100% 離線本機運算、零資料上傳、全 TypeScript 模組化架構。

---

## 🌟 核心功能亮點

1. **實體印刷規格精確適配**
   - 支援 **A4 / A3 經典海報** (210×297mm / 297×420mm)
   - 支援 **藝術紀念明信片** (148×100mm)
   - 支援 **商業名片** (90×54mm)
   - 支援 **模切貼紙** (50×50mm, 350 DPI)
   - 支援 **數位社群高畫質發布** (1080×1080px)

2. **誠實 7 大維度印刷適合度評分 (0–100 分)**
   - 解析度權重 (35%)、長寬比契合 (15%)、亮暗階調 (10%)、CMYK 飽和度 (10%)、對比層次 (10%)、微細邊緣銳度 (10%)、總墨量安全 (10%)。
   - 給出具體的專家檢驗診斷與改善建議。

3. **Pre-press 印刷物理防護引擎**
   - **總墨量 (TAC) 300% 限制壓制**：自動修復高密度四色黑與溢墨區域，防範印刷廠乾燥失敗與背印沾損。
   - **TAC 溢墨視覺熱力圖**：一鍵開啟螢光熱力圖，直觀檢視超過 300% 墨量之危險區域。
   - **Pre-press 微細邊緣銳化 (USM)**：補償紙張纖維吸墨擴散 (Dot Gain)。
   - **Lanczos-3 高精度重採樣**：自動將不足 300 DPI 的圖片無失真放大至印刷級解析度。

4. **工業標準 PDF 匯出**
   - **0.1mm 標準向量裁切標記 (Crop Marks)**
   - **3mm 精確出血框與文字安全區**
   - **CMYK 四色印刷密度條與十字套準標記 (Registration Marks)**
   - **印刷規格 Meta Slug 標註**

5. **純客戶端向量化 (Potrace TS)**
   - 一鍵將 AI 插畫、線條圖轉換為可無限縮放的貝茲曲線向量 SVG。

6. **Apple Pro Studio 質感與雙向對比**
   - **60fps 雙向滑動檢視器**：即時滑動檢驗優化前後細節。
   - **實體紙材模擬器**：超光銅版紙、雙面啞粉紙、細格萊妮紙、象牙棉卡質感與漫射光影預覽。
   - **剪貼簿直接貼上 (Ctrl+V / Cmd+V)**：從 Midjourney / Discord 複製圖片後直接貼上。

---

## 🚀 開發與建置

```bash
# 安裝依賴
npm install

# 啟動本機開發伺服器
npm run dev

# 執行 TypeScript 型別檢查
npm run typecheck

# 執行自動化單元測試 (Vitest)
npm test

# 生產環境打包
npm run build

# 預覽打包產物
npm run preview
```

---

## 📁 專案架構

```
AI2PNG (PrintMagic)
├── index.html                    # 語意化 HTML5 入口
├── package.json                  # Vite + TypeScript + jsPDF + Vitest
├── tsconfig.json                 # 嚴格型別檢查配置
├── vite.config.ts                # Vite 模組化打包配置
├── src/
│   ├── main.ts                   # 應用啟動與流程控制器
│   ├── types/
│   │   └── index.ts              # 核心型別合約
│   ├── styles/
│   │   ├── index.css             # 全域 CSS 變數與 Typography
│   │   ├── studio.css            # Studio 專業暗色中性介面
│   │   └── components.css        # 拖曳區、滑動對比、圓形量表等元件樣式
│   ├── core/
│   │   ├── presets.ts            # 工業印刷規格標準設定
│   │   ├── dpi-calculator.ts     # DPI 與毫米/像素數學轉換
│   │   ├── ink-limiter.ts        # TAC 總墨量 300% 壓制與熱力圖
│   │   ├── cmyk-engine.ts        # CMYK 色彩科學與軟打樣
│   │   ├── unsharp-mask.ts       # Pre-press 細部銳化
│   │   └── print-score.ts        # 7 大面向誠實印刷評分
│   ├── workers/
│   │   ├── image.worker.ts       # 獨立像素運算 Web Worker
│   │   └── worker-client.ts      # 型別安全非同步 Worker 封裝
│   ├── engines/
│   │   ├── lanczos.ts            # Lanczos-3 插值演算法核心
│   │   ├── pdf-exporter.ts       # jsPDF 印刷標準 0.1mm 裁切標記輸出
│   │   └── vector-tracer.ts      # Potrace 純客戶端 SVG 向量化
│   └── ui/
│       ├── state.ts              # 響應式狀態管理 Store
│       ├── dropzone.ts           # 支援拖曳與 Ctrl+V 剪貼簿上傳元件
│       ├── diagnostic-card.ts    # 印刷診斷儀 UI
│       ├── compare-slider.ts     # 60fps 分割對比滑動器
│       ├── paper-simulator.ts    # 實體紙材材質模擬
│       └── toast.ts              # 微互動通知
└── tests/
    └── core.test.ts              # 核心演算法單元測試
```

---

## 📜 授權協議

MIT License
