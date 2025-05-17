import multer from 'multer';

export const errorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer-specific errors (e.g., file too large)
        res.status(400).json({ message: err.message });
    } else if (err.statusCode) {
        // Custom error from fileFilter or other sources
        res.status(err.statusCode).json({ message: err.message });
    } else {
        // General errors
        res.status(500).json({ message: 'Internal Server Error', error: err.message });
    }
};
