/**
 * Combat Round State Machine
 * Manages valid state transitions and prevents race conditions
 */

export class CombatStateMachine {
    static STATES = {
        ACTIVE: 'active',
        RESOLVING: 'resolving', 
        RESOLVED: 'resolved',
        CANCELLED: 'cancelled'
    };

    static VALID_TRANSITIONS = {
        'active': ['resolving', 'resolved', 'cancelled'], // Allow direct resolution
        'resolving': ['resolved', 'cancelled'],
        'resolved': [], // Terminal state
        'cancelled': [] // Terminal state
    };

    /**
     * Check if a state transition is valid
     * @param {string} fromState - Current state
     * @param {string} toState - Target state
     * @returns {boolean} True if transition is valid
     */
    static canTransition(fromState, toState) {
        const validTargets = this.VALID_TRANSITIONS[fromState] || [];
        return validTargets.includes(toState);
    }

    /**
     * Validate and perform state transition with database update
     * @param {object} roundRepo - Round repository (transactional)
     * @param {number} roundId - Round ID
     * @param {string} fromState - Expected current state
     * @param {string} toState - Target state
     * @param {object} additionalUpdates - Additional fields to update
     * @returns {Promise<boolean>} Success status
     */
    static async transition(roundRepo, roundId, fromState, toState, additionalUpdates = {}) {
        if (!this.canTransition(fromState, toState)) {
            throw new Error(`Invalid state transition from ${fromState} to ${toState}`);
        }

        // Atomic state update with optimistic locking
        const updateResult = await roundRepo.update(
            { 
                id: roundId, 
                status: fromState // Only update if still in expected state
            },
            { 
                status: toState,
                ...additionalUpdates
            }
        );

        // Check if update was successful (affected rows > 0)
        if (updateResult.affected === 0) {
            throw new Error(`Failed to transition round ${roundId} from ${fromState} to ${toState} - round may have been modified by another process`);
        }

        return true;
    }

    /**
     * Get all possible next states for a given state
     * @param {string} currentState - Current state
     * @returns {string[]} Array of possible next states
     */
    static getValidNextStates(currentState) {
        return this.VALID_TRANSITIONS[currentState] || [];
    }

    /**
     * Check if a state is terminal (no valid transitions)
     * @param {string} state - State to check
     * @returns {boolean} True if state is terminal
     */
    static isTerminalState(state) {
        return this.getValidNextStates(state).length === 0;
    }
}