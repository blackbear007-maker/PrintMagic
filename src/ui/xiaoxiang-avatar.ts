export type XiaoxiangAvatarState = 'idle' | 'hello' | 'think' | 'thumbs' | 'cheer';

export const LEGACY_XIAOXIANG_AVATAR = 'xiaoxiang.jpg';

const AVATAR_STATES: readonly XiaoxiangAvatarState[] = ['idle', 'hello', 'think', 'thumbs', 'cheer'];

export function avatarAssetPath(state: XiaoxiangAvatarState, blink = false): string {
  return `xiaoxiang/${state}${blink ? '-blink' : ''}.webp`;
}

export function avatarAssetCandidates(
  state: XiaoxiangAvatarState,
  blink: boolean,
  available: ReadonlySet<string>,
): string[] {
  const candidates = [
    avatarAssetPath(state, blink),
    avatarAssetPath(state, false),
    avatarAssetPath('idle', blink),
    avatarAssetPath('idle', false),
    LEGACY_XIAOXIANG_AVATAR,
  ];
  return candidates.filter((asset, index) => candidates.indexOf(asset) === index && available.has(asset));
}

export function fallbackAvatarAssetPath(
  state: XiaoxiangAvatarState,
  blink: boolean,
  available: ReadonlySet<string>,
): string {
  return avatarAssetCandidates(state, blink, available)[0] || LEGACY_XIAOXIANG_AVATAR;
}

export function allAvatarAssetPaths(): string[] {
  return AVATAR_STATES.flatMap((state) => [avatarAssetPath(state), avatarAssetPath(state, true)]);
}
