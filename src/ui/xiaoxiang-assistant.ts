import { store, type AppState } from './state';
import { SoundEffects } from '../core/sound-effects';

/**
 * 🐘 小象（向俊傑）對白與陪伴助手系統
 * 參考《單單環島 GO》danCard 架構，統整全站指引與提示於專屬對話框
 */
export class XiaoxiangAssistant {
  private container: HTMLElement;
  private xiangSay: HTMLElement | null = null;
  private xiangAvatar: HTMLElement | null = null;
  private timeoutId: any = null;

  // Default lines by context
  public static readonly LINES = {
    welcome: '丟一張圖進來吧。或者按 <strong>Ctrl+V 貼上</strong>、手機拍照，點下面的海報、明信片或貼紙，我都幫你算好 3mm 出血了。',
    processing: '正在跑 8x 金字塔超解析度與 CMYK 控墨... 稍等一下，馬上就好。',
    ready: '搞定了！300 DPI 補齊了，總墨量也幫你壓在 300% 內。直接點下載 PDF，印刷廠老闆挑不出毛病。',
    simpleMode: '切到【簡易模式】了。無腦直出，該有的 8x 放大跟 3mm 出血我都在背景做好了。',
    advancedMode: '切到【進階模式】了。專業製版、紙材、ICC 軟打樣和燙金工藝都在上面，想調什麼自己開。',
    localEngine: '100% 離線本機模式，照片完全不連網，商業作品放心用。',
    cloudEngine: '雲端工業模式連線中，支援 ISO 15930 PDF/X-1a 與開源 AI 深度重建。',
    postcard: '切成【藝術明信片】了。單單上次環島也叫我印過這個，印在 300P 萊妮紙上手感最好。',
    posterA4: '【A4 經典海報】模式。3mm 出血外推保護都做好了，裁刀稍微歪一點也不會露出白邊。',
    posterA3: '【A3 展覽大圖】模式。尺寸較大，我已經幫你用 Lanczos-3 放大補齊 300 DPI，印出來不會糊。',
    businessCard: '【商業名片】模式。四邊留好了 2mm 安全框，重要文字都保護在裡面。',
    sticker: '【模切貼紙】模式。印透明貼紙的話記得點進階開白墨，我幫你留好 2mm 刀模線。',
    social: '【社群高畫質】模式。純數位輸出不加出血，顏色維持鮮豔。',
    paperGlossy: '選了超光銅版紙？亮面鮮豔反光佳，印高彩度海報與動漫插畫選這個就對了。',
    paperMatte: '選了雙面啞粉？霧面細緻不反光，拿來印畫冊跟藝術明信片最乾淨。',
    paperLinen: '細格萊妮紙，十字布紋手感特別好，文創名片跟日系插畫很搭。',
    paperCotton: '象牙棉卡，吸墨自然溫潤，手繪水彩跟版畫選這個很有味道。',
    foilGold: '亮金燙金效果開了。手機晃一下螢幕能看反光，印實體的話白墨燙金層我也分好在 PDF 裡了。',
    convPrint: '超商專用圖準備好了。下樓去 7-11 或全家機台，首頁點列印，掃 QR 碼投幣就能印，不用在那邊手動調尺寸。',
    specCopy: '「傳給老闆一句話」複製好了。直接貼在 LINE 傳給印刷廠，你不用在那邊背出血和解析度數字。',
    objectEraser: '要修圖？用筆刷塗一塗不要的雜物或路人，我幫你算底圖補回去。',
    textInspect: '文字檢測看過了。幫你檢查了有沒有怪異亂碼或 AI 偽字。',
    exportPdf: 'PDF 正在輸出中，已內嵌向量角線、十字規矩線與 CMYK 色條，拿到哪家印刷廠都能直接出機。',
    exportPng: '300 DPI 高清 PNG 已下載。拿去傳 LINE 或手機沖洗相片剛剛好。'
  };

