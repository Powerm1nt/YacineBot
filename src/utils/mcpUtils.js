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
 * Detect the language of a message
 * @param {string} text - Text to analyze
 * @returns {Promise<string>} - Detected language code (e.g., 'en', 'fr', 'es')
 */
export async function detectLanguage(text) {
  try {
    if (!text || text.trim() === '') {
      console.log('[MCP] Empty text, defaulting to English')
      return 'en'
    }

    console.log(`[MCP] Language detection for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)

    const systemInstructions = `You are a language detection system.

Analyze the provided text and determine its language.

Respond ONLY with the ISO 639-1 language code (2 letters) for the detected language.
Examples:
- English: en
- French: fr
- Spanish: es
- German: de
- Italian: it
- Portuguese: pt
- Russian: ru
- Japanese: ja
- Chinese: zh
- Arabic: ar

If you cannot determine the language or the text is too short, respond with "en" (English).

IMPORTANT: Your response should ONLY contain the 2-letter language code, nothing else.`

    const ai = getOpenAIClient()

    // Check if using DeepSeek API
    let response
    if (isUsingDeepSeekAPI()) {
      console.log('[MCP] Using DeepSeek API for language detection')

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
            content: `Text to analyze: ${text}`
          }
        ],
        max_tokens: 10
      })

      // Build a response object compatible with the expected format
      response = {
        output_text: chatResponse.choices[0]?.message?.content || 'en'
      }
    } else {
      // Use standard Assistants API
      response = await ai.responses.create({
        model: process.env.ANALYSIS_MODEL || 'gpt-4.1-nano',
        input: `Text to analyze: ${text}`,
        instructions: systemInstructions,
        max_tokens: 10
      })
    }

    console.log('[MCP] Language detection response received')

    // Clean up the response to ensure it's just a language code
    const languageCode = response.output_text.trim().toLowerCase().substring(0, 2)

    // Validate that it's a plausible language code
    const validLanguageCodes = ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ar', 'nl', 'sv', 'no', 'fi', 'da', 'pl', 'tr', 'ko', 'th', 'vi', 'id', 'ms', 'hi', 'bn', 'fa', 'he', 'ur', 'el']

    const detectedLanguage = validLanguageCodes.includes(languageCode) ? languageCode : 'en'
    console.log(`[MCP] Detected language: ${detectedLanguage}`)

    return detectedLanguage
  } catch (error) {
    console.error('Error during language detection:', error)
    return 'en' // Default to English in case of error
  }
}

/**
 * Force a specific language for the context
 * @param {string} languageCode - ISO 639-1 language code to force
 * @param {string} originalText - Original text to translate if needed
 * @returns {Promise<Object>} - Result with success status and translated text if applicable
 */
export async function forceContextLanguage(languageCode, originalText = '') {
  try {
    console.log(`[MCP] Forcing context language to: ${languageCode}`)

    // Store the forced language in environment variable for other services to use
    process.env.FORCED_LANGUAGE = languageCode

    // If original text is provided and different from forced language, translate it
    if (originalText && originalText.trim() !== '') {
      const detectedLanguage = await detectLanguage(originalText)

      // Only translate if the detected language is different from the forced language
      if (detectedLanguage !== languageCode) {
        console.log(`[MCP] Translating text from ${detectedLanguage} to ${languageCode}`)

        const systemInstructions = `You are a translation system.

Translate the provided text from ${detectedLanguage} to ${languageCode}.

Respond ONLY with the translated text, no explanations or additional content.`

        const ai = getOpenAIClient()

        // Check if using DeepSeek API
        let response
        if (isUsingDeepSeekAPI()) {
          console.log('[MCP] Using DeepSeek API for translation')

          // Convert parameters for Chat Completions API
          const chatResponse = await ai.chat.completions.create({
            model: process.env.GPT_MODEL || 'gpt-4.1-mini',
            messages: [
              {
                role: "system",
                content: systemInstructions
              },
              {
                role: "user",
                content: `Text to translate: ${originalText}`
              }
            ],
            max_tokens: 1000
          })

          // Build a response object compatible with the expected format
          response = {
            output_text: chatResponse.choices[0]?.message?.content || originalText
          }
        } else {
          // Use standard Assistants API
          response = await ai.responses.create({
            model: process.env.GPT_MODEL || 'gpt-4.1-mini',
            input: `Text to translate: ${originalText}`,
            instructions: systemInstructions,
            max_tokens: 1000
          })
        }

        console.log('[MCP] Translation completed')

        return {
          success: true,
          originalLanguage: detectedLanguage,
          targetLanguage: languageCode,
          originalText: originalText,
          translatedText: response.output_text
        }
      }
    }

    return {
      success: true,
      language: languageCode,
      message: `Context language set to ${languageCode}`
    }
  } catch (error) {
    console.error('Error forcing context language:', error)
    return {
      success: false,
      error: error.message
    }
  }
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

    const systemInstructions = `You are a message intent analysis system.

Analyze the provided message and determine if it's a GIF request or a command to modify communication preferences.

INTENT TYPES:
1. GIF_REQUEST - The user is requesting a GIF on a specific topic
2. TALK_PREFERENCE - The user is requesting to modify the communication frequency (talk more, talk less, or return to normal)
3. NONE - No specific intent detected

RULES FOR GIF REQUESTS:
- The user may request a GIF with phrases like "send a gif of [topic]", "show a gif of [topic]", etc.
- If it's a GIF request, extract the subject/search term

RULES FOR COMMUNICATION PREFERENCES:
- LESS: The user asks the bot to talk less (e.g., "talk less", "respond less often")
- MORE: The user asks the bot to talk more (e.g., "talk more", "respond more often")
- NORMAL: The user asks to return to normal behavior (e.g., "return to normal", "reset your communication")

Respond ONLY in raw JSON format (without markdown formatting, without code block) with the following properties:
- intentType: "GIF_REQUEST", "TALK_PREFERENCE", or "NONE"
- data: an object containing intent-specific data
  - For GIF_REQUEST: { searchTerm: "search term" }
  - For TALK_PREFERENCE: { preference: "LESS", "MORE", or "NORMAL" }

IMPORTANT: DO NOT use markdown code block (\`\`\`) in your response, return only the raw JSON object.

LANGUAGE ADAPTATION:
- Always analyze the message in the language it was written in
- If the message is in a language other than English, adapt your analysis to that language
- The response format should still be JSON, but the analysis should consider the original language`

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
            content: `Message to analyze: ${messageContent}`
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
        input: `Message to analyze: ${messageContent}`,
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
  detectLanguage,
  forceContextLanguage,
  analyzeMessageIntent
}
