import { RaceService } from '../services/RaceService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';

const raceService = new RaceService();

export class RaceController {
    static getAllRaces = asyncHandler(async (req, res) => {
        res.status(200).json(await raceService.getAllRaces());
    });

    static getPlayableRaces = asyncHandler(async (req, res) => {
        res.status(200).json(await raceService.getPlayableRaces());
    });

    static getRaceById = asyncHandler(async (req, res) => {
        res.status(200).json(await raceService.getRaceById(InputValidator.validateId(req.params.id)));
    });

    static createRace = asyncHandler(async (req, res) => {
        res.status(201).json(await raceService.createRace(req.body));
    });

    static updateRace = asyncHandler(async (req, res) => {
        res.status(200).json(await raceService.updateRace(InputValidator.validateId(req.params.id), req.body));
    });

    static deleteRace = asyncHandler(async (req, res) => {
        await raceService.deleteRace(InputValidator.validateId(req.params.id));
        res.status(204).end();
    });
}
