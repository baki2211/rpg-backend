import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import protectedRoutes from './routes/protected.js';
import mapRoutes from './routes/map.js';
import locationRoutes from './routes/location.js';
import chatRoutes from './routes/chat.js';
import raceRoutes from './routes/race.js';
import characterRoutes from './routes/character.js';
import skillRoutes from './routes/skill.js';
import skillBranchRoutes from './routes/skillBranch.js';
import skillTypeRoutes from './routes/skillType.js';
import sessionRoutes from './routes/session.js';
import characterSkillsRoutes from './routes/characterSkills.js';
import pvpRoutes from './routes/pvpRoutes.js';
import combatRoutes from './routes/combat.js';
import eventRoutes from './routes/event.js';
import engineLogRoutes from './routes/engineLogs.js';
import statDefinitionRoutes from './routes/statDefinition.js';
import combatConstantRoutes from './routes/combatConstant.js';
import masteryTierRoutes from './routes/masteryTier.js';
import skillValidationRuleRoutes from './routes/skillValidationRule.js';
import rankRoutes from './routes/rank.js';
import wikiRoutes from './routes/wikiRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import presenceRoutes from './routes/presenceRoutes.js';

import { errorHandler } from './middleware/errorHandler.js';
import { compressionMiddleware, compressionStatsMiddleware } from './middleware/compressionMiddleware.js';
import { queryMonitoringMiddleware, queryStatsHandler, resetQueryStatsHandler } from './middleware/queryMonitoringMiddleware.js';
import { RateLimitMiddleware } from './middleware/rateLimitMiddleware.js';
import { verifyCsrfToken } from './middleware/csrfMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'https://arcanerealms.org'];

function resolveCorsOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (!raw) return DEFAULT_CORS_ORIGINS;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : DEFAULT_CORS_ORIGINS;
}

export function createApp() {
  const app = express();

  app.use(cors({
    origin: resolveCorsOrigins(),
    credentials: true,
  }));

  app.use(compressionMiddleware);
  app.use(compressionStatsMiddleware);
  app.use(queryMonitoringMiddleware);

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Express 5 leaves req.body as undefined when no body parser matched (e.g.
  // missing/mismatched Content-Type). Restore the Express 4 default so the many
  // `const { x } = req.body` destructures across the codebase don't throw.
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });

  app.use('/api', RateLimitMiddleware.generalApiLimit);

  // CSRF: double-submit cookie verification on state-changing /api routes.
  // Bootstrap routes (login/register) are exempt — see csrfMiddleware.js.
  app.use('/api', verifyCsrfToken);

  app.use('/api', healthRoutes);

  app.get('/api/admin/query-stats', queryStatsHandler);
  app.post('/api/admin/query-stats/reset', resetQueryStatsHandler);
  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/protected', protectedRoutes);
  app.use('/api/maps', mapRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/races', raceRoutes);
  app.use('/api/characters', characterRoutes);
  app.use('/api/character-skills', characterSkillsRoutes);
  app.use('/api/skills', skillRoutes);
  app.use('/api/skill-branches', skillBranchRoutes);
  app.use('/api/skill-types', skillTypeRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/pvp', pvpRoutes);
  app.use('/api/combat', combatRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/engine-logs', engineLogRoutes);
  app.use('/api/stat-definitions', statDefinitionRoutes);
  app.use('/api/combat-constants', combatConstantRoutes);
  app.use('/api/mastery-tiers', masteryTierRoutes);
  app.use('/api/skill-validation-rules', skillValidationRuleRoutes);
  app.use('/api/ranks', rankRoutes);
  app.use('/api/wiki', wikiRoutes);
  app.use('/api/presence', presenceRoutes);

  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  app.use(errorHandler);

  return app;
}
