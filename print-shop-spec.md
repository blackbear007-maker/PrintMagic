# ImageTool 印刷店輸出規格

這份文件描述 `ImageTool` 輸出檔案的規格，方便印刷店或 POD 平台預覽、接收與生產。

## 輸出檔案

- **格式**：PNG 或 JPG（無 TIFF/PDF/CMYK 轉檔，避免誤導）
- **色彩**：RGB（由印刷店自有流程轉換至 CMYK）
- **DPI**：依場景固定，通常 300 DPI
- **出血**：依場景設定，已保留裁切空間

## 場景尺寸

| 場景 | 成品尺寸 | 出血 | 建議 DPI | 輸出格式 |
|------|---------|------|----------|---------|
| 社群分享 | 1080 × 1080 px | 0 | 150 | JPG |
| 明信片 / 4x6 | 148 × 100 mm | 2 mm | 300 | JPG |
| A4 海報 / 傳單 | 210 × 297 mm | 3 mm | 300 | PNG |
| A3 海報 | 297 × 420 mm | 3 mm | 300 | PNG |
| 名片 | 90 × 54 mm | 1.5 mm | 300 | PNG |
| 貼紙 | 50 × 50 mm | 1.5 mm | 300 | PNG |

## 注意事項

- 出血區域已包含在輸出圖片中；印刷店裁切時請以成品尺寸為準。
- 重要內容建議放在安全區內，避免被裁切。
- 圖片解析度若低於場景需求，工具會使用 Lanczos 重採樣自動放大，但原始像素越高，成品越好。

## 嵌入 / API 參考

若印刷店或 POD 平台想嵌入 ImageTool，最簡單的方式是提供一個單檔 `single-file.html`：

```html
<iframe src="single-file.html" width="100%" height="800" style="border:none;"></iframe>
```

進階整合可直接使用 `image-core.js` 的 API：

```javascript
const result = await ImageTool.printScore(imageDataUrl, {
  dpi: 300,
  widthMm: 210,
  heightMm: 297,
  bleed: 3
});
console.log(result.score, result.issues);
```
