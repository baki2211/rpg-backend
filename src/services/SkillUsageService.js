import { CharacterSkill } from '../models/characterSkillModel.js';
import { CharacterSkillBranch } from '../models/characterSkillBranchModel.js';
import staticDataCache from '../utils/staticDataCache.js';
import { skillRankFor, branchRankFor } from '../domain/skills/ranks.js';
import { inCharacterLockOrder } from '../utils/rowLocks.js';

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

        // Increment branch usage. The row is created on the first use of the branch. ON CONFLICT DO NOTHING
        // makes that insert safe when two first uses race (the loser waits, then counts on the winner's row),
        // and it only runs when the lookup misses, so later uses don't spend a statement and a serial id on it
        const findLockedBranch = () => characterSkillBranchRepo.findOne({
            where: { characterId, branchId },
            lock: { mode: 'pessimistic_write' }
        });

        let characterSkillBranch = await findLockedBranch();
        if (!characterSkillBranch) {
            await manager.createQueryBuilder()
                .insert()
                .into(CharacterSkillBranch)
                .values({ characterId, branchId, uses: 0, rank: branchRankFor(0, branchRanks).rank })
                .orIgnore()
                .execute();
            characterSkillBranch = await findLockedBranch();
        }
        characterSkillBranch.uses += 1;
        // Update rank based on uses
        characterSkillBranch.rank = branchRankFor(characterSkillBranch.uses, branchRanks).rank;
        await characterSkillBranchRepo.save(characterSkillBranch);

        return { skillUses: characterSkill?.uses || 0, branchUses: characterSkillBranch.uses };
    }

    /**
     * Count one use for each side of an encounter, in the app's lock order (ascending character id),
     * so two encounters over the same characters never lock usage rows in opposite orders.
     * @param {Array<{ characterId: number, skillId: number, branchId: number }>} uses
     * @param {EntityManager} manager - The caller's transaction
     */
    static async incrementSkillUsages(uses, manager) {
        for (const { characterId, skillId, branchId } of inCharacterLockOrder(uses)) {
            await SkillUsageService.incrementSkillUsage(characterId, skillId, branchId, manager);
        }
    }
}
