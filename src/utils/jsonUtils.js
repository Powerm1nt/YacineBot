/**
 * Utilitaires pour la manipulation de JSON
 */

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
 * Convertit les BigInt en chaînes dans un objet JSON
 * Résout le problème de sérialisation des BigInt
 * @param {Object} obj - L'objet à convertir
 * @returns {Object} - L'objet avec les BigInt convertis en chaînes
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

/**
 * Analyse une chaîne JSON avec gestion sécurisée des erreurs
 * @param {string} jsonString - Chaîne JSON à analyser
 * @param {*} defaultValue - Valeur par défaut en cas d'erreur
 * @returns {*} - Objet JSON ou valeur par défaut
 */
export function safeJsonParse(jsonString, defaultValue = {}) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Erreur lors de l\'analyse JSON:', error);
    return defaultValue;
  }
}
