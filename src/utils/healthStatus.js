// Pure decision for GET /health: plain numbers in, statuses out. No I/O, clock or logger.

export const MEMORY_WARNING_PERCENT = 90;
export const MAX_HEALTHY_CONNECTIONS = 40;
export const OVERLOAD_MEMORY_PERCENT = 95;
export const OVERLOAD_CONNECTIONS = 50;

export function assessHealth({ memoryPercent, totalConnections, databaseStatus }) {
  const memoryOk = memoryPercent < MEMORY_WARNING_PERCENT;
  const healthy = memoryOk && totalConnections < MAX_HEALTHY_CONNECTIONS && databaseStatus === 'connected';
  const overloaded = memoryPercent > OVERLOAD_MEMORY_PERCENT || totalConnections >= OVERLOAD_CONNECTIONS;

  return {
    status: healthy ? 'healthy' : 'degraded',
    memoryStatus: memoryOk ? 'healthy' : 'warning',
    overloaded,
  };
}
