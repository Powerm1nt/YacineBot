import fetch from 'node-fetch';
import { Buffer } from 'buffer'

export const metadata = {
  name: 'avatar',
  description: 'Change l\'avatar du bot (global ou sur un serveur)',
  restricted: true
};

const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 Mo en octets

export async function avatar(client, message, args) {

  if (!args || args.length === 0) {
      message.reply('Veuillez spécifier un lien vers une image. Exemples: \n- f!avatar https://exemple.com/image.png (avatar global)\n- f!avatar https://exemple.com/image.png server (avatar de serveur)');
      return;
    }

    const isServerAvatar = args.length > 1 && ['server', 'serveur', 'guild'].includes(args[args.length - 1].toLowerCase());
    const imageUrl = isServerAvatar ? args.slice(0, -1).join(' ') : args[0];
    let imageBuffer;
    let statusMessage;

  try {
    console.log(`Téléchargement de l'image à partir de: ${imageUrl}...`);

    const headResponse = await fetch(imageUrl, { method: 'HEAD' });
    if (!headResponse.ok) {
      throw new Error(`Impossible d'accéder à l'image (${headResponse.status}: ${headResponse.statusText})`);
    }

    const contentLength = headResponse.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);

      if (size > MAX_IMAGE_SIZE) {
        throw new Error(`L'image est trop volumineuse (${(size / (1024 * 1024)).toFixed(2)} Mo). La taille maximale autorisée est de ${MAX_IMAGE_SIZE / (1024 * 1024)} Mo.`);
      }
    } else {
      console.log('Impossible de déterminer la taille de l\'image à partir des en-têtes.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondes timeout

    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        size: MAX_IMAGE_SIZE + 1
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Impossible de télécharger l'image (${response.status}: ${response.statusText})`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Le lien ne contient pas une image valide (type: ${contentType})`);
      }

      const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      let extension = '';

      try {
        const urlObj = new URL(imageUrl);
        const pathname = urlObj.pathname;

        const filenameMatch = pathname.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
        if (filenameMatch && filenameMatch[1]) {
          extension = filenameMatch[1].toLowerCase();
        }
      } catch (e) {
        const filenameParts = imageUrl.split('?')[0].split('#')[0].split('.');
        if (filenameParts.length > 1) {
          extension = filenameParts.pop().toLowerCase();
        }
      }

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

      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      const totalSize = imageBuffer.length;

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

    const statusMessage = await message.reply(`⏳ Changement de mon avatar ${isServerAvatar ? 'de serveur' : 'global'} en cours...`);

    try {
      if (isServerAvatar) {
        const botMember = message.guild.members.cache.get(client.user.id);
        if (!botMember) {
          throw new Error('Je n\'ai pas pu trouver mon compte sur ce serveur.');
        }

        await botMember.setAvatar(imageBuffer);
        console.log(`Avatar du bot changé avec succès sur le serveur ${message.guild.name}!`);

        await statusMessage.edit(`✅ Mon avatar a été changé avec succès uniquement sur ce serveur! 🖼️`);
      } else {
        await client.user.setAvatar(imageBuffer);
        console.log(`Avatar global du bot changé avec succès!`);

        await statusMessage.edit(`✅ Mon avatar global a été changé avec succès! 🖼️`);
      }
    } catch (error) {
      await statusMessage.edit(`❌ Échec du changement d'avatar: ${error.message || 'Erreur inconnue'}`);
      return error;
    }
  } catch (error) {
    console.error('Erreur lors du changement d\'avatar:', error);
    if (!statusMessage) {
      message.reply(`❌ Désolé, je n\'ai pas pu changer mon avatar. ${error.message || 'Erreur inconnue'}`);
    }
  }
}
