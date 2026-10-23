import { RankService } from '../services/RankService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';

const rankService = new RankService();

export class RankController {
    static getAllRanks = asyncHandler(async (req, res) => {
        res.json(await rankService.getAllRanks());
    });

    static createRank = asyncHandler(async (req, res) => {
        res.json(await rankService.createRank(req.body));
    });

    static updateRank = asyncHandler(async (req, res) => {
        const level = InputValidator.validateId(req.params.level);
        res.json(await rankService.updateRank({ ...req.body, level }));
    });

    static deleteRank = asyncHandler(async (req, res) => {
        const level = InputValidator.validateId(req.params.level);
        await rankService.deleteRank(level);
        res.json({ success: true });
    });
}
