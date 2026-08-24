# PrintMagic Studio 3.1 系統產品規格說明書 (System & Product SPEC)

> **版本**：v3.1.0-Release  
> **最後更新日期**：2026-08-23  
> **系統定位**：全自動商業印前修復與出機工作站 (AI Pre-Press Engine & Multi-Format Exporter)  
> **核心哲學**：100% 自由開源商用架構 · 0 外部收費 API 依賴 · 新手無腦一鍵出機 · 商業合規舉證  

---

## 1. 系統全景與技術架構 (System Architecture)

### 1.1 雲端微服務矩陣 (Railway Docker Multi-Container Architecture)
系統在雲端採用 4 大獨立輕量化容器，記憶體硬體上限嚴格鎖定在 1.4 GB 內，確保每月主機總開銷控制在 **$6.5 美元 (約 NT$ 210)** 內：

| 服務容器名稱 | 執行語言 / 運行環境 | 端口 (Port) | RAM 硬上限 | 核心職責與承載模組 |
| :--- | :--- | :---: | :---: | :--- |
| **`printmagic`** | Node.js 22 (Alpine) + Vite SSR | `3000` | **256 MB** | 主應用入口、UI 渲染、合版拼版算力、PDF/X-1a 出機檔壓製。 |
| **`vtracer`** | Rust 1.78 + Tokio (Distroless) | `8080` | **128 MB** | VTracer 向量化引擎、Kurbo 2mm 刀模幾何運算、OxiPNG 無損壓縮。 |
| **`tesseract`** | Python 3.11 + Tesseract 5.3 C++ | `8081` | **384 MB** | 繁中/英/日 OCR 文字辨識、PP-OCRv4 邊界包圍盒幾何解析。 |
| **`zero-dce`** | Python 3.11 + PyTorch 2.3+ (CPU) | `8082` | **640 MB** | 統一神經網路工作站 (共用 300MB 常駐池，承載 10+ 款 PyTorch 模型)。 |

### 1.2 零外部付費 API 規則 (Strict 100% Zero-Commercial-API Policy)
- ❌ 徹底剔除 Google Cloud Vision、Remove.bg、PhotoRoom、Midjourney 等任何需第三方 Token/按次計費之商業 API。
- ✅ 100% 採用 **MIT / Apache 2.0 / BSD** 開源協議之演算法與模型，杜絕任何隱形成本與超額扣款風險。

### 1.3 🛡️ 絕不能移除的【黃金核心護城河】（Golden Core Moat Modules - 永久保留清單）
以下模組是真正**解決印刷翻車痛點、支撐產品付費轉換與商業護城河**的核心資產，**任何架構精簡或重構均嚴禁移除**：

#### 🎨 1. 動漫 / 文創周邊剛需（創作者變現主力）
- **`Sticker-KissCut-Builder` (手帳貼紙刀模線 + 0.2mm 內縮白墨)**：解決透明/PVC 貼紙透光問題，自動生成洋紅刀模與白墨遮罩層。
- **`Acrylic-Charm-Builder` (壓克力立牌/吊飾外框與打孔)**：自動生成 2mm 圓滑邊界向量刀模與頂部打孔圈。
- **`TShirt-Color-Knockout` (衣服膠印底色去色透氣)**：智慧扣除同色衣物底色，使熱轉印膠膜柔軟透氣不悶熱。
- **`Anime4K-Upscaler` (二次元插畫無損放大)**：專為動漫插畫重構墨線與平塗色彩，邊緣刀削般銳利無雜點。

