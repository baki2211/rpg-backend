# Console.log Cleanup Progress

## What We've Implemented

### 🔧 Infrastructure
- ✅ Created `ToastContext` for frontend user notifications
- ✅ Created `logger.js` utility for backend structured logging
- ✅ Added ToastProvider to app layout
- ✅ Updated main server startup logs to use logger

### 🎯 Files Cleaned Up
- ✅ `rpg-backend/src/index.js` - Server startup (KEEP startup logs)
- ✅ `rpg-backend/src/websockets/PresenceWebSocket.js` - WebSocket debugging
- ✅ `rpg-backend/src/websockets/ChatWebSocket.js` - Chat system logs
- ✅ `rpg-backend/src/services/ChatService.js` - Character/skill management
- ✅ `rpg-frontend/src/app/pages/chat/[locationId]/page.tsx` - User notifications

## Categorization Strategy

### 🔥 CRITICAL - Always Keep (convert to logger.critical)
- Database connection failures
- Server startup failures
- Authentication errors
- WebSocket security issues

### ⚠️ IMPORTANT - Keep in Development (logger.warn/error)
- WebSocket connection drops
- Database transaction failures
- Skill calculation errors
- Session management issues

### ℹ️ INFORMATIONAL - Development Only (logger.info/debug)
- Character experience updates
- Skill usage increments
- Session participant changes
- Location updates

### 🗑️ DEBUG/NOISE - Remove Completely
- Message processing details
- Data formatting logs  
- Verbose WebSocket message content
- Development testing logs

## Files Still Needing Cleanup

### Backend Services (High Priority)
- `src/services/SessionService.js` - 7 console.log statements
- `src/services/CharacterService.js` - 4 console.log statements
- `src/services/MapService.js` - 3 console.log statements
- `src/controllers/sessionController.js` - 4 console.log statements

### Frontend Components (Medium Priority)
- `src/app/hooks/useChatUsers.tsx` - 20+ debug statements
- `src/app/contexts/PresenceContext.tsx` - 6 statements
- `src/app/components/master/MasterPanel.tsx` - 2 statements
- `src/app/components/sessions/SessionList.tsx` - 8 statements

### Development/Migration Files (Low Priority)
- `src/jobs/seed.js` - Keep 2 important logs
- `src/migrations/*.js` - Keep migration status logs
- `src/jobs/sessionExpiration.js` - 1 statement

## Replacement Guidelines

### Frontend User-Facing Actions
```javascript
// OLD
console.log('Character activated');

// NEW  
showSuccess('Character activated successfully');
```

### Backend Service Operations
```javascript
// OLD
console.log('Session frozen with', messages.length, 'messages');

// NEW
logger.session(`Session ${sessionId} frozen with ${messages.length} messages saved`);
```

### Debug Information
```javascript
// OLD
console.log('Processing message:', msg);

// NEW - Remove completely or use logger.debug in development
if (process.env.NODE_ENV === 'development') {
  logger.debug('Processing message', { messageId: msg.id });
}
```

## Next Steps
1. Apply logger to remaining backend services
2. Clean up frontend hooks with toast notifications where appropriate
3. Remove development-only console.logs
4. Add environment-based logging levels
5. Consider file-based logging for production debugging

## Usage Examples

### Toast Notifications (Frontend)
```javascript
const { showSuccess, showError, showInfo, showWarning } = useToast();

// User actions
showSuccess('Skill acquired successfully!');
showError('Failed to save character');
showInfo('Connection restored');
showWarning('Session expires in 5 minutes');
```

### Structured Logging (Backend)
```javascript
import { logger } from '../utils/logger.js';

// System events
logger.startup('Server running on port 5001');
logger.critical('Database connection failed', { error: err.message });

// Feature-specific
logger.websocket('User connected to presence', { userId, location });
logger.character('Experience updated', { characterId, newExp });
logger.skill('Skill usage incremented', { skillName, uses });
``` 