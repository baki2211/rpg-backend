import { CharacterSkill } from '../models/characterSkillModel.js';
import { CharacterSkillBranch } from '../models/characterSkillBranchModel.js';
import staticDataCache from '../utils/staticDataCache.js';
import { skillRankFor, branchRankFor } from '../domain/skills/ranks.js';

export class SkillUsageService {
    
    /**
     * Increment skill usage and branch usage for a character
     * @param {number} characterId - The character ID
     * @param {number} skillId - The skill ID
     * @param {number} branchId - The branch ID
     * @param {EntityManager} manager - The caller's transaction: usage is counted in the same commit as the use
     */
    static async incrementSkillUsage(characterId, skillId, branchId, manager) {
        // Rank ladders: DB rows with code defaults (src/domain/skills/rules.js)
        const { skillRanks, branchRanks } = await staticDataCache.getSkillRules();

        const characterSkillRepo = manager.getRepository(CharacterSkill);
        const characterSkillBranchRepo = manager.getRepository(CharacterSkillBranch);

        // Increment skill usage (row locked: concurrent uses must not overwrite each other's count)
        let characterSkill = await characterSkillRepo.findOne({
            where: { characterId, skillId },
            lock: { mode: 'pessimistic_write' }
        });

        if (characterSkill) {
            characterSkill.uses += 1;
            // Update rank based on uses
            characterSkill.rank = skillRankFor(characterSkill.uses, skillRanks).rank;
            await characterSkillRepo.save(characterSkill);
        }

        // Increment branch usage
        let characterSkillBranch = await characterSkillBranchRepo.findOne({
            where: { characterId, branchId },
            lock: { mode: 'pessimistic_write' }
        });

        if (characterSkillBranch) {
            characterSkillBranch.uses += 1;
            // Update rank based on uses
            characterSkillBranch.rank = branchRankFor(characterSkillBranch.uses, branchRanks).rank;
            await characterSkillBranchRepo.save(characterSkillBranch);
        } else {
            // Create new branch tracking entry
            characterSkillBranch = characterSkillBranchRepo.create({
                characterId,
                branchId,
                uses: 1,
                rank: branchRankFor(1, branchRanks).rank
            });
            await characterSkillBranchRepo.save(characterSkillBranch);
        }

        return { skillUses: characterSkill?.uses || 0, branchUses: characterSkillBranch.uses };
    }
} 