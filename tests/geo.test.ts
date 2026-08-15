import { describe, it, expect } from 'vitest';
import { GeoDistanceEngine } from '../src/core/geo-distance';
import { CURATED_PRINT_SHOPS } from '../src/data/print-shops';

describe('GeoDistanceEngine (Haversine & Proximity Calculation)', () => {
  it('should calculate distance between Taipei Main Station and Taipei 101 accurately (~5.5km)', () => {
    const taipeiMain = { lat: 25.0478, lng: 121.5170 };
    const taipei101 = { lat: 25.0339, lng: 121.5645 };

    const distanceMeters = GeoDistanceEngine.calculateDistance(
      taipeiMain.lat,
      taipeiMain.lng,
      taipei101.lat,
      taipei101.lng
    );

    // Physical distance is approx 5.1km - 5.5km
    expect(distanceMeters).toBeGreaterThan(5000);
    expect(distanceMeters).toBeLessThan(5600);
  });

  it('should format distance into readable string correctly', () => {
    expect(GeoDistanceEngine.formatDistance(450)).toBe('450 公尺');
    expect(GeoDistanceEngine.formatDistance(1250)).toBe('1.3 公里');
    expect(GeoDistanceEngine.formatDistance(5000)).toBe('5.0 公里');
  });

  it('should sort print shops by proximity to user coordinates', () => {
    // User at Taipei Station (25.0478, 121.5170)
    const userLat = 25.0478;
    const userLng = 121.5170;

    const nearest = GeoDistanceEngine.findNearestShops(
      CURATED_PRINT_SHOPS,
      userLat,
      userLng
    );

    expect(nearest.length).toBeGreaterThan(0);
    // Nearest should be within 1km of Taipei Station (e.g. 健豪 or 經典 or 千業)
    expect(nearest[0].distanceMeters).toBeLessThan(1000);
    // Verify ascending order
    for (let i = 0; i < nearest.length - 1; i++) {
      expect(nearest[i].distanceMeters).toBeLessThanOrEqual(nearest[i + 1].distanceMeters);
    }
  });

  it('should filter shops by city when specified', () => {
    const userLat = 25.0478;
    const userLng = 121.5170;

    const taichungShops = GeoDistanceEngine.findNearestShops(
      CURATED_PRINT_SHOPS,
      userLat,
      userLng,
      '台中市'
    );

    expect(taichungShops.length).toBeGreaterThan(0);
    taichungShops.forEach((s) => {
      expect(s.city).toBe('台中市');
    });
  });

  it('should generate valid Google Maps navigation directions link', () => {
    const url = GeoDistanceEngine.getNavigationUrl(25.0441, 121.5135, '經典數位印刷');
    expect(url).toContain('https://www.google.com/maps/dir/?api=1');
    expect(url).toContain('destination=25.0441,121.5135');
  });
});
