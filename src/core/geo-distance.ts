import type { PrintShop } from '../data/print-shops';

export interface ShopWithDistance extends PrintShop {
  distanceMeters: number;
  distanceFormatted: string;
}

export interface UserCoordinates {
  lat: number;
  lng: number;
  accuracyMeters?: number;
}

/**
 * High-Precision Geometric Distance Engine
 * Computes exact physical distance using the Haversine formula (100% Free, 0ms, Zero API cost)
 */
export class GeoDistanceEngine {
  private static readonly EARTH_RADIUS_METERS = 6371000;

  /**
   * Calculate distance between two coordinates in meters
   */
  public static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(this.EARTH_RADIUS_METERS * c);
  }

  /**
   * Format meters into human-readable string (e.g. "450 公尺" or "2.3 公里")
   */
  public static formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters} 公尺`;
    }
    const km = (meters / 1000).toFixed(1);
    return `${km} 公里`;
  }

  /**
   * Sort print shops by distance from user coordinates
   */
  public static findNearestShops(
    shops: PrintShop[],
    userLat: number,
    userLng: number,
    selectedCity?: string
  ): ShopWithDistance[] {
    let filtered = shops;
    if (selectedCity && selectedCity !== 'all') {
      filtered = shops.filter((s) => s.city === selectedCity);
    }

    const calculated: ShopWithDistance[] = filtered.map((shop) => {
      const distanceMeters = this.calculateDistance(
        userLat,
        userLng,
        shop.lat,
        shop.lng
      );
      return {
        ...shop,
        distanceMeters,
        distanceFormatted: this.formatDistance(distanceMeters)
      };
    });

    return calculated.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  /**
   * Generate 100% Free Google Maps Turn-by-Turn Navigation URL
   */
  public static getNavigationUrl(lat: number, lng: number, shopName: string): string {
    const encodedName = encodeURIComponent(shopName);
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodedName}`;
  }

  /**
   * Promisified HTML5 Geolocation API
   */
  public static async getUserLocation(): Promise<UserCoordinates> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('您的瀏覽器不支援地理定位'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy
          });
        },
        (err) => {
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000
        }
      );
    });
  }
}
