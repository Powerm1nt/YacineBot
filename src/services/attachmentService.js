/**
 * Service d'analyse des pièces jointes (images, PDFs, etc.)
 */
import fetch from 'node-fetch';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { FormData } from 'formdata-node';
import { OpenAI } from 'openai/client.mjs';
import dotenv from 'dotenv';

dotenv.config();

const ai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

/**
 * Télécharge une pièce jointe depuis une URL
 * @param {string} url - L'URL de la pièce jointe
 * @returns {Promise<Buffer>} - Les données de la pièce jointe
 */
async function downloadAttachment(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erreur lors du téléchargement de la pièce jointe: ${response.status} ${response.statusText}`);
    }

    return await response.buffer();
  } catch (error) {
    console.error('Erreur lors du téléchargement de la pièce jointe:', error);
    throw error;
  }
}

/**
 * Analyse une image avec Vision API
 * @param {Buffer} imageData - Les données de l'image
 * @returns {Promise<string>} - Description de l'image
 */
async function analyzeImage(imageData) {
  try {
    const response = await ai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user", 
          content: [
            { type: "text", text: "Décris cette image en détail. Indique ce que tu vois, les éléments importants, le contexte et tout ce qui pourrait être pertinent. Si tu vois du texte dans l'image, retranscris-le." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageData.toString('base64')}`,
              }
            }
          ]
        }
      ],
    });

    return response.choices[0]?.message?.content || "Je n'ai pas pu analyser cette image.";
  } catch (error) {
    console.error('Erreur lors de l\'analyse de l\'image:', error);
    return "Désolé, je n'ai pas pu analyser cette image en raison d'une erreur technique.";
  }
}

/**
 * Analyse un document PDF
 * @param {Buffer} pdfData - Les données du PDF
 * @returns {Promise<string>} - Résumé du contenu du PDF
 */
async function analyzePDF(pdfData) {
  try {
    // Créer un FormData pour l'upload du fichier
    const formData = new FormData();
    formData.append('file', new Blob([pdfData]), 'document.pdf');
    formData.append('model', 'gpt-4-vision-preview');
    formData.append('purpose', 'assistants');

    // Télécharger le fichier à OpenAI
    const fileUploadResponse = await ai.files.create({
      file: new Blob([pdfData]),
      purpose: 'assistants',
    });

    // Utiliser l'API Assistants pour analyser le PDF
    const assistant = await ai.beta.assistants.create({
      name: "PDF Analyzer",
      description: "Analyse les documents PDF et en extrait les informations importantes.",
      model: "gpt-4.1-mini",
      tools: [{ type: "retrieval" }],
      file_ids: [fileUploadResponse.id]
    });

    // Créer un thread avec le fichier
    const thread = await ai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: "Voici un document PDF. Peux-tu me faire un résumé détaillé de son contenu, en mentionnant les points clés, les données importantes et le contexte général?",
          file_ids: [fileUploadResponse.id]
        }
      ]
    });

    // Exécuter l'assistant sur le thread
    const run = await ai.beta.threads.runs.create(
      thread.id,
      { assistant_id: assistant.id }
    );

    // Attendre que l'exécution soit terminée
    let runStatus = await ai.beta.threads.runs.retrieve(
      thread.id,
      run.id
    );

    while (runStatus.status !== "completed") {
      if (runStatus.status === "failed") {
        throw new Error(`L'analyse du PDF a échoué: ${runStatus.error?.message || 'Raison inconnue'}`);
      }

      // Attendre 2 secondes avant de vérifier à nouveau
      await new Promise(resolve => setTimeout(resolve, 2000));

      runStatus = await ai.beta.threads.runs.retrieve(
        thread.id,
        run.id
      );
    }

    // Récupérer les messages générés par l'assistant
    const messages = await ai.beta.threads.messages.list(thread.id);

    // Nettoyer les ressources
    await ai.beta.assistants.delete(assistant.id);
    await ai.files.delete(fileUploadResponse.id);

    // Extraire le contenu de la réponse de l'assistant
    const assistantMessages = messages.data.filter(msg => msg.role === "assistant");
    if (assistantMessages.length > 0) {
      return assistantMessages[0].content[0].text.value || "Je n'ai pas pu analyser ce document PDF.";
    } else {
      return "Je n'ai pas pu générer d'analyse pour ce document PDF.";
    }
  } catch (error) {
    console.error('Erreur lors de l\'analyse du PDF:', error);
    return "Désolé, je n'ai pas pu analyser ce document PDF en raison d'une erreur technique.";
  }
}

/**
 * Analyse une pièce jointe Discord
 * @param {Object} attachment - L'objet attachment Discord
 * @returns {Promise<string>} - Résultat de l'analyse
 */
async function analyzeAttachment(attachment) {
  try {
    console.log(`[AttachmentService] Analyse de la pièce jointe: ${attachment.name} (${attachment.contentType})`);

    // Télécharger la pièce jointe
    const attachmentData = await downloadAttachment(attachment.url);

    // Déterminer le type de fichier
    const contentType = attachment.contentType || '';

    if (contentType.startsWith('image/')) {
      console.log(`[AttachmentService] Analyse d'une image: ${attachment.name}`);
      return await analyzeImage(attachmentData);
    } else if (contentType === 'application/pdf') {
      console.log(`[AttachmentService] Analyse d'un PDF: ${attachment.name}`);
      return await analyzePDF(attachmentData);
    } else {
      return `La pièce jointe de type "${contentType}" n'est pas prise en charge. Je peux actuellement analyser des images et des PDFs.`;
    }
  } catch (error) {
    console.error('Erreur lors de l\'analyse de la pièce jointe:', error);
    return "Désolé, je n'ai pas pu analyser cette pièce jointe en raison d'une erreur technique.";
  }
}

/**
 * Analyse toutes les pièces jointes d'un message Discord
 * @param {Object} message - Le message Discord contenant des pièces jointes
 * @returns {Promise<string>} - Résultat de l'analyse de toutes les pièces jointes
 */
async function analyzeMessageAttachments(message) {
  // Vérifier si le message contient des pièces jointes
  if (!message.attachments || message.attachments.size === 0) {
    return "";
  }

  console.log(`[AttachmentService] Message ${message.id} contient ${message.attachments.size} pièce(s) jointe(s)`);

  try {
    const results = [];

    // Analyser chaque pièce jointe
    for (const [id, attachment] of message.attachments) {
      const result = await analyzeAttachment(attachment);
      results.push(`**Analyse de ${attachment.name}:**\n${result}`);
    }

    return results.join('\n\n');
  } catch (error) {
    console.error('Erreur lors de l\'analyse des pièces jointes du message:', error);
    return "Désolé, je n'ai pas pu analyser les pièces jointes en raison d'une erreur technique.";
  }
}

export const attachmentService = {
  analyzeMessageAttachments,
  analyzeAttachment,
  analyzeImage,
  analyzePDF
};
