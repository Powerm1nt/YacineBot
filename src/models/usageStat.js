/**
 * Modèle de données pour les statistiques d'utilisation
 */
import { prisma } from './index.js';

/**
 * Crée une nouvelle entrée de statistiques
 */
export async function createUsageStat(data) {
  return await prisma.usageStat.create({
    data: {
      userId: data.userId,
      guildId: data.guildId,
      commandType: data.commandType,
      tokensUsed: data.tokensUsed || 0
    }
  });
}

/**
 * Récupère les statistiques d'un utilisateur
 */
export async function getUserStats(userId, startDate = null, endDate = null) {
  const whereClause = { userId };

  if (startDate || endDate) {
    whereClause.usedAt = {};
    if (startDate) whereClause.usedAt.gte = startDate;
    if (endDate) whereClause.usedAt.lte = endDate;
  }

  return await prisma.usageStat.findMany({
    where: whereClause,
    orderBy: {
      usedAt: 'desc'
    }
  });
}

/**
 * Récupère les statistiques d'une guilde
 */
export async function getGuildStats(guildId, startDate = null, endDate = null) {
  const whereClause = { guildId };

  if (startDate || endDate) {
    whereClause.usedAt = {};
    if (startDate) whereClause.usedAt.gte = startDate;
    if (endDate) whereClause.usedAt.lte = endDate;
  }

  return await prisma.usageStat.findMany({
    where: whereClause,
    orderBy: {
      usedAt: 'desc'
    }
  });
}

/**
 * Calcule les statistiques agrégées
 */
export async function getAggregatedStats(period = 'all') {
  let whereClause = {};

  if (period !== 'all') {
    const today = new Date();
    whereClause.usedAt = {};

    switch (period) {
      case 'today':
        today.setHours(0, 0, 0, 0);
        whereClause.usedAt.gte = today;
        break;
      case 'week':
        today.setDate(today.getDate() - 7);
        whereClause.usedAt.gte = today;
        break;
      case 'month':
        today.setMonth(today.getMonth() - 1);
        whereClause.usedAt.gte = today;
        break;
    }
  }

  const [uniqueUsers, totalCommands, tokenSum, commandTypes] = await Promise.all([
    prisma.usageStat.groupBy({
      by: ['userId'],
      where: whereClause,
      _count: true
    }),
    prisma.usageStat.count({ where: whereClause }),
    prisma.usageStat.aggregate({
      where: whereClause,
      _sum: { tokensUsed: true }
    }),
    prisma.usageStat.groupBy({
      by: ['commandType'],
      where: whereClause,
      _count: true
    })
  ]);

  return {
    uniqueUsers: uniqueUsers.length,
    totalCommands,
    totalTokensUsed: tokenSum._sum.tokensUsed || 0,
    commandUsage: commandTypes.map(item => ({
      type: item.commandType,
      count: item._count
    }))
  };
}

export const usageStatModel = {
  createUsageStat,
  getUserStats,
  getGuildStats,
  getAggregatedStats
};
