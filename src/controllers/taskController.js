/**
 * Contrôleur pour la gestion des tâches planifiées
 */
import { taskService } from '../services/taskService.js';

/**
 * Ajoute une nouvelle tâche à la file d'attente
 * @param {string} type - Type de tâche
 * @param {Object} data - Données associées à la tâche
 * @param {number} priority - Priorité de la tâche (0-10)
 * @returns {Promise<Object>} - Tâche créée
 */
export async function addTask(type, data, priority = 0) {
  return await taskService.addTask(type, data, priority);
}

/**
 * Récupère la prochaine tâche à exécuter
 * @param {Array<string>} types - Types de tâches à récupérer
 * @returns {Promise<Object|null>} - Tâche à exécuter ou null
 */
export async function getNextTask(types = []) {
  return await taskService.getNextTask(types);
}

/**
 * Marque une tâche comme terminée
 * @param {number} taskId - ID de la tâche
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function completeTask(taskId) {
  return await taskService.completeTask(taskId);
}

/**
 * Marque une tâche comme échouée
 * @param {number} taskId - ID de la tâche
 * @param {string} error - Message d'erreur
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function failTask(taskId, error) {
  return await taskService.failTask(taskId, error);
}

export const taskController = {
  addTask,
  getNextTask,
  completeTask,
  failTask
};
