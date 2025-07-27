import { InputValidator } from '../utils/inputValidator.js';
import { logger } from '../utils/logger.js';
import { AuditLogger } from '../utils/auditLogger.js';

/**
 * Validation middleware factory for route-specific input validation
 */
export class ValidationMiddleware {
    
    /**
     * Create middleware to validate request parameters
     * @param {object} schema - Parameter validation schema
     * @returns {Function} Express middleware function
     */
    static validateParams(schema) {
        return (req, res, next) => {
            try {
                req.validatedParams = InputValidator.validateObject(req.params, schema);
                next();
            } catch (error) {
                logger.warn('Parameter validation failed', {
                    url: req.originalUrl,
                    method: req.method,
                    params: req.params,
                    error: error.message,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                });
                
                // Log security event for input validation failure
                AuditLogger.logSecurity(
                    AuditLogger.EventTypes.INPUT_VALIDATION_FAILED,
                    req.user?.id || null,
                    req,
                    {
                        validation_type: 'parameters',
                        failed_params: Object.keys(req.params),
                        error_message: error.message
                    },
                    AuditLogger.RiskLevels.LOW
                );
                
                return res.status(400).json({
                    error: 'Invalid request parameters',
                    details: error.message
                });
            }
        };
    }

    /**
     * Create middleware to validate request body
     * @param {object} schema - Body validation schema
     * @returns {Function} Express middleware function
     */
    static validateBody(schema) {
        return (req, res, next) => {
            try {
                req.validatedBody = InputValidator.validateObject(req.body, schema);
                next();
            } catch (error) {
                logger.warn('Body validation failed', {
                    url: req.originalUrl,
                    method: req.method,
                    error: error.message,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                });
                
                // Log security event for input validation failure
                AuditLogger.logSecurity(
                    AuditLogger.EventTypes.INPUT_VALIDATION_FAILED,
                    req.user?.id || null,
                    req,
                    {
                        validation_type: 'body',
                        body_size: JSON.stringify(req.body).length,
                        error_message: error.message
                    },
                    AuditLogger.RiskLevels.LOW
                );
                
                return res.status(400).json({
                    error: 'Invalid request data',
                    details: error.message
                });
            }
        };
    }

    /**
     * Create middleware to validate query parameters
     * @param {object} schema - Query validation schema
     * @returns {Function} Express middleware function
     */
    static validateQuery(schema) {
        return (req, res, next) => {
            try {
                req.validatedQuery = InputValidator.validateObject(req.query, schema);
                next();
            } catch (error) {
                logger.warn('Query validation failed', {
                    url: req.originalUrl,
                    method: req.method,
                    query: req.query,
                    error: error.message,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                });
                
                // Log security event for input validation failure
                AuditLogger.logSecurity(
                    AuditLogger.EventTypes.INPUT_VALIDATION_FAILED,
                    req.user?.id || null,
                    req,
                    {
                        validation_type: 'query',
                        failed_query_params: Object.keys(req.query),
                        error_message: error.message
                    },
                    AuditLogger.RiskLevels.LOW
                );
                
                return res.status(400).json({
                    error: 'Invalid query parameters',
                    details: error.message
                });
            }
        };
    }

    // Pre-defined common validation schemas
    static schemas = {
        // Common ID parameter validation
        idParam: {
            id: { type: 'integer', required: true, options: { min: 1 } }
        },

        // Character ID parameter validation
        characterIdParam: {
            characterId: { type: 'integer', required: true, options: { min: 1 } }
        },

        // User ID parameter validation
        userIdParam: {
            userId: { type: 'integer', required: true, options: { min: 1 } }
        },

        // Combat action body validation
        combatActionBody: {
            skillId: { type: 'integer', required: true, options: { min: 1 } },
            targetId: { type: 'integer', required: false, options: { min: 1 } }
        },

        // Character creation body validation
        characterCreationBody: {
            name: { type: 'characterName', required: true },
            surname: { type: 'string', required: false, options: { maxLength: 50 } },
            background: { type: 'string', required: false, options: { maxLength: 1000 } },
            race: { 
                validator: (value) => {
                    if (!value || typeof value !== 'object') {
                        throw new Error('Race is required');
                    }
                    if (!value.id || !Number.isInteger(Number(value.id))) {
                        throw new Error('Race ID is required');
                    }
                    return { id: InputValidator.validateInteger(value.id, { min: 1 }) };
                },
                required: true
            },
            stats: {
                validator: (value) => {
                    if (!value || typeof value !== 'object') {
                        return {};
                    }
                    // Validate each stat value
                    const validatedStats = {};
                    for (const [stat, statValue] of Object.entries(value)) {
                        // Only allow known stat names (basic protection)
                        if (!/^[a-z]{2,10}$/.test(stat)) {
                            throw new Error(`Invalid stat name: ${stat}`);
                        }
                        validatedStats[stat] = InputValidator.validateInteger(statValue, { 
                            min: 0, 
                            max: 100 
                        });
                    }
                    return validatedStats;
                },
                required: false
            }
        },

        // Chat message body validation
        chatMessageBody: {
            message: { 
                validator: (value) => InputValidator.validateChatMessage(value),
                required: true
            },
            locationId: { type: 'integer', required: true, options: { min: 1 } }
        },

        // User registration body validation
        userRegistrationBody: {
            username: { type: 'string', required: true, options: { maxLength: 30, minLength: 3 } },
            email: { type: 'email', required: true },
            password: { 
                validator: (value) => {
                    if (!value || typeof value !== 'string') {
                        throw new Error('Password is required');
                    }
                    if (value.length < 8) {
                        throw new Error('Password must be at least 8 characters long');
                    }
                    if (value.length > 128) {
                        throw new Error('Password is too long');
                    }
                    return value; // Don't sanitize passwords
                },
                required: true
            }
        }
    };

    // Pre-built middleware functions for common use cases
    static validateId = ValidationMiddleware.validateParams(ValidationMiddleware.schemas.idParam);
    static validateCharacterId = ValidationMiddleware.validateParams(ValidationMiddleware.schemas.characterIdParam);
    static validateUserId = ValidationMiddleware.validateParams(ValidationMiddleware.schemas.userIdParam);
    static validateCombatAction = ValidationMiddleware.validateBody(ValidationMiddleware.schemas.combatActionBody);
    static validateCharacterCreation = ValidationMiddleware.validateBody(ValidationMiddleware.schemas.characterCreationBody);
    static validateChatMessage = ValidationMiddleware.validateBody(ValidationMiddleware.schemas.chatMessageBody);
    static validateUserRegistration = ValidationMiddleware.validateBody(ValidationMiddleware.schemas.userRegistrationBody);
}

/**
 * Helper function to combine multiple validation middlewares
 * @param {...Function} middlewares - Validation middleware functions
 * @returns {Function[]} Array of middleware functions
 */
export function combineValidations(...middlewares) {
    return middlewares;
}