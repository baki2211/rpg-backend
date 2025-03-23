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
}
