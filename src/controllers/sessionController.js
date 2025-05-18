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
      console.error('Error in createSession:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getSession(req, res) {
    try {
      const session = await this.sessionService.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      console.error('Error in getSession:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getSessionByLocation(req, res) {
    try {
      const session = await this.sessionService.getSessionByLocation(req.params.locationId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      console.error('Error in getSessionByLocation:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async addParticipant(req, res) {
    try {
      const { characterId } = req.body;
      const participant = await this.sessionService.addParticipant(req.params.sessionId, characterId);
      res.json(participant);
    } catch (error) {
      console.error('Error in addParticipant:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async removeParticipant(req, res) {
    try {
      await this.sessionService.removeParticipant(req.params.sessionId, req.params.characterId);
      res.status(204).send();
    } catch (error) {
      console.error('Error in removeParticipant:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getParticipants(req, res) {
    try {
      const participants = await this.sessionService.getParticipants(req.params.sessionId);
      res.json(participants);
    } catch (error) {
      console.error('Error in getParticipants:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getAllSessions(req, res) {
    try {
      console.log('Getting all sessions');
      const sessions = await this.sessionService.getAllSessions();
      console.log(`Found ${sessions.length} sessions`);
      res.json(sessions);
    } catch (error) {
      console.error('Error in getAllSessions:', error);
      res.status(500).json({ error: error.message });
    }
  }
}