import jwt from 'jsonwebtoken';
import { AuditLogger } from '../utils/auditLogger.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateToken = (req, res, next) => {
  if (!JWT_SECRET) {
    res.status(500).json({ message: 'Server configuration error' });
    return;
  }

  // Try to get token from cookies first (for local development)
  let token = req.cookies?.token;
  
  // If no cookie token, try Authorization header (for cross-domain production)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
  }

  if (!token) {
    // Log unauthorized access attempt
    AuditLogger.logSecurity(
      AuditLogger.EventTypes.UNAUTHORIZED_ACCESS,
      null,
      req,
      {
        reason: 'missing_token',
        endpoint: req.originalUrl,
        method: req.method
      },
      AuditLogger.RiskLevels.MEDIUM
    );
    res.status(401).json({ message: 'Unauthorized: Token missing' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Decode the token
    req.user = decoded; // Attach the decoded token to the req object
    next();
  } catch (err) {
    // Log failed authentication attempt
    AuditLogger.logSecurity(
      AuditLogger.EventTypes.UNAUTHORIZED_ACCESS,
      null,
      req,
      {
        reason: err.name || 'token_verification_failed',
        error_message: err.message,
        endpoint: req.originalUrl,
        method: req.method
      },
      AuditLogger.RiskLevels.MEDIUM
    );
    
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
      res.status(403).json({ message: 'Invalid token' });
    } else {
      res.status(403).json({ message: 'Token verification failed' });
    }
  }
};

export const requireAuth = (req, res, next) => {
  if (!JWT_SECRET) {
    res.status(500).json({ message: 'Server configuration error' });
    return;
  }

  // Try to get token from cookies first (for local development)
  let token = req.cookies?.token;
  
  // If no cookie token, try Authorization header (for cross-domain production)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Unauthorized: Token missing' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
      res.status(403).json({ message: 'Invalid token' });
    } else {
      res.status(403).json({ message: 'Token verification failed' });
    }
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user || !roles.includes(user.role)) {
      // Log permission denied attempt
      AuditLogger.logSecurity(
        AuditLogger.EventTypes.PERMISSION_DENIED,
        user?.id || null,
        req,
        {
          required_roles: roles,
          user_role: user?.role || 'none',
          endpoint: req.originalUrl,
          method: req.method
        },
        AuditLogger.RiskLevels.HIGH
      );
      res.status(403).json({ message: 'Forbidden: Insufficient role' });
      return;
    }
    next();
  };
};
