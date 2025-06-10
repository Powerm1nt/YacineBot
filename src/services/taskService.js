/**
 * Service pour gérer la persistance des tâches planifiées
 */
import { prisma } from '../models/index.js';

/**
 * Sauvegarde une tâche planifiée dans la base de données
 * @param {string} schedulerId - ID unique de la tâche (ancien taskId)
 * @param {number} taskNumber - Numéro de la tâche
 * @param {Date} nextExecution - Date de la prochaine exécution
 * @param {string} targetChannelType - Type de canal cible (guild, dm, group)
 * @returns {Promise<Object>} La tâche créée
 */
export async function saveTask(schedulerId, taskNumber, nextExecution, targetChannelType = null) {
  try {
    return await prisma.task.upsert({
      where: { schedulerId },
      update: { 
        taskNumber,
        nextExecution,
        targetChannelType,
        updatedAt: new Date()
      },
      create: {
        type: 'scheduler',
        status: 'pending',
        data: {},
        schedulerId,
        taskNumber,
        nextExecution,
        targetChannelType
      }
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la tâche:', error);
    throw error;
  }
}

/**
 * Récupère toutes les tâches planifiées
 * @returns {Promise<Array>} Liste des tâches
 */
export async function getAllTasks() {
  try {
    return await prisma.task.findMany({
      where: { 
        type: 'scheduler',
        schedulerId: { not: null }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches:', error);
    return [];
  }
}

/**
 * Supprime une tâche planifiée
 * @param {string} schedulerId - ID du scheduler (ancien taskId) à supprimer
 * @returns {Promise<boolean>} Succès de l'opération
 */
export async function deleteTask(schedulerId) {
  try {
    await prisma.task.delete({
      where: { schedulerId }
    });
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression de la tâche:', error);
    return false;
  }
}

/**
 * Supprime toutes les tâches planifiées
 * @returns {Promise<boolean>} Succès de l'opération
 */
export async function deleteAllTasks() {
  try {
    await prisma.task.deleteMany({
      where: { 
        type: 'scheduler',
        schedulerId: { not: null }
      }
    });
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression de toutes les tâches:', error);
    return false;
  }
}

/**
 * Enregistre l'exécution d'une tâche
 * @param {string} schedulerId - ID du scheduler (ancien taskId)
 * @param {string} channelId - ID du canal où le message a été envoyé
 * @param {string} userId - ID de l'utilisateur ciblé
 * @param {string} message - Message envoyé
 * @returns {Promise<Object>} L'exécution enregistrée
 */
export async function logTaskExecution(schedulerId, channelId, userId, message) {
  try {
    // Rechercher d'abord la tâche par son schedulerId
    const task = await prisma.task.findUnique({
      where: { schedulerId }
    });

    if (!task) {
      console.warn(`Aucune tâche trouvée avec schedulerId: ${schedulerId}`);
      return null;
    }

    // Créer l'exécution liée à la tâche
    return await prisma.taskExecution.create({
      data: {
        taskId: task.id,
        schedulerId,
        channelId,
        userId,
        message,
        executedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'exécution de la tâche:', error);
    // Ne pas propager l'erreur pour ne pas interrompre l'exécution de la tâche
    return null;
  }
}

// Exporter un objet pour les imports nommés
export const taskService = {
  saveTask,
  getAllTasks,
  deleteTask,
  deleteAllTasks,
  logTaskExecution
};
