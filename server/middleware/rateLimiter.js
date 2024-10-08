/**
 * In-memory sliding-window rate limiter middleware
 */

class MemoryRateLimiter {
  constructor({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests, please try again later.' }) {
    this.windowMs = windowMs;
    this.max = max;
    this.message = message;
    this.hits = new Map();

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref?.();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.hits.entries()) {
      if (now - data.resetTime > this.windowMs) {
        this.hits.delete(key);
      }
    }
  }

  middleware() {
    return (req, res, next) => {
      const ip = req.ip || req.socket.remoteAddress || 'anonymous';
      const key = `${ip}:${req.baseUrl || req.path}`;
      const now = Date.now();

      let record = this.hits.get(key);

      if (!record || now > record.resetTime) {
        record = {
          count: 1,
          resetTime: now + this.windowMs,
        };
        this.hits.set(key, record);
      } else {
        record.count += 1;
      }

      const remaining = Math.max(0, this.max - record.count);
      const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

      res.setHeader('X-RateLimit-Limit', this.max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetSeconds);

      if (record.count > this.max) {
        res.setHeader('Retry-After', resetSeconds);
        return res.status(429).json({
          error: 'too_many_requests',
          message: this.message,
          retryAfterSeconds: resetSeconds,
        });
      }

      next();
    };
  }
}

/**
 * Factory to create custom rate limiters
 */
export function createRateLimiter(options) {
  const limiter = new MemoryRateLimiter(options);
  return limiter.middleware();
}

/**
 * Standard API rate limiter (1000 requests per 15 minutes)
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP. Please try again after 15 minutes.',
});

/**
 * Strict authentication rate limiter (15 requests per 15 minutes)
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many login attempts. Please wait 15 minutes before trying again.',
});