#### 🖼️ 2. 相片與生活輸出剛需（大眾消費轉化主力）
- **`HAT-S / Real-ESRGAN / SwinIR` (8x 金字塔超解析度)**：終結 72 DPI 手機照片與截圖印成海報變馬賽克的恐懼。
- **`Canvas-Wrap-Mirror` (無框畫 3.5cm 立體包邊鏡像)**：四面包邊鏡像延伸，正面構圖 100% 完整不切人臉與重要細節。
- **`Photo-Frame-Mat` (畫廊卡紙裝裱內襯白邊)**：自動計算 2:3/3:4 比例與 45° 倒角陰影，營造美術館級裝裱質感。
- **`Passport-Proportion-Aligner` (2 吋護照大頭照頭頂自動校準)**：精確定位台灣與國際 2 吋大頭照 3.2~3.6cm 官方頭部比例。
- **`Object-Eraser` (AI 智慧消除筆)**：筆刷塗抹秒除路人、雜物、反光斑點與浮水印，底圖平滑自動修補。

#### 🖨️ 3. 工業級印前物理與色彩安全（印刷廠零退件保證）
- **`Bleed-Expander` (3mm 智慧出血背景生長)**：AOT-GAN / OpenCV Telea / 鏡像外推，徹底杜絕裁切白邊與文字切除。
- **`CMYK-Engine / Kubelka-Munk / GCR-Gray` (控墨防死黑、軟打樣、省墨 35%)**：物理減法混色預測 + 總墨量 TAC ≤ 300% 限制。
- **`Foil-Simulator` (亮金/玫瑰金/局部光 3D 擬真與獨立黑版分離)**：即時反光模擬並自動生成 100% K100 菲林鋅版遮罩。
- **`Barcode-QR-Fixer` (純黑 K100 向量小字與保證秒掃的 QR 碼)**：重構純黑向量碼與高反差對比驗證，保證機台 100% 秒讀。
- **`Imposition-Engine` (A4/A3 智慧合版拼模)**：多模自動排滿大版，大幅節省 70% 實體合版印刷費。
- **`PDF/X-1a 出機壓製` (零退件標準出機檔)**：內嵌向量角線、十字規矩線、出血框與 CMYK 描述檔，任何印刷廠皆可直接出機。

---

## 2. AI 模型與印前演算法陣列 (AI Models & Pre-Press Matrix)

### 2.1 超解析度放大模型矩陣 (Super-Resolution Suite)
| 模型名稱 | 核心架構 | 權重體積 | 耗時 (CPU) | 開源協議 | 最佳適用場景 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **本機 Lanczos-3** | 純數學 Sinc 濾波卷積插值 | 0 KB | 0.05s | MIT | 0ms 離線極速平滑，消除馬賽克 (Free 標配)。 |
| **FSRCNN** | 亞像素輕量卷積網絡 (Fast SRCNN) | 150 KB | 0.02s | BSD | 畫布 20x 放大鏡即時預覽，超低耗電。 |
| **Anime4K** | 動漫幾何邊緣重構演算法 | ~5 MB | 0.1s | MIT | 二次元動漫插畫、同人誌，墨線刀削般漆黑無鋸齒。 |
| **Real-ESRGAN Compact** | 深度殘差卷積 (RRDB + UNet) | ~12 MB | 0.8s | BSD-3 | 文字、插畫、包裝設計綜合重構王者。 |
| **HAT-S (2024 SOTA)** | 混合注意力 Transformer (Hybrid Attention) | ~28 MB | 1.3s | Apache 2.0 | 寫實風景、人像婚紗、攝影大圖，重構真實毛孔細節。 |
| **SwinIR-Lite** | Swin Transformer 影像修復網絡 | ~24 MB | 1.1s | Apache 2.0 | 去除 8x8 DCT JPEG 壓縮塊狀噪點 + 4x 超解析二合一。 |

