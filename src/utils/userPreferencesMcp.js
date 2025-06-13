/**
 * Message Consumer Processor (MCP) for User Communication Preferences
 * 
 * This module handles user preferences for communication frequency (talk less/more)
 * using a message-based architecture. It processes message objects with specific
 * types and payloads, and returns responses.
 */
import { loadConfig, saveConfig } from './configService.js';

// Types de messages supportés
const MESSAGE_TYPES = {
  SET_TALK_PREFERENCE: 'SET_TALK_PREFERENCE',
  GET_TALK_PREFERENCE: 'GET_TALK_PREFERENCE',
  RESET_TALK_PREFERENCE: 'RESET_TALK_PREFERENCE',
};

// Valeurs possibles pour les préférences de communication
const TALK_PREFERENCES = {
  LESS: 'LESS',    // Parler moins (réduire le relevanceScore)
  MORE: 'MORE',    // Parler plus (augmenter le relevanceScore)
  NORMAL: 'NORMAL' // Comportement normal (pas de modification du relevanceScore)
};

// Modificateurs de relevanceScore pour chaque préférence
const RELEVANCE_MODIFIERS = {
  [TALK_PREFERENCES.LESS]: -0.3,   // Réduire le score de 0.3
  [TALK_PREFERENCES.MORE]: 0.3,    // Augmenter le score de 0.3
  [TALK_PREFERENCES.NORMAL]: 0     // Pas de modification
};

/**
 * Définit la préférence de communication d'un utilisateur
 * @param {Object} payload - Données pour la préférence
 * @param {string} payload.userId - ID de l'utilisateur
 * @param {string} payload.preference - Préférence de communication (LESS, MORE, NORMAL)
 * @returns {Promise<Object>} - Résultat de l'opération
 */
async function handleSetTalkPreference(payload) {
  const { userId, preference } = payload;
  
  if (!userId) {
    throw new Error('ID utilisateur requis pour définir une préférence de communication');
  }
  
  if (!Object.values(TALK_PREFERENCES).includes(preference)) {
    throw new Error(`Préférence de communication invalide: ${preference}. Valeurs possibles: ${Object.values(TALK_PREFERENCES).join(', ')}`);
  }
  
  try {
    const config = await loadConfig();
    
    // S'assurer que la structure existe
    if (!config.scheduler) {
      config.scheduler = { users: {} };
    }
    if (!config.scheduler.users) {
      config.scheduler.users = {};
    }
    
    // Définir la préférence de l'utilisateur
    if (!config.scheduler.users[userId]) {
      config.scheduler.users[userId] = {};
    }
    
    config.scheduler.users[userId].talkPreference = preference;
    
    // Sauvegarder la configuration
    await saveConfig(config);
    
    console.log(`[UserPreferencesMCP] Préférence de communication définie pour l'utilisateur ${userId}: ${preference}`);
    
    return {
      success: true,
      userId,
      preference,
      modifier: RELEVANCE_MODIFIERS[preference]
    };
  } catch (error) {
    console.error(`[UserPreferencesMCP] Erreur lors de la définition de la préférence de communication:`, error);
    throw error;
  }
}

/**
 * Récupère la préférence de communication d'un utilisateur
 * @param {Object} payload - Données pour la recherche
 * @param {string} payload.userId - ID de l'utilisateur
 * @returns {Promise<Object>} - Préférence de communication de l'utilisateur
 */
async function handleGetTalkPreference(payload) {
  const { userId } = payload;
  
  if (!userId) {
    throw new Error('ID utilisateur requis pour récupérer une préférence de communication');
  }
  
  try {
    const config = await loadConfig();
    
    // Récupérer la préférence de l'utilisateur (NORMAL par défaut)
    const preference = config.scheduler?.users?.[userId]?.talkPreference || TALK_PREFERENCES.NORMAL;
    
    return {
      userId,
      preference,
      modifier: RELEVANCE_MODIFIERS[preference]
    };
  } catch (error) {
    console.error(`[UserPreferencesMCP] Erreur lors de la récupération de la préférence de communication:`, error);
    throw error;
  }
}

/**
 * Réinitialise la préférence de communication d'un utilisateur
 * @param {Object} payload - Données pour la réinitialisation
 * @param {string} payload.userId - ID de l'utilisateur
 * @returns {Promise<Object>} - Résultat de l'opération
 */
async function handleResetTalkPreference(payload) {
  const { userId } = payload;
  
  if (!userId) {
    throw new Error('ID utilisateur requis pour réinitialiser une préférence de communication');
  }
  
  try {
    const config = await loadConfig();
    
    // Vérifier si l'utilisateur a une préférence définie
    if (config.scheduler?.users?.[userId]?.talkPreference) {
      // Réinitialiser la préférence
      config.scheduler.users[userId].talkPreference = TALK_PREFERENCES.NORMAL;
      
      // Sauvegarder la configuration
      await saveConfig(config);
      
      console.log(`[UserPreferencesMCP] Préférence de communication réinitialisée pour l'utilisateur ${userId}`);
    }
    
    return {
      success: true,
      userId,
      preference: TALK_PREFERENCES.NORMAL,
      modifier: RELEVANCE_MODIFIERS[TALK_PREFERENCES.NORMAL]
    };
  } catch (error) {
    console.error(`[UserPreferencesMCP] Erreur lors de la réinitialisation de la préférence de communication:`, error);
    throw error;
  }
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
  
  console.log(`[UserPreferencesMCP] Traitement du message de type: ${message.type}`);
  
  switch (message.type) {
    case MESSAGE_TYPES.SET_TALK_PREFERENCE:
      return {
        type: `${message.type}_RESPONSE`,
        payload: await handleSetTalkPreference(message.payload || {})
      };
      
    case MESSAGE_TYPES.GET_TALK_PREFERENCE:
      return {
        type: `${message.type}_RESPONSE`,
        payload: await handleGetTalkPreference(message.payload || {})
      };
      
    case MESSAGE_TYPES.RESET_TALK_PREFERENCE:
      return {
        type: `${message.type}_RESPONSE`,
        payload: await handleResetTalkPreference(message.payload || {})
      };
      
    default:
      throw new Error(`Type de message non supporté: ${message.type}`);
  }
}

/**
 * Obtient le modificateur de relevanceScore pour un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<number>} - Modificateur de relevanceScore
 */
async function getUserRelevanceModifier(userId) {
  try {
    const response = await processMessage({
      type: MESSAGE_TYPES.GET_TALK_PREFERENCE,
      payload: { userId }
    });
    
    return response.payload.modifier;
  } catch (error) {
    console.error(`[UserPreferencesMCP] Erreur lors de la récupération du modificateur de relevanceScore:`, error);
    return 0; // Valeur par défaut en cas d'erreur
  }
}

export const userPreferencesMcp = {
  processMessage,
  MESSAGE_TYPES,
  TALK_PREFERENCES,
  RELEVANCE_MODIFIERS,
  getUserRelevanceModifier
};
