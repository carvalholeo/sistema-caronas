import slowDown from "express-slow-down";

export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes without delay
  delayMs: 500 // add 500ms delay per request after delayAfter
});
