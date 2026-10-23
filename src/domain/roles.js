// Roles that run the game: they manage sessions, combat rounds and the wiki, and may resolve
// combat they don't take part in. One list for every route guard and domain rule that needs it.
export const MASTER_OR_ADMIN_ROLES = Object.freeze(['admin', 'master']);

// Every account role, in the order the role-change API lists them.
export const ALL_ROLES = Object.freeze(['user', 'staffer', 'master', 'admin']);
