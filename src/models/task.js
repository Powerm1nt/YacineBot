/**
 * Modèle de données pour les tâches
 */
import { prisma } from './index.js';

/**
 * Récupère une tâche par son ID
 */
export async function getTaskById(id) {
  return await prisma.task.findUnique({
    where: { id }
  });
}

/**
 * Crée une nouvelle tâche
 */
export async function createTask(data) {
  return await prisma.task.create({
    data: {
      type: data.type,
      data: data.data || {},
      priority: data.priority || 0,
      status: 'pending'
    }
  });
}

/**
 * Met à jour une tâche
 */
export async function updateTask(id, data) {
  return await prisma.task.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date()
    }
  });
}

/**
 * Récupère les tâches en attente
 */
export async function getPendingTasks(types = [], limit = 10) {
  const whereClause = {
    status: 'pending',
    OR: [
      { nextRetryAt: null },
      { nextRetryAt: { lte: new Date() } }
    ]
  };

  if (types && types.length > 0) {
    whereClause.type = { in: types };
  }

  return await prisma.task.findMany({
    where: whereClause,
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' }
    ],
    take: limit
  });
}

/**
 * Supprime les tâches terminées datant de plus de N jours
 */
export async function cleanupCompletedTasks(daysToKeep = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  return await prisma.task.deleteMany({
    where: {
      status: 'completed',
      completedAt: {
        lt: cutoffDate
      }
    }
  });
}

export const taskModel = {
  getTaskById,
  createTask,
  updateTask,
  getPendingTasks,
  cleanupCompletedTasks
};
