import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'Welcome to the RPG API',
        status: 'running',
        version: '1.0.0'
    });
});

export default router;