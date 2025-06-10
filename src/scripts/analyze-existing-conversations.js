/**
 * Script pour analyser les conversations existantes
 * Ce script met à jour les scores de pertinence pour les conversations et messages existants
 */

import { prisma } from '../models/prisma.js';
import { analysisService } from '../services/analysisService.js';
import dotenv from 'dotenv';

dotenv.config();

async function analyzeExistingConversations() {
  console.log('Début de l\'analyse des conversations existantes...');

  try {
    // Récupérer toutes les conversations
    const conversations = await prisma.conversation.findMany({
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    console.log(`Nombre de conversations à analyser: ${conversations.length}`);

    let processedCount = 0;
    let errorCount = 0;

    for (const conversation of conversations) {
      try {
        console.log(`Analyse de la conversation ${conversation.id} (canal: ${conversation.channelId})...`);

        // Analyser la conversation globale
        const conversationAnalysis = await analysisService.analyzeConversationRelevance(
          conversation.messages
        );

        // Mettre à jour la conversation
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            relevanceScore: conversationAnalysis.relevanceScore,
            topicSummary: conversationAnalysis.topicSummary,
            updatedAt: new Date()
          }
        });

        // Analyser les messages individuels
        for (const message of conversation.messages) {
          if (!message.relevanceScore || message.relevanceScore === 0) {
            const context = message.content.substring(0, 200);
            const analysis = await analysisService.analyzeMessageRelevance(
              message.content,
              context
            );

            await prisma.message.update({
              where: { id: message.id },
              data: {
                relevanceScore: analysis.relevanceScore,
                hasKeyInfo: analysis.hasKeyInfo
              }
            });
          }
        }

        processedCount++;
        console.log(`Conversation ${conversation.id} analysée avec succès.`);
      } catch (error) {
        console.error(`Erreur lors de l'analyse de la conversation ${conversation.id}:`, error);
        errorCount++;
      }

      // Pause pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Analyse terminée. ${processedCount} conversations traitées, ${errorCount} erreurs.`);
  } catch (error) {
    console.error('Erreur globale lors de l\'analyse des conversations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
analyzeExistingConversations()
  .then(() => {
    console.log('Script terminé avec succès');
    process.exit(0);
  })
  .catch(error => {
    console.error('Erreur lors de l\'exécution du script:', error);
    process.exit(1);
  });
