import { RankService } from '../services/RankService.js';

export class RankController {
  constructor() {
    this.rankService = new RankService();
  }

  async getAllRanks(req, res) {
    try {
      const ranks = await this.rankService.getAllRanks();
      res.json(ranks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async createRank(req, res) {
    try {
      if (!['admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const rank = await this.rankService.createRank(req.body);
      res.json(rank);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async updateRank(req, res) {
    try {
      if (!['admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { level } = req.params;
      const rank = await this.rankService.updateRank({ ...req.body, level: parseInt(level) });
      res.json(rank);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async deleteRank(req, res) {
    try {
      if (!['admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { level } = req.params;
      await this.rankService.deleteRank(parseInt(level));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
} 