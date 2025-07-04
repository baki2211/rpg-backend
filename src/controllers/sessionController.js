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
      const sessions = await this.sessionService.getAllSessions();
      res.json(sessions);
    } catch (error) {
      console.error('Error in getAllSessions:', error);
      res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
  }

  async getLocationParticipants(req, res) {
    try {
      const { locationId } = req.params;
      const participants = await this.sessionService.getLocationParticipants(locationId);
      res.json(participants);
    } catch (error) {
      console.error('Error in getLocationParticipants:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateSessionStatus(req, res) {
    try {
      const { sessionId } = req.params;
      const { status } = req.body;
      
      if (!['open', 'closed', 'frozen'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be open, closed, or frozen' });
      }
      
      const session = await this.sessionService.updateSessionStatus(sessionId, status);
      res.json(session);
    } catch (error) {
      console.error('Error in updateSessionStatus:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateSessionActive(req, res) {
    try {
      const { sessionId } = req.params;
      const { isActive } = req.body;
      
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
      }
      
      const session = await this.sessionService.updateSessionActive(sessionId, isActive);
      res.json(session);
    } catch (error) {
      console.error('Error in updateSessionActive:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getClosedSessions(req, res) {
    try {
      console.log('Getting closed sessions');
      const sessions = await this.sessionService.getClosedSessions();
      console.log(`Found ${sessions.length} closed sessions`);
      res.json(sessions);
    } catch (error) {
      console.error('Error in getClosedSessions:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all sessions for logging/admin purposes
   */
  async getAllSessionsForLogs(req, res) {
    try {
      // Verify user has admin/master permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

      const { limit } = req.query;
      const sessions = await this.sessionService.getAllSessionsForLogs(
        limit ? parseInt(limit) : 100
      );
      res.json(sessions);
    } catch (error) {
      console.error('Error in getAllSessionsForLogs:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Freeze a session
   */
  async freezeSession(req, res) {
    try {
      // Verify user has admin/master permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

      const { sessionId } = req.params;
      const session = await this.sessionService.freezeSession(sessionId);
      res.json(session);
    } catch (error) {
      console.error('Error in freezeSession:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Unfreeze a session
   */
  async unfreezeSession(req, res) {
    try {
      // Verify user has admin/master permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

      const { sessionId } = req.params;
      const session = await this.sessionService.unfreezeSession(sessionId);
      res.json(session);
    } catch (error) {
      console.error('Error in unfreezeSession:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Close a session
   */
  async closeSession(req, res) {
    try {
      // Verify user has admin/master permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

      const { sessionId } = req.params;
      const { reason } = req.body;
      const session = await this.sessionService.closeSession(sessionId, reason);
      res.json(session);
    } catch (error) {
      console.error('Error in closeSession:', error);
      res.status(500).json({ error: error.message });
    }
  }
}