import { AppDataSource } from '../data-source.js';
import { SkillType } from '../models/skillTypeModel.js';
import { HttpError } from '../utils/HttpError.js';

const skillTypeRepository = AppDataSource.getRepository(SkillType);

export const SkillTypeService = {
    async getAllSkillTypes() {
        return await skillTypeRepository.find();
    },

    async getSkillTypeById(id) {
        const type = await skillTypeRepository.findOne({ where: { id } });
        if (!type) throw new HttpError(404, 'Skill type not found');
        return type;
    },

    async createSkillType(typeData) {
        const type = skillTypeRepository.create(typeData);
        return await skillTypeRepository.save(type);
    },

    async updateSkillType(id, typeData) {
        await skillTypeRepository.update(id, typeData);
        const type = await skillTypeRepository.findOne({ where: { id } });
        if (!type) throw new HttpError(404, 'Skill type not found');
        return type;
    },

    async deleteSkillType(id) {
        const type = await skillTypeRepository.findOne({ where: { id } });
        if (!type) throw new HttpError(404, 'Skill type not found');
        await skillTypeRepository.remove(type);
    },
};
