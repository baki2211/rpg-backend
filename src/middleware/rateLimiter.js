// Simple in-memory rate limiter
const rateLimitStore = new Map();

const createRateLimiter = (windowMs, maxRequests) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [ip, requests] of rateLimitStore.entries()) {
      const filteredRequests = requests.filter(timestamp => timestamp > windowStart);
      if (filteredRequests.length === 0) {
        rateLimitStore.delete(ip);
      } else {
        rateLimitStore.set(ip, filteredRequests);
      }
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
    
    next();
  };
};

// Rate limiter for authentication endpoints (5 requests per 15 minutes)
export const authLimiter = createRateLimiter(15 * 60 * 1000, 5);

// General API rate limiter (100 requests per 15 minutes)
export const generalLimiter = createRateLimiter(15 * 60 * 1000, 100); 