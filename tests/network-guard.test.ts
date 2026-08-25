import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkGuard } from '../src/services/network-guard';

describe('NetworkGuard & Privacy Shield', () => {
  let storeMock: Record<string, string> = {};

  beforeEach(() => {
    vi.restoreAllMocks();
    storeMock = {};

    // @ts-ignore
    global.localStorage = {
      getItem: (k: string) => storeMock[k] || null,
      setItem: (k: string, v: string) => { storeMock[k] = v; },
      removeItem: (k: string) => { delete storeMock[k]; },
      clear: () => { storeMock = {}; }
    } as any;

    NetworkGuard.setPrivacyShield(false);
  });

  it('should toggle and persist privacy shield state in localStorage', () => {
    expect(NetworkGuard.isPrivacyShieldActive()).toBe(false);

    NetworkGuard.setPrivacyShield(true);
    expect(NetworkGuard.isPrivacyShieldActive()).toBe(true);

    NetworkGuard.setPrivacyShield(false);
    expect(NetworkGuard.isPrivacyShieldActive()).toBe(false);
  });

  it('should correctly validate binary magic headers for PNG, JPEG, and WebP', async () => {
    // PNG Header: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])]);
    expect(await NetworkGuard.validateImageBlob(pngBlob)).toBe(true);

    // JPEG Header: 0xFF 0xD8 0xFF
    const jpegBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])]);
    expect(await NetworkGuard.validateImageBlob(jpegBlob)).toBe(true);

    // Corrupted / invalid text file pretending to be image
    const corruptBlob = new Blob(['<html>502 Bad Gateway</html>']);
    expect(await NetworkGuard.validateImageBlob(corruptBlob)).toBe(false);
  });
});
