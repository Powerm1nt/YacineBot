import { OpenAI } from 'openai/client.mjs';
import dotenv from 'dotenv';

dotenv.config();

// Fonction pour vérifier si on utilise l'API DeepSeek
function isUsingDeepSeekAPI() {
  const baseURL = process.env['OPENAI_API_BASE_URL'] || '';
  return baseURL.toLowerCase().includes('deepseek');
}

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
  baseURL: process.env['OPENAI_API_BASE_URL'] || 'https://api.openai.com/v1',
});

// Catégories de questions pour varier les interactions
const QUESTION_CATEGORIES = [
  'hypothétique',     // Ex: "Que ferais-tu si tu avais un super pouvoir ?"
  'préférence',       // Ex: "Tu préfères les films d'action ou les comédies ?"
  'opinion',          // Ex: "Que penses-tu de la dernière mise à jour de Discord ?"
  'expérience',       // Ex: "Quelle est ta meilleure expérience de gaming ?"
  'humour',           // Ex: "Raconte une blague ou une anecdote drôle"
  'choix',            // Ex: "Pizza ou burger, il faut choisir !"
  'créativité',       // Ex: "Invente un nouveau mot et sa définition"
  'conseil',          // Ex: "Quel conseil donnerais-tu pour apprendre à coder ?"
  'débat léger',      // Ex: "Le chocolat dans les pâtes, pour ou contre ?"
  'partage'           // Ex: "Partage ton film préféré du moment"
];

/**
 * Génère une question personnalisée pour un utilisateur spécifique
 * @param {string} username - Nom de l'utilisateur
 * @returns {Promise<string>} Question générée
 */
export async function generatePersonalizedQuestion(username) {
  const randomCategory = QUESTION_CATEGORIES[Math.floor(Math.random() * QUESTION_CATEGORIES.length)];

  try {
    const systemPrompt = `Génère une question ${randomCategory} courte, amicale et engageante pour un utilisateur nommé ${username}. 
La question doit être directe, entre 10 et 20 mots maximum. 
Ne pas ajouter d'introduction ou de formule de politesse, donne juste la question.
Utilise le tutoiement et un ton décontracté entre amis.`;

    let response;

    // Vérifier si on utilise l'API DeepSeek
    if (isUsingDeepSeekAPI()) {
      console.log(`[MessageGenerator] Utilisation de l'API DeepSeek avec chat.completions.create`);

      // Convertir les paramètres pour l'API Chat Completions
      const chatResponse = await openai.chat.completions.create({
        model: process.env.GPT_MODEL || 'gpt-4.1-mini',
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Génère une question ${randomCategory} pour ${username}`
          }
        ],
        max_tokens: 100 // Limite appropriée pour les questions courtes
      });

      // Construire un objet de réponse compatible avec le format attendu
      response = {
        output_text: chatResponse.choices[0]?.message?.content || ''
      };
    } else {
      // Utiliser l'API Assistants standard
      response = await openai.responses.create({
        model: process.env.GPT_MODEL || 'gpt-4.1-mini',
        input: `Génère une question ${randomCategory} pour ${username}`,
        instructions: systemPrompt,
        max_tokens: 100 // Limite appropriée pour les questions courtes
      });
    }

    return response.output_text || `Hey ${username}, ça va aujourd'hui ?`;
  } catch (error) {
    console.error('Erreur lors de la génération de question personnalisée:', error);

    // Questions de secours par catégorie en cas d'erreur API
    const fallbackQuestions = {
      'hypothétique': `${username}, si tu pouvais voyager n'importe où, ce serait où ?`,
      'préférence': `Tu préfères les jeux solo ou multijoueur, ${username} ?`,
      'opinion': `${username}, tu penses quoi de la dernière mise à jour de Discord ?`,
      'expérience': `Raconte ta meilleure expérience de gaming, ${username} !`,
      'humour': `${username}, balance ta meilleure blague !`,
      'choix': `${username}, tu choisis quoi : ne plus jamais manger de pizza ou de burger ?`,
      'créativité': `${username}, invente un nouveau mot pour décrire quand on est à la fois fatigué et excité`,
      'conseil': `${username}, quel conseil donnerais-tu à quelqu'un qui débute en programmation ?`,
      'débat léger': `${username}, ketchup sur les pâtes : crime culinaire ou délice incompris ?`,
      'partage': `${username}, c'est quoi ta chanson du moment ?`
    };

    return fallbackQuestions[randomCategory] || `Hey ${username}, comment ça va aujourd'hui ?`;
  }
}

/**
 * Génère une question pour un groupe ou un serveur
 * @returns {Promise<string>} Question générée
 */
export async function generateGroupQuestion() {
  const randomCategory = QUESTION_CATEGORIES[Math.floor(Math.random() * QUESTION_CATEGORIES.length)];

  try {
    const systemPrompt = `Génère une question ${randomCategory} courte et engageante pour animer une conversation de groupe sur Discord. 
La question doit être directe, entre 10 et 20 mots maximum.
Utilise le pluriel ("vous") et un ton décontracté entre amis.
Ne pas ajouter d'introduction, donne juste la question.`;

    let response;

    // Vérifier si on utilise l'API DeepSeek
    if (isUsingDeepSeekAPI()) {
      console.log(`[MessageGenerator] Utilisation de l'API DeepSeek avec chat.completions.create pour groupe`);

      // Convertir les paramètres pour l'API Chat Completions
      const chatResponse = await openai.chat.completions.create({
        model: process.env.GPT_MODEL || 'gpt-4.1-mini',
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Génère une question ${randomCategory} pour un groupe`
          }
        ],
        max_tokens: 100 // Limite appropriée pour les questions courtes
      });

      // Construire un objet de réponse compatible avec le format attendu
      response = {
        output_text: chatResponse.choices[0]?.message?.content || ''
      };
    } else {
      // Utiliser l'API Assistants standard
      response = await openai.responses.create({
        model: process.env.GPT_MODEL || 'gpt-4.1-mini',
        input: `Génère une question ${randomCategory} pour un groupe`,
        instructions: systemPrompt,
        max_tokens: 100 // Limite appropriée pour les questions courtes
      });
    }

    return response.output_text || `Vous préférez les jeux compétitifs ou coopératifs ?`;
  } catch (error) {
    console.error('Erreur lors de la génération de question de groupe:', error);

    // Questions de secours par catégorie en cas d'erreur API
    const fallbackQuestions = {
      'hypothétique': `Si vous pouviez ajouter une fonctionnalité à Discord, ce serait quoi ?`,
      'préférence': `Vous préférez jouer sur PC, console ou mobile ?`,
      'opinion': `Qu'est-ce que vous pensez des nouveaux emojis Discord ?`,
      'expérience': `Quel est votre meilleur souvenir de gaming entre potes ?`,
      'humour': `Qui a une blague à partager aujourd'hui ?`,
      'choix': `Vous choisissez quoi : avoir l'internet le plus rapide ou ne plus jamais avoir de bug ?`,
      'créativité': `Inventez un nom pour un nouveau serveur Discord qu'on créerait ensemble`,
      'conseil': `Quel conseil donneriez-vous à quelqu'un qui rejoint ce serveur ?`,
      'débat léger': `Les ananas sur la pizza, pour ou contre ? Défendez votre position !`,
      'partage': `Partagez le dernier jeu auquel vous avez joué ce week-end`
    };

    return fallbackQuestions[randomCategory] || `Comment se passe votre journée à tous ?`;
  }
}
