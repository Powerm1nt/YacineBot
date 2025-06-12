/**
 * Message Consumer Processor (MCP) for Tenor API
 * 
 * This module handles all communication with the Tenor API using a message-based architecture.
 * It processes message objects with specific types and payloads, and returns responses.
 */
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Configuration de l'API Tenor
const TENOR_API_KEY = process.env.TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Clé API par défaut (limitée)
const TENOR_API_BASE_URL = 'https://tenor.googleapis.com/v2';
const CLIENT_KEY = 'autism_discord_bot'; // Identifiant de l'application

// Types de messages supportés
const MESSAGE_TYPES = {
  SEARCH_GIFS: 'SEARCH_GIFS',
  GET_RANDOM_GIF: 'GET_RANDOM_GIF',
};

/**
 * Construit l'URL pour une requête à l'API Tenor
 * @param {string} endpoint - Point de terminaison de l'API
 * @param {Object} params - Paramètres de la requête
 * @returns {URL} - URL complète pour la requête
 */
function buildApiUrl(endpoint, params = {}) {
  const url = new URL(`${TENOR_API_BASE_URL}/${endpoint}`);
  
  // Ajouter les paramètres communs
  url.searchParams.append('key', TENOR_API_KEY);
  url.searchParams.append('client_key', CLIENT_KEY);
  
  // Ajouter les paramètres spécifiques
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });
  
  return url;
}

/**
 * Effectue une requête à l'API Tenor
 * @param {string} endpoint - Point de terminaison de l'API
 * @param {Object} params - Paramètres de la requête
 * @returns {Promise<Object>} - Réponse de l'API
 */
async function fetchFromApi(endpoint, params = {}) {
  try {
    const url = buildApiUrl(endpoint, params);
    console.log(`[TenorApiMCP] Requête API: ${url.toString()}`);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur API Tenor: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[TenorApiMCP] Erreur lors de la requête à ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Gestionnaire pour la recherche de GIFs
 * @param {Object} payload - Données pour la recherche
 * @returns {Promise<Array>} - Liste des GIFs trouvés
 */
async function handleSearchGifs(payload) {
  const { searchTerm, limit = 8, contentFilter, locale, mediaFilter = 'gif,tinygif,mediumgif' } = payload;
  
  if (!searchTerm) {
    throw new Error('Terme de recherche requis pour chercher des GIFs');
  }
  
  const params = {
    q: searchTerm,
    limit,
    media_filter: mediaFilter,
    random: 'false',
  };
  
  if (contentFilter) params.contentfilter = contentFilter;
  if (locale) params.locale = locale;
  
  const data = await fetchFromApi('search', params);
  return data.results || [];
}

/**
 * Gestionnaire pour obtenir un GIF aléatoire
 * @param {Object} payload - Données pour la recherche
 * @returns {Promise<Object|null>} - Un GIF aléatoire ou null
 */
async function handleGetRandomGif(payload) {
  const { searchTerm, limit = 20 } = payload;
  
  if (!searchTerm) {
    throw new Error('Terme de recherche requis pour obtenir un GIF aléatoire');
  }
  
  const gifs = await handleSearchGifs({
    searchTerm,
    limit,
  });
  
  if (gifs.length === 0) {
    console.log(`[TenorApiMCP] Aucun GIF trouvé pour: "${searchTerm}"`);
    return null;
  }
  
  // Sélectionner un GIF aléatoire
  const randomIndex = Math.floor(Math.random() * gifs.length);
  return gifs[randomIndex];
}

/**
 * Traite un message et retourne une réponse
 * @param {Object} message - Message à traiter
 * @param {string} message.type - Type de message (voir MESSAGE_TYPES)
 * @param {Object} message.payload - Données du message
 * @returns {Promise<Object>} - Réponse au message
 */
async function processMessage(message) {
  if (!message || !message.type) {
    throw new Error('Message invalide: type manquant');
  }
  
  console.log(`[TenorApiMCP] Traitement du message de type: ${message.type}`);
  
  switch (message.type) {
    case MESSAGE_TYPES.SEARCH_GIFS:
      return {
        type: `${message.type}_RESPONSE`,
        payload: await handleSearchGifs(message.payload || {})
      };
      
    case MESSAGE_TYPES.GET_RANDOM_GIF:
      return {
        type: `${message.type}_RESPONSE`,
        payload: await handleGetRandomGif(message.payload || {})
      };
      
    default:
      throw new Error(`Type de message non supporté: ${message.type}`);
  }
}

export const tenorApiMcp = {
  processMessage,
  MESSAGE_TYPES
};
