// Consistent JSON error handling for the API.

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error('[server error]', err);
  }

  const payload = {
    error: status >= 500 ? 'Something went wrong on the server.' : err.message,
  };

  if (err.details) payload.details = err.details;

  res.status(status).json(payload);
}

/** Small helper so routes can throw HTTP-aware errors. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
