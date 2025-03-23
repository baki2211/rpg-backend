export class UserController {
    static async getDashboard(req, res) {
        try {
            const user = (req).user;
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
            const errorMessage = (error).message;
            res.status(500).json({ message: 'Error loading dashboard', error: errorMessage });
        }
    }

    static async getUsers(req, res) {
        try {
            const user = (req).user;
            if (!user) {
                res.status(401).json({ message: 'Unauthorized access' });
                return;
            }

            res.status(200).json(user);
        } catch (error) {
            const errorMessage = (error).message;
            res.status(500).json({ message: 'Error fetching users', error: errorMessage });
        }
    }
}
