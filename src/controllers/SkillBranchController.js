import { SkillBranchService } from '../services/SkillBranchService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const SkillBranchController = {
    getAllSkillBranches: asyncHandler(async (req, res) => {
        res.json(await SkillBranchService.getAllSkillBranches());
    }),

    getSkillBranchById: asyncHandler(async (req, res) => {
        res.json(await SkillBranchService.getSkillBranchById(req.params.id));
    }),

    createSkillBranch: asyncHandler(async (req, res) => {
        res.status(201).json(await SkillBranchService.createSkillBranch(req.body));
    }),

    updateSkillBranch: asyncHandler(async (req, res) => {
        res.json(await SkillBranchService.updateSkillBranch(req.params.id, req.body));
    }),

    deleteSkillBranch: asyncHandler(async (req, res) => {
        await SkillBranchService.deleteSkillBranch(req.params.id);
        res.status(204).end();
    }),
};
