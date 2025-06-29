import jwt from 'jsonwebtoken';

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
    res.status(401).json({ message: 'Unauthorized: Token missing' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Decode the token
    req.user = decoded; // Attach the decoded token to the req object
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
      res.status(403).json({ message: 'Forbidden: Insufficient role' });
      return;
    }
    next();
  };
};
