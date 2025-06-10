/**
 * Controller for scheduled tasks management
 */
import { taskService } from '../services/taskService.js';

/**
 * Adds a new task to the queue
 * @param {string} type - Task type
 * @param {Object} data - Data associated with the task
 * @param {number} priority - Task priority (0-10)
 * @returns {Promise<Object>} - Created task
 */
export async function addTask(type, data, priority = 0) {
  return await taskService.addTask(type, data, priority);
}

/**
 * Gets the next task to execute
 * @param {Array<string>} types - Types of tasks to retrieve
 * @returns {Promise<Object|null>} - Task to execute or null
 */
export async function getNextTask(types = []) {
  return await taskService.getNextTask(types);
}

/**
 * Marks a task as completed
 * @param {number} taskId - Task ID
 * @returns {Promise<boolean>} - Operation success
 */
export async function completeTask(taskId) {
  return await taskService.completeTask(taskId);
}

/**
 * Marks a task as failed
 * @param {number} taskId - Task ID
 * @param {string} error - Error message
 * @returns {Promise<boolean>} - Operation success
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
