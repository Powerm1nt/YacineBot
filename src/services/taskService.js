/**
 * Service pour gérer les tâches planifiées
 */
import { prisma } from '../models/index.js';

/**
 * Ajoute une nouvelle tâche à la file d'attente
 * @param {string} type - Type de tâche
 * @param {Object} data - Données associées à la tâche
 * @param {number} priority - Priorité de la tâche (0-10)
 * @returns {Promise<Object>} - Tâche créée
 */
export async function addTask(type, data, priority = 0) {
  try {
    const task = await prisma.task.create({
      data: {
        type,
        data,
        priority,
        status: 'pending'
      }
    });

    return task;
  } catch (error) {
    console.error('Erreur lors de l\'ajout de la tâche:', error);
    throw error;
  }
}

/**
 * Récupère la prochaine tâche à exécuter
 * @param {Array<string>} types - Types de tâches à récupérer
 * @returns {Promise<Object|null>} - Tâche à exécuter ou null
 */
export async function getNextTask(types = []) {
  try {
    const whereClause = {
      status: 'pending',
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: new Date() } }
      ]
    };

    // Ajouter le filtre de types si spécifié
    if (types && types.length > 0) {
      whereClause.type = { in: types };
    }

    // Récupérer et verrouiller la tâche dans une transaction
    const task = await prisma.$transaction(async (tx) => {
      const nextTask = await tx.task.findFirst({
        where: whereClause,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      if (!nextTask) return null;

      // Marquer comme démarrée
      return await tx.task.update({
        where: { id: nextTask.id },
        data: {
          status: 'processing',
          startedAt: new Date(),
          updatedAt: new Date()
        }
      });
    });

    return task;
  } catch (error) {
    console.error('Erreur lors de la récupération de la prochaine tâche:', error);
    return null;
  }
}

/**
 * Marque une tâche comme terminée
 * @param {number} taskId - ID de la tâche
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function completeTask(taskId) {
  try {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      }
    });

    return true;
  } catch (error) {
    console.error('Erreur lors de la complétion de la tâche:', error);
    return false;
  }
}

/**
 * Marque une tâche comme échouée
 * @param {number} taskId - ID de la tâche
 * @param {string} error - Message d'erreur
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function failTask(taskId, error) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) return false;

    const retryCount = (task.retryCount || 0) + 1;
    const maxRetries = 3; // Nombre maximal de tentatives

    if (retryCount <= maxRetries) {
      // Calculer le délai exponentiel pour la prochaine tentative
      const backoffMinutes = Math.pow(2, retryCount - 1) * 5; // 5, 10, 20 minutes
      const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'retry',
          error,
          retryCount,
          nextRetryAt,
          updatedAt: new Date()
        }
      });
    } else {
      // Plus de tentatives, marquer comme définitivement échouée
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          error,
          failedAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Erreur lors de la gestion de l\'échec de la tâche:', error);
    return false;
  }
}

export const taskService = {
  addTask,
  getNextTask,
  completeTask,
  failTask
};
