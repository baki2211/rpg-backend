import { describe, expect, it } from 'vitest';
import { assessHealth } from '../../../src/utils/healthStatus.js';

const makeInput = (overrides = {}) => ({ memoryPercent: 10, totalConnections: 0, databaseStatus: 'connected', ...overrides });

describe('health assessment', () => {
  it.each([
    ['just under 90 percent memory', 89.9, 'healthy', 'healthy'],
    ['exactly 90 percent memory', 90, 'degraded', 'warning'],
  ])('%s', (_name, memoryPercent, status, memoryStatus) => {
    const result = assessHealth(makeInput({ memoryPercent }));

    expect(result.status).toBe(status);
    expect(result.memoryStatus).toBe(memoryStatus);
  });

  it.each([
    ['39 connections', 39, 'healthy'],
    ['40 connections', 40, 'degraded'],
  ])('%s', (_name, totalConnections, status) => {
    const result = assessHealth(makeInput({ totalConnections }));

    expect(result.status).toBe(status);
  });

  it.each([
    ['connected', 'healthy'],
    ['disconnected', 'degraded'],
    ['error', 'degraded'],
  ])('database %s', (databaseStatus, status) => {
    const result = assessHealth(makeInput({ databaseStatus }));

    expect(result.status).toBe(status);
  });

  it.each([
    ['memory at 95', 95, 0, false],
    ['memory just over 95', 95.1, 0, true],
    ['49 connections', 10, 49, false],
    ['50 connections', 10, 50, true],
  ])('overload: %s', (_name, memoryPercent, totalConnections, overloaded) => {
    const result = assessHealth(makeInput({ memoryPercent, totalConnections }));

    expect(result.overloaded).toBe(overloaded);
  });
});
