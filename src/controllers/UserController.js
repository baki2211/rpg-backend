import { UserService } from '../services/UserService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const userService = new UserService();

export class UserController {
    static getAllUsers = asyncHandler(async (req, res) => {
        res.json(await userService.getAllUsers());
    });

    static updateUserPassword = asyncHandler(async (req, res) => {
        const { oldPassword, newPassword } = req.body;
        if (!newPassword) throw new HttpError(400, 'New password is required');
        if (!oldPassword) throw new HttpError(400, 'Old password is required');

        const userId = parseInt(req.params.userId);
        // Self-service only — admins resetting another user's password must use
        // the admin reset endpoint.
        if (req.user.id !== userId) {
            throw new HttpError(403, 'Access denied. You can only update your own password.');
        }

        res.json(await userService.updateUserPassword(userId, oldPassword, newPassword));
    });

    static adminResetPassword = asyncHandler(async (req, res) => {
        const { newPassword } = req.body;
        if (!newPassword) throw new HttpError(400, 'New password is required');
        res.json(await userService.adminResetPassword(parseInt(req.params.userId), newPassword));
    });

    static updateUserRole = asyncHandler(async (req, res) => {
        const { role } = req.body;
        if (!role) throw new HttpError(400, 'Role is required');
        res.json(await userService.updateUserRole(parseInt(req.params.userId), role));
    });

    static getUsersByRole = asyncHandler(async (req, res) => {
        res.json(await userService.getUsersByRole(req.params.role));
    });

    static getDashboard = asyncHandler(async (req, res) => {
        const user = req.user;
        res.json({
            message: `Welcome to your dashboard, ${user.username}!`,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
        });
    });

    static getUsers = asyncHandler(async (req, res) => {
        res.json(req.user);
    });
}
