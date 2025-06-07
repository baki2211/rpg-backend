import { UserService } from '../services/UserService.js';

export class UserController {
    constructor() {
        this.userService = new UserService();
    }

    async getAllUsers(req, res) {
        try {
            // Check if user is admin
            if (req.user?.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied. Admin role required.' });
            }

            const users = await this.userService.getAllUsers();
            res.json(users);
        } catch (error) {
            console.error('Error in getAllUsers:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async updateUserRole(req, res) {
        try {
            // Check if user is admin
            if (req.user?.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied. Admin role required.' });
            }

            const { userId } = req.params;
            const { role } = req.body;

            if (!role) {
                return res.status(400).json({ error: 'Role is required' });
            }

            const updatedUser = await this.userService.updateUserRole(parseInt(userId), role);
            res.json(updatedUser);
        } catch (error) {
            console.error('Error in updateUserRole:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getUsersByRole(req, res) {
        try {
            // Check if user is admin
            if (req.user?.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied. Admin role required.' });
            }

            const { role } = req.params;
            const users = await this.userService.getUsersByRole(role);
            res.json(users);
        } catch (error) {
            console.error('Error in getUsersByRole:', error);
            res.status(500).json({ error: error.message });
        }
    }

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
