/**
 * Utilitaires pour la gestion des messages Discord
 */

import { getSchedulerStatus, initScheduler } from '../services/schedulerService.js';

/**
 * Vérifie si le planificateur a des tâches actives et le redémarre si nécessaire
 * @param {Object} client - Client Discord
 * @returns {boolean} - Vrai si le planificateur a été redémarré
 */
export function checkAndRegenerateTasks(client) {
  const status = getSchedulerStatus();

  // Si le planificateur est actif mais qu'il n'a plus de tâches
  if (status.active && status.tasks.length === 0) {
    console.log('⚠️ Aucune tâche active détectée. Régénération automatique des tâches...');
    initScheduler(client);
    return true;
  }

  return false;
}

/**
 * Fonction utilitaire pour envoyer un message long en plusieurs parties
 * @param {Object} channel - Canal Discord où envoyer les messages
 * @param {string} content - Contenu du message à diviser
 * @param {Object} options - Options supplémentaires (reply)
 * @returns {Promise<Array>} - Tableau des messages envoyés
 */
export async function sendLongMessage(channel, content, options = {}) {
  // Limite de caractères pour un message Discord
  const MAX_LENGTH = 1900;

  // Diviser le contenu en plusieurs parties si nécessaire
  const parts = [];
  let currentPart = '';

  const lines = content.split('\n');

  for (const line of lines) {
    // Si ajouter cette ligne dépasserait la limite
    if (currentPart.length + line.length + 1 > MAX_LENGTH) {
      // Ajouter la partie actuelle et commencer une nouvelle
      parts.push(currentPart);
      currentPart = line;
    } else {
      // Sinon, ajouter la ligne à la partie actuelle
      if (currentPart.length > 0) {
        currentPart += '\n';
      }
      currentPart += line;
    }
  }

  // Ajouter la dernière partie si elle n'est pas vide
  if (currentPart.length > 0) {
    parts.push(currentPart);
  }

  // Envoyer toutes les parties
  const messages = [];
  let isFirst = true;

  for (const part of parts) {
    try {
      if (isFirst && options.reply) {
        // Premier message: utiliser reply si demandé
        const msg = await options.reply(part);
        messages.push(msg);
        isFirst = false;
      } else {
        // Messages suivants: utiliser send
        const msg = await channel.send(part);
        messages.push(msg);
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi d\'une partie du message:', error);
    }
  }

  return messages;
}

/**
 * Divise un contenu en plusieurs parties sans dépasser la limite Discord
 * @param {string} content - Contenu à diviser
 * @param {number} maxLength - Longueur maximale de chaque partie (défaut: 1900)
 * @returns {Array<string>} - Tableau des parties du message
 */
export function splitMessageContent(content, maxLength = 1900) {
  if (!content) return [];

  const parts = [];
  let currentPart = '';

  const lines = content.split('\n');

  for (const line of lines) {
    // Si la ligne elle-même dépasse la limite, il faut la découper
    if (line.length > maxLength) {
      // D'abord ajouter la partie en cours si non vide
      if (currentPart.length > 0) {
        parts.push(currentPart);
        currentPart = '';
      }

      // Puis découper la ligne trop longue en morceaux
      let remainingLine = line;
      while (remainingLine.length > 0) {
        parts.push(remainingLine.substring(0, maxLength));
        remainingLine = remainingLine.substring(maxLength);
      }
    } 
    // Sinon, vérifier si ajouter cette ligne dépasserait la limite
    else if (currentPart.length + line.length + 1 > maxLength) {
      // Ajouter la partie actuelle et commencer une nouvelle
      parts.push(currentPart);
      currentPart = line;
    } else {
      // Sinon, ajouter la ligne à la partie actuelle
      if (currentPart.length > 0) {
        currentPart += '\n';
      }
      currentPart += line;
    }
  }

  // Ajouter la dernière partie si elle n'est pas vide
  if (currentPart.length > 0) {
    parts.push(currentPart);
  }

  return parts;
}