### 2.2 3mm 物理出血背景外推模型矩陣 (Bleed Outpainting Suite)
| 模型名稱 | 核心架構 | 權重體積 | 耗時 (CPU) | 開源協議 | 外推生成專長 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **基礎邊界拉伸 / 鏡像** | 像素邊界延展 / 對稱鏡像 | 0 KB | 0.01s | MIT | 純色/漸層背景，100% 裁切不留白邊 (Free 標配)。 |
| **OpenCV Telea** | Navier-Stokes 流體力學偏微分擴散 | ~2 MB | 0.05s | Apache 2.0 | 邊界色彩融接極度柔和，自然擴散。 |
| **LaMa-Lite** | 快速傅立葉頻域卷積 (FFC) | ~25 MB | 0.4s | Apache 2.0 | 幾何磚牆、重複紋理、格紋布料外推無破綻。 |
| **AOT-GAN Lite** | 多孔徑上下文聚合生成對抗網絡 | ~28 MB | 0.5s | Apache 2.0 | 大自然風景、天空、草地自然向外生長。 |
| **MAT-Lite** | 遮罩感知 Transformer (Mask-Aware) | ~32 MB | 0.9s | MIT | 深遠透視地平線、公路、建築空間延伸不變形。 |

### 2.3 專業印前光學與色彩防護模型 (Industrial Pre-Press Modules)
- **OGV-ExpandedGamut-Separator** (0 KB, MIT)：7色廣色域高保真分色 (CMYK+Orange+Green+Violet)，色域覆蓋率自 65% 躍升至 92%。
- **CrystalUV-Heightmap-Builder** (0 KB, MIT)：UV 水晶標/立體浮雕自動生成 100% 遮底白墨層 + 5階立體光油高度貼圖。
- **SaddleStitch-Creep-Compensator** (0 KB, MIT)：多頁手冊騎馬釘裝訂紙厚外推爬移 (Creep) 遞進幾何內縮補償。
- **InkWash-Diffusion-Engine** (~1.5 MB, MIT)：生宣/熟宣紙毛細管擴散模擬與水墨字畫 Giclée 藝術微噴飛白還原。

