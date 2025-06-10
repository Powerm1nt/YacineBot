import { PrismaClient } from '@prisma/client';

let prisma;

try {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Vérifier la connexion
  prisma.$connect()
    .then(() => console.log('Connexion à la base de données établie'))
    .catch(err => console.error('Erreur de connexion à la base de données:', err));

  // Gestion propre de la fermeture
  process.on('exit', () => {
    prisma.$disconnect()
      .catch(err => console.error('Erreur lors de la déconnexion de Prisma:', err));
  });
} catch (error) {
  console.error('Erreur lors de l\'initialisation de Prisma:', error);

  // Vérifier si l'erreur est liée à l'absence de génération du client
  if (error.message && error.message.includes('prisma generate')) {
    console.error('\n\nERREUR: Le client Prisma n\'a pas été généré. Exécutez:\nnpx prisma generate\n\n');
  }

  // Créer un client factice pour éviter les erreurs d'exécution
  prisma = new Proxy({}, {
    get: (target, prop) => {
      // Renvoyer une fonction qui lève une erreur pour toutes les méthodes
      if (prop === '$connect' || prop === '$disconnect') {
        return () => Promise.resolve();
      }
      return () => {
        console.error(`Erreur: Le client Prisma n'est pas initialisé correctement. Opération '${prop}' impossible.`);
        return Promise.reject(new Error('Client Prisma non initialisé'));
      };
    }
  });
}

export { prisma };
