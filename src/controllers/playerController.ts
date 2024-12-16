import { Request, Response } from 'express';

// In-memory database (replace with actual DB later)
interface Player {
    id: number;
    name: string;
    race: string;
    age: number;
}

const players: Player[] = [];

// Get all players
export const getPlayers = (req: Request, res: Response): void => {
    res.status(200).json(players);
};

// Create a new player
export const createPlayer = (req: Request, res: Response): void => {
    const { name, race, age } = req.body;

    if (!name || !race || !age) {
        res.status(400).json({ message: 'Missing required fields' });
        return;
    }

    const newPlayer: Player = {
        id: players.length + 1,
        name,
        race,
        age,
    };

    players.push(newPlayer);
    res.status(201).json(newPlayer);
};
