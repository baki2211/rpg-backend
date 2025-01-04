import { Request, Response, NextFunction } from 'express';

export const isAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user; 

    if (!user || user.role !== 'admin') {
        res.status(403).json({ message: 'Access denied: Admins only' });
        return;
    }

    next();
};
