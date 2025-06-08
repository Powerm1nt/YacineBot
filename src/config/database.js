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

// Configuration pour Supabase (pour la compatibilité avec l'ancien code)
export const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_KEY,
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

// Vérifier que les variables d'environnement pour Supabase sont définies
export function validateSupabaseConfig() {
  const missingVars = [];

  if (!SUPABASE_CONFIG.url) missingVars.push('SUPABASE_URL');
  if (!SUPABASE_CONFIG.key) missingVars.push('SUPABASE_KEY');

  if (missingVars.length > 0) {
    console.warn(`Variables d'environnement manquantes pour Supabase: ${missingVars.join(', ')}`);
    return false;
  }

  return true;
}
