// Wraps async route handlers so rejected promises reach the global error handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const parseId = (value, label = 'ID') => {
  const id = parseInt(value, 10);
  if (Number.isNaN(id) || id < 1) throw new HttpError(400, `Invalid ${label}.`);
  return id;
};

const round1 = (n) => (n === null || n === undefined ? null : parseFloat(Number(n).toFixed(1)));

module.exports = { asyncHandler, HttpError, parseId, round1 };
