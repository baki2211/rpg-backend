// Simple in-memory rate limiter with memory leak prevention
const rateLimitStore = new Map();
const MAX_STORE_SIZE = 1000; // Limit to 1000 IPs max
let lastCleanup = Date.now();

// Aggressive cleanup function to prevent memory leaks
const cleanupRateLimitStore = () => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 hour
  
  // Clean up entries older than 1 hour
  for (const [ip, requests] of rateLimitStore.entries()) {
    const recentRequests = requests.filter(timestamp => timestamp > now - oneHour);
    if (recentRequests.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, recentRequests);
    }
  }
  
  // If still too large, remove oldest entries
  if (rateLimitStore.size > MAX_STORE_SIZE) {
    const entries = Array.from(rateLimitStore.entries());
    // Sort by oldest request time
    entries.sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
    
    // Remove oldest entries
    const toRemove = entries.slice(0, rateLimitStore.size - MAX_STORE_SIZE);
    toRemove.forEach(([ip]) => rateLimitStore.delete(ip));
    
    console.log(`Rate limiter: Cleaned up ${toRemove.length} old entries. Current size: ${rateLimitStore.size}`);
  }
  
  lastCleanup = now;
};

// Run cleanup every 10 minutes
setInterval(cleanupRateLimitStore, 10 * 60 * 1000);

const createRateLimiter = (windowMs, maxRequests) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Run cleanup if it's been more than 10 minutes
    if (now - lastCleanup > 10 * 60 * 1000) {
      cleanupRateLimitStore();
    }
    
    // Get current requests for this IP
    const currentRequests = rateLimitStore.get(clientIP) || [];
    const recentRequests = currentRequests.filter(timestamp => timestamp > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        message: 'Too many requests, please try again later.'
      });
    }
    
    // Add current request
    recentRequests.push(now);
    rateLimitStore.set(clientIP, recentRequests);
    
    // Prevent store from growing too large
    if (rateLimitStore.size > MAX_STORE_SIZE * 1.2) {
      cleanupRateLimitStore();
    }
    
    next();
  };
};

// Rate limiter for authentication endpoints (5 requests per 15 minutes)
export const authLimiter = createRateLimiter(15 * 60 * 1000, 5);

// General API rate limiter (100 requests per 15 minutes)
export const generalLimiter = createRateLimiter(15 * 60 * 1000, 100); 