import { AppDataSource } from '../data-source.js';
import { Rank } from '../models/rankModel.js';

export class RankService {
  constructor() {
    this.rankRepository = AppDataSource.getRepository(Rank);
  }

  async getAllRanks() {
    return this.rankRepository.find({ order: { level: 'ASC' }});
  }

  async getRank(level) {
    return this.rankRepository.findOne({ where: { level }});
  }

  async createRank(data) {
    return this.rankRepository.save(this.rankRepository.create(data));
  }

  async updateRank(data) {
    const existing = await this.getRank(data.level);
    if (existing) {
      await this.rankRepository.update({ level: data.level }, data);
      return this.getRank(data.level);
    }
    return this.rankRepository.save(this.rankRepository.create(data));
  }

  async deleteRank(level) {
    return this.rankRepository.delete({ level });
  }

  async getNextRank(currentLevel) {
    return this.rankRepository.findOne({ where: { level: currentLevel + 1 }});
  }

  async createOrUpdateRank(data) {
    const existing = await this.getRank(data.level);
    if (existing) {
      return this.updateRank(data);
    }
    return this.createRank(data);
  }
} 