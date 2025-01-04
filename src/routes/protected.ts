import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = Router();

router.get('/', authenticateToken, (req, res) => {
    const user = (req as any).user;
    res.status(200).json({
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
        },
        message: 'Authenticated successfully',
    });
});

export default router;
