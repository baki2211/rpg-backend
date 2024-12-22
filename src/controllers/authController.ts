import { Request, Response } from 'express';
import { getRepository } from 'typeorm';
import { User } from '../models/userModel';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// Register a new user
export const registerUser = async (req: Request, res: Response): Promise<Response> => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Missing username or password' });
    }

    const userRepository = getRepository(User);

    // Check if the username already exists
    const existingUser = await userRepository.findOne({ where: { username } });
    if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = userRepository.create({ username, password: hashedPassword });
    await userRepository.save(newUser);

    return res.status(201).json({ message: 'User registered successfully' });
};

// Log in a user
export const loginUser = async (req: Request, res: Response): Promise<Response> => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Missing username or password' });
    }

    const userRepository = getRepository(User);

    // Find the user in the database
    const user = await userRepository.findOne({ where: { username } });
    if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Verify the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate a JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({ token });
};
