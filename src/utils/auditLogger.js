import { logger } from './logger.js';

/**
 * Comprehensive audit logging system for security and compliance
 * Tracks user actions, system events, and security-related activities
 */
export class AuditLogger {
    
    // Event types for structured logging
    static EventTypes = {
        // Authentication events
        LOGIN_SUCCESS: 'auth.login.success',
        LOGIN_FAILURE: 'auth.login.failure', 
        LOGOUT: 'auth.logout',
        TOKEN_REFRESH: 'auth.token.refresh',
        REGISTRATION: 'auth.registration',
        
        // Character management
        CHARACTER_CREATE: 'character.create',
        CHARACTER_DELETE: 'character.delete',
        CHARACTER_ACTIVATE: 'character.activate',
        CHARACTER_UPDATE: 'character.update',
        CHARACTER_STATS_UPDATE: 'character.stats.update',
        
        // Combat and skills
        COMBAT_ACTION: 'combat.action',
        COMBAT_ROUND_CREATE: 'combat.round.create',
        COMBAT_ROUND_RESOLVE: 'combat.round.resolve',
        SKILL_ACQUIRE: 'skill.acquire',
        SKILL_USE: 'skill.use',
        
        // Administrative actions
        ADMIN_USER_ACTION: 'admin.user.action',
        ADMIN_NPC_CREATE: 'admin.npc.create',
        ADMIN_NPC_UPDATE: 'admin.npc.update',
        ADMIN_NPC_DELETE: 'admin.npc.delete',
        ADMIN_SYSTEM_ACTION: 'admin.system.action',
        
        // Security events
        RATE_LIMIT_EXCEEDED: 'security.rate_limit.exceeded',
        INPUT_VALIDATION_FAILED: 'security.input.validation_failed',
        UNAUTHORIZED_ACCESS: 'security.access.unauthorized',
        PERMISSION_DENIED: 'security.permission.denied',
        
        // Data events
        DATA_ACCESS: 'data.access',
        DATA_MODIFICATION: 'data.modification',
        DATA_EXPORT: 'data.export',
        
        // System events
        SYSTEM_STARTUP: 'system.startup',
        SYSTEM_SHUTDOWN: 'system.shutdown',
        SYSTEM_ERROR: 'system.error',
        SYSTEM_MAINTENANCE: 'system.maintenance'
    };
    
    // Risk levels for events
    static RiskLevels = {
        LOW: 'low',
        MEDIUM: 'medium', 
        HIGH: 'high',
        CRITICAL: 'critical'
    };
    
    /**
     * Log an audit event with structured data
     * @param {string} eventType - Type of event from EventTypes
     * @param {object} options - Event options
     */
    static logEvent(eventType, options = {}) {
        const {
            userId = null,
            characterId = null,
            targetId = null,
            riskLevel = this.RiskLevels.LOW,
            details = {},
            metadata = {},
            req = null,
            success = true,
            error = null
        } = options;
        
        // Build audit log entry
        const auditEntry = {
            timestamp: new Date().toISOString(),
            event_type: eventType,
            risk_level: riskLevel,
            success,
            
            // User context
            user: {
                id: userId,
                character_id: characterId,
                target_id: targetId
            },
            
            // Request context (if available)
            request: req ? {
                ip: req.ip || req.connection?.remoteAddress,
                user_agent: req.get('User-Agent'),
                method: req.method,
                url: req.originalUrl,
                headers: {
                    referer: req.get('Referer'),
                    authorization: req.get('Authorization') ? '[REDACTED]' : null
                }
            } : null,
            
            // Event details
            details: {
                ...details,
                session_id: req?.sessionID || null
            },
            
            // Additional metadata
            metadata: {
                ...metadata,
                audit_version: '1.0',
                environment: process.env.NODE_ENV || 'development'
            },
            
            // Error information (if applicable)
            error: error ? {
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            } : null
        };
        
        // Log with appropriate level based on risk and success
        const logLevel = this.getLogLevel(riskLevel, success);
        logger[logLevel]('AUDIT', auditEntry);
        
        // Additional alert for high-risk events
        if (riskLevel === this.RiskLevels.CRITICAL || riskLevel === this.RiskLevels.HIGH) {
            this.alertHighRiskEvent(auditEntry);
        }
    }
    
    /**
     * Determine appropriate log level based on risk and success
     * @param {string} riskLevel - Risk level of the event
     * @param {boolean} success - Whether the event was successful
     * @returns {string} Log level
     */
    static getLogLevel(riskLevel, success) {
        if (!success) {
            if (riskLevel === this.RiskLevels.CRITICAL) return 'critical';
            if (riskLevel === this.RiskLevels.HIGH) return 'error';
            return 'warn';
        }
        
        switch (riskLevel) {
            case this.RiskLevels.CRITICAL:
                return 'error';
            case this.RiskLevels.HIGH:
                return 'warn';
            case this.RiskLevels.MEDIUM:
                return 'info';
            default:
                return 'info';
        }
    }
    
