/**
 * CraftSquad Tool - API error with an HTTP status so validation problems are not reported as 500s.
 */

class ApiError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (extra) Object.assign(this, extra);
  }
}

module.exports = { ApiError };
