import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export interface IUser {
    id?: number;
    username: string;
    password?: string; // Optional since hashed password may not always be needed
}

export class User {
    static JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

    // Register a new user
    static async register(username: string, password: string): Promise<IUser> {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );

        return result.rows[0]; // Return the created user (id and username)
    }

    // Find a user by username
    static async findByUsername(username: string): Promise<IUser | null> {
        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows[0] || null;
    }

    // Verify password
    static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(password, hashedPassword);
    }

    // Generate JWT token
    static generateToken(user: IUser): string {
        return jwt.sign({ id: user.id, username: user.username }, this.JWT_SECRET, {
            expiresIn: '1h',
        });
    }
}
