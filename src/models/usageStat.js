/**
 * Data model for usage statistics
 */
import { prisma } from './prisma.js';

/**
 * Creates a new statistics entry
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
 * Retrieves statistics for a user
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
 * Retrieves statistics for a guild
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
 * Calculates aggregated statistics
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
