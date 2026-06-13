import { RankService } from '../services/RankService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const rankService = new RankService();

export class RankController {
    static getAllRanks = asyncHandler(async (req, res) => {
        res.json(await rankService.getAllRanks());
    });

    static createRank = asyncHandler(async (req, res) => {
        res.json(await rankService.createRank(req.body));
    });

    static updateRank = asyncHandler(async (req, res) => {
        const { level } = req.params;
        res.json(await rankService.updateRank({ ...req.body, level: parseInt(level) }));
    });

    static deleteRank = asyncHandler(async (req, res) => {
        const { level } = req.params;
        await rankService.deleteRank(parseInt(level));
        res.json({ success: true });
    });
}
