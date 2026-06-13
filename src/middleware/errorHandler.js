import multer from 'multer';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        res.status(400).json({ message: err.message });
    } else if (err.statusCode) {
        res.status(err.statusCode).json({ message: err.message });
    } else {
        logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};
