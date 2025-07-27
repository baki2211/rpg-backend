import validator from 'validator';

/**
 * Input validation and sanitization utilities
 * Provides defense against XSS, SQL injection, and other common attacks
 */
export class InputValidator {
    
    /**
     * Sanitize string input to prevent XSS attacks
     * @param {string} input - Input string to sanitize
     * @param {object} options - Sanitization options
     * @returns {string} Sanitized string
     */
    static sanitizeString(input, options = {}) {
        if (typeof input !== 'string') {
            throw new Error('Input must be a string');
        }

        const defaults = {
            maxLength: 1000,
            allowHtml: false,
            trim: true
        };
        
        const opts = { ...defaults, ...options };
        
        let sanitized = input;
        
        // Trim whitespace if requested
        if (opts.trim) {
            sanitized = sanitized.trim();
        }
        
        // Check length
        if (sanitized.length > opts.maxLength) {
            throw new Error(`Input exceeds maximum length of ${opts.maxLength} characters`);
        }
        
        // HTML sanitization and XSS protection
        if (!opts.allowHtml) {
            // Strip HTML tags using regex and escape HTML entities
            sanitized = sanitized.replace(/<[^>]*>/g, ''); // Remove HTML tags
            sanitized = validator.escape(sanitized); // Escape HTML entities
        } else {
            // For limited HTML, we'll still escape everything for security
            sanitized = validator.escape(sanitized);
        }
        
        return sanitized;
    }

    /**
     * Validate and sanitize integer input
     * @param {any} input - Input to validate as integer
     * @param {object} options - Validation options
     * @returns {number} Validated integer
     */
    static validateInteger(input, options = {}) {
        const defaults = {
            min: Number.MIN_SAFE_INTEGER,
            max: Number.MAX_SAFE_INTEGER,
            required: true
        };
        
        const opts = { ...defaults, ...options };
        
        // Handle null/undefined
        if (input == null) {
            if (opts.required) {
                throw new Error('Integer value is required');
            }
            return null;
        }
        
        // Convert to number
        const num = Number(input);
        
        // Validate it's an integer
        if (!Number.isInteger(num)) {
            throw new Error('Value must be a valid integer');
        }
        
        // Check bounds
        if (num < opts.min) {
            throw new Error(`Value must be at least ${opts.min}`);
        }
        
        if (num > opts.max) {
            throw new Error(`Value must be at most ${opts.max}`);
        }
        
        return num;
    }

    /**
     * Validate character name input
     * @param {string} name - Character name to validate
     * @returns {string} Validated and sanitized name
     */
    static validateCharacterName(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Character name is required');
        }
        
        const sanitized = this.sanitizeString(name, { 
            maxLength: 50,
            allowHtml: false 
        });
        
        // Additional character name rules
        if (sanitized.length < 2) {
            throw new Error('Character name must be at least 2 characters long');
        }
        
        // Only allow letters, numbers, spaces, apostrophes, and hyphens
        if (!/^[a-zA-Z0-9\s'\-]+$/.test(sanitized)) {
            throw new Error('Character name contains invalid characters');
        }
        
        return sanitized;
    }

    /**
     * Validate user ID parameter
     * @param {any} userId - User ID to validate
     * @returns {number} Validated user ID
     */
    static validateUserId(userId) {
        return this.validateInteger(userId, {
            min: 1,
            max: 2147483647, // PostgreSQL INTEGER max
            required: true
        });
    }

    /**
     * Validate character ID parameter  
     * @param {any} characterId - Character ID to validate
     * @returns {number} Validated character ID
     */
    static validateCharacterId(characterId) {
        return this.validateInteger(characterId, {
            min: 1,
            max: 2147483647,
            required: true
        });
    }

    /**
     * Validate skill ID parameter
     * @param {any} skillId - Skill ID to validate  
     * @returns {number} Validated skill ID
     */
    static validateSkillId(skillId) {
        return this.validateInteger(skillId, {
            min: 1,
            max: 2147483647,
            required: true
        });
    }

    /**
     * Validate round ID parameter
     * @param {any} roundId - Round ID to validate
     * @returns {number} Validated round ID
     */
    static validateRoundId(roundId) {
        return this.validateInteger(roundId, {
            min: 1,
            max: 2147483647,
            required: true
        });
    }

