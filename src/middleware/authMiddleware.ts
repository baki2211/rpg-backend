import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from './../models/userModel.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.token; // Read the token from cookies

  if (!token) {
    res.status(401).json({ message: 'Unauthorized: Token missing' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as User; // Cast the decoded token to the User type
    req.user = decoded; // Attach the decoded token to the req object
    next();
  } catch (err) {
    res.status(403).json({ message: 'Forbidden: Invalid token' });
  }
};