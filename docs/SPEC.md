# PrintMagic Studio 3.1 系統產品規格說明書 (System & Product SPEC)

> **版本**：v3.1.0-Release  
> **最後更新日期**：2026-08-23  
> **系統定位**：全自動商業印前修復與出機工作站 (AI Pre-Press Engine & Multi-Format Exporter)  
> **核心哲學**：100% 自由開源商用架構 · 0 外部收費 API 依賴 · 新手無腦一鍵出機 · 商業合規舉證  

> ⚠️ **誠實性附註（2026-08-26，後更新）**：本文件曾經在第 2、3、7 節列出大量從未實作的「模型」與功能（HAT-S、SwinIR、AOT-GAN、MAT-Lite、DexiNed、CodeFormer、GAIC、FontMatcher、桌面版效能數字等）——這些內容已於 2026-08-25 全面核實並改寫。第一輪核實時誤把 Zero-DCE++ 當成「真正訓練過的模型」，後來進一步查證發現它的 Docker 建置設定引用了從未存在過的權重檔案，程式碼裡也從未載入任何訓練權重（隨機初始化，非訓練結果）；VTracer 的 Dockerfile 同樣引用了從未存在過的原始碼，導致建置必定失敗，現已修正為安裝真正發布的 vtracer crate。**Tesseract（OCR）已於 2026-08-26 移除**——查證後發現它從未被任何 UI 功能實際呼叫（純死碼），且它原本想解決的問題（讀取 AI 繪圖產生的亂碼假文字）本來就不是 OCR 能解的，因為那些筆畫通常不是真實字元。同日新增 **Real-ESRGAN**（4x 放大）與 **ARNIQA**（品質評分）——兩者都是真實開源模型的官方發布訓練權重，開箱即用；也新增了 **DehazeFormer-T**（去霧）的真實架構程式碼；作者只透過 Google Drive 發布權重、無法自動下載，已於 2026-08-26 手動下載並**直接提交進 git**（原因見下段），已用真實下載的權重檔驗證：`strict=True` 完整載入 258 個張量、零缺漏零多餘，真實推論在模擬霧霾測試圖上讓對比度提升逾 3 倍（0.0245 → 0.0763）。**Retinexformer**（低光提亮）已於同日取代原本從未載入訓練權重的 Zero-DCE++——真實下載了官方發布的 `LOL_v2_real.pth` 權重（同樣提交進 git）並驗證：`strict=True` 完整載入 122 個張量、零缺漏零多餘，真實推論成功讓測試圖片變亮（平均亮度 0.082 → 0.399）。⚠️ 這兩個權重檔（合計 ~9MB）原本被 gitignore，但因為 Railway 是從 git 儲存庫建置 `zero-dce` 服務（`railway.toml` 用 `builder=DOCKERFILE`），不是從本機硬碟建置，只存在本機的權重檔案永遠不會真正部署上去——即使本機驗證推論成功，Railway 上仍會誠實回報 503。因此改為直接提交進 git（見 `.gitignore` 裡的例外規則）。同日再新增 **LaMa**（物件／浮水印移除）——TorchScript 匯出的 `big-lama.pt`，有可自動下載的 GitHub Release 網址，開箱即用（不受上述問題影響，因為建置時直接從網路下載，不依賴本機檔案）；已用真實下載的權重檔驗證：`torch.jit.load()` 成功，真實推論在模擬「浮水印」色塊測試圖上完全移除目標色塊（移除區域內 0% 殘留原色）。當時可正常建置運作、且已接上真實訓練權重的自建服務是 **VTracer**（向量化）、**Real-ESRGAN**（放大）、**ARNIQA**（品質評分）、**Retinexformer**（低光提亮）、**DehazeFormer-T**（去霧，兩者的權重都已下載並提交進 git，且都已用真實下載的權重檔驗證過推論成功）、**LaMa**（物件／浮水印移除，權重自動下載，已驗證推論成功）。其餘全部是決定性演算法（無 AI 模型），詳見 [README](../README.md#️-引擎組成真實模型-vs-決定性演算法)。**2026-08-27 再新增兩個模型**：**rembg**（去背，`u2netp` session，MIT，權重自動下載，已用真實下載的權重檔驗證——在有紋理漸層背景的合成測試圖上正確分離主體與背景，取代原本只能處理單一色背景的色鍵去背演算法）、**YuNet**（人臉偵測，Apache-2.0/MIT，權重自動下載，已驗證對合成測試圖成功偵測人臉，信心分數 84.2%）。這兩者跑在 ONNX Runtime／OpenCV DNN 後端，不是 PyTorch，是這個服務第一次同時承載兩套推論引擎。曾評估過的 **GFPGAN**（人像修復）與 **DDColor**（老照片上色）**決定不採用**——技術上驗證可行，但與「印前處理」核心定位不符（解決的是「照片好不好看」而非「印刷會不會出錯」），詳見下方 1.1 節後的評估紀錄。另外評估過的 **Florence-2**（浮水印自動定位）也決定不採用，理由與詳細真實驗證數據見下方另一段評估紀錄。⚠️ **DehazeFormer-T 後續於 2026-08-27（同一天）評估後移除**——不是技術問題（模型本身真實可用），而是去霧的真實需求與本站典型使用情境（證件照/名片/貼紙）重疊度太低，詳見下方獨立的評估紀錄段落；**目前**（本文件最後更新後）自建服務的真實模型清單是 VTracer、Real-ESRGAN、ARNIQA、Retinexformer、LaMa、rembg、YuNet 這 7 項，不含 DehazeFormer-T。

> ⚠️ **誠實性附註（2026-08-28）**：這一輪稽核修正三類問題。(1) **真實計算錯誤**：`cmyk-engine.ts` 的 GCR（灰版替代）公式有個可證明恆真的邏輯錯誤，導致自適應 GCR 分級程式碼從未真正執行過；`ink-limiter.ts` 因此把同一份灰階份量算兩次，總墨量 TAC 虛報（純黑誤算成 400% 而非正確的 100%）。已修正兩者並改用真實統一公式，測試已驗證。`anti-banding.ts` 的抖動雜訊公式少了關鍵的 `sin()` 與放大係數，用頻譜分析量測後發現高/低頻能量比僅 0.47（應遠大於 1），等於這個「消除色階斷層」的濾鏡自己在製造新的規律條紋——已改用 void-and-cluster 演算法產生真正的藍雜訊，量測後比值提升至 ~80。(2) **即時使用者可見的誤導文字**：`scene-classifier.ts` 每個分類分支的訊息原本宣稱「已自動套用專屬處理流程（X）」，但實際上只有 anime/portrait/landscape 三類的超解析度部分真的有對應執行，其餘完全沒有任何呼叫方會自動執行——已將措辭改為「建議搭配」，不再宣稱已執行未執行的動作。(3) **§1.3「絕不能移除的黃金核心護城河」清單本身也是本輪稽核發現的假象**：清單裡列出的 `sticker-kisscut-builder.ts`／`acrylic-charm-builder.ts`／`tshirt-color-knockout.ts`／`canvas-wrap-mirror.ts`／`real-paper-simulator.ts`／`qr-preflight-enhancer.ts`，逐一核對後發現全部**從未被任何 UI 或後端路徑呼叫過**（純死碼），且文檔宣稱的技術（如 StickerKisscutBuilder 的「向量 kiss-cut 輪廓線」）實際上只是一個固定矩形，根本不會貼合裁切輪廓——「護城河」的框架本身建立在不存在的使用者可觸及功能上。連同同一批查出的另外 13 個模組（`chromatic-aberration-corrector.ts`、`flatfield-vignette-corrector.ts`、`fluorescent-neon-extractor.ts`、`food-menu-mouthwatering.ts`、`giclee-fineart-dmax.ts`、`hairline-thickener.ts`、`luxury-embossing-bevel.ts`、`neon-halation-compressor.ts`、`packaging-3d-mockup-renderer.ts`、`packaging-box-dieline.ts`、`photocard-holo-glitter.ts`、`rollup-banner-scaler.ts`、`wedding-skin-pore-preserver.ts`），共 19 個檔案——全部帶有虛構的「(MIT)」／「(MIT, 0 KB)」授權標籤（100% 本專案自己寫的程式碼，並未引用任何第三方授權碼）、文檔宣稱的具名演算法（Sobel 邊緣偵測、Voronoi 碎裂、11-Zone Tonal System、EDT 距離變換、分塊串流放大等）在程式碼裡完全不存在，且都是死碼——已全部移除，連同其專屬測試檔（測試本身也只驗證輸出尺寸，從未驗證過文檔宣稱的行為）。另外 1 個活著但帶假授權標籤的檔案（`exif-metadata-sniffer.ts`，透過 `scene-classifier.ts` 被 `main.ts` 呼叫，本次稽核方法論一開始漏抓了這種 core 目錄內部互相引用的情況，修正後才發現它其實是活的）與 2 個「部分真實」的檔案（`perspective-rectifier.ts` 的角點偵測是假的但透視矩陣運算是真的；`kurbo-geometry.ts` 的多邊形偏移運算是真的但 Bézier 曲線宣稱是假的）已修正文檔措辭，保留程式碼。其餘經稽核確認文檔誠實、只是尚未被 UI 呼叫的模組（`color-region-selector.ts`、`contrast-stretch-filter.ts`、`curved-page-flattener.ts`、`edge-contour-detector.ts`、`edge-extend-inpaint.ts`、`gradient-centroid-cropper.ts`、`sharpen-deblur-filter.ts`、`smoothing-denoise-filter.ts`、`subscription-tier.ts`、`text-zone-detector.ts`）維持原樣，未被移除——它們沒有說謊，只是還沒被接上 UI。

---

## 1. 系統全景與技術架構 (System Architecture)

### 1.1 雲端微服務矩陣 (Railway Docker Multi-Container Architecture)
系統在雲端採用 2 大獨立容器，記憶體硬體上限（OOM 防線，非計費依據）鎖定在約 4.4 GB 內（2026-08-27 起，`zero-dce` 因新增 rembg 與 YuNet 而由 3072 MB 調升為 4096 MB）。⚠️ **費用估算已於 2026-08-26 修正、2026-08-27 更新**：Railway 是按實際用量按秒計費（RAM $10/GB-月、CPU $20/vCPU-月，來源 railway.com/pricing），不是按上面的硬上限計費。用 `zero-dce` 當時真實量到的 7 模型記憶體數據（閒置 837.2 MB、穩態 ~1.70 GB，⚠️ 含已於 2026-08-27 移除的 DehazeFormer-T，尚未針對移除後重新量測，實際數字應略低，見 `docker-compose.yml` 的過時提醒）重算，每月主機總開銷實際落在**約 $10-20 美元（約 NT$ 320-650，upper bound）**，其中 `printmagic`／`vtracer` 兩個容器這次沒有實測、只用硬上限粗估為次要項目，`zero-dce` 才是主要開銷。用戶量大時 CPU 費用增加得很少（按實測延遲估算，月處理 5 萬次請求也只多 +$1.5 左右）——真正的瓶頸是 `server.py` 目前用單執行緒 HTTP server，並發請求會互相卡隊，不是帳單會爆增；細節見 `docker-compose.yml` 內附的完整測量與推算過程：

| 服務容器名稱 | 執行語言 / 運行環境 | 端口 (Port) | RAM 硬上限 | 核心職責與承載模組 |
| :--- | :--- | :---: | :---: | :--- |
| **`printmagic`** | Node.js 22 (Alpine) + Vite SSR | `3000` | **256 MB** | 主應用入口、UI 渲染、合版拼版算力、印前 PDF 出機檔壓製（非通過驗證的 PDF/X-1a，見第 5 節）。 |
| **`vtracer`** | Rust 1.78 (Distroless) | `8080` | **128 MB** | 真實 VTracer 向量化引擎（點陣轉 SVG）。「Kurbo 2mm 刀模幾何運算」實際跑在主應用內的 `src/core/kurbo-geometry.ts`（純 TypeScript），不在這個容器裡；「OxiPNG 無損壓縮」查無實作，本服務不做 PNG 壓縮，已移除該說法。 |
| **`zero-dce`** | Python 3.12 + PyTorch 2.3+ (CPU) + ONNX Runtime | `8082` | **4096 MB** | 承載 6 個模型：**Real-ESRGAN**（4x 放大，真實 BSD-3-Clause 訓練權重）、**ARNIQA**（品質評分，真實 Apache-2.0 訓練權重）、**Retinexformer**（低光提亮，真實 MIT 訓練權重，已用真實下載的 `LOL_v2_real.pth` 驗證推論成功，取代原本從未訓練過的 Zero-DCE++；權重因無自動下載網址已直接提交進 git，見 `docker/zero-dce/weights/README.md`）、**LaMa**（物件／浮水印移除，真實 Apache-2.0 TorchScript 權重，建置時自動下載，已驗證推論成功）、**rembg u2netp**（去背，2026-08-27 新增，真實 MIT 訓練權重，建置時自動下載，已驗證推論成功）、**YuNet**（人臉偵測，2026-08-27 新增，真實 Apache-2.0/MIT ONNX 權重，建置時自動下載，已驗證推論成功）。⚠️ **DehazeFormer-T**（去霧）曾於 2026-08-26 以同等規格真實整合驗證通過，但 2026-08-27 評估後移除，見 §1.1 評估紀錄——去霧功能（含本機備援演算法）已於同日完全移除，本站不再提供去霧功能。RAM 上限數字尚未針對這次移除重新量測，見 `docker-compose.yml` 內附的過時提醒。 |

⚠️ **`tesseract`（OCR）容器已於 2026-08-26 移除**：查證後發現從未被任何 UI 功能實際呼叫（純死碼），且它原本想解決的問題——讀取 AI 繪圖產生的亂碼假文字——OCR 本來就解不了，那些筆畫通常不是任何文字系統的真實字元。

#### 評估紀錄：Florence-2（浮水印自動定位）——已真實驗證，但決定不採用

背景：使用者反映本站的主要情境之一，是讓用戶把 Gemini 等 AI 生圖工具產生的圖片（右下角常帶有浮水印）直接拿去印刷；現有的 `/inpaint`（LaMa）物件移除功能需要使用者**自己手動畫遮罩**才能去除浮水印，並非真正的一鍵/無腦操作。為了評估「自動定位浮水印位置 → 自動餵給 LaMa 修補」這條路，2026-08-27 對 `microsoft/Florence-2-base` 做了與 Retinexformer/DehazeFormer-T/LaMa 同等規格的真實驗證：

- **授權**：直接從 HuggingFace 模型卡中繼資料確認 `license: mit`，README 無任何額外限制條款，權重確實可直接下載（非空殼倉庫，每月 276 萬+ 下載）——商用授權乾淨。
- **真實推論驗證**：在獨立 venv 中下載真實權重（930MB, F16 safetensors），用 `<CAPTION_TO_PHRASE_GROUNDING>` 任務對一張自建的合成測試圖（已知位置的假浮水印色塊）下 prompt "watermark"，回傳的最佳框與真實浮水印位置的 **IoU 達 0.946**（滿分 1.0），定位精準度非常高。把該框轉成遮罩餵給 LaMa 後，浮水印區域平均亮度從 203.0（偏白，即浮水印疊加色）降到 130.9（接近原始背景漸層色調），確認 LaMa 真的把該區域修補掉了，不是誤判成功。
- **真實踩坑**：Florence-2 的官方遠端程式碼（`trust_remote_code=True`）會無條件 `import flash_attn`（一個純 CUDA 套件），即使走 CPU 的 `sdpa` attention 路徑也一樣會在載入階段直接噴錯，這是社群已知的上游問題（見 [huggingface.co/microsoft/Florence-2-base/discussions/4](https://huggingface.co/microsoft/Florence-2-base/discussions/4)），必須用社群提供的 monkeypatch（攔截 `transformers.dynamic_module_utils.get_imports`，把 `flash_attn` 從 Florence-2 modeling 檔案的 import 清單移除）才能在 CPU 環境正常載入，不是官方原生支援的乾淨路徑。
- **真實記憶體量測**：Florence-2-base 單獨載入後 RSS 達 1198.6 MB，執行一次定位推論峰值 1659.2 MB；接著載入 LaMa 後（Florence-2 未完全釋放，Python 記憶體配置器行為所致）總 RSS 來到 2006.8 MB——這還只是 Florence-2+LaMa 兩者，沒有算進現有 5 模型服務本身已經量到的 1843.2MB 峰值。若真的整合進 `zero-dce` 容器，RAM 上限很可能得從現有 3072M 再往上調到 4096M 以上，以現行 Railway 真實費率（$10/GB-月）估算，等於每月再多 **$10-14 美元**左右。

**不採用的理由（技術可行，但不划算）**：
1. **目標客群的付費意願低**：會用「免費 AI 生圖工具 + 印刷網站」這個組合的用戶，本質上傾向找免費方案，轉換成付費用戶的機率偏低——花額外預算養一個 930MB 重量級模型，服務的卻是最不容易帶來營收的族群。
2. **有更便宜的替代方案**：如果真正的需求只是「去掉 Gemini 固定位置的那個角標」，Gemini 浮水印的位置是固定、可預期的，用一個寫死的「右下角某比例區塊」當遮罩直接餵給已經整合好的 LaMa，幾乎零額外成本、零額外模型重量，比訓練/整合一個通用浮水印定位模型划算得多。
3. **記憶體成本推高月費**：如上述估算，整合後容器 RAM 上限很可能要再加 1GB+，每月多 $10-14 美元的固定成本，對應到前項偏低轉換率的客群，投資報酬率不佳。
4. **去除「看得到」的浮水印不等於去除 AI 來源標記**：如果 Gemini 之後全面改用 SynthID 這類嵌在像素統計裡的隱形浮水印，消掉右下角那個看得見的圖示並不會讓圖片真的「看起來不是 AI 生成」，功能的實際效果可能不如預期；在 AI 內容標示法規（如歐盟 AI 法案）日趨嚴格的環境下，把「幫用戶抹除 AI 來源標記」當賣點來行銷，定位上也需要謹慎。

**未來可能重新評估的情境**：若之後推出**單機版**（使用者在自己電腦上執行，非 Railway 這種 CPU-only、記憶體受限的雲端容器），上述「記憶體成本推高月費」的顧慮就不成立（本機硬體資源通常遠優於雲端最低規格容器），屆時可以重新評估是否納入 Florence-2 這類自動定位功能。

#### 評估紀錄：GFPGAN（人像修復）與 DDColor（老照片上色）——技術可行，但決定不採用

2026-08-27 一併評估的另外兩個候選，兩者都是技術上真實可行、授權乾淨（GFPGAN Apache-2.0、DDColor Apache-2.0）、社群成熟（GFPGAN 3.7 萬 star，是這整輪所有候選中最多人用的一個）的模型。最終決定不採用，不是技術問題，是產品定位問題：

1. **服務錯誤的痛點**：GFPGAN 解決的是「這張照片好不好看」，DDColor 解決的是「這張老照片有沒有顏色」——這兩個都是通用修圖需求，跟本站「新手無腦一鍵出機」的印前定位（圖片印出來會不會出錯、解析度夠不夠、有沒有出血、色彩對不對）是兩件不同的事。使用者選擇印刷網站而非修圖軟體，通常是因為怕印壞、怕被退件，不是因為想修臉或上色——這兩者手機裡免費的濾鏡 App 就能做，而且往往更快。
2. **定位稀釋風險**：現有 5-7 個自建模型（Real-ESRGAN、ARNIQA、Retinexformer、DehazeFormer-T、LaMa、rembg、YuNet）已經涵蓋放大、品質評分、低光、去霧、去背、物件移除、人臉偵測；再加上「修臉」「上色」這兩個泛用修圖功能，會讓產品一句話說不清楚是什麼——是印前工作站，還是修圖軟體外加印刷輸出。
3. **不是印刷特化能力**：對照 rembg（解決貼紙邊緣去背這種印刷特定需求）與 YuNet（解決證件照合規裁切這種印刷特定需求），GFPGAN／DDColor 並不服務任何「這是印刷網站才特別需要」的場景，屬於任何通用修圖工具都能做、也通常做得一樣好的功能。

兩者都沒有進行真實推論驗證（技術上已知可行，第一輪選型評估時已查證授權與模型資料，見選型清單 artifact），純粹是產品範疇決策，未來若產品定位改變可重新評估。

#### 評估紀錄：DehazeFormer-T（去霧）——已真實整合並驗證，2026-08-27 評估後移除

跟上面兩節不同，這個不是「從沒整合過、評估後決定不做」，而是「已經真的整合進 `zero-dce` 容器、真實推論驗證通過，上線一天後重新評估決定移除」，記錄在這裡是為了誠實反映決策，不是隱藏掉一段已發生過的整合。

**真實整合曾經做到什麼程度**：2026-08-26 加入，真實架構程式碼（`dehazeformer_model/dehazeformer.py`，從官方倉庫原樣取得，非憑記憶重寫），真實訓練權重（`dehazeformer-t.pth`，作者只透過 Google Drive 發布、無法自動下載，已手動下載並提交進 git）。已用真實下載的權重檔驗證：`strict=True` 完整載入 258 個張量、零缺漏零多餘，真實推論在模擬霧霾測試圖上讓對比度從 0.0245 提升到 0.0763——技術上完全能跑，不是假貨。

**移除理由（跟 GFPGAN/DDColor 同一套判準，事後才想清楚）**：
1. **戶外遠景霧霾是很窄的情境**：本站典型使用情境是證件照、名片、貼紙、社群圖——這些幾乎不會碰到「大氣霧霾造成對比度下降」這個問題，只有「風景明信片/海報」這個子類別用得到，遠比「照片曝光不足」（Retinexformer 服務的情境）常見度低。
2. **不是印刷特化能力**：去霧在螢幕修圖跟印刷輸出上的處理邏輯完全一樣，沒有像 TAC 控墨／出血／ICC 色彩管理那種「只有印刷才需要」的理由，跟任何通用修圖 App 的去霧濾鏡效果相同——判準與上方 GFPGAN/DDColor 的「不是印刷特化能力」完全一致。
3. **本來就有本機備援，AI 版只是品質升級，不是從無到有**：`ContrastDehazeFilter`（`src/core/contrast-dehaze-filter.ts`，經典 Dark Channel Prior 大氣散射反演公式）在 DehazeFormer-T 加入前就已存在且真實可用；DehazeFormer-T 帶來的是「做得更好」，不是「解決了原本完全做不到的問題」，急迫性因此偏低。

**第一階段移除範圍（AI 模型層）**：`docker/zero-dce/server.py` 的模型載入與 `/dehaze` 端點、`docker/zero-dce/Dockerfile` 的架構檔案 vendoring 步驟、`requirements.txt` 的 `timm` 依賴、已提交的 `dehazeformer-t.pth` 權重檔、`server/services/ai-engine-service.ts` 的 `processDehaze()`、`server/routes/api.ts` 的 `/ai/dehaze` 路由、前端的 `FreeDehazeClient`（`src/services/free-dehaze-client.ts`）。這一階段刻意保留了本機備援演算法 `ContrastDehazeFilter`，`main.ts` 的去霧管線步驟改成直接呼叫它，去霧功能本身沒有消失，只是少了「AI 模型優先嘗試」這一層。

**第二階段移除（同日，範圍擴大到整個功能）**：使用者進一步確認「印前處理不需要去霧功能」，判準是這個功能從一開始就不該存在——不是「AI 版不划算，退回本機版」，而是連本機版存在的理由都站不住腳（跟上面第 2 點「不是印刷特化能力」的判準完全一致，只是徹底貫徹到底）。因此把整條去霧管線全部拔除：`ContrastDehazeFilter`（`src/core/contrast-dehaze-filter.ts`）與其專屬測試（`tests/pro-prepress-suite.test.ts`）整個刪除、`main.ts` 的去霧管線步驟（Step 1.9）整段移除、`PipelineOptions` 型別與預設值（`src/types/index.ts`、`src/ui/state.ts`）拿掉 `enableDehaze` 欄位、「專家管線自訂」彈窗（`src/ui/pipeline-matrix-modal.ts`）拿掉去霧開關項目。**去霧現在在本站完全不存在**，前端、後端、本機演算法三層都沒有殘留，不是「換一種方式繼續提供」。

**未來可能重新評估的情境**：跟 Florence-2 一樣，若之後真的鎖定「風景/旅遊攝影印刷」這個垂直市場（例如專做風景明信片/海報的子產品線），去霧的真實需求密度會高很多，屆時值得重新評估、重新設計（不只是把這次刪掉的程式碼加回去，因為架構本身也已經不存在了）。

### 1.2 零外部付費 API 規則 (Strict 100% Zero-Commercial-API Policy)
- ❌ 徹底剔除 Google Cloud Vision、Remove.bg、PhotoRoom、Midjourney 等任何需第三方 Token/按次計費之商業 API。
- ✅ 100% 採用 **MIT / Apache 2.0 / BSD** 開源協議之演算法與模型，杜絕任何隱形成本與超額扣款風險。

### 1.3 🛡️ 核心資產清單（Core Modules — 已附帶真實使用狀態）
以下模組是真正**解決印刷翻車痛點**的核心資產，任何架構精簡或重構前應先確認這裡的即時使用狀態，而不是照抄本清單的舊有標籤。

> ⚠️ **2026-08-28 更正**：這個清單原本標題是「絕不能移除的黃金核心護城河」，並宣稱以下每一項都「支撐產品付費轉換與商業護城河」。逐一核對呼叫路徑後發現：`sticker-kisscut-builder.ts`、`acrylic-charm-builder.ts`、`tshirt-color-knockout.ts`、`canvas-wrap-mirror.ts`、`real-paper-simulator.ts`、`qr-preflight-enhancer.ts` 這 6 項從未被任何 UI 或後端路徑呼叫過——使用者根本無法觸發它們，談不上「護城河」。且其中多項文檔宣稱的技術本身也不成立（例如 `sticker-kisscut-builder.ts` 宣稱生成「向量 kiss-cut 輪廓線」，實際上只是一個固定尺寸的矩形，不會貼合裁切物件的實際輪廓）。這 6 個檔案已於同日移除（詳見文件頂端 2026-08-28 附註），下方清單已同步移除這些項目，只保留真正被 `main.ts`／`server/` 呼叫的模組。

全部是決定性演算法（無 AI 模型），檔名為 `src/core/` 中的真實檔案：

#### 🎨 1. 動漫 / 文創周邊剛需（創作者變現主力）
- **`line-art-upscaler.ts` (二次元插畫放大)**：雙線性放大 + 邊緣壓黑，強化墨線輪廓（不是 Anime4K 官方實作，僅技法取向相近）。

#### 🖼️ 2. 相片與生活輸出剛需（大眾消費轉化主力）
- **`edge-aware-upscaler.ts` (金字塔超解析度)**：雙線性插值 + 邊緣強化演算法（非神經網路，不會生成原本不存在的細節）。
- **`passport-modal.ts`（UI）+ 相關比例計算 (2 吋護照大頭照頭頂自動校準)**：精確定位台灣與國際 2 吋大頭照 3.2~3.6cm 官方頭部比例。
- **`object-eraser.ts` (智慧消除筆)**：Fast Marching 快速前進法補景演算法，筆刷塗抹秒除路人、雜物、反光斑點與浮水印。2026-08-26 起，`free-inpainting-client.ts` 會優先嘗試自建 **LaMa** 微服務（真實訓練權重，見 1.1 節），這裡的本機演算法是離線時的備援。

#### 🖨️ 3. 工業級印前物理與色彩安全（印刷廠零退件保證）
- **`bleed-expander.ts` (3mm 智慧出血背景生長)**：鏡像外推 + 接縫混合，徹底杜絕裁切白邊與文字切除。
- **`cmyk-engine.ts` / `ink-limiter.ts` (控墨防死黑、軟打樣)**：物理減法混色預測 + 總墨量 TAC ≤ 300% 限制（2026-08-28 修正 GCR 與 TAC 計算錯誤，見文件頂端附註）。
- **`foil-simulator.ts` (亮金/玫瑰金/局部光 3D 擬真與獨立黑版分離)**：即時反光模擬並自動生成 100% K100 菲林鋅版遮罩。
- **`imposition-engine.ts` (A4/A3 智慧合版拼模)**：多模自動排滿大版，大幅節省實體合版印刷費。
- **`engines/pdf-exporter.ts` (印前 PDF 壓製)**：內嵌向量角線、十字規矩線、出血框，見第 5 節關於 PDF/X-1a 合規現況的誠實說明。

---

## 2. 印前演算法陣列 (Pre-Press Algorithm Matrix)

跑在 Docker 微服務裡、真正接上訓練權重推論的模型是 **VTracer**（向量化）、**Real-ESRGAN**（放大）、**ARNIQA**（品質評分）、**Retinexformer**（低光提亮，取代原本從未訓練過的 Zero-DCE++）、**LaMa**（物件／浮水印移除，權重自動下載）、**rembg**（去背，u2netp session，權重自動下載）、**YuNet**（人臉偵測，權重自動下載）（見 1.1 節）。**DehazeFormer-T**（去霧）曾以同等規格真實整合並驗證推論成功，但 2026-08-27 評估後連同本機備援演算法一併完全移除，詳見 1.1 節評估紀錄——本站現在沒有去霧功能。以下全部是 `src/core/` 或 `src/engines/` 裡實際存在的決定性演算法（無 AI 模型、無框架依賴、無授權條款可標——這些都是純 TypeScript 數學運算，不是打包發布的第三方模型），依功能分類：

### 2.1 放大與清晰化
- **`edge-aware-upscaler.ts`**：雙線性插值 + 局部梯度邊緣強化。用於相片、包裝設計放大。
- **`line-art-upscaler.ts`**：雙線性放大 + 邊緣壓黑，強化墨線輪廓。用於動漫插畫。
- **`engines/lanczos.ts`**：多階漸進式 Lanczos-3 sinc 濾波重取樣（線性光空間運算，防止高反差邊緣產生黑暈）。
- **`sharpen-deblur-filter.ts`**：固定 5×5 反卷積核銳化，緩解輕微手震模糊。
- **`unsharp-mask.ts`**：USM 邊緣銳化，補償紙張吸墨網點擴大 (Dot Gain)。
- **`contrast-stretch-filter.ts`**：全域冪次曲線對比拉伸。

### 2.2 出血外推與修補
- **`bleed-expander.ts`**：鏡像外推 + 接縫余弦混合 + 四角交叉修補 + 接縫色溫微調，生成 3mm 印刷出血。
- **`edge-extend-inpaint.ts`**：鏡像外推填色，生成畫布邊緣延伸。
- **`object-eraser.ts`**：Fast Marching 快速前進法補景，塗抹消除路人/雜物/浮水印。

### 2.3 去背與區域選取
- **`ai-matting.ts`**：角落取樣背景色 + 顏色距離去背（色鍵去背，非神經網路）。2026-08-27 起，`free-matting-client.ts` 會優先嘗試自建 **rembg**（u2netp）微服務（真實訓練權重，見 1.1 節），這裡的本機演算法是離線時的備援，且僅適合背景為單一色塊的圖片。
- **`edge-choke-matting.ts`**：四角取樣顏色距離去背 + 邊緣縮邊，防止白邊溢出。
- **`color-region-selector.ts`**：顏色距離 flood-fill 區域選取，用於專色/燙金分版標記。

### 2.4 去噪、去模糊、去雜訊
- **`smoothing-denoise-filter.ts`**：經典雙邊濾波（空間核 × 色彩範圍核）。

⚠️ **`descreen-engine.ts` 與 `fabric-moire-neutralizer.ts` 已於 2026-08-28 移除**——查證後發現這兩個檔案是本文件早期誠實性稽核（見文件頂端 2026-08-26 附註）沒抓到的漏網之魚：它們的註解宣稱做「頻域陷波抑制」「辨識重複半色調網花」「沿織紋方向的非等向高斯平滑，同時衰減橫紋諧波」，但實際程式碼只是一個固定 3x3 鄰域平均閾值混合（`descreen-engine.ts`）或普通等向高斯模糊（`fabric-moire-neutralizer.ts`）——沒有任何頻域分析、沒有方向性偵測，註解描述的技術完全沒有實作。兩者也從未被任何 UI 功能呼叫過（純死碼），對應的測試也只驗證輸出尺寸不變，沒有驗證「摩爾紋真的被去除」這個核心宣稱。已整個移除，改用 §2.4.1 的 `moire-descreen.ts`（真實 FFT 頻域陷波濾波，port 自 `6o6o/fft-descreen`，MIT，已用真實週期圖案測試驗證高頻能量確實下降）。

#### 2.4.1 真實 FFT 去網紋摩爾紋濾波（2026-08-28 新增）

- **`src/core/moire-descreen.ts`**：真正的頻域陷波濾波，port 自 `6o6o/fft-descreen`（Bogdan Boyko，2019，MIT，已直接核對原始 `LICENSE` 檔案，標準未修改文字，無額外限制）。這不是機器學習模型，是純訊號處理：對每個色版做 2D FFT，用「離中心距離加權」的自訂正規化找出頻譜上的規律尖峰（半色調網點、螢幕次像素排列等週期性圖案），保護中心低頻區域（真正的圖像內容）完全不受影響，把偵測到的尖峰遮罩做膨脹＋高斯模糊軟化邊緣後，反轉套用到頻譜上再做逆 FFT。
- **本次研究的關鍵發現**：學術上的「去摩爾紋」神經網路模型（如 ESDNet）訓練資料全部是「拍螢幕」產生的干涉紋，跟「翻拍印刷品網點」是完全不同的成因，市面上找不到任何開源模型真正解決印刷網點去網紋問題——這正是選擇這個古典演算法而非神經網路模型的原因（見 §1.1 附近的模型評估研究脈絡）。
- **與原始 Python/OpenCV 版本的真實差異**：OpenCV 的 `cv2.dft`/`idft` 支援任意尺寸 2D FFT；這個 TypeScript port 只實作了 radix-2 Cooley-Tukey FFT，需要 2 的冪次尺寸，因此來源圖片會先用鏡射邊界擴展（reflect padding）到下一個 2 的冪次尺寸再運算，運算完再裁切回原尺寸——這會改變演算法實際運算的確切頻率區間（例如 1200×1600 的圖會在 2048×2048 尺寸下運算），跟原始版本在原生尺寸下運算不完全等價，但核心的尖峰偵測／遮罩邏輯是忠實移植（同一套 `normalize()`/`ellipse()`/門檻/膨脹/模糊管線，同樣的預設參數）。
- **已驗證**：7 個真實單元測試涵蓋 FFT 正確性（自行以已知頻率訊號驗證尖峰位置正確）、非 2 的冪次尺寸的 padding 路徑、輸出尺寸維持、alpha 完全不受影響；最關鍵的一項——對真實合成的高頻棋盤格週期圖案（模擬網點）套用濾波，量化驗證高頻能量確實大幅下降（>50%），而對平滑漸層圖片幾乎沒有副作用。另外用真實瀏覽器端對端測試（透過 Web Worker，避免卡住主執行緒 UI）確認：真實上傳一張帶有棋盤格週期圖案的圖片，套用後取樣像素資料，高頻能量從有意義的數值降到接近 0，相鄰像素從劇烈跳動變成平滑——不是空跑一趟而已。
- **效能與限制（誠實揭露）**：純 JS FFT 沒有 WASM/GPU 加速，1200×1200～2000×2000 範圍的圖片（都會被 padding 到同一個 2048×2048 運算尺寸）在瀏覽器 Worker 中實測約需 7-20 秒；超過這個範圍會被 padding 到 4096×4096，耗時粗估再乘 4 倍以上，因此設有 `MAX_DESCREEN_INPUT_PIXELS`（2000×2000）上限，超過會清楚回報錯誤而不是卡住或裝忙。這是**手動觸發的工具**（工具列的「🌀 去網紋」按鈕，「✨ 智慧增強」區），不是自動管線步驟——因為只對真的有網紋/摩爾紋的圖片有幫助，套用在一般照片上可能誤刪細節。

#### 2.4.2 摩爾紋風險預測 + JPEG 去區塊（2026-08-28 新增，已接上 UI）

這兩個是先前研究找到「有真實開源公式可查證、值得實作」的成果，已經寫成真實、有測試驗證的 `src/core/` 模組，並已接上介面：「✨ 智慧增強」浮動工具列新增「🧩 去區塊」按鈕（`btnJpegDeblock`，透過 `src/workers/worker-client.ts`/`image.worker.ts` 的 `deblock` operation，寫法與既有的「🌀 去網紋」按鈕完全一致，同樣支援無 Worker 環境的本機主執行緒 fallback）；摩爾紋風險預測則掛在 Step 4 印前健檢分析（`runOptimizationPipeline`），偵測到中高風險時會把結果推進既有的 `scoreResult.issues`/`recommendations`（同一套顯示元件 `DiagnosticCard`，不需要新 UI 元件），並用局部 try/catch 包起來——這是加分檢查，不應該讓整個印前健檢因為它失敗而中斷。

- **`src/core/moire-risk-predictor.ts`（摩爾紋風險預測）**：真實數學來自 Amidror, Hersch & Ostromoukhov, *"Spectral Analysis and Minimization of Moiré Patterns in Color Separation,"* Journal of Electronic Imaging 3(3), 1994（開放取用全文：`perso.liris.cnrs.fr/victor.ostromoukhov/publications/pdf/JEI94_Moire.pdf`）——兩個週期圖案（週期 T1/T2、夾角 α）疊加後的摩爾紋週期公式 `T = T1·T2 / sqrt(T1² + T2² − 2·T1·T2·cos(α))`，直接引用論文的 Eq. 6.1，已用單元測試驗證邊界情況（完全重合兩個週期圖案應得到無限大週期、夾角 90° 時應等於 `T/√2`、對調兩個圖案應該對稱）。作品本身的主週期偵測則重用 `moire-descreen.ts` 已驗證過的 FFT 基礎設施。真實印刷圖片通常遠大於能即時跑 FFT 的尺寸，因此改用「整數倍率箱型濾波降採樣到固定小工作解析度 → 偵測週期 → 換算回原圖像素單位」而非直接對大圖拒絕處理——開發過程中曾踩過一個真實的別名陷阱：非整數比例的降採樣分組不均勻，會產生自己的取樣假頻，跟真實訊號混在一起（已用 1600×1600 大圖合成測試抓到並改成整數倍率解決）。加上 Hann 窗函數（週期型慣例，已數值驗證平坦影像的洩漏降到浮點雜訊等級）與「徑向衰減」判斷式（門檻值經過真實案例的數量級量測校準：真正週期圖案量到 3600~1470 萬倍衰減比，漸層洩漏只有 5.6 倍，門檻設在有安全邊際的 50 倍），區分「真正的週期圖案窄頻峰」跟「一般漸層/光照造成的寬頻低頻能量」——後者不該被誤判成摩爾紋風險。風險分級門檻（2mm/15mm）是工程判斷，不是論文本身提供的視覺閾值，文件內已誠實標註。
- **`src/core/jpeg-deblocking-filter.ts`（JPEG 去區塊）**：教科書參考解法是 A. Nosratinia 的位移＋真實 JPEG 重新編碼＋平均法（"Denoising of JPEG images by re-application of JPEG," 2001），但那個方法需要瀏覽器原生 `canvas.toDataURL('image/jpeg')` 做真正的編碼往返，這個專案的 vitest 測試環境沒有 DOM/canvas，完全無法寫自動化單元測試驗證。改為直接在解碼後的像素上運作：偵測 JPEG 固定的 8×8 網格邊界，比對邊界處的跳動量跟區塊內部的局部梯度活動量，只有「邊界有明顯跳動、但區塊內部平坦」這個量化壓縮的特徵訊號出現時才做局部平滑，真實邊緣（區塊內外都有連續變化）不會被誤觸碰。已用合成的 8×8 網格假影圖片驗證：邊界跳動量確實大幅下降、區塊內部像素完全不受影響、平滑連續漸層完全不觸碰。誠實聲明：這不是 Nosratinia 論文精確係數的重現，是同一類「鎖定網格邊界做選擇性濾波」技術的自製、可驗證版本。

### 2.5 光照與色調
- **`zero-dce-enhancer.ts`**：Zero-DCE 論文曲線公式的本機簡化版（單一全域參數，非學習式逐像素參數圖）。Docker `zero-dce` 服務的低光提亮功能已於 2026-08-26 改跑 Retinexformer（真實訓練權重，MIT），此檔案現在是它離線時的本機備援，不再對應同一篇論文的架構。
- **`hand-shadow-balancer.ts`**：24×24 網格光照插值，均化手機翻拍陰影。
- **`shadow-lift.ts`**：暗部階調提亮，防止實體印刷死黑糊成一片。

### 2.6 幾何校正與版面
- **`curved-page-flattener.ts`**：固定拋物線位移公式，粗略校正翻拍書頁曲面（非學習式 3D 網格估算）。
- **`perspective-rectifier.ts`**：3x3 單應性矩陣運算與雙線性反向取樣是真實實作；`autoDetectCorners()` 不做真正的角點偵測，永遠回傳固定 5% 邊距內縮（2026-08-28 修正文檔誇大宣稱，程式碼本身未變）。
- **`kurbo-geometry.ts`**：2D 多邊形內縮/外擴幾何運算（純 TypeScript，非 Rust）。2026-08-28 移除文檔裡不成立的「Bézier 曲線平滑化」宣稱，該功能程式碼裡不存在。
- **`imposition-engine.ts` / `imposition-calculator.ts`**：A4/A3 智慧合版拼模計算。

### 2.7 印刷色彩與物理防護
- **`cmyk-engine.ts`**：RGB→CMYK 減法混色預測，Bradford 色適應轉換 + GCR 灰版替代（2026-08-28 修正一個可證明恆真的 GCR 邏輯錯誤，自適應分級過去從未真正執行過，詳見文件頂端附註）。
- **`ink-limiter.ts`**：總墨量 (TAC) ≤ 300% 限制與壓制（2026-08-28 修正雙重計算灰階份量導致的 TAC 虛報錯誤）。
- **`icc-profiles.ts`**：ICC 描述檔參數參考（公開已知標準的名稱/TAC 上限；本模組自己沒有真正的 `.icc` 描述檔案，不做真正的色彩轉換——詳見 README 誠實說明）。2026-08-27 起，這不再是本專案唯一的 ICC 相關能力：使用者可自行上傳自己的 CMYK `.icc`/`.icm` 描述檔，透過自建服務（`docker/zero-dce/` 的 `/icc/soft-proof`，Pillow 的 `ImageCms`／LittleCMS）取得真正的描述檔色彩轉換與逐像素 TAC，見 §2.7.1。
- **`pantone-matcher.ts`**：真實 CIE Lab 轉換 + CIEDE2000 色差公式，比對一份精選的 Pantone 色票近似表（非官方授權完整資料庫）。

#### 2.7.1 真實 ICC 色彩管理（自建服務，2026-08-27 新增）
- **`src/services/free-icc-client.ts`** + **自建服務 `docker/zero-dce/` 的 `POST /icc/soft-proof`**：真正的 ICC 描述檔色彩轉換，透過 Pillow 的 `ImageCms` 模組（已內建 LittleCMS 2.16，`requirements.txt` 無需新增套件）。
- **需要使用者自行上傳 CMYK 描述檔**（`.icc`/`.icm`，自己印刷廠提供的那份）——本專案刻意不內建/散布任何具名描述檔（FOGRA39／Japan Color 2001／GRACoL 等）。查證發現：即使是 ICC 官方自己的描述檔登錄庫，其收錄的 FOGRA 描述檔條款仍寫明「未經書面同意不得散布、出售或更改」；freieFarbe.de 本身並未代管描述檔案（只連結至別處）；basICColor 聲稱的「免費授權」因 colormanagement.org 回應 403 兩次而無法查證，故未採信。這是與 `icc-profiles.ts`（僅供 TAC 門檻參考）架構上不同、完全獨立的能力。
- **已驗證**（真實 CMYK 描述檔，透過已安裝於本機 Windows 的一份描述檔暫時測試，未複製進本專案）：`ImageCms.buildProofTransform()` 產生的軟打樣色彩位移可測量（測試漸層平均 RGB 差異 19.83），`ImageCms.buildTransform()` 轉出的真實 CMYK 值算出的逐像素總墨量合理（最高 212.2%、平均 135.6%）；並以真實 HTTP 請求對實際的 `server.py`（未修改、原始檔案）驗證：成功路徑、缺少描述檔的 400、上傳非 CMYK 描述檔的 400 拒絕，皆如預期運作。
- 使用者未上傳描述檔、或此服務離線時，軟打樣功能會退回既有的 `CmykEngine.simulatePrintProof()` 近似模擬——兩者不等價，UI 會誠實標示目前用的是哪一種。

#### 2.7.2 色盲/色覺辨識障礙模擬（2026-08-28 新增，已接上 UI）

已接上「🌈 色盲預覽」按鈕（`btnToggleCvdPreview`，與「🖨️ 軟打樣」同一排工具切換鈕），點擊依序循環：關閉 → 紅色盲(protanopia) → 綠色盲(deuteranopia) → 藍黃色盲(tritanopia) → 關閉，非破壞性預覽（跟軟打樣一樣，不會真的修改要送印的圖片）。已透過真實瀏覽器互動驗證：切換後同一個像素的實際 RGB 值確實改變（例如純紅 (255,0,0) 在紅色盲模擬下變成 (255,0,15)），不是空按鈕。

- **`src/core/color-blindness-simulator.ts`**：真實實作 Machado, Oliveira & Fernandes 2009 模型（*"A Physiologically-based Model for Simulation of Color Vision Deficiency,"* IEEE TVCG 15(6)）——全色盲（100% 嚴重度）色差矩陣取自作者官方補充資料頁，並跨查兩個獨立來源（DaltonLens-Python 的 `machado_2009_matrices` 表格，MIT 授權；Chrome DevTools 官方色覺模擬功能）確認係數吻合。用途：印前預檢「這個設計如果只靠顏色分辨（例如紅綠圖表），色盲使用者看得出來嗎？」。已驗證並修正一個容易誤踩的坑：矩陣必須套用在線性 RGB，不是 gamma 編碼的 sRGB（R 語言 `colorspace` 套件的 v2.1-0 更新記錄明確記載了這個曾經犯過的錯誤）。部分嚴重度（非 100%）採用線性內插近似，非論文原始資料，文件內已誠實標註。已用單元測試驗證：白/黑在色盲模擬下仍接近白/黑（在無彩色軸上）；一組真實紅綠混淆色對，在紅綠色盲（deuteranopia/protanopia）模擬下的色差距離顯著小於原始色差，且明顯小於藍黃色盲（tritanopia，物理上不該影響紅綠判斷）下的色差——這是矩陣本身是否符合生理學意義的真實驗證，不只是檢查輸出尺寸。

### 2.8 文字、條碼與防呆
- **`text-inspector.ts`**：文字區域偵測（對比/邊緣啟發式，非 OCR）+ 錯字檢查。錯字檢查完全是本機的，透過 `free-spellcheck-client.ts` 的 ~18 條正規表示式規則比對——儘管兩個檔案的舊版註解都聲稱有打 LanguageTool 免費 API，實際上整條路徑裡沒有任何一次網路請求，純粹是本機規則比對，已於 2026-08-25 修正說明文字。
- **`text-zone-detector.ts`**：深色像素密度網格掃描，標示可能的文字區域（不做文字辨識）。
- **`k100-barcode-generator.ts`**：⚠️ 目前產生的 QR/條碼圖案**不是真正可掃描的編碼**（QR 沒有糾錯碼與遮罩、Code128 缺少檢查碼）。未被前端 UI 呼叫，但透過 `server/services/prepress-toolkit.ts` 接了真實的 `/api/prepress/k100-barcode` 後端端點（動態 import，非死碼）——列在此處是為了誠實揭露「產生的編碼不可掃描」這件事，不是推薦使用。
- **`barcode-verifier.ts`**：真實的對比度/尺寸預檢啟發式（不是解碼器，無法確認條碼本身正確，只能檢查印刷可讀性風險）。2026-08-28 移除文檔裡「偵測 4 色富黑污染」的宣稱，程式碼裡從未實作過這項檢查。

### 2.9 場景分類與版面工具
- **`scene-classifier.ts`**：EXIF 特徵 + YCbCr 膚色模型 + Otsu 雙峰方差 + 飽和度/邊緣統計的決策樹分類器（純像素統計，非訓練分類模型）。
- **`gradient-centroid-cropper.ts`**：梯度能量加權 + 中心偏向的焦點裁切估算（非物件偵測模型）。
- **`dpi-calculator.ts`**：DPI 與放大倍率計算。
- **`print-score.ts`**：依實際分析數據（DPI、墨量、對比等）加權計算的印前健檢分數（本機自我評分，非第三方驗證）。
- **`svg-path-optimizer.ts`**：SVG 路徑精度裁剪與空白壓縮（非 SVGO 完整實作）。未被前端 UI 呼叫，但透過 `server/services/prepress-toolkit.ts` 接了真實的 `/api/prepress/optimize-svg` 後端端點（動態 import，非死碼）。
- **`exif-metadata-sniffer.ts`**：對檔案前 16KB 做 ASCII 關鍵字子字串比對，辨識拍攝軟體/AI 生圖工具簽名（子字串比對會有誤判風險，例如圖片內容剛好包含品牌名稱文字；2026-08-28 移除文檔裡不成立的「100%」宣稱與虛構的「(MIT, 0 KB)」授權標籤）。
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

1. **📄 標準印刷 PDF (300 DPI)**：3mm 物理出血、向量角線裁切標記、色條、來源圖片 SHA-256 內容雜湊。⚠️ **不是通過驗證的 PDF/X-1a / ISO 15930 檔案**——沒有 OutputIntent、沒有嵌入 ICC 描述檔，圖片內容仍是 RGB（未做 CMYK 分色）。印刷廠仍須自行執行標準 CMYK 轉換流程，見 `server/services/pdfx-service.ts` 內的誠實性註解。真正的 PDF/X-1a 合規（OutputIntent + 嵌入 ICC + CMYK 內容）是尚待完成的功能缺口，不是現況。⚠️ **另一個真實限制（2026-08-27 查證發現）**：`PdfExporter.export()` 目前是把整張來源圖直接拉伸（`pdf.addImage`）填滿目標版面尺寸，`cropAnchor` 參數雖然存在但完全沒被使用（`_cropAnchor` 加底線前綴）——也就是說 `CropController` 的九宮格焦點目前**只會改變預覽畫面的 CSS `object-position`，不會影響真正匯出的 PDF**，來源圖跟目標長寬比不同時，匯出結果其實是被拉伸變形，不是裁切。這是既有缺口，本次（2026-08-27）新增的「2 吋證件照」功能因為需要精準裁切，改用真正對 `ImageData` 做像素裁切（`IdPhotoCropper.applyCrop`）來繞開這個問題，但這只解決了證件照這一個預設，其餘預設（A4海報、名片、貼紙等）目前仍然是拉伸行為，尚未修復。
   同一天（2026-08-27）另外替 `IdPhotoCropper` 加了三項延伸能力，全部是純幾何/像素統計，沒有新增模型呼叫：(a) `levelFace()`——用 YuNet 早就回傳、但先前完全沒用到的雙眼特徵點座標，算出眼線傾角並自動旋轉校正頭部歪斜（<0.5° 略過不轉、>15° 視為偵測異常同樣略過不轉）；(b) `checkBackgroundCompliance()`——對裁切成品四角取樣做亮度/中性色/均勻度啟發式檢查，抓「背景明顯不是白色」這種明顯問題，非官方驗證；(c) `FaceSafetyChecker.checkFaceMargin()`（新檔案 `src/core/face-safety-checker.ts`）——檢查偵測到的臉框離裁切成品邊緣是否小於預設的安全邊界，同時掛在證件照流程與既有的「✨ AI 建議」smartcrop 流程上（`SmartCropClient.suggestCrop()` 現在也會回傳原始 `faces` 陣列供這個檢查使用，不需要重新呼叫一次偵測）。另外，證件照裁切完成後會用小象提示既有的「🧩 智慧拼模」功能（A4/A3 拼版引擎）可以直接拿來排版整批證件照——這個引擎本來就是動態讀取目前選中預設的 `widthMm`/`heightMm`，35×45mm 的證件照不需要任何新的排版邏輯就能正確運作（已驗證：A4 可排 28 張、A3 可排 56 張，見 `imposition-engine.test.ts`），純粹是把既有能力接上這個使用情境。
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

> 註：上方「自訂上傳印刷廠機台 ICC 描述檔」原列為 VIP 專屬構想，但 2026-08-27 已把底層技術能力實作出來（見 §2.7.1）並開放給所有使用者免費使用，未做任何付費分級限制——本節其餘的付費分級規劃本身仍未實裝，這一項只是恰好技術上已經做出來了，並非付費機制也跟著上線。

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
