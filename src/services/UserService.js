import { AppDataSource } from '../data-source.js';
import { User } from '../models/userModel.js';
import bcrypt from 'bcrypt';

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

        return this.userRepository.save(newUser); // Save to the database
    }

    // Find a user by ID
    async findById(id) {
        const user = await this.userRepository.findOne({ where: { id } });
        return user ?? undefined;
    }

    // Find a user by username
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
            select: ['id', 'username', 'role', 'createdAt'],
            order: { username: 'ASC' }
        });
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
            select: ['id', 'username', 'role', 'createdAt'],
            order: { username: 'ASC' }
        });
    }
}
