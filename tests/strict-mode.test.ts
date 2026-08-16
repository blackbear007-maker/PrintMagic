import { describe, it, expect } from 'vitest';
import { store } from '../src/ui/state';

describe('Strict Engine Mode Enforcement', () => {
  it('should default to local engine mode with local upscale mode', () => {
    store.reset();
    const state = store.getState();
    expect(state.engineMode).toBe('local');
    expect(state.aiUpscaleMode).toBe('local');
  });

  it('should reset aiUpscaleMode to local when switching to local engine mode', () => {
    store.setEngineMode('cloud');
    store.setState({ aiUpscaleMode: 'cloud-ai' });
    expect(store.getState().aiUpscaleMode).toBe('cloud-ai');

    store.setEngineMode('local');
    store.setState({ aiUpscaleMode: 'local' });
    expect(store.getState().engineMode).toBe('local');
    expect(store.getState().aiUpscaleMode).toBe('local');
  });
});
