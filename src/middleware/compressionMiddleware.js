import { createGzip, createDeflate, constants } from 'zlib';
import { logger } from '../utils/logger.js';
import { updateCompressionStats } from '../routes/healthRoutes.js';

/**
 * Memory-efficient compression middleware
 * Optimized for 512MB memory environments
 */
export const compressionMiddleware = (req, res, next) => {
  // Skip compression for certain routes
  const skipRoutes = ['/uploads', '/ws'];
  if (skipRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  // Skip compression for small responses (under 1KB)
  const originalSend = res.send;
  const originalJson = res.json;

  // Override res.send
  res.send = function(data) {
    if (shouldCompress(req, res, data)) {
      compressResponse(req, res, data, originalSend.bind(this));
    } else {
      originalSend.call(this, data);
    }
  };

  // Override res.json
  res.json = function(data) {
    const jsonString = JSON.stringify(data);
    if (shouldCompress(req, res, jsonString)) {
      compressResponse(req, res, jsonString, originalSend.bind(this));
    } else {
      originalSend.call(this, jsonString);
    }
  };

  next();
};

/**
 * Determine if response should be compressed
 */
function shouldCompress(req, res, data) {
  // Check if client accepts compression
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const supportsGzip = acceptEncoding.includes('gzip');
  const supportsDeflate = acceptEncoding.includes('deflate');
  
  if (!supportsGzip && !supportsDeflate) {
    return false;
  }

  // Skip compression for small payloads (under 1KB)
  const dataLength = Buffer.byteLength(data, 'utf8');
  if (dataLength < 1024) {
    return false;
  }

  // Skip if already compressed
  if (res.getHeader('content-encoding')) {
    return false;
  }

  // Skip for certain content types
  const contentType = res.getHeader('content-type') || '';
  const skipTypes = ['image/', 'video/', 'audio/', 'application/octet-stream'];
  if (skipTypes.some(type => contentType.includes(type))) {
    return false;
  }

  return true;
}

/**
 * Compress response with memory optimization
 */
function compressResponse(req, res, data, originalSend) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const supportsGzip = acceptEncoding.includes('gzip');
  
  // Prefer gzip over deflate for better compression
  const useGzip = supportsGzip;
  const encoding = useGzip ? 'gzip' : 'deflate';
  
  // Memory-optimized compression options
  const compressionOptions = {
    level: constants.Z_BEST_SPEED, // Fast compression to save CPU
    windowBits: useGzip ? 15 : -15, // Smaller window for memory efficiency
    memLevel: 6, // Reduced memory usage (default is 8)
    chunkSize: 512, // Smaller chunks for memory efficiency
  };

  try {
    const compressor = useGzip 
      ? createGzip(compressionOptions)
      : createDeflate(compressionOptions);

    const chunks = [];
    let totalSize = 0;

    compressor.on('data', (chunk) => {
      chunks.push(chunk);
      totalSize += chunk.length;
      
      // Memory safety: prevent excessive memory usage
      if (totalSize > 10 * 1024 * 1024) { // 10MB limit
        logger.warn('Compression aborted - response too large', {
          originalSize: Buffer.byteLength(data, 'utf8'),
          compressedSize: totalSize
        });
        compressor.destroy();
        return originalSend(data);
      }
    });

    compressor.on('end', () => {
      const compressed = Buffer.concat(chunks);
      const originalSize = Buffer.byteLength(data, 'utf8');
      const compressionRatio = ((originalSize - compressed.length) / originalSize) * 100;

      // Only use compression if it saves significant space (>10%)
      if (compressionRatio > 10) {
        res.setHeader('Content-Encoding', encoding);
        res.setHeader('Content-Length', compressed.length);
        res.setHeader('Vary', 'Accept-Encoding');
        
        // Add compression info for monitoring
        res.setHeader('X-Compression-Ratio', compressionRatio.toFixed(1) + '%');
        
        // Update compression statistics
        updateCompressionStats(originalSize, compressed.length, true);
        
        logger.debug('Response compressed', {
          originalSize,
          compressedSize: compressed.length,
          ratio: compressionRatio.toFixed(1) + '%',
          encoding
        });
        
        originalSend(compressed);
      } else {
        // Compression not worth it, send original
        updateCompressionStats(originalSize, originalSize, false);
        originalSend(data);
      }
    });

    compressor.on('error', (error) => {
      logger.warn('Compression error, sending uncompressed:', { error: error.message });
      const originalSize = Buffer.byteLength(data, 'utf8');
      updateCompressionStats(originalSize, originalSize, false);
      originalSend(data);
    });

    // Compress the data
    compressor.end(data);

  } catch (error) {
    logger.warn('Compression failed, sending uncompressed:', { error: error.message });
    const originalSize = Buffer.byteLength(data, 'utf8');
    updateCompressionStats(originalSize, originalSize, false);
    originalSend(data);
  }
}

/**
 * Compression statistics middleware for monitoring
 */
export const compressionStatsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    const size = res.getHeader('Content-Length') || (data ? Buffer.byteLength(data, 'utf8') : 0);
    const encoding = res.getHeader('Content-Encoding');
    
    // Log compression statistics for large responses
    if (size > 5000 && encoding) {
      logger.info('Compressed response stats', {
        path: req.path,
        method: req.method,
        size,
        encoding,
        responseTime,
        compressionRatio: res.getHeader('X-Compression-Ratio')
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};