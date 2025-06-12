/**
 * Service pour gérer la persistance des tâches planifiées
 * Gère principalement les tâches dans la base de données et en mémoire si nécessaire
 */
import { prisma } from './prisma.js';

// Cache en mémoire pour les tâches actives
const tasksMemoryCache = new Map();

/**
 * Sauvegarde une tâche planifiée dans la base de données et dans le cache mémoire
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

    // Sauvegarde dans la base de données
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

    // Mettre aussi en cache mémoire
    tasksMemoryCache.set(schedulerId, {
      id: task.id,
      schedulerId,
      taskNumber,
      type,
      status: task.status,
      nextExecution,
      targetChannelType,
      data,
      updatedAt: new Date()
    });

    console.log(`[TaskService] Tâche sauvegardée avec succès - ID BDD: ${task.id}, Scheduler ID: ${schedulerId}`);
    return task;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la tâche:', error);
    throw error;
  }
}

/**
 * Récupère toutes les tâches planifiées depuis la base de données
 * @returns {Promise<Array>} Liste des tâches
 */
export async function getAllTasks() {
  try {
    const tasks = await prisma.task.findMany({
      where: { 
        type: 'scheduler',
        schedulerId: { not: null }
      }
    });

    // Mettre à jour le cache mémoire avec les résultats de la base de données
    tasks.forEach(task => {
      if (task.schedulerId) {
        tasksMemoryCache.set(task.schedulerId, task);
      }
    });

    return tasks;
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches:', error);
    return [];
  }
}

/**
 * Récupère une tâche par son ID de planificateur
 * @param {string} schedulerId - ID unique du planificateur à rechercher
 * @returns {Promise<Object|null>} La tâche trouvée ou null
 */
export async function getTaskById(schedulerId) {
  try {
    // Vérifier d'abord dans le cache mémoire
    if (tasksMemoryCache.has(schedulerId)) {
      return tasksMemoryCache.get(schedulerId);
    }

    // Sinon rechercher dans la base de données
    const task = await prisma.task.findUnique({
      where: { schedulerId }
    });

    // Mettre à jour le cache si trouvé
    if (task) {
      tasksMemoryCache.set(schedulerId, task);
    }

    return task;
  } catch (error) {
    console.error(`Erreur lors de la récupération de la tâche ${schedulerId}:`, error);
    return null;
  }
}

/**
 * Récupère les tâches par type spécifique
 * @param {string} taskType - Type de tâche à récupérer (ex: 'conversation', 'analysis')
 * @returns {Promise<Array>} Liste des tâches correspondant au type
 */
export async function getTasksByType(taskType) {
  try {
    if (taskType === 'random-question-task') {
      console.log(`[TaskService] Type de tâche "random-question-task" déprécié`);
      return [];
    }

    const tasks = await prisma.task.findMany({
      where: { 
        schedulerId: { contains: taskType }
      }
    });

    // Mettre à jour le cache mémoire
    tasks.forEach(task => {
      if (task.schedulerId) {
        tasksMemoryCache.set(task.schedulerId, task);
      }
    });

    return tasks;
  } catch (error) {
    console.error(`[TaskService] Erreur lors de la récupération des tâches de type ${taskType}:`, error);
    return [];
  }
}

/**
 * Met à jour le statut d'une tâche
 * @param {string} schedulerId - ID du scheduler
 * @param {string} status - Nouveau statut ('pending', 'running', 'completed', 'failed')
 * @returns {Promise<Object|null>} Tâche mise à jour ou null
 */
export async function updateTaskStatus(schedulerId, status) {
  try {
    const task = await prisma.task.update({
      where: { schedulerId },
      data: { 
        status,
        updatedAt: new Date() 
      }
    });

    // Mettre à jour le cache mémoire
    if (tasksMemoryCache.has(schedulerId)) {
      const cachedTask = tasksMemoryCache.get(schedulerId);
      cachedTask.status = status;
      cachedTask.updatedAt = new Date();
      tasksMemoryCache.set(schedulerId, cachedTask);
    }

    return task;
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du statut de la tâche ${schedulerId}:`, error);
    return null;
  }
}

/**
 * Supprime une tâche planifiée de la base de données et du cache mémoire
 * @param {string} schedulerId - ID du scheduler (ancien taskId) à supprimer
 * @returns {Promise<boolean>} Succès de l'opération
 */
export async function deleteTask(schedulerId) {
  try {
    // Check if the task exists before attempting to delete it
    const taskExists = await prisma.task.findUnique({
      where: { schedulerId },
      select: { id: true }
    });

    if (!taskExists) {
      console.log(`[TaskService] Aucune tâche trouvée avec l'ID ${schedulerId}, aucune suppression nécessaire`);
      // Remove from memory cache if present
      if (tasksMemoryCache.has(schedulerId)) {
        tasksMemoryCache.delete(schedulerId);
      }
      return true; // Return success since the end state is as expected (task doesn't exist)
    }

    // Proceed with deletion since the task exists
    await prisma.task.delete({
      where: { schedulerId }
    });

    // Supprimer aussi du cache mémoire
    if (tasksMemoryCache.has(schedulerId)) {
      tasksMemoryCache.delete(schedulerId);
    }

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

    // Vider le cache mémoire
    tasksMemoryCache.clear();

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
    // Récupérer d'abord les IDs pour mettre à jour le cache
    const tasksToDelete = await prisma.task.findMany({
      where: { 
        schedulerId: { contains: taskType }
      },
      select: { schedulerId: true }
    });

    // Supprimer de la base de données
    const result = await prisma.task.deleteMany({
      where: { 
        schedulerId: { contains: taskType }
      }
    });

    // Supprimer du cache mémoire
    tasksToDelete.forEach(task => {
      if (task.schedulerId && tasksMemoryCache.has(task.schedulerId)) {
        tasksMemoryCache.delete(task.schedulerId);
      }
    });

    return result.count;
  } catch (error) {
    console.error(`Erreur lors de la suppression des tâches de type ${taskType}:`, error);
    return 0;
  }
}

