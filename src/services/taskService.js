/**
 * Service pour gérer la persistance des tâches planifiées
 */
import { prisma } from './prisma.js';

/**
 * Sauvegarde une tâche planifiée dans la base de données
 * @param {string} schedulerId - ID unique de la tâche (ancien taskId)
 * @param {number} taskNumber - Numéro de la tâche
 * @param {Date} nextExecution - Date de la prochaine exécution
 * @param {string} targetChannelType - Type de canal cible (guild, dm, group)
 * @param {string} type - Type de tâche (scheduler par défaut)
 * @param {Object} data - Données supplémentaires de la tâche
 * @returns {Promise<Object>} La tâche créée
 */
export async function saveTask(schedulerId, taskNumber, nextExecution, targetChannelType = null, type = 'scheduler', data = {}) {
  try {
    console.log(`[TaskService] Sauvegarde de tâche - ID: ${schedulerId}, Type: ${type}, Exécution: ${nextExecution.toISOString()}`);

    const task = await prisma.task.upsert({
      where: { schedulerId },
      update: { 
        taskNumber,
        nextExecution,
        targetChannelType,
        updatedAt: new Date(),
        type,
        data
      },
      create: {
        type,
        status: 'pending',
        data,
        schedulerId,
        taskNumber,
        nextExecution,
        targetChannelType
      }
    });

    console.log(`[TaskService] Tâche sauvegardée avec succès - ID BDD: ${task.id}, Scheduler ID: ${schedulerId}`);
    return task;
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
 * Récupère les tâches par type spécifique
 * @param {string} taskType - Type de tâche à récupérer (ex: 'conversation', 'analysis')
 * @returns {Promise<Array>} Liste des tâches correspondant au type
 */
export async function getTasksByType(taskType) {
  try {
    console.log(`[TaskService] Recherche de tâches par type: ${taskType}`);
    // Ignorer les recherches pour les tâches de type random-question-task qui n'existent plus
    if (taskType === 'random-question-task') {
      console.log(`[TaskService] Type de tâche "random-question-task" déprécié`);
      return [];
    }
    const tasks = await prisma.task.findMany({
      where: { 
        schedulerId: { contains: taskType }
      }
    });
    console.log(`[TaskService] ${tasks.length} tâches trouvées de type ${taskType}`);
    return tasks;
  } catch (error) {
    console.error(`[TaskService] Erreur lors de la récupération des tâches de type ${taskType}:`, error);
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
 * Supprime les tâches planifiées par type
 * @param {string} taskType - Type de tâche à supprimer
 * @returns {Promise<number>} Nombre de tâches supprimées
 */
export async function deleteTasksByType(taskType) {
  try {
    const result = await prisma.task.deleteMany({
      where: { 
        schedulerId: { contains: taskType }
      }
    });
    return result.count;
  } catch (error) {
    console.error(`Erreur lors de la suppression des tâches de type ${taskType}:`, error);
    return 0;
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
    console.log(`[TaskService] Enregistrement d'exécution de tâche - Scheduler ID: ${schedulerId}, Canal: ${channelId}, Utilisateur: ${userId}`);

    // Rechercher d'abord la tâche par son schedulerId
    const task = await prisma.task.findUnique({
      where: { schedulerId }
    });

    if (!task) {
      console.warn(`[TaskService] Aucune tâche trouvée avec schedulerId: ${schedulerId}`);
      return null;
    }

    console.log(`[TaskService] Tâche trouvée - ID BDD: ${task.id}, Type: ${task.type}`);

    // Créer l'exécution liée à la tâche
    const execution = await prisma.taskExecution.create({
      data: {
        taskId: task.id,
        schedulerId,
        channelId,
        userId,
        message,
        executedAt: new Date()
      }
    });

    console.log(`[TaskService] Exécution enregistrée avec succès - ID: ${execution.id}`);
    return execution;
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
  getTasksByType,
  deleteTask,
  deleteAllTasks,
  deleteTasksByType,
  logTaskExecution
};