### 2.4 使用者端圖片轉印刷專用優化引擎 (User-Facing Image Pre-Press Suite)
- **Deep-Shadow-Detail-Revealer** (0 KB, MIT)：暗部防死黑層次還原，拉開 0%~15% 深色階調，防止實體吸墨成大黑斑。
- **Hairline-Thickener-Guard** (0 KB, MIT)：小於 0.08mm 細線防斷印自動增厚至 0.12mm 安全線寬。
- **Pure-White-Clean-Up** (0 KB, MIT)：相片/手繪背景一鍵去灰去髒，230~255 RGB 背景拉平純白省墨。
- **Skin-Tone-Cyan-Suppressor** (0 KB, MIT)：人像膚色去青去濁，壓制青墨並微調 M+Y 黃金氣色比例。
- **Color-Banding-DeContour** (0 KB, MIT)：大面積漸層防斷階平滑器，高頻藍噪點微抖動消除階梯紋。
- **RGB-To-CMYK-Vibrancy-Rescuer** (~1 MB, MIT)：RGB 轉 CMYK 鮮豔度拯救，感知色相重對齊保留霓虹感。
- **Acrylic-Charm-Dieline-Builder** (0 KB, MIT)：壓克力立牌/吊飾一鍵生成 2mm 圓滑刀模線、打孔圈與白墨層。
- **Sticker-KissCut-Border-Generator** (0 KB, MIT)：手帳貼紙萌系 1.5~2mm 圓滑白邊與半斷向量刀模路徑。
- **T-Shirt-Color-Knockout** (0 KB, MIT)：衣服膠印底色去色透氣，扣除同色背景使印花柔軟不悶熱。
- **Text-SafeZone-Auto-Padding** (0 KB, MIT)：重要文字防切自動內縮，將 1~2mm 邊界文字平移至 5mm 安全區。
- **AI-Pseudo-Text-Filter** (~3 MB, MIT)：AI 繪圖外星亂碼字一鍵抹除還原底圖，便於替換真實商用文字。
- **Micro-Contrast-Text-Booster** (0 KB, MIT)：文字背景微反差拉開，避免暗底黑字在實體紙張上融成一團。
- **Real-Paper-Print-Simulator** (~2 MB, MIT)：實體紙張印刷預覽模擬，真實呈現牛皮紙、相紙與模造紙吸墨手感。
- **Resolution-DPI-Defect-Visualizer** (0 KB, MIT)：1:1 實物放大鏡，手持比例真實預覽低解析度馬賽克鋸齒。
- **Foiling-Highlight-Extractor** (~1 MB, MIT)：喜帖/名片局部燙金圖層一鍵萃取 100% K100 菲林出片遮罩。
- **Barcode-QR-Legibility-Fixer** (~500 KB, MIT)：模糊點陣條碼與 QR 碼一鍵重構純黑 K100 向量碼，保證 100% 秒掃。
- **Passport-Head-Proportion-Aligner** (~2 MB, MIT)：台灣與國際 2 吋護照大頭照 70%~80% (3.2~3.6cm) 頭頂自動校準。
- **Photo-To-Coloring-Book** (~4 MB, MIT)：照片一鍵變兒童塗色著色本，生成純淨無雜點黑白填色線稿。
- **Seam-Carving-Canvas-Fitter** (~1 MB, MIT)：智慧內容感知畫面延展，16:9 轉 A4/名片主體完全不變形。
- **Edge-Bleed-Feathering-Inpainter** (0 KB, MIT)：照片邊緣漸層羽化，無縫融入馬克杯與周邊商品底色。
- **Screenshot-Dark-Inverter** (0 KB, MIT)：深色截圖一鍵省墨轉印，將 ChatGPT/代碼黑底反轉為純白紙基與 K100 文字。
- **Canvas-Wrap-Mirror-Builder** (0 KB, MIT)：無框畫 4 面 3.5cm 立體包邊鏡像延伸，正面 100% 完整不切人臉。
- **Photo-Frame-Mat-Generator** (0 KB, MIT)：畫廊卡紙裝裱內襯白邊生成器，自動計算 2:3/3:4 比例與 45° 倒角陰影。
- **Grid-Splitter-Multi-Panel** (0 KB, MIT)：巨幅海報多張 A4 拼印神器，自動分割帶 5mm 重疊對位十字虛線。
- **Holographic-Foil-Masker** (0 KB, MIT)：鐳射雷射貼紙透光白墨遮罩，背景閃耀彩虹光芒、人物清晰顯色。
- **Folded-Greeting-Card-Imposer** (0 KB, MIT)：對折卡片/邀請函自動正反倒轉拼版，中央附帶壓痕對折定位。
- **Fluorescent-Neon-Ink-Extractor** (0 KB, MIT)：螢光粉/螢光綠第 5 專色獨立膠片分色出片生成。
- **Whiteboard-Glare-Keystone** (~1.5 MB, MIT)：白板/簡報翻拍去光斑拉平，抹除高光斑點並拉正為 90° 矩形。
- **Canvas-Oil-Impasto-3D** (0 KB, MIT)：無框畫立體油畫厚塗筆觸肌理，生成 3D 法線與 UV 光油高度貼圖。
- **Watermark-Stamp-Remover** (~2.5 MB, Apache 2.0)：相片樣張日期戳記與水印智慧抹除，局部紋理流體平滑修補。
- **Watercolor-Bleed-Softener** (0 KB, MIT)：水彩畫紙水痕浸潤模擬，邊緣生成自然水痕沉澱邊框。
- **Price-Tag-Batch-Tiler** (0 KB, MIT)：市集商品標籤一鍵滿版排版，自動拼版排滿 A4 貼紙頁。
- **Business-Card-Smart-Aligner** (~1.0 MB, MIT)：名片文字瑞士網格自動對齊，基線網格吸附排版。
- **Wedding-Skin-Pore-Preserver** (0 KB, MIT)：婚紗寫真天然微晶磨皮，高低頻空間分離 100% 鎖死毛孔細節。
- **Photocard-Holo-Glitter-Masker** (0 KB, MIT)：K-Pop 偶像小卡/動漫碎玻璃閃粉遮罩，分離人物白墨與雷射碎晶背景。
- **Food-Menu-Mouthwatering-Toner** (0 KB, MIT)：餐廳菜單美食色澤垂涎誘人增豔，600~650nm 暖紅黃與油脂反光提亮。
- **Rollup-Banner-Gigantic-Scaler** (0 KB, MIT)：易拉寶/80x200cm 商業大圖展架瓦片分塊超解析，前端 0 崩潰輸出。
- **Packaging-Box-Dieline-Gen** (0 KB, MIT)：電商飛機盒/扣底彩盒參數化 3D 刀模生成器，包含壓痕虛線與 15mm 糊邊。
- **Luxury-Embossing-Bevel-Builder** (0 KB, MIT)：名媛喜帖/頂級名片立體打凸浮雕高度圖，45° 倒角灰階圖直通鋅版雕刻機。
- **Giclee-FineArt-Dmax-Toner** (0 KB, MIT)：博物館級藝術微噴黑階深度與紙張動態增強，Ansel Adams 11 階動態擴展。
- **Apparel-HangTag-Planner** (0 KB, MIT)：獨立服飾品牌吊牌排版與 3.5mm 穿繩打孔規劃，自動拼滿 A4/A3。

### 2.5 純演算法 100% 無腦全自動印前物理引擎 (Pure Mathematical 0-KB Pre-Press Suite)
- **Kubelka-Munk-Mixer** (0 KB, MIT)：Kubelka-Munk 物理減法混色模擬，雙流輻射傳遞消除螢幕加法色差。
- **CAT02-Color-Temperature** (0 KB, MIT)：CIECAM02 CAT02 色適應變換，冷白日光燈翻拍自動校正為 5500K 暖日光。
- **GCR-Gray-Maximizer** (0 KB, MIT)：中性深灰 100% 黑版替代最大化，消除印刷機震動偏色並省墨 35%。
- **Local-Laplacian-Toner** (0 KB, MIT)：多尺度拉普拉斯金字塔動態壓縮，高光陰影平衡且鎖死微反差細節。
- **Adaptive-Wiener-Deblur** (0 KB, MIT)：自適應維納逆卷積去模糊，頻域逆濾波 0.005s 瞬間重新聚焦手震線條。
- **Highpass-Dotgain-Crispener** (0 KB, MIT)：3x3 高通空間卷積邊緣反差微銳化，物理抵消紙張吸墨網點擴大。
- **Paper-White-Compensator** (0 KB, MIT)：紙張介質底色反向色彩預補償，修正米黃/牛皮底紙造成的膚色發黃。
- **Duplex-Alignment-Balancer** (0 KB, MIT)：雙面列印正反面透光重合幾何平衡，左右咬口對稱消除 3mm 錯位。
- **Corner-Radius-Mitering** (0 KB, MIT)：R3/R5/R8 圓角安全邊距自動檢驗，布林運算防止圓角刀切除四角圖標。
- **Floyd-Steinberg-Rasterizer** (0 KB, MIT)：經典空間誤差擴散 1-Bit 光柵化，超商黑白影印/熱感列印極致點陣。
- **Auto-Keystone-Rectifier** (0 KB, MIT)：100% 全自動輪廓四角偵測與單應性矩陣拉正，零手動拖曳。
- **Circle-Badge-Arc-Fitter** (0 KB, MIT)：58mm/75mm 圓形胸章極座標弧形展開與 3mm 馬口鐵包邊折痕出血生成。
- **Trapping-Master** (0 KB, MIT)：自動印刷補邊與陷印，消除機台套準震動造成的漏白縫隙。
- **MetallicFoil-Separator** (~2 MB, MIT)：燙金/燙銀/燙雷射獨立 100% K100 鋅版出片遮罩自動生成。
- **UCR/GCR Under-Color-Removal** (0 KB, MIT)：底色去除與黑版替代，減少 30% 暗部油墨堆疊防止背印。
- **Nesting-Optimizer** (~2 MB, Apache 2.0)：異形貼紙 2D 凸包旋轉排版，A3/A4 紙張利用率提升至 90%。
- **CMYK-DotGain-Predictor** (0 KB, MIT)：Murray-Davies 實體網點擴大預補償，消除無塗佈紙印刷變黑。
- **Barcode-Vector-Synthesizer** (~500 KB, MIT)：GS1 EAN-13 / Code-128 純向量 K100 條碼重構。
- **Varnish-SpotUV-Dilator** (0 KB, MIT)：局部上光 (Spot UV) 0.15mm 套準溢光補償與邊緣修飾。
- **Packaging-Crease-Fold3D** (~4 MB, MIT)：包裝紙盒 2D 刀模壓痕驗證與 3D 摺疊網格推導。
- **SpineWidth-Calculator** (0 KB, MIT)：基重 (gsm) 與頁數精確推導 0.1mm 級膠裝/精裝書背厚度。
- **DeltaE-Gamut-Remapper** (~1 MB, MIT)：CIECAM02 視覺感知色域映射，保留 RGB 霓虹色印刷活力。
- **ShadowHighlight-HDR-Toner** (~3 MB, Apache 2.0)：14 EV 手機 HDR 動態範圍平滑壓縮至 5.5 EV 紙張反射率。
- **TextCurvature-Unbender** (~3 MB, Apache 2.0)：圓形印章與瓶身杯身環狀弧形文字展開拉直。
- **Photo-To-Vector-Silhouette** (~4 MB, MIT)：照片一鍵生成高對比純單色向量剪影刀模。
- **GripMargin-Checker** (0 KB, MIT)：平版印刷機 10mm 夾爪咬口 (Gripper Margin) 碰撞自動預警。
- **Metallic-Sheen-Renderer** (~2 MB, MIT)：薄膜干涉與 BRDF 物理渲染鐳射彩虹反光動態。
- **ScreenAngle-Optimizer** (0 KB, MIT)：ISO 12647-2 四色網點角度 (C:15, M:75, Y:0, K:45) 撞網防護。
- **LineArt-Extractor** (~9 MB, MIT)：彩色插畫/照片一鍵提取純單色純黑 K100 向量線稿，專供著色本與雷雕。
- **PaperTexture-Engine** (~2 MB, MIT)：3D 物理法線貼圖即時模擬萊妮、牛皮、水彩紙微觀纖維手感與油墨吸收。
- **RisoSeparator** (~1 MB, MIT)：衣服網版絹印 / Risograph 孔版印刷 2~6 專色獨立黑色膠片版自動分離。
- **QR-Preflight-Enhancer** (~1.5 MB, Apache 2.0)：餐廳菜單/名片 QR Code ECC 容錯與高反差對比驗證 + 純黑向量重構。
- **DeGlare-Net** (~12 MB, MIT)：自動分離並抹除玻璃裱框、壓克力櫃與光面相紙的刺眼強光眩光。
- **AOD-Net DeHaze** (~5 MB, MIT)：大氣光透射率估算，1秒穿透霧霾水氣還原深邃藍天與高對比建築。
- **Homography-Net** (~4 MB, MIT)：四角點單應性幾何變換，將斜拍看板/證書自動拉正為 90° 矩形。
- **Scratch-Net** (~14 MB, Apache 2.0)：實體老照片紙張長條折痕、白色裂紋與霉斑筆觸級自動修補。
- **Moiré / DeScreen-Net** (~8 MB, MIT)：過濾掃描/翻拍實體印刷品的蜂巢狀網點與二次干涉摩爾紋。
- **CodeFormer-Lite / FaceRestorer** (~18 MB, Apache 2.0)：人臉先驗特徵重構，瞳孔高光、睫毛與自然笑臉微對比增強。
- **GAIC-Lite / SmartCropper** (~3 MB, MIT)：美學顯著度感知，跨長寬比切換時黃金分割防切頭構圖。
- **DDColor-Lite / VintageColorizer** (~22 MB, Apache 2.0)：雙解耦神經網絡，黑白/復古老照片智慧擬真上色。
- **FontMatcher-Lite** (~6 MB, Apache 2.0)：視覺字體特徵分類與 Google Fonts 開源商用字庫精確配對。
- **Zero-DCE++** (~79 KB, MIT)：深度可分離卷積非線性曲線調光，防止暗部印刷死黑。
- **Deshadow-Net** (~5 MB, MIT)：Retinex 光照場均勻化，抹除手機翻拍實體作品的手部黑影。
- **SCUNet-Lite** (~15 MB, Apache 2.0)：實用盲去噪與高 ISO 噪點抑制。
- **NAFNet-Lite** (~16 MB, MIT)：非線性無激活運動模糊與脫焦還原。
- **DocTr-Dewarp** (~18 MB, Apache 2.0)：圓柱形曲面書頁拉平與透視形變消除。
- **MODNet-Lite / BiRefNet** (~6~18 MB, Apache 2.0)：髮絲級透明通道 Alpha Matting。
- **TinySAM** (~28 MB, Apache 2.0)：1-Click 智慧物件分割消除筆 (Magic Eraser)。
- **DexiNed-Lite** (~10 MB, MIT)：單像素極細連續邊界提取（激光刀模專用）。
- **DGF-Net / 防斷階引擎** (MIT)：引導式濾波 + 藍噪點抖動，消除 8-bit 色階階梯紋。
- **Kurbo Geometry (Rust)** (Apache 2.0)：2mm 壓克力刀模外推線與 0.2mm 內縮白墨布林運算。
- **PyVips SIMD 串流** (LGPL-2.1+)：需求驅動切片管線，處理 20,000px 巨幅看版記憶體控制在 30MB 內。
- **Pantone 色票比對** (MIT)：CIE $\Delta E_{2000}$ 國際專色匹配與調墨比矩陣。
- **純黑 K100 向量轉曲** (MIT)：小字自動轉單色純黑向量，杜絕 4 色混墨重影。

