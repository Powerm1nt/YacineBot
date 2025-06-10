/**
 * Configuration de la base de données
 */
import dotenv from 'dotenv';

dotenv.config();

// Configuration pour Prisma
export const DATABASE_CONFIG = {
  url: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
};

// Vérifier que les variables d'environnement nécessaires sont définies
export function validateDatabaseConfig() {
  const missingVars = [];

  if (!DATABASE_CONFIG.url) missingVars.push('DATABASE_URL');
  if (!DATABASE_CONFIG.directUrl) missingVars.push('DIRECT_URL');

  if (missingVars.length > 0) {
    console.error(`Variables d'environnement manquantes pour la base de données: ${missingVars.join(', ')}`);
    return false;
  }

  return true;
}

