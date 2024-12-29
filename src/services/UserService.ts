import { AppDataSource } from '../data-source';
import { User } from '../models/userModel';
import bcrypt from 'bcrypt';

export class UserService {
    private userRepository = AppDataSource.getRepository(User);

    // Register a new user
    async register(username: string, password: string): Promise<User> {
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = this.userRepository.create({
            username,
            password: hashedPassword,
        });

        return this.userRepository.save(newUser); // Save to the database
    }

    // Find a user by username
    async findByUsername(username: string): Promise<User | undefined> {
        const user = await this.userRepository.findOne({ where: { username } });
        return user ?? undefined;
    }

    // Verify the password
    async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(password, hashedPassword);
    }
}