    /**
     * Send alert for high-risk events (could be extended to external systems)
     * @param {object} auditEntry - The audit log entry
     */
    static alertHighRiskEvent(auditEntry) {
        // For now, just log a special alert entry
        // In production, this could send to monitoring systems, email alerts, etc.
        logger.critical('HIGH_RISK_AUDIT_EVENT', {
            alert_type: 'security_audit',
            event_type: auditEntry.event_type,
            risk_level: auditEntry.risk_level,
            user_id: auditEntry.user.id,
            timestamp: auditEntry.timestamp,
            summary: `High-risk audit event: ${auditEntry.event_type}`
        });
    }
    
    // Convenience methods for common events
    
    /**
     * Log authentication events
     */
    static logAuth(eventType, userId, req, success = true, error = null, details = {}) {
        const riskLevel = success ? 
            this.RiskLevels.LOW : 
            (eventType === this.EventTypes.LOGIN_FAILURE ? this.RiskLevels.MEDIUM : this.RiskLevels.LOW);
            
        this.logEvent(eventType, {
            userId,
            req,
            success,
            error,
            riskLevel,
            details: {
                ...details,
                authentication_method: 'jwt'
            }
        });
    }
    
    /**
     * Log character management events
     */
    static logCharacter(eventType, userId, characterId, req, details = {}) {
        this.logEvent(eventType, {
            userId,
            characterId,
            req,
            riskLevel: this.RiskLevels.LOW,
            details
        });
    }
    
    /**
     * Log combat events
     */
    static logCombat(eventType, userId, characterId, req, details = {}) {
        this.logEvent(eventType, {
            userId,
            characterId,
            req,
            riskLevel: this.RiskLevels.LOW,
            details: {
                ...details,
                combat_system: 'v1'
            }
        });
    }
    
    /**
     * Log admin actions with high risk level
     */
    static logAdmin(eventType, userId, req, details = {}, targetId = null) {
        this.logEvent(eventType, {
            userId,
            targetId,
            req,
            riskLevel: this.RiskLevels.HIGH,
            details
        });
    }
    
    /**
     * Log security events with appropriate risk levels
     */
    static logSecurity(eventType, userId, req, details = {}, riskLevel = this.RiskLevels.MEDIUM) {
        this.logEvent(eventType, {
            userId,
            req,
            riskLevel,
            success: false, // Security events are typically failures
            details
        });
    }
    
    /**
     * Log data access events
     */
    static logDataAccess(userId, resourceType, resourceId, req, action = 'read', details = {}) {
        this.logEvent(this.EventTypes.DATA_ACCESS, {
            userId,
            req,
            riskLevel: this.RiskLevels.LOW,
            details: {
                ...details,
                resource_type: resourceType,
                resource_id: resourceId,
                action
            }
        });
    }
    
    /**
     * Log system events
     */
    static logSystem(eventType, details = {}, riskLevel = this.RiskLevels.LOW) {
        this.logEvent(eventType, {
            riskLevel,
            details: {
                ...details,
                pid: process.pid,
                memory_usage: process.memoryUsage(),
                uptime: process.uptime()
            }
        });
    }
    
    /**
     * Create audit middleware for Express routes
     * @param {string} eventType - Type of event to log
     * @param {object} options - Middleware options
     * @returns {Function} Express middleware
     */
    static createMiddleware(eventType, options = {}) {
        const {
            extractUserId = (req) => req.user?.id,
            extractCharacterId = (req) => req.params.id || req.params.characterId,
            extractDetails = (req) => ({}),
            riskLevel = this.RiskLevels.LOW,
            logOnSuccess = true,
            logOnError = true
        } = options;
        
        return (req, res, next) => {
            // Store original methods to intercept responses
            const originalJson = res.json;
            const originalStatus = res.status;
            let statusCode = 200;
            
            // Override status method to capture status code
            res.status = function(code) {
                statusCode = code;
                return originalStatus.call(this, code);
            };
            
            // Override json method to log after response
            res.json = function(data) {
                const success = statusCode >= 200 && statusCode < 400;
                
                // Only log if configured to do so
                if ((success && logOnSuccess) || (!success && logOnError)) {
                    try {
                        AuditLogger.logEvent(eventType, {
                            userId: extractUserId(req),
                            characterId: extractCharacterId(req),
                            req,
                            success,
                            riskLevel,
                            details: {
                                ...extractDetails(req),
                                response_status: statusCode,
                                response_size: JSON.stringify(data).length
                            }
                        });
                    } catch (auditError) {
                        // Don't let audit logging break the application
                        logger.error('Audit logging failed:', auditError);
                    }
                }
                
                return originalJson.call(this, data);
            };
            
            next();
        };
    }
}