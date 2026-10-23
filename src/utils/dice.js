/**
 * Roll a d20. The only place the game reads randomness: services roll here and pass the
 * result to the domain (src/domain/skills/output.js, outcome.js).
 * @returns {number} 1..20
 */
export function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
}
