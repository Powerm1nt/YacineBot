import { supabase } from '../app.js';

/**
 * Service pour interagir avec la base de données Supabase
 */

/**
 * Récupère l'historique de conversation d'un utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @returns {Promise<Array>} - Historique de conversation ou tableau vide si aucun historique
 */
export async function getUserConversationHistory(userId) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('messages')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      return [];
    }
    
    return data?.messages || [];
  } catch (error) {
    console.error('Erreur dans getUserConversationHistory:', error);
    return [];
  }
}

/**
 * Enregistre l'historique de conversation d'un utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {Array} messages - Tableau des messages de la conversation
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function saveUserConversationHistory(userId, messages) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .upsert({ 
        user_id: userId, 
        messages: messages,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id' 
      });
    
    if (error) {
      console.error('Erreur lors de l\'enregistrement de l\'historique:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erreur dans saveUserConversationHistory:', error);
    return false;
  }
}

/**
 * Supprime l'historique de conversation d'un utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function deleteUserConversationHistory(userId) {
  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('user_id', userId);
    
    if (error) {
      console.error('Erreur lors de la suppression de l\'historique:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erreur dans deleteUserConversationHistory:', error);
    return false;
  }
}

/**
 * Enregistre une nouvelle entrée dans les statistiques d'utilisation
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {string} commandType - Type de commande utilisée
 * @param {number} tokensUsed - Nombre de tokens utilisés (si applicable)
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function logUsageStatistics(userId, commandType, tokensUsed = 0) {
  try {
    const { error } = await supabase
      .from('usage_stats')
      .insert({
        user_id: userId,
        command_type: commandType,
        tokens_used: tokensUsed,
        used_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Erreur lors de l\'enregistrement des statistiques:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erreur dans logUsageStatistics:', error);
    return false;
  }
}

/**
 * Récupère les préférences utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @returns {Promise<Object>} - Préférences utilisateur ou objet vide
 */
export async function getUserPreferences(userId) {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Erreur lors de la récupération des préférences:', error);
      return {};
    }
    
    return data || {};
  } catch (error) {
    console.error('Erreur dans getUserPreferences:', error);
    return {};
  }
}

/**
 * Enregistre les préférences utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {Object} preferences - Objet contenant les préférences
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function saveUserPreferences(userId, preferences) {
  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert({ 
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id' 
      });
    
    if (error) {
      console.error('Erreur lors de l\'enregistrement des préférences:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erreur dans saveUserPreferences:', error);
    return false;
  }
}