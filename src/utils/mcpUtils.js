/**
 * Utility functions for Message Consumer Processor (MCP) features
 * Shared between aiService and analysisService
 */
import { OpenAI } from 'openai/client.mjs'
import dotenv from 'dotenv'
import { safeJsonParse } from './jsonUtils.js'

dotenv.config()

// Initialize OpenAI client
let openAIClient = null

/**
 * Get or initialize the OpenAI client
 * @returns {OpenAI} The OpenAI client instance
 */
export function getOpenAIClient() {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
      baseURL: process.env['OPENAI_API_BASE_URL'] || 'https://api.openai.com/v1',
    })
  }
  return openAIClient
}

/**
 * Check if the DeepSeek API is being used
 * @returns {boolean} True if using DeepSeek API
 */
export function isUsingDeepSeekAPI() {
  const baseURL = process.env['OPENAI_API_BASE_URL'] || ''
  return baseURL.toLowerCase().includes('deepseek')
}

/**
 * Analyze the intent of a message to detect GIF requests or user preferences
 * @param {string} messageContent - Content of the message to analyze
 * @returns {Promise<Object>} - Result of the analysis with intent type and associated data
 */
export async function analyzeMessageIntent(messageContent) {
  try {
    if (!messageContent || messageContent.trim() === '') {
      console.log('[MCP] Empty content, no intent analysis possible')
      return { intentType: 'NONE' }
    }

    console.log(`[MCP] Intent analysis for message: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`)

    const systemInstructions = `Tu es un système d'analyse d'intention de messages.

Analyse le message fourni et détermine s'il s'agit d'une demande de GIF ou d'une commande pour modifier les préférences de communication.

TYPES D'INTENTIONS:
1. GIF_REQUEST - L'utilisateur demande un GIF sur un sujet spécifique
2. TALK_PREFERENCE - L'utilisateur demande de modifier la fréquence de communication (parler plus, parler moins, ou revenir à la normale)
3. NONE - Aucune intention spécifique détectée

RÈGLES POUR LES DEMANDES DE GIF:
- L'utilisateur peut demander un GIF avec des phrases comme "envoie un gif de [sujet]", "montre un gif de [sujet]", etc.
- Si c'est une demande de GIF, extrais le sujet/terme de recherche

RÈGLES POUR LES PRÉFÉRENCES DE COMMUNICATION:
- LESS: L'utilisateur demande que le bot parle moins (ex: "parle moins", "réponds moins souvent")
- MORE: L'utilisateur demande que le bot parle plus (ex: "parle plus", "réponds plus souvent")
- NORMAL: L'utilisateur demande de revenir à un comportement normal (ex: "reviens à la normale", "reset ta communication")

Réponds UNIQUEMENT au format JSON brut (sans formatage markdown, sans bloc de code) avec les propriétés suivantes:
- intentType: "GIF_REQUEST", "TALK_PREFERENCE", ou "NONE"
- data: un objet contenant les données spécifiques à l'intention
  - Pour GIF_REQUEST: { searchTerm: "terme de recherche" }
  - Pour TALK_PREFERENCE: { preference: "LESS", "MORE", ou "NORMAL" }

IMPORTANT: N'utilise PAS de bloc de code markdown (\`\`\`) dans ta réponse, renvoie uniquement l'objet JSON brut.`

    const ai = getOpenAIClient()
    
    // Check if using DeepSeek API
    let response
    if (isUsingDeepSeekAPI()) {
      console.log('[MCP] Using DeepSeek API for intent analysis')

      // Convert parameters for Chat Completions API
      const chatResponse = await ai.chat.completions.create({
        model: process.env.ANALYSIS_MODEL || 'gpt-4.1-nano',
        messages: [
          {
            role: "system",
            content: systemInstructions
          },
          {
            role: "user",
            content: `Message à analyser: ${messageContent}`
          }
        ],
        max_tokens: 500
      })

      // Build a response object compatible with the expected format
      response = {
        output_text: chatResponse.choices[0]?.message?.content || ''
      }
    } else {
      // Use standard Assistants API
      response = await ai.responses.create({
        model: process.env.ANALYSIS_MODEL || 'gpt-4.1-nano',
        input: `Message à analyser: ${messageContent}`,
        instructions: systemInstructions,
        max_tokens: 500
      })
    }

    console.log('[MCP] Intent analysis response received')

    // Extract JSON from response
    const result = safeJsonParse(response.output_text, null)

    // Validate format
    if (!result || !result.intentType) {
      console.error('[MCP] Invalid intent response format:', response.output_text)
      return { intentType: 'NONE' }
    }

    console.log(`[MCP] Detected intent: ${result.intentType}${result.data ? `, Data: ${JSON.stringify(result.data)}` : ''}`)
    return result
  } catch (error) {
    console.error('Error during intent analysis:', error)
    return { intentType: 'NONE' }
  }
}

// Export all MCP utilities
export const mcpUtils = {
  getOpenAIClient,
  isUsingDeepSeekAPI,
  analyzeMessageIntent
}
