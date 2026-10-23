import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from '../../../src/utils/withTimeout.js';

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the value when the promise resolves before the deadline and leaves no timer behind', async () => {
    vi.useFakeTimers();

    const result = await withTimeout(Promise.resolve('ok'), 3000, 'Timeout');

    expect(result).toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with the given message when the deadline passes first', async () => {
    vi.useFakeTimers();
    const pending = new Promise(() => {});

    const outcome = withTimeout(pending, 3000, 'Timeout').catch((e) => e.message);
    await vi.advanceTimersByTimeAsync(3000);

    expect(await outcome).toBe('Timeout');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not reject just before the deadline', async () => {
    vi.useFakeTimers();
    let settled = false;

    withTimeout(new Promise(() => {}), 3000, 'Timeout').catch(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(2999);

    expect(settled).toBe(false);
  });

  it('propagates the underlying rejection and clears the timer', async () => {
    vi.useFakeTimers();

    const outcome = await withTimeout(Promise.reject(new Error('db down')), 3000, 'Timeout').catch((e) => e.message);

    expect(outcome).toBe('db down');
    expect(vi.getTimerCount()).toBe(0);
  });
});
