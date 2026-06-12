import { AppDataSource } from '../data-source.js';
import { User } from '../models/userModel.js';
import bcrypt from 'bcrypt';

const PUBLIC_USER_FIELDS = { id: true, username: true, role: true, createdAt: true, updatedAt: true };

export class UserService {
    userRepository = AppDataSource.getRepository(User);

    // Register a new user
    async register(username, password, role = 'user') {
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = this.userRepository.create({
            username,
            password: hashedPassword,
            role: role || 'user',
        });

        const saved = await this.userRepository.save(newUser);
        return this.findById(saved.id);
    }

    // Find a user by ID. Password is excluded by default; pass includePassword=true
    // only for internal verification flows (e.g. old-password check).
    async findById(id, includePassword = false) {
        const options = { where: { id } };
        if (!includePassword) {
            options.select = PUBLIC_USER_FIELDS;
        }
        const user = await this.userRepository.findOne(options);
        return user ?? undefined;
    }

    // Find a user by username. Includes password — only used by the login path.
    async findByUsername(username) {
        const user = await this.userRepository.findOne({ where: { username } });
        return user ?? undefined;
    }

    // Verify the password
    async verifyPassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }

    // Get all users with their roles
    async getAllUsers() {
        return this.userRepository.find({
            select: PUBLIC_USER_FIELDS,
            order: { username: 'ASC' }
        });
    }

    // Update user password — requires the caller-supplied old password.
    async updateUserPassword(userId, oldPassword, newPassword) {
        const user = await this.findById(userId, true);
        if (!user) {
            throw new Error('User not found');
        }

        const isPasswordValid = await this.verifyPassword(oldPassword, user.password);
        if (!isPasswordValid) {
            throw new Error('The old password does not match');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.userRepository.update(userId, { password: hashedPassword });
        return this.findById(userId);
    }

    // Admin password reset — bypasses the old-password check. Authorization (admin role)
    // must be enforced by the caller.
    async adminResetPassword(userId, newPassword) {
        const user = await this.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.userRepository.update(userId, { password: hashedPassword });
        return this.findById(userId);
    }

    // Update user role
    async updateUserRole(userId, newRole) {
        const validRoles = ['user', 'staffer', 'master', 'admin'];
        if (!validRoles.includes(newRole.toLowerCase())) {
            throw new Error('Invalid role. Must be one of: user, staffer, master, admin');
        }

        const user = await this.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        await this.userRepository.update(userId, { role: newRole.toLowerCase() });
        return this.findById(userId);
    }

    // Get users by role
    async getUsersByRole(role) {
        return this.userRepository.find({
            where: { role: role.toLowerCase() },
            select: PUBLIC_USER_FIELDS,
            order: { username: 'ASC' }
        });
    }
}
