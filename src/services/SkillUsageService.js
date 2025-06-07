import { AppDataSource } from '../data-source.js';
import { CharacterSkill } from '../models/characterSkillModel.js';
import { CharacterSkillBranch } from '../models/characterSkillBranchModel.js';

export class SkillUsageService {
    
    /**
     * Increment skill usage and branch usage for a character
     * @param {number} characterId - The character ID
     * @param {number} skillId - The skill ID
     * @param {number} branchId - The branch ID
     */
    static async incrementSkillUsage(characterId, skillId, branchId) {
        return await AppDataSource.transaction(async (transactionalEntityManager) => {
            const characterSkillRepo = transactionalEntityManager.getRepository(CharacterSkill);
            const characterSkillBranchRepo = transactionalEntityManager.getRepository(CharacterSkillBranch);

            // Increment skill usage
            let characterSkill = await characterSkillRepo.findOne({
                where: { characterId, skillId }
            });

            if (characterSkill) {
                characterSkill.uses += 1;
                // Update rank based on uses
                characterSkill.rank = this.calculateSkillRank(characterSkill.uses);
                await characterSkillRepo.save(characterSkill);
            }

            // Increment branch usage
            let characterSkillBranch = await characterSkillBranchRepo.findOne({
                where: { characterId, branchId }
            });

            if (characterSkillBranch) {
                characterSkillBranch.uses += 1;
                // Update rank based on uses
                characterSkillBranch.rank = this.calculateBranchRank(characterSkillBranch.uses);
                await characterSkillBranchRepo.save(characterSkillBranch);
            } else {
                // Create new branch tracking entry
                characterSkillBranch = characterSkillBranchRepo.create({
                    characterId,
                    branchId,
                    uses: 1,
                    rank: 1
                });
                await characterSkillBranchRepo.save(characterSkillBranch);
            }

            return { skillUses: characterSkill?.uses || 0, branchUses: characterSkillBranch.uses };
        });
    }

    /**
     * Calculate skill rank based on uses
     * @param {number} uses - Number of uses
     * @returns {number} The skill rank (1-5)
     */
    static calculateSkillRank(uses) {
        if (uses < 20) return 1;    // Rank I
        if (uses < 35) return 2;    // Rank II
        if (uses < 60) return 3;    // Rank III
        if (uses < 100) return 4;   // Rank IV
        return 5;                   // Rank V
    }

    /**
     * Calculate branch rank based on uses
     * @param {number} uses - Number of uses
     * @returns {number} The branch rank (1-10)
     */
    static calculateBranchRank(uses) {
        if (uses < 75) return 1;      // Rank I
        if (uses < 150) return 2;     // Rank II
        if (uses < 250) return 3;     // Rank III
        if (uses < 375) return 4;     // Rank IV
        if (uses < 525) return 5;     // Rank V
        if (uses < 700) return 6;     // Rank VI
        if (uses < 900) return 7;     // Rank VII
        if (uses < 1125) return 8;    // Rank VIII
        if (uses < 1375) return 9;    // Rank IX
        return 10;                    // Rank X
    }

    /**
     * Get skill and branch information for a character
     * @param {number} characterId - The character ID
     * @param {number} skillId - The skill ID
     * @param {number} branchId - The branch ID
     * @returns {Promise<Object>} Skill and branch usage info
     */
    static async getSkillUsageInfo(characterId, skillId, branchId) {
        const characterSkillRepo = AppDataSource.getRepository(CharacterSkill);
        const characterSkillBranchRepo = AppDataSource.getRepository(CharacterSkillBranch);

        const [characterSkill, characterSkillBranch] = await Promise.all([
            characterSkillRepo.findOne({ where: { characterId, skillId } }),
            characterSkillBranchRepo.findOne({ where: { characterId, branchId } })
        ]);

        return {
            skillUses: characterSkill?.uses || 0,
            skillRank: characterSkill?.rank || 1,
            branchUses: characterSkillBranch?.uses || 0,
            branchRank: characterSkillBranch?.rank || 1
        };
    }
} 