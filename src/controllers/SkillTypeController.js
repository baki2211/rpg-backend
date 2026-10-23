import { SkillTypeService } from '../services/SkillTypeService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';

export const SkillTypeController = {
    getAllSkillTypes: asyncHandler(async (req, res) => {
        res.json(await SkillTypeService.getAllSkillTypes());
    }),

    getSkillTypeById: asyncHandler(async (req, res) => {
        res.json(await SkillTypeService.getSkillTypeById(InputValidator.validateId(req.params.id)));
    }),

    createSkillType: asyncHandler(async (req, res) => {
        res.status(201).json(await SkillTypeService.createSkillType(req.body));
    }),

    updateSkillType: asyncHandler(async (req, res) => {
        res.json(await SkillTypeService.updateSkillType(InputValidator.validateId(req.params.id), req.body));
    }),

    deleteSkillType: asyncHandler(async (req, res) => {
        await SkillTypeService.deleteSkillType(InputValidator.validateId(req.params.id));
        res.status(204).end();
    }),
};
