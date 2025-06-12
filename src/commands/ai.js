import { aiService } from '../services/aiService.js'

export const metadata = {
  name: 'ai',
  description: 'Interagir avec l\'assistant IA',
  restricted: false,
  usage: '<message>'
}

export async function ai(client) {
  // Initialiser le service AI avec le client Discord
  return await aiService.initialize(client)
}
