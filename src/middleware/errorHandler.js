import multer from 'multer';
import { logger } from '../utils/logger.js';
import { httpResponseForError } from '../utils/HttpError.js';

export const errorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        res.status(400).json({ message: err.message });
        return;
    }

    const known = httpResponseForError(err);
    if (known) {
        res.status(known.status).json({ message: known.message });
    } else {
        logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);
        // The full error stays in the log; the client never sees driver or SQL details.
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
