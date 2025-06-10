/**
 * Service pour gérer les statistiques d'utilisation
 */
import { prisma } from './prisma.js';

/**
 * Enregistre une nouvelle entrée dans les statistiques d'utilisation
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {string} commandType - Type de commande utilisée
 * @param {number} tokensUsed - Nombre de tokens utilisés (si applicable)
 * @param {string} guildId - ID de la guilde (facultatif)
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function logUsage(userId, commandType, tokensUsed = 0, guildId = null) {
  try {
    await prisma.usageStat.create({
      data: {
        userId,
        guildId,
        commandType,
        tokensUsed
      }
    });

    return true;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des statistiques:', error);
    return false;
  }
}

/**
 * Récupère les statistiques d'utilisation d'un utilisateur
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {Date} startDate - Date de début pour les statistiques
 * @param {Date} endDate - Date de fin pour les statistiques
 * @returns {Promise<Array>} - Statistiques d'utilisation
 */
export async function getUserStats(userId, startDate = null, endDate = null) {
  try {
    const whereClause = { userId };

    if (startDate || endDate) {
      whereClause.usedAt = {};
      if (startDate) whereClause.usedAt.gte = startDate;
      if (endDate) whereClause.usedAt.lte = endDate;
    }

    const stats = await prisma.usageStat.findMany({
      where: whereClause,
      orderBy: {
        usedAt: 'desc'
      }
    });

    return stats;
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques utilisateur:', error);
    return [];
  }
}

/**
 * Récupère les statistiques d'utilisation d'une guilde
 * @param {string} guildId - ID Discord de la guilde
 * @param {Date} startDate - Date de début pour les statistiques
 * @param {Date} endDate - Date de fin pour les statistiques
 * @returns {Promise<Array>} - Statistiques d'utilisation
 */
export async function getGuildStats(guildId, startDate = null, endDate = null) {
  try {
    const whereClause = { guildId };

    if (startDate || endDate) {
      whereClause.usedAt = {};
      if (startDate) whereClause.usedAt.gte = startDate;
      if (endDate) whereClause.usedAt.lte = endDate;
    }

    const stats = await prisma.usageStat.findMany({
      where: whereClause,
      orderBy: {
        usedAt: 'desc'
      }
    });

    return stats;
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques de guilde:', error);
    return [];
  }
}

/**
 * Obtient un résumé des statistiques d'utilisation globales
 * @returns {Promise<Object>} - Résumé des statistiques
 */
export async function getUsageSummary() {
  try {
    const totalUsers = await prisma.usageStat.groupBy({
      by: ['userId'],
      _count: true
    });

    const totalCommands = await prisma.usageStat.count();

    const totalTokens = await prisma.usageStat.aggregate({
      _sum: {
        tokensUsed: true
      }
    });

    const commandTypes = await prisma.usageStat.groupBy({
      by: ['commandType'],
      _count: true
    });

    return {
      uniqueUsers: totalUsers.length,
      totalCommands,
      totalTokensUsed: totalTokens._sum.tokensUsed || 0,
      commandUsage: commandTypes.map(item => ({
        type: item.commandType,
        count: item._count
      }))
    };
  } catch (error) {
    console.error('Erreur lors de la récupération du résumé des statistiques:', error);
    return {
      uniqueUsers: 0,
      totalCommands: 0,
      totalTokensUsed: 0,
      commandUsage: []
    };
  }
}

export const usageStatsService = {
  logUsage,
  getUserStats,
  getGuildStats,
  getUsageSummary
};
