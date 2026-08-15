import { CURATED_PRINT_SHOPS, type PrintShop } from '../data/print-shops';
import { GeoDistanceEngine, type ShopWithDistance, type UserCoordinates } from '../core/geo-distance';
import { store } from './state';
import { Toast } from './toast';
import { SoundEffects } from '../core/sound-effects';

/**
 * Nearby Commercial Print Shops Finder Modal
 * 100% Free & Open (HTML5 Geolocation + Haversine Metric Engine + Curated Database)
 */
export class NearbyShopsModal {
  private modalEl: HTMLElement;
  private userCoords: UserCoordinates | null = null;
  private selectedCity = 'all';
  private isLocating = false;

  constructor() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'pm-modal-backdrop';
    this.modalEl.style.display = 'none';
    document.body.appendChild(this.modalEl);

    this.bindEvents();
  }

  public open(): void {
    this.render();
    this.modalEl.style.display = 'flex';
    requestAnimationFrame(() => this.modalEl.classList.add('pm-modal-open'));

    // Auto-attempt geolocation if not yet acquired
    if (!this.userCoords) {
      this.detectLocation();
    }
  }

  public hide(): void {
    this.modalEl.classList.remove('pm-modal-open');
    setTimeout(() => {
      this.modalEl.style.display = 'none';
    }, 250);
  }

  private async detectLocation(): Promise<void> {
    this.isLocating = true;
    this.updateLocationButtonUI();

    try {
      this.userCoords = await GeoDistanceEngine.getUserLocation();
      Toast.success('✓ 已成功取得您的地理位置，已依據物理距離排序周邊印刷廠！');
      SoundEffects.purityChime();
    } catch (err: any) {
      console.warn('Geolocation fallback:', err);
      // Default to Taipei Main Station coordinates if location denied
      this.userCoords = { lat: 25.0478, lng: 121.5170 };
      Toast.info('💡 未能取得 GPS 定位，已預設為台北市中心排序 (您可手動切換縣市)');
    } finally {
      this.isLocating = false;
      this.render();
    }
  }

  private getShops(): (ShopWithDistance | (PrintShop & { distanceFormatted?: string }))[] {
    if (this.userCoords) {
      return GeoDistanceEngine.findNearestShops(
        CURATED_PRINT_SHOPS,
        this.userCoords.lat,
        this.userCoords.lng,
        this.selectedCity
      );
    }

    let filtered = CURATED_PRINT_SHOPS;
    if (this.selectedCity !== 'all') {
      filtered = filtered.filter((s) => s.city === this.selectedCity);
    }
    return filtered;
  }

  private render(): void {
    const shops = this.getShops();
    const cities = ['all', '台北市', '新北市', '台中市', '高雄市', '台南市', '新竹市'];

    const cityPillsHtml = cities
      .map((c) => {
        const active = this.selectedCity === c;
        const label = c === 'all' ? '全部縣市' : c;
        return `<button class="pm-shop-city-btn ${active ? 'active' : ''}" data-city="${c}">${label}</button>`;
      })
      .join('');

    const shopCardsHtml = shops
      .map((shop) => {
        const distanceBadge = (shop as ShopWithDistance).distanceFormatted
          ? `<span class="pm-shop-dist-badge">📍 ${(shop as ShopWithDistance).distanceFormatted}</span>`
          : '';

        const tagsHtml = shop.services
          .slice(0, 4)
          .map((s) => `<span class="pm-shop-tag">${s}</span>`)
          .join('');

        const navUrl = GeoDistanceEngine.getNavigationUrl(shop.lat, shop.lng, shop.name);

        return `
          <div class="pm-shop-card">
            <div class="pm-shop-card-header">
              <div class="pm-shop-title-group">
                <span class="pm-shop-name">${shop.name}</span>
                <span class="pm-shop-addr">${shop.address}</span>
              </div>
              ${distanceBadge}
            </div>

            <div class="pm-shop-meta-row">
              <span class="pm-shop-hours">🕒 ${shop.businessHours}</span>
              <a href="tel:${shop.phone}" class="pm-shop-phone">📞 ${shop.phone}</a>
            </div>

            <div class="pm-shop-tags">
              ${tagsHtml}
            </div>

            <div class="pm-shop-actions">
              <a href="${navUrl}" target="_blank" rel="noopener noreferrer" class="pm-btn pm-btn-secondary pm-btn-sm" title="開啟 Google Maps 路線導航">
                <span>🧭</span> 地圖導航
              </a>
              <a href="${shop.onlineUploadUrl}" target="_blank" rel="noopener noreferrer" class="pm-btn pm-btn-artisan pm-btn-sm" title="前往該印刷廠官網線上傳檔系統">
                <span>🌐</span> 線上送印官網
              </a>
              <button class="pm-btn pm-btn-ghost pm-btn-sm btn-copy-shop-spec" data-shop-name="${shop.name}" title="複製符合此印刷廠之印前規格小抄">
                <span>📋</span> 複製送印規格
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    this.modalEl.innerHTML = `
      <div class="pm-modal-dialog pm-shops-dialog">
        <div class="pm-modal-header">
          <div class="pm-modal-title-group">
            <span class="pm-modal-title">📍 尋找附近專業商業印刷廠</span>
            <span class="pm-modal-subtitle">精選具備 CMYK 出血裁切、多紙材打樣與線上自動落版能力的專業廠商 (100% 免費導航)</span>
          </div>
          <button class="pm-modal-close" id="btnShopsClose">✕</button>
        </div>

        <div class="pm-shops-toolbar">
          <button id="btnGpsLocate" class="pm-btn pm-btn-secondary pm-btn-sm" ${this.isLocating ? 'disabled' : ''}>
            <span>${this.isLocating ? '🔄' : '📍'}</span>
            <span>${this.isLocating ? '正在定位中...' : '重新 GPS 定位'}</span>
          </button>

          <div class="pm-shop-cities">
            ${cityPillsHtml}
          </div>
        </div>

        <div class="pm-shops-list-stage">
          ${shopCardsHtml}
        </div>

        <div class="pm-modal-footer">
          <button class="pm-btn pm-btn-ghost" id="btnShopsDone">完成</button>
        </div>
      </div>
    `;

    this.bindDynamicEvents();
  }

  private bindEvents(): void {
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.hide();
    });
  }

  private bindDynamicEvents(): void {
    this.modalEl.querySelector('#btnShopsClose')?.addEventListener('click', () => this.hide());
    this.modalEl.querySelector('#btnShopsDone')?.addEventListener('click', () => this.hide());

    // GPS Locate Button
    this.modalEl.querySelector('#btnGpsLocate')?.addEventListener('click', () => {
      SoundEffects.sliderTick();
      this.detectLocation();
    });

    // City Filter Buttons
    this.modalEl.querySelectorAll<HTMLButtonElement>('.pm-shop-city-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const city = btn.dataset.city || 'all';
        this.selectedCity = city;
        SoundEffects.sliderTick();
        this.render();
      });
    });

    // Copy spec button for specific shop
    this.modalEl.querySelectorAll<HTMLButtonElement>('.btn-copy-shop-spec').forEach((btn) => {
      btn.addEventListener('click', () => {
        const state = store.getState();
        const preset = state.currentPreset;
        const totalW = preset.widthMm + preset.bleedMm * 2;
        const totalH = preset.heightMm + preset.bleedMm * 2;
        const shopName = btn.dataset.shopName || '印刷廠';

        const copyText = `【PrintMagic 送印規格單 — 指定廠商：${shopName}】
■ 輸出項目：${preset.nameZh}
■ 成品淨尺寸：${preset.widthMm} × ${preset.heightMm} mm
■ 含出血尺寸：${totalW} × ${totalH} mm (單邊 ${preset.bleedMm}mm 出血)
■ 實體解析度：${state.dpiAnalysis?.currentDpi || preset.targetDpi} DPI 實體渲染
■ 總墨量 TAC：${state.inkAnalysis?.maxTotalInk || 300}% (已套用安全壓制防溢)
■ 裁切標記：已內嵌 0.1mm 標準向量角線、CMYK 密度條與十字套準
■ 建議紙材：${preset.recommendedPaper}
■ 備註：檔案已通過 PrintMagic Studio 3.1 印前合規審查`;

        navigator.clipboard.writeText(copyText).then(() => {
          Toast.success(`✓ 已複製適用於「${shopName}」的送印規格小抄！`);
          SoundEffects.shutterClick();
        }).catch(() => {
          Toast.info(copyText);
        });
      });
    });
  }

  private updateLocationButtonUI(): void {
    const btn = this.modalEl.querySelector<HTMLButtonElement>('#btnGpsLocate');
    if (btn) {
      btn.disabled = this.isLocating;
      btn.innerHTML = `<span>${this.isLocating ? '🔄' : '📍'}</span><span>${this.isLocating ? '正在定位中...' : '重新 GPS 定位'}</span>`;
    }
  }
}
