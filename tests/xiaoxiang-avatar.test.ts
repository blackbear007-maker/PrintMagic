import { describe, expect, it } from 'vitest';
import {
  LEGACY_XIAOXIANG_AVATAR,
  allAvatarAssetPaths,
  avatarAssetCandidates,
  avatarAssetPath,
  fallbackAvatarAssetPath,
} from '../src/ui/xiaoxiang-avatar';

describe('Xiaoxiang avatar state mapping', () => {
  it('maps each approved state to normal and blink WebP assets', () => {
    expect(allAvatarAssetPaths()).toEqual([
      'xiaoxiang/idle.webp', 'xiaoxiang/idle-blink.webp',
      'xiaoxiang/hello.webp', 'xiaoxiang/hello-blink.webp',
      'xiaoxiang/think.webp', 'xiaoxiang/think-blink.webp',
      'xiaoxiang/thumbs.webp', 'xiaoxiang/thumbs-blink.webp',
      'xiaoxiang/cheer.webp', 'xiaoxiang/cheer-blink.webp',
    ]);
    expect(avatarAssetPath('hello', true)).toBe('xiaoxiang/hello-blink.webp');
  });

  it('falls back to an available idle or legacy image when a state is pending', () => {
    const available = new Set(['xiaoxiang/idle.webp', LEGACY_XIAOXIANG_AVATAR]);
    expect(fallbackAvatarAssetPath('cheer', false, available)).toBe('xiaoxiang/idle.webp');
    expect(fallbackAvatarAssetPath('cheer', true, available)).toBe('xiaoxiang/idle.webp');
    expect(avatarAssetCandidates('cheer', false, new Set([LEGACY_XIAOXIANG_AVATAR]))).toEqual([LEGACY_XIAOXIANG_AVATAR]);
  });
});
