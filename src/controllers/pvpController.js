import { PvPResolutionService } from '../services/PvPResolutionService.js';
import { CharacterService } from '../services/CharacterService.js';
import { AppDataSource } from '../data-source.js';
import { Skill } from '../models/skillModel.js';

export class PvPController {
    constructor() {
        this.characterService = new CharacterService();
        this.skillRepository = AppDataSource.getRepository(Skill);
    }

    /**
     * Resolve a PvP encounter between two characters
     */
    async resolvePvPEncounter(req, res) {
        try {
            const { attackerId, attackerSkillId, defenderId, defenderSkillId } = req.body;

            // Validate input
            if (!attackerId || !attackerSkillId || !defenderId || !defenderSkillId) {
                return res.status(400).json({ 
                    error: 'Missing required fields: attackerId, attackerSkillId, defenderId, defenderSkillId' 
                });
            }

            // Get both characters
            const [attacker, defender] = await Promise.all([
                this.characterService.characterRepository.findOne({
                    where: { id: attackerId },
                    relations: ['skills', 'race']
                }),
                this.characterService.characterRepository.findOne({
                    where: { id: defenderId },
                    relations: ['skills', 'race']
                })
            ]);

            if (!attacker) {
                return res.status(404).json({ error: 'Attacker character not found' });
            }
            if (!defender) {
                return res.status(404).json({ error: 'Defender character not found' });
            }

            // Get both skills with full relations
            const [attackerSkill, defenderSkill] = await Promise.all([
                this.skillRepository.findOne({
                    where: { id: attackerSkillId },
                    relations: ['branch', 'type']
                }),
                this.skillRepository.findOne({
                    where: { id: defenderSkillId },
                    relations: ['branch', 'type']
                })
            ]);

            if (!attackerSkill) {
                return res.status(404).json({ error: 'Attacker skill not found' });
            }
            if (!defenderSkill) {
                return res.status(404).json({ error: 'Defender skill not found' });
            }

            // Verify characters have the skills
            const attackerHasSkill = attacker.skills?.some(skill => skill.id === attackerSkillId);
            const defenderHasSkill = defender.skills?.some(skill => skill.id === defenderSkillId);

            if (!attackerHasSkill) {
                return res.status(400).json({ error: 'Attacker does not have the specified skill' });
            }
            if (!defenderHasSkill) {
                return res.status(400).json({ error: 'Defender does not have the specified skill' });
            }

            // Resolve the PvP encounter
            const result = await PvPResolutionService.resolvePvPEncounter(
                attacker,
                attackerSkill,
                defender,
                defenderSkill
            );

            return res.status(200).json({
                success: true,
                result: result
            });

        } catch (error) {
            console.error('Error resolving PvP encounter:', error);
            return res.status(500).json({ 
                error: 'Internal server error', 
                message: error.message 
            });
        }
    }

    /**
     * Get available skills for PvP for a character
     */
    async getCharacterPvPSkills(req, res) {
        try {
            const { characterId } = req.params;
            const userId = req.user.id;

            const character = await this.characterService.getCharacterById(characterId, userId);
            if (!character) {
                return res.status(404).json({ error: 'Character not found' });
            }

            // Filter skills that can be used in PvP (target 'other' or 'none')
            const pvpSkills = character.skills?.filter(skill => 
                skill.target === 'other' || skill.target === 'none'
            ) || [];

            return res.status(200).json({
                success: true,
                skills: pvpSkills
            });

        } catch (error) {
            console.error('Error getting character PvP skills:', error);
            return res.status(500).json({ 
                error: 'Internal server error', 
                message: error.message 
            });
        }
    }

    /**
     * Simulate a skill output without actually using it
     */
    async simulateSkillOutput(req, res) {
        try {
            const { characterId, skillId } = req.body;
            const userId = req.user.id;

            const character = await this.characterService.getCharacterById(characterId, userId);
            if (!character) {
                return res.status(404).json({ error: 'Character not found' });
            }

            const skill = await this.skillRepository.findOne({
                where: { id: skillId },
                relations: ['branch', 'type']
            });

            if (!skill) {
                return res.status(404).json({ error: 'Skill not found' });
            }

            // Verify character has the skill
            const hasSkill = character.skills?.some(s => s.id === skillId);
            if (!hasSkill) {
                return res.status(400).json({ error: 'Character does not have this skill' });
            }

            // Calculate output without incrementing usage
            const skillEngine = new (await import('../services/SkillEngine.js')).SkillEngine(character, skill);
            const output = await skillEngine.computeFinalOutput();

            return res.status(200).json({
                success: true,
                simulation: {
                    character: character.name,
                    skill: skill.name,
                    estimatedOutput: output,
                    skillType: skill.type?.name,
                    target: skill.target
                }
            });

        } catch (error) {
            console.error('Error simulating skill output:', error);
            return res.status(500).json({ 
                error: 'Internal server error', 
                message: error.message 
            });
        }
    }
} 