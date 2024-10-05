export function snakeToCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

export function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamelCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (typeof obj === 'object' && obj.constructor === Object) {
    const res = {};
    for (const [key, val] of Object.entries(obj)) {
      res[snakeToCamel(key)] = toCamelCase(val);
    }
    return res;
  }
  return obj;
}

export function formatPagination({ items, total, page = 1, pageSize = 10 }) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = pageSize === 'all' ? (total > 0 ? total : 1) : Math.max(1, parseInt(pageSize, 10) || 10);
  const pageCount = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(total / size));
  return {
    items: toCamelCase(items),
    total: parseInt(total, 10) || 0,
    page: p,
    pageSize: pageSize === 'all' ? total : size,
    pageCount,
  };
}