/**
 * Nettoie les tâches expirées de la base de données et du cache mémoire
 * @returns {Promise<number>} Nombre de tâches nettoyées
 */
export async function cleanupExpiredTasks() {
  try {
    const now = new Date();

    // Récupérer d'abord les IDs pour mettre à jour le cache
    const expiredTasks = await prisma.task.findMany({
      where: {
        nextExecution: { lt: now }
      },
      select: { schedulerId: true }
    });

    // Supprimer de la base de données
    const result = await prisma.task.deleteMany({
      where: {
        nextExecution: { lt: now }
      }
    });

    // Supprimer du cache mémoire
    expiredTasks.forEach(task => {
      if (task.schedulerId && tasksMemoryCache.has(task.schedulerId)) {
        tasksMemoryCache.delete(task.schedulerId);
      }
    });

    console.log(`[TaskService] ${result.count} tâches expirées nettoyées`);
    return result.count;
  } catch (error) {
    console.error('Erreur lors du nettoyage des tâches expirées:', error);
    return 0;
  }
}

/**
 * Synchronise le cache mémoire avec la base de données
 * @returns {Promise<number>} Nombre de tâches synchronisées
 */
export async function syncMemoryCache() {
  try {
    console.log('[TaskService] Synchronisation du cache mémoire avec la base de données');
    const dbTasks = await prisma.task.findMany({
      where: {
        schedulerId: { not: null }
      }
    });

    // Vider le cache actuel
    tasksMemoryCache.clear();

    // Remplir avec les données fraîches
    dbTasks.forEach(task => {
      if (task.schedulerId) {
        tasksMemoryCache.set(task.schedulerId, task);
      }
    });

    console.log(`[TaskService] ${dbTasks.length} tâches synchronisées dans le cache mémoire`);
    return dbTasks.length;
  } catch (error) {
    console.error('Erreur lors de la synchronisation du cache mémoire:', error);
    return 0;
  }
}

// Exporter un objet pour les imports nommés
/**
 * Retourne le nombre de tâches actives dans le système
 * @returns {number} Nombre de tâches actives
 */
export function getActiveTaskCount() {
  return tasksMemoryCache.size;
}

/**
 * Nettoie les tâches terminées (completed ou failed)
 * @returns {Promise<number>} Nombre de tâches nettoyées
 */
export async function cleanupFinishedTasks() {
  try {
    // Récupérer d'abord les IDs pour mettre à jour le cache
    const finishedTasks = await prisma.task.findMany({
      where: {
        status: { in: ['completed', 'failed'] }
      },
      select: { schedulerId: true }
    });

    // Supprimer de la base de données
    const result = await prisma.task.deleteMany({
      where: {
        status: { in: ['completed', 'failed'] }
      }
    });

    // Supprimer du cache mémoire
    finishedTasks.forEach(task => {
      if (task.schedulerId && tasksMemoryCache.has(task.schedulerId)) {
        tasksMemoryCache.delete(task.schedulerId);
      }
    });

    console.log(`[TaskService] ${result.count} tâches terminées nettoyées`);
    return result.count;
  } catch (error) {
    console.error('Erreur lors du nettoyage des tâches terminées:', error);
    return 0;
  }
}

export const taskService = {
  saveTask,
  getAllTasks,
  getTaskById,
  getTasksByType,
  updateTaskStatus,
  deleteTask,
  deleteAllTasks,
  deleteTasksByType,
  cleanupExpiredTasks,
  cleanupFinishedTasks,
  syncMemoryCache,
  getActiveTaskCount
};
