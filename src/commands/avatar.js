import fetch from 'node-fetch';

// Constante pour la taille maximale de l'image (8 Mo)
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 Mo en octets

export async function avatar(client, message, args) {
  if (!args || args.length === 0) {
      message.reply('Veuillez spécifier un lien vers une image. Exemples: \n- f!avatar https://exemple.com/image.png (avatar global)\n- f!avatar https://exemple.com/image.png server (avatar de serveur)');
      return;
    }

    // Vérifier si l'option serveur est spécifiée
    const isServerAvatar = args.length > 1 && ['server', 'serveur', 'guild'].includes(args[args.length - 1].toLowerCase());

    // Si l'option serveur est spécifiée, on retire le dernier argument
    const imageUrl = isServerAvatar ? args.slice(0, -1).join(' ') : args[0];

      // Déclarer les variables dans le scope de la fonction pour qu'elles soient accessibles partout
      let imageBuffer;
      let statusMessage;

  try {
    console.log(`Téléchargement de l'image à partir de: ${imageUrl}...`);

    // Vérifier d'abord la taille sans télécharger tout le contenu
    const headResponse = await fetch(imageUrl, { method: 'HEAD' });

    if (!headResponse.ok) {
      throw new Error(`Impossible d'accéder à l'image (${headResponse.status}: ${headResponse.statusText})`);
    }

    // Vérifier la taille de l'image si l'en-tête Content-Length est disponible
    const contentLength = headResponse.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_IMAGE_SIZE) {
        throw new Error(`L'image est trop volumineuse (${(size / (1024 * 1024)).toFixed(2)} Mo). La taille maximale autorisée est de ${MAX_IMAGE_SIZE / (1024 * 1024)} Mo.`);
      }
      console.log(`Taille de l'image: ${(size / 1024).toFixed(2)} Ko`);
    } else {
      console.log('Impossible de déterminer la taille de l\'image à partir des en-têtes.');
    }

    // Télécharger l'image avec un timeout et une limite de taille
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondes timeout

    try {
      const response = await fetch(imageUrl, { 
        signal: controller.signal,
        size: MAX_IMAGE_SIZE + 1 // Pour détecter si le fichier dépasse la limite
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Impossible de télécharger l'image (${response.status}: ${response.statusText})`);
      }

      // Vérifier si le contenu est une image
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Le lien ne contient pas une image valide (type: ${contentType})`);
      }

      // Vérifier les extensions autorisées
      const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

      // Extraire l'extension de l'URL en gérant les paramètres de requête
      let extension = '';

      // Parse l'URL pour extraire le chemin (sans les paramètres)
      try {
        // Essayer de parser l'URL complète
        const urlObj = new URL(imageUrl);
        const pathname = urlObj.pathname;

        // Extraire l'extension du pathname
        const filenameMatch = pathname.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
        if (filenameMatch && filenameMatch[1]) {
          extension = filenameMatch[1].toLowerCase();
        }
      } catch (e) {
        // Si l'URL est invalide, on essaie une approche plus simple
        const filenameParts = imageUrl.split('?')[0].split('#')[0].split('.');
        if (filenameParts.length > 1) {
          extension = filenameParts.pop().toLowerCase();
        }
      }

      // Si l'extension n'a pas été trouvée, on vérifie dans le content-type
      if (!validExtensions.includes(extension)) {
        const mimeToExt = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/gif': 'gif',
          'image/webp': 'webp'
        };

        const mimeExt = mimeToExt[contentType];
        if (mimeExt) {
          extension = mimeExt;
          console.log(`Aucune extension trouvée dans l'URL, utilisation du type MIME: ${contentType} -> ${extension}`);
        } else {
          throw new Error(`Format de fichier non pris en charge. Formats autorisés: ${validExtensions.join(', ')}`);
        }
      }

      console.log(`Extension d'image détectée: ${extension}`);

      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      const totalSize = imageBuffer.length;

      // Vérifier la taille après téléchargement
      if (totalSize > MAX_IMAGE_SIZE) {
        throw new Error(`L'image est trop volumineuse (${(totalSize / (1024 * 1024)).toFixed(2)} Mo). La taille maximale autorisée est de ${MAX_IMAGE_SIZE / (1024 * 1024)} Mo.`);
      }

      console.log(`Image téléchargée avec succès. Taille: ${(totalSize / 1024).toFixed(2)} Ko`);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Le téléchargement de l\'image a pris trop de temps et a été annulé.');
      }
      return error;
    }

    // Utiliser imageBuffer qui contient les données de l'image

    // Envoyer un message de statut que nous mettrons à jour
    const statusMessage = await message.reply(`⏳ Changement de mon avatar ${isServerAvatar ? 'de serveur' : 'global'} en cours...`);

    try {
      if (isServerAvatar) {
        // Changer l'avatar uniquement sur ce serveur (guildAvatar)
        const botMember = message.guild.members.cache.get(client.user.id);
        if (!botMember) {
          return new Error('Je n\'ai pas pu trouver mon compte sur ce serveur.');
        }

        await botMember.setAvatar(imageBuffer);
        console.log(`Avatar du bot changé avec succès sur le serveur ${message.guild.name}!`);

        // Mettre à jour le message de statut
        await statusMessage.edit(`✅ Mon avatar a été changé avec succès uniquement sur ce serveur! 🖼️`);
      } else {
        // Changer l'avatar global du bot
        await client.user.setAvatar(imageBuffer);
        console.log(`Avatar global du bot changé avec succès!`);

        // Mettre à jour le message de statut
        await statusMessage.edit(`✅ Mon avatar global a été changé avec succès! 🖼️`);
      }
    } catch (error) {
      // En cas d'erreur, mettre à jour le message de statut pour indiquer l'échec
      await statusMessage.edit(`❌ Échec du changement d'avatar: ${error.message || 'Erreur inconnue'}`);
      return error; // Relancer l'erreur pour qu'elle soit gérée par le bloc catch extérieur
    }
  } catch (error) {
    console.error('Erreur lors du changement d\'avatar:', error);
    // Si l'erreur se produit avant la création du message de statut
    if (!statusMessage) {
      message.reply(`❌ Désolé, je n\'ai pas pu changer mon avatar. ${error.message || 'Erreur inconnue'}`);
    }
    // Si l'erreur provient du bloc try interne, le message est déjà mis à jour
  }
}