---

## 3. 智慧照片類型自動偵測分流 (SceneClassifier Auto-Routing)

系統於圖片上傳後 0.01 秒內完成特徵分析，自動派發最佳模型：

```
                              【5 大場景自動分流路徑】
┌─────────────────────────────┬────────────────────────────────────────────────────────┐
│ 1. 🎨 動漫 / 二次元插畫     │ ➔ 套用 Anime4K 墨線銳化 + MODNet 角色立牌 + Kurbo 2mm 刀模 │
├─────────────────────────────┼────────────────────────────────────────────────────────┤
│ 2. 📷 寫實人像 / 婚紗寫真   │ ➔ 套用 HAT-S 真毛孔重構 + Deshadow 去陰影 + SCUNet 去噪│
├─────────────────────────────┼────────────────────────────────────────────────────────┤
│ 3. 📄 文件 / 名片 / 證書    │ ➔ 套用 純黑 K100 向量轉曲 + OpenCV 歪斜校正 + DocTr 拉平│
├─────────────────────────────┼────────────────────────────────────────────────────────┤
│ 4. 🏞️ 風景 / 建築 / 展覽    │ ➔ 套用 AOT-GAN 背景生長 + MAT-Lite 深度透視 + DGF 防斷階│
├─────────────────────────────┼────────────────────────────────────────────────────────┤
│ 5. 🏷️ 模切貼紙 / 圖標       │ ➔ 套用 Rust VTracer 轉向量 + 0.2mm 白墨 + 2mm 洋紅刀模 │
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
4. **超商 30 秒立印與送印小抄**：
   - 一鍵生成 7-11 ibon / 全家 雲端列印碼。
   - 下載 PDF 時自動複製標準送印規格小抄至剪貼簿（便於 LINE 給印刷廠）。

---

## 5. 多格式商業印刷出機中心 (Multi-Format Pre-Press Export)

原生支援印刷廠與製版要求的 6 大標準格式：

1. **📄 標準印刷 PDF (PDF/X-1a 300 DPI)**：ISO 15930 規範、3mm 物理出血、向量角線、CMYK 色條。
2. **🖨️ 工業級無損 TIFF (.tif 300 DPI)**：Tag 282/283 內嵌 300DPI 點陣檔，無失真分色首選。
3. **📥 高清透明 PNG (.png 300 DPI)**：保留 8-bit Alpha 透明通道，貼紙/立牌預覽。
4. **🖼️ 商用高畫質 JPG (.jpg 300 DPI)**：100% 最高畫質 JPEG，相片沖印必備。
5. **✂️ 向量刀模與白墨 SVG (.svg)**：100% 洋紅 (Spot Magenta) 向量激光割字線與 0.2mm 內縮白墨。
6. **📦 印刷廠出機全套包 (.zip)**：一鍵打包 PDF + TIFF + PNG + JPG + 刀模 SVG + PrintPass 合格證書。

---

## 6. 會員分級與商業模式規格 (M365 雙棲混合訂閱架構)

```
┌─────────────────────────────────────────────────────────────┐
│ 🟢 Free 完整體驗版 (NT$ 0 永久免費)：                       │
│    • 100% 享受全部 19 大 AI 模型與功能 (無閹割、無浮水印)   │
│    • 每日處理上限：3 張 / 天                                │
│    • 單張上傳、標準佇列、超商 30 秒立印                     │
├─────────────────────────────────────────────────────────────┤
│ 🔵 Pro 專業生產力版 (建議 NT$ 199 /月)：                    │
│    • Web 雲端每日 100 張 + 【下載 Mac / Windows 原生桌面版】│
│    • 20 張多圖批次連續製版 (一鍵打包 ZIP)                   │
│    • A4/A3 智慧合版拼模試算 (省 70% 費用)                   │
│    • 雙面合版綁定 (正面 + 背面 2 頁 PDF)                    │
│    • 高速運算佇列 (快 3 倍)                                 │
├─────────────────────────────────────────────────────────────┤
│ 👑 VIP 企業工作室版 (建議 NT$ 699 /月)：                    │
│    • Web 雲端 + 原生桌面版【無上限張數 (Unlimited)】         │
│    • 專屬 VIP 0 秒插隊算力通道 (最高優先級 GPU/CPU)         │
│    • 20,000px 巨幅戶外看板 / 車體廣告串流 (pyvips)          │
│    • 商業隱私保護盾 (Privacy Shield 100% 離線 + 0秒粉碎)    │
│    • PrintPass™ ISO 15930 合格證書 (含 SHA-256 防偽舉證戳記)│
│    • 自訂上傳印刷廠機台 ICC 描述檔                          │
│    • 3~5 人團隊席位 + 統一開立公司統編發票報帳              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 桌面離線版與 Mac (Apple Silicon) 規格規劃

### 7.1 雙棲模式授權與資安機制 (Microsoft 365 Hybrid Model)
- **登入一次，離線 30~90 天可用**：桌面 App 透過加密 JWT Token 記錄離線授權心跳包。
- **實體斷網專用 (Air-Gapped License)**：支援讀取機器碼 (Machine Hardware ID) 產生離線 `License.key` 授權檔。
- **營運端成本優勢**：重度設計師使用本地 Mac/PC 算力，**伺服器雲端成本降低 90%，毛利率 >95%**。

### 7.2 macOS (Apple Silicon M 系列) 原生優勢
- **蘋果 CoreML + 16 核心神經網絡引擎 (Apple Neural Engine, ANE)**：
  - Real-ESRGAN / HAT-S 放大從 1.5 秒降至 **0.1~0.2 秒**，無風扇噪音、極度省電。
- **Tauri 2.0 原生外殼**：安裝包小於 15 MB，原生支援 macOS 毛玻璃與 Retina XDR 視網膜螢幕。
- **ColorSync 與 Display P3 廣色域**：完美對接 Japan Color 2001 CMYK 描述檔，螢幕到印刷 0 色差。
