import { SessionService } from '../services/SessionService.js';

export class SessionController {
  constructor() {
    this.sessionService = new SessionService();
  }

  async createSession(req, res) {
    try {
      const { name, locationId } = req.body;
      const session = await this.sessionService.createSession(name, locationId);
      res.json(session);
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  }

  async getSession(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await this.sessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }

  async getSessionByLocation(req, res) {
    try {
      const { locationId } = req.params;
      const session = await this.sessionService.getSessionByLocation(locationId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      console.error('Error getting session by location:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }

  async addParticipant(req, res) {
    try {
      const { sessionId } = req.params;
      const { characterId } = req.body;
      const participant = await this.sessionService.addParticipant(sessionId, characterId);
      res.json(participant);
    } catch (error) {
      console.error('Error adding participant:', error);
      res.status(500).json({ error: 'Failed to add participant' });
    }
  }

  async removeParticipant(req, res) {
    try {
      const { sessionId, characterId } = req.params;
      await this.sessionService.removeParticipant(sessionId, characterId);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing participant:', error);
      res.status(500).json({ error: 'Failed to remove participant' });
    }
  }

  async getParticipants(req, res) {
    try {
      const { sessionId } = req.params;
      const participants = await this.sessionService.getParticipants(sessionId);
      res.json(participants);
    } catch (error) {
      console.error('Error getting participants:', error);
      res.status(500).json({ error: 'Failed to get participants' });
    }
  }
} 