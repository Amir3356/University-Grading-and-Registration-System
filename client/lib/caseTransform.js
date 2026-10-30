/**
 * Check if a string key looks like an entity ID (e.g. asm_123, enr_123, or composite enr:asm)
 */
function isEntityId(str) {
  return /^[a-z]{2,5}_[0-9a-f]+$/i.test(str) || str.includes(':');
}

/**
 * Convert snake_case string to camelCase
 */
function snakeToCamel(str) {
  if (isEntityId(str)) return str;
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively transform object keys from snake_case to camelCase
 */
export function transformKeysToCamel(obj) {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(transformKeysToCamel);
  }

  const transformed = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    // If the field is 'marks', preserve its inner keys as-is since they are assessment IDs
    if ((key === 'marks' || camelKey === 'marks') && value && typeof value === 'object' && !Array.isArray(value)) {
      transformed[camelKey] = { ...value };
    } else {
      transformed[camelKey] = transformKeysToCamel(value);
    }
  }
  return transformed;
}