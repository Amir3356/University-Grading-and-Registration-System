/**
 * Standardized HTTP response helpers for controllers
 */

/**
 * Send a successful JSON response (default HTTP 200)
 * @param {import('express').Response} res
 * @param {any} data
 * @param {number} [status=200]
 */
export function sendSuccess(res, data, status = 200) {
  return res.status(status).json(data);
}

/**
 * Send a resource creation response (HTTP 201)
 * @param {import('express').Response} res
 * @param {any} data
 */
export function sendCreated(res, data) {
  return res.status(201).json(data);
}

/**
 * Send an empty success response (HTTP 204 No Content)
 * @param {import('express').Response} res
 */
export function sendNoContent(res) {
  return res.status(204).end();
}

/**
 * Send a paginated collection response
 * @param {import('express').Response} res
 * @param {Array<any>} items
 * @param {{ page: number, limit: number, total: number, totalPages?: number }} pagination
 */
export function sendPaginated(res, items, pagination) {
  const total = pagination.total || items.length;
  const limit = pagination.limit || items.length || 20;
  const page = pagination.page || 1;
  const totalPages = pagination.totalPages || Math.ceil(total / limit) || 1;

  return res.status(200).json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}

/**
 * Send a structured error response
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [status=500]
 * @param {any} [details=null]
 */
export function sendError(res, message, status = 500, details = null) {
  const payload = {
    success: false,
    error: {
      message,
      status,
    },
  };
  if (details) {
    payload.error.details = details;
  }
  return res.status(status).json(payload);
}
