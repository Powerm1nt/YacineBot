/**
 * Gestionnaire de contexte pour les conversations par serveur/canal/DM
 */

// Séparation des contextes par type de conversation
const guildConversations = new Map() // Conversations de serveurs
const dmConversations = new Map()     // Conversations privées (DM)
const groupConversations = new Map()  // Conversations de groupe

/**
 * Génère une clé de contexte unique pour stocker les conversations
 * @param {Object} message - Message Discord
 * @returns {Object} - Objet contenant le type et la clé de contexte
 */
export function getContextKey(message) {
  if (!message || !message.channel) {
    console.error('Invalid message object passed to getContextKey')
    return { type: 'invalid', key: 'invalid_context' }
  }

  if (message.guild) {
    // Si c'est un message de serveur
    return { 
      type: 'guild', 
      key: `${message.guild.id}_${message.channel.id}` 
    }
  } else if (message.channel.type === 'GROUP_DM') {
    // Si c'est un groupe DM
    return { 
      type: 'group', 
      key: message.channel.id 
    }
  } else {
    // Si c'est un DM privé
    return { 
      type: 'dm', 
      key: message.channel.id 
    }
  }
}

/**
 * Récupère les données de contexte pour un message
 * @param {Object} message - Message Discord
 * @returns {Object} - Données de contexte
 */
export function getContextData(message) {
  const context = getContextKey(message)

  // Sélectionner le stockage approprié selon le type de contexte
  switch (context.type) {
    case 'guild':
      return guildConversations.get(context.key) || {}
    case 'dm':
      return dmConversations.get(context.key) || {}
    case 'group':
      return groupConversations.get(context.key) || {}
    default:
      return {}
  }
}

/**
 * Stocke l'ID de réponse pour un contexte spécifique
 * @param {Object} message - Message Discord
 * @param {string} responseId - ID de réponse OpenAI
 * @returns {boolean} - Succès
 */
export function saveContextResponse(message, responseId) {
  if (!message || !responseId) {
    console.error('Invalid parameters for saveContextResponse')
    return false
  }

  const context = getContextKey(message)
  const contextData = {
    lastResponseId: responseId,
    lastMessageTimestamp: new Date().toISOString(),
    lastAuthorId: message.author.id,
    lastAuthorName: message.author.globalName || message.author.username,
    participants: getParticipants(context, message.author.id, message.author.globalName || message.author.username)
  }

  // Sauvegarder dans le stockage approprié
  switch (context.type) {
    case 'guild':
      guildConversations.set(context.key, contextData)
      break
    case 'dm':
      dmConversations.set(context.key, contextData)
      break
    case 'group':
      groupConversations.set(context.key, contextData)
      break
    default:
      return false
  }

  console.log(`Stored response ID ${responseId} for ${context.type} context ${context.key}`)
  return true
}

/**
 * Met à jour la liste des participants récents dans un contexte
 * @param {Object} context - Objet de contexte avec type et clé
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userName - Nom de l'utilisateur
 * @returns {Array} - Liste mise à jour des participants
 */
function getParticipants(context, userId, userName) {
  let contextData = {}

  // Récupérer les données de contexte selon le type
  switch (context.type) {
    case 'guild':
      contextData = guildConversations.get(context.key) || {}
      break
    case 'dm':
      contextData = dmConversations.get(context.key) || {}
      break
    case 'group':
      contextData = groupConversations.get(context.key) || {}
      break
  }

  const participants = contextData.participants || []

  // Vérifier si l'utilisateur est déjà dans la liste
  const existingIndex = participants.findIndex(p => p.id === userId)

  if (existingIndex >= 0) {
    // Mettre à jour les informations de l'utilisateur existant
    const existing = participants[existingIndex]
      // Supprimer l'entrée existante
      participants.splice(existingIndex, 1)

      // Ajouter l'utilisateur mis à jour au début de la liste
      participants.unshift({
        ...existing,
        name: userName,  // Mettre à jour le nom au cas où il aurait changé
        messageCount: (existing.messageCount || 0) + 1,
        lastActive: new Date().toISOString()
      })
  } else {
    // Ajouter l'utilisateur au début de la liste
    participants.unshift({
      id: userId,
      name: userName,
      messageCount: 1,
      firstSeen: new Date().toISOString(),
      lastActive: new Date().toISOString()
    })
  }

  // Limiter à 10 participants récents
  return participants.slice(0, 10)
}

/**
 * Réinitialise le contexte pour un message
 * @param {Object} message - Message Discord
 * @returns {boolean} - Succès
 */
export function resetContext(message) {
  if (!message) {
    console.error('Invalid message object passed to resetContext')
    return false
  }

  const context = getContextKey(message)

  // Supprimer le contexte du stockage approprié
  switch (context.type) {
    case 'guild':
      guildConversations.delete(context.key)
      break
    case 'dm':
      dmConversations.delete(context.key)
      break
    case 'group':
      groupConversations.delete(context.key)
      break
    default:
      return false
  }

  console.log(`Reset context for ${context.type} context ${context.key}`)
  return true
}

/**
 * Récupère l'ID de la dernière réponse pour un message
 * @param {Object} message - Message Discord
 * @returns {string|null} - ID de la dernière réponse ou null
 */
export function getLastResponseId(message) {
  const contextData = getContextData(message)
  return contextData.lastResponseId || null
}

/**
 * Récupère la liste des participants pour un contexte
 * @param {Object} message - Message Discord
 * @returns {Array} - Liste des participants
 */
export function getParticipantsList(message) {
  const contextData = getContextData(message)
  return contextData.participants || []
}

/**
 * Formate une liste de participants pour être incluse dans le contexte
 * @param {Array} participants - Liste des participants
 * @returns {string} - Texte formaté des participants
 */
export function formatParticipantsInfo(participants) {
  if (!participants || participants.length === 0) {
    return ''
  }

  const participantsInfo = participants.map(p => {
    return `${p.name} (ID: ${p.id})`
  }).join(', ')

  return `[Participants: ${participantsInfo}]`
}

/**
 * Nettoie les contextes inactifs depuis plus de 24 heures
 * @returns {number} - Nombre de contextes nettoyés
 */
export function cleanupOldContexts() {
  let cleanCount = 0
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 heures en millisecondes

  // Fonction helper pour nettoyer un stockage spécifique
  const cleanupStorage = (storage, type) => {
    let count = 0
    storage.forEach((contextData, contextKey) => {
      if (contextData.lastMessageTimestamp) {
        const lastActivity = new Date(contextData.lastMessageTimestamp)
        if (lastActivity < oneDayAgo) {
          storage.delete(contextKey)
          count++
        }
      }
    })
    console.log(`Cleaned up ${count} inactive ${type} conversation contexts`)
    return count
  }

  // Nettoyer chaque type de stockage séparément
  cleanCount += cleanupStorage(guildConversations, 'guild')
  cleanCount += cleanupStorage(dmConversations, 'DM')
  cleanCount += cleanupStorage(groupConversations, 'group')

  console.log(`Cleaned up ${cleanCount} total inactive conversation contexts`)
  return cleanCount
}
