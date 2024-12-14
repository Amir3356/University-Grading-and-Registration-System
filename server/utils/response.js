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
