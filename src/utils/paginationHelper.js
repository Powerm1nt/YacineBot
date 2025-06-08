/**
 * Utilitaire pour gérer la pagination dans les messages Discord
 */

/**
 * Crée un gestionnaire de pagination pour un message
 * @param {Object} message - Message Discord original
 * @param {Array} items - Éléments à paginer
 * @param {Function} renderPage - Fonction pour rendre une page
 * @param {Object} options - Options supplémentaires
 * @returns {Object} - Contrôleur de pagination
 */
export async function createPagination(message, items, renderPage, options = {}) {
  const {
    itemsPerPage = 10,
    timeout = 300000, // 5 minutes par défaut
    startPage = 0,
    reactions = {
      previous: '⬅️',
      next: '➡️',
      first: '⏪',
      last: '⏩',
      stop: '⏹️'
    },
    filter = (reaction, user) => user.id === message.author.id
  } = options;

  // Calculer le nombre total de pages
  const pageCount = Math.ceil(items.length / itemsPerPage);

  if (pageCount === 0) {
    return null; // Aucun élément à afficher
  }

  let currentPage = startPage;

  // Fonction pour obtenir les éléments de la page actuelle
  const getCurrentPageItems = () => {
    const start = currentPage * itemsPerPage;
    const end = Math.min(start + itemsPerPage, items.length);
    return items.slice(start, end);
  };

  // Fonction pour mettre à jour le message avec la page actuelle
  const updateMessage = async () => {
    const pageItems = getCurrentPageItems();
    const content = renderPage(pageItems, currentPage, pageCount);

    try {
      await paginatedMessage.edit(content);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du message paginé:', error);
    }
  };

  // Créer le message initial
  const initialContent = renderPage(getCurrentPageItems(), currentPage, pageCount);
  const paginatedMessage = await message.channel.send(initialContent);

  // Ajouter les réactions de navigation
  if (pageCount > 1) {
    try {
      if (pageCount > 2) await paginatedMessage.react(reactions.first);
      await paginatedMessage.react(reactions.previous);
      await paginatedMessage.react(reactions.next);
      if (pageCount > 2) await paginatedMessage.react(reactions.last);
      await paginatedMessage.react(reactions.stop);
    } catch (error) {
      console.error('Erreur lors de l\'ajout des réactions:', error);
    }
  }

  // Configurer le collecteur de réactions
  const collector = paginatedMessage.createReactionCollector({ filter, time: timeout });

  // Gérer les événements de réaction
  collector.on('collect', async (reaction, user) => {
    // Supprimer la réaction de l'utilisateur pour un meilleur UX
    try {
      reaction.users.remove(user.id);
    } catch (error) {
      console.error('Impossible de supprimer la réaction:', error);
    }

    // Traiter la réaction
    switch (reaction.emoji.name) {
      case reactions.previous:
        currentPage = Math.max(0, currentPage - 1);
        break;
      case reactions.next:
        currentPage = Math.min(pageCount - 1, currentPage + 1);
        break;
      case reactions.first:
        currentPage = 0;
        break;
      case reactions.last:
        currentPage = pageCount - 1;
        break;
      case reactions.stop:
        collector.stop();
        return;
    }

    // Mettre à jour le message
    await updateMessage();
  });

  // Gérer la fin de la collection
  collector.on('end', async () => {
    try {
      // Supprimer toutes les réactions à la fin
      await paginatedMessage.reactions.removeAll();
    } catch (error) {
      console.error('Impossible de supprimer les réactions:', error);
    }
  });

  // Retourner le contrôleur de pagination
  return {
    message: paginatedMessage,
    collector,
    updatePage: async (pageNum) => {
      if (pageNum >= 0 && pageNum < pageCount) {
        currentPage = pageNum;
        await updateMessage();
      }
    },
    stop: () => collector.stop()
  };
}
