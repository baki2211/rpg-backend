import { Request, Response } from 'express';
import { RaceService } from '../services/RaceService';

const raceService = new RaceService();

export class RaceController {
    static async getAllRaces(req: Request, res: Response): Promise<void> {
        try {
            const races = await raceService.getAllRaces();
            res.status(200).json(races);
        } catch (error) {
            const err = error as any;
            res.status(500).json({ message: 'Error fetching races', error: err.message });
        }
    }

    static async getRaceById(req: Request, res: Response): Promise<void> {
        try {
            const race = await raceService.getRaceById(parseInt(req.params.id));
            if (!race) {
                res.status(404).json({ message: 'Race not found' });
                return;
            }
            res.status(200).json(race);
        } catch (error) {
            const err = error as any;
            res.status(500).json({ message: 'Error fetching race', error: err.message });
        }
    }

    static async createRace(req: Request, res: Response): Promise<void> {
        try {
            const newRace = await raceService.createRace(req.body);
            res.status(201).json(newRace);
        } catch (error) {
            const err = error as any;
            res.status(400).json({ message: 'Error creating race', error: err.message });
        }
    }

    static async updateRace(req: Request, res: Response): Promise<void> {
        try {
            const updatedRace = await raceService.updateRace(parseInt(req.params.id), req.body);
            if (!updatedRace) {
                res.status(404).json({ message: 'Race not found' });
                return;
            }
            res.status(200).json(updatedRace);
        } catch (error) {
            const err = error as any;
            res.status(400).json({ message: 'Error updating race', error: err.message });
        }
    }

    static async deleteRace(req: Request, res: Response): Promise<void> {
        try {
            await raceService.deleteRace(parseInt(req.params.id));
            res.status(204).send();
        } catch (error) {
            const err = error as any;
            res.status(404).json({ message: err.message });
        }
    }
}
