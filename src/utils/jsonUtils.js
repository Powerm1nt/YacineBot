/**
 * Convertit les BigInt en chaînes de caractères lors de la sérialisation JSON
 * @param {any} obj - Objet à sérialiser 
 * @returns {string} - JSON sérialisé avec BigInt convertis en chaînes
 */
export function safeJsonStringify(obj) {
  return JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
}

/**
 * Vérifie récursivement un objet et convertit tous les BigInt en chaînes de caractères
 * @param {any} obj - Objet à traiter
 * @returns {any} - Objet avec tous les BigInt convertis en chaînes
 */
export function convertBigIntsToStrings(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntsToStrings(item));
  }
  
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertBigIntsToStrings(value);
    }
    return result;
  }
  
  return obj;
}