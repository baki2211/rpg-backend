import { Request, Response } from 'express';

export class UserController {
    static async getDashboard(req: Request, res: Response): Promise<void> {
        try {
            const user = (req as any).user;
            if (!user) {
                res.status(401).json({ message: 'Unauthorized access' });
                return;
            }

            // Respond with user details (or fetch additional data from the DB if needed)
            res.status(200).json({
                message: `Welcome to your dashboard, ${user.username}!`,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
            });
        } catch (error) {
            const errorMessage = (error as Error).message;
            res.status(500).json({ message: 'Error loading dashboard', error: errorMessage });
        }
    }
}