    /**
     * Validate location ID parameter
     * @param {any} locationId - Location ID to validate
     * @returns {number} Validated location ID
     */
    static validateLocationId(locationId) {
        return this.validateInteger(locationId, {
            min: 1,
            max: 2147483647,
            required: true
        });
    }

    /**
     * Validate chat message content
     * @param {string} message - Message content to validate
     * @returns {string} Validated and sanitized message
     */
    static validateChatMessage(message) {
        if (!message || typeof message !== 'string') {
            throw new Error('Message content is required');
        }
        
        const sanitized = this.sanitizeString(message, {
            maxLength: 500,
            allowHtml: false
        });
        
        if (sanitized.length === 0) {
            throw new Error('Message cannot be empty');
        }
        
        return sanitized;
    }

    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {string} Validated email
     */
    static validateEmail(email) {
        if (!email || typeof email !== 'string') {
            throw new Error('Email is required');
        }
        
        const sanitized = this.sanitizeString(email, {
            maxLength: 254, // RFC 5321 limit
            allowHtml: false
        });
        
        if (!validator.isEmail(sanitized)) {
            throw new Error('Invalid email format');
        }
        
        return sanitized.toLowerCase();
    }

    /**
     * Validate object with multiple fields
     * @param {object} obj - Object to validate
     * @param {object} schema - Validation schema
     * @returns {object} Validated object
     */
    static validateObject(obj, schema) {
        if (!obj || typeof obj !== 'object') {
            throw new Error('Input must be an object');
        }
        
        const validated = {};
        
        for (const [field, rules] of Object.entries(schema)) {
            const value = obj[field];
            
            try {
                if (rules.required && (value === undefined || value === null)) {
                    throw new Error(`${field} is required`);
                }
                
                if (value !== undefined && value !== null) {
                    if (rules.type === 'string') {
                        validated[field] = this.sanitizeString(value, rules.options || {});
                    } else if (rules.type === 'integer') {
                        validated[field] = this.validateInteger(value, rules.options || {});
                    } else if (rules.type === 'email') {
                        validated[field] = this.validateEmail(value);
                    } else if (rules.type === 'characterName') {
                        validated[field] = this.validateCharacterName(value);
                    } else if (rules.validator) {
                        validated[field] = rules.validator(value);
                    } else {
                        validated[field] = value; // Pass through if no specific validation
                    }
                }
            } catch (error) {
                throw new Error(`Validation error for field '${field}': ${error.message}`);
            }
        }
        
        return validated;
    }

    /**
     * Validate combat action input
     * @param {object} actionData - Combat action data
     * @returns {object} Validated action data
     */
    static validateCombatAction(actionData) {
        return this.validateObject(actionData, {
            roundId: { type: 'integer', required: true, options: { min: 1 } },
            characterId: { type: 'integer', required: true, options: { min: 1 } },
            skillId: { type: 'integer', required: true, options: { min: 1 } },
            targetId: { type: 'integer', required: false, options: { min: 1 } }
        });
    }

    /**
     * Validate character creation data
     * @param {object} characterData - Character creation data
     * @returns {object} Validated character data
     */
    static validateCharacterCreation(characterData) {
        // Handle both raceId and race formats
        const processedData = { ...characterData };
        
        if (characterData.raceId && !characterData.race) {
            processedData.race = { id: characterData.raceId };
            delete processedData.raceId;
        }
        
        // Parse stats if it's a JSON string
        if (typeof characterData.stats === 'string') {
            try {
                processedData.stats = JSON.parse(characterData.stats);
            } catch (error) {
                throw new Error('Invalid stats format');
            }
        }
        
        return this.validateObject(processedData, {
            name: { type: 'characterName', required: true },
            surname: { type: 'string', required: false, options: { maxLength: 50 } },
            background: { type: 'string', required: false, options: { maxLength: 1000 } },
            age: { type: 'string', required: false },
            gender: { type: 'string', required: false },
            race: { 
                validator: (value) => {
                    if (!value || typeof value !== 'object') {
                        throw new Error('Race is required');
                    }
                    if (!value.id || !Number.isInteger(Number(value.id))) {
                        throw new Error('Race ID is required');
                    }
                    return { id: this.validateInteger(value.id, { min: 1 }) };
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
                        validatedStats[stat] = this.validateInteger(statValue, { 
                            min: 0, 
                            max: 100 
                        });
                    }
                    return validatedStats;
                },
                required: false
            }
        });
    }
}