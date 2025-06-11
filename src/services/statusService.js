import { Client } from 'discord.js-selfbot-v13';
import { getHours } from 'date-fns';
import dotenv from 'dotenv';

dotenv.config();

// Constantes de statut
const STATUS = {
  ONLINE: 'online',
  DND: 'dnd',      // Ne pas déranger (Do Not Disturb)
  IDLE: 'idle',    // Inactif/AFK
  INVISIBLE: 'invisible'
};

// Configuration des plages horaires
const TIME_RANGES = {
  NIGHT: { start: 22, end: 8 },    // 22h - 8h: DND
  EVENING: { start: 18, end: 22 }, // 18h - 22h: IDLE
  DAY: { start: 8, end: 18 }      // 8h - 18h: ONLINE
};

/**
 * Détermine le statut approprié en fonction de l'heure actuelle
 * @returns {string} Le statut à définir
 */
function getStatusForCurrentTime() {
  const currentHour = getHours(new Date());

  if (currentHour >= TIME_RANGES.NIGHT.start || currentHour < TIME_RANGES.NIGHT.end) {
    return STATUS.DND;
  } else if (currentHour >= TIME_RANGES.EVENING.start && currentHour < TIME_RANGES.EVENING.end) {
    return STATUS.IDLE;
  } else {
    return STATUS.ONLINE;
  }
}

/**
 * Met à jour le statut du bot
 * @param {Client} client - Le client Discord
 */
async function updateStatus(client) {
  if (!client || !client.user) {
    console.error('[StatusService] Client Discord non disponible');
    return;
  }

  try {
    const newStatus = getStatusForCurrentTime();
    await client.user.setStatus(newStatus);
    console.log(`[StatusService] Statut mis à jour: ${newStatus}`);
  } catch (error) {
    console.error('[StatusService] Erreur lors de la mise à jour du statut:', error);
  }
}

/**
 * Initialise le service de gestion du statut
 * @param {Client} client - Le client Discord
 */
export async function initStatusService(client) {
  console.log('[StatusService] Initialisation du service de statut...');

  if (!client) {
    console.error('[StatusService] Client Discord non fourni');
    return;
  }

  // Mettre à jour le statut immédiatement
  await updateStatus(client);

  // Planifier la mise à jour toutes les heures
  setInterval(() => updateStatus(client), 60 * 60 * 1000);

  console.log('[StatusService] Service de statut initialisé avec succès');
}

/**
 * Service principal exporté
 */
export const statusService = {
  initStatusService,
  updateStatus,
  getStatusForCurrentTime,
  STATUS
};