  constructor(containerId = 'xiangAssistantRoot') {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
      document.body.appendChild(el);
    }
    this.container = el;
    this.render();
    this.bindEvents();
    this.subscribeState();
  }

  private render(): void {
    this.container.innerHTML = `
      <div id="xiangAssistant" class="pm-xiang-assistant">
        <!-- Xiaoxiang Dialog Card (Left) -->
        <div id="xiangCard" class="pm-xiang-card breath">
          <div class="pm-xiang-header">
            <div class="pm-xiang-title-row">
              <span class="pm-xiang-name">小象</span>
              <span class="pm-xiang-badge">印刷廠之子 · 樓下的朋友們</span>
            </div>
            <div id="xiangActs" class="pm-xiang-actions">
              <button id="btnXiangGuide" class="pm-xiang-act-btn" title="查看 3 步速成指南">💡 30秒指南</button>
            </div>
          </div>
          <div id="xiangSay" class="pm-xiang-say">
            ${XiaoxiangAssistant.LINES.welcome}
          </div>
        </div>

        <!-- Xiaoxiang Avatar (Right Side) -->
        <div id="xiangAvatar" class="pm-xiang-avatar-wrap" title="小象（印刷廠之子 · 樓下的朋友們）">
          <img id="xiangFace" src="xiaoxiang.jpg" alt="小象" class="pm-xiang-avatar-img" />
          <span class="pm-xiang-status-dot" title="小象在線守護印刷品質"></span>
        </div>
      </div>
    `;

    this.xiangSay = this.container.querySelector('#xiangSay');
    this.xiangAvatar = this.container.querySelector('#xiangAvatar');
  }

  private bindEvents(): void {
    this.container.querySelector('#btnXiangGuide')?.addEventListener('click', () => {
      document.getElementById('btnOpenGuide')?.click();
    });

    this.xiangAvatar?.addEventListener('click', () => {
      SoundEffects.purityChime();
      this.sayRandomBanter();
    });
  }

  /**
   * Speak a line in Xiaoxiang's characteristic deadpan & reliable voice
   */
  public say(text: string, durationMs = 6000): void {
    if (!this.xiangSay) return;
    this.xiangSay.style.opacity = '0';
    setTimeout(() => {
      if (this.xiangSay) {
        this.xiangSay.innerHTML = text;
        this.xiangSay.style.opacity = '1';
      }
    }, 120);

    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (durationMs > 0) {
      this.timeoutId = setTimeout(() => {
        const state = store.getState();
        if (state.originalDataUrl) {
          this.say(XiaoxiangAssistant.LINES.ready, 0);
        } else {
          this.say(XiaoxiangAssistant.LINES.welcome, 0);
        }
      }, durationMs);
    }
  }

  private sayRandomBanter(): void {
    const banters = [
      '「我爸開印刷廠三十年，最怕客人給 72 DPI 的圖說要印兩米海報。還好有我幫你先補到 300 DPI。」',
      '「單單上次環島也拍了一堆海邊照，叫我幫她印滿一張 A3，拿 250P 霧面印出來是真的挺好看。」',
      '「不要的東西用消除筆塗掉就好，底圖我幫你算。不用開 Photoshop 搞老半天。」',
      '「送印直接丟我給你的 PDF 就好，出血十字色條全都有，老闆挑不出毛病。」',
      '「那就好。」',
      '「字體我有幫你看，AI 生的怪字或英文拼錯都幫你挑出來了。」'
    ];
    const pick = banters[Math.floor(Math.random() * banters.length)];
    this.say(pick, 7000);
  }

  private subscribeState(): void {
    let prevPreset = store.getState().currentPreset.id;
    let prevPaper = store.getState().selectedPaper;
    let prevMode = store.getState().uiMode;
    let prevProcessing = false;
    let prevHasImage = false;

    store.subscribe((state: AppState) => {
      const hasImage = !!state.originalDataUrl;

      // 1. Image upload state change
      if (hasImage && !prevHasImage) {
        prevHasImage = true;
        this.say('收到圖了！正在自動解析尺寸並計算最佳印刷品質...', 3000);
      } else if (!hasImage && prevHasImage) {
        prevHasImage = false;
        this.say(XiaoxiangAssistant.LINES.welcome, 0);
      }

      // 2. Processing state change
      if (state.isProcessing && !prevProcessing) {
        prevProcessing = true;
        this.say(XiaoxiangAssistant.LINES.processing, 0);
      } else if (!state.isProcessing && prevProcessing) {
        prevProcessing = false;
        this.say(XiaoxiangAssistant.LINES.ready, 0);
      }

      // 3. Preset change
      if (state.currentPreset.id !== prevPreset) {
        prevPreset = state.currentPreset.id;
        let line = `切換為【${state.currentPreset.nameZh}】規格了。`;
        if (state.currentPreset.id === 'poster-a4') line = XiaoxiangAssistant.LINES.posterA4;
        else if (state.currentPreset.id === 'poster-a3') line = XiaoxiangAssistant.LINES.posterA3;
        else if (state.currentPreset.id === 'postcard') line = XiaoxiangAssistant.LINES.postcard;
        else if (state.currentPreset.id === 'business-card') line = XiaoxiangAssistant.LINES.businessCard;
        else if (state.currentPreset.id === 'sticker') line = XiaoxiangAssistant.LINES.sticker;
        else if (state.currentPreset.id === 'social') line = XiaoxiangAssistant.LINES.social;
        this.say(line, 5000);
      }

      // 4. Paper change
      if (state.selectedPaper !== prevPaper) {
        prevPaper = state.selectedPaper;
        let line = '';
        if (state.selectedPaper === 'glossy') line = XiaoxiangAssistant.LINES.paperGlossy;
        else if (state.selectedPaper === 'matte') line = XiaoxiangAssistant.LINES.paperMatte;
        else if (state.selectedPaper === 'linen') line = XiaoxiangAssistant.LINES.paperLinen;
        else if (state.selectedPaper === 'cotton') line = XiaoxiangAssistant.LINES.paperCotton;
        if (line) this.say(line, 5000);
      }

      // 5. UI Mode change
      if (state.uiMode !== prevMode) {
        prevMode = state.uiMode;
        if (state.uiMode === 'simple') {
          this.say(XiaoxiangAssistant.LINES.simpleMode, 4000);
        } else {
          this.say(XiaoxiangAssistant.LINES.advancedMode, 4000);
        }
      }
    });
  }
}
