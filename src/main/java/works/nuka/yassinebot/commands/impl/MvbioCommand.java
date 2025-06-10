package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.MessageEmbed;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.commands.Command;
import works.nuka.yassinebot.models.Bio;
import works.nuka.yassinebot.repositories.BioRepository;
import works.nuka.yassinebot.services.UsageStatsService;
import works.nuka.yassinebot.utils.RateLimiter;

import java.awt.*;
import java.time.Instant;
import java.util.List;

/**
 * Commande pour gérer les biographies des utilisateurs
 */
public class MvbioCommand implements Command {
    private static final Logger logger = LoggerFactory.getLogger(MvbioCommand.class);
    private static final int MAX_BIO_LENGTH = 500;

    private final BioRepository bioRepository;
    private final UsageStatsService usageStatsService;
    private final RateLimiter rateLimiter;

    /**
     * Crée une nouvelle instance de la commande mvbio
     */
    public MvbioCommand(BioRepository bioRepository, UsageStatsService usageStatsService) {
        this.bioRepository = bioRepository;
        this.usageStatsService = usageStatsService;
        this.rateLimiter = new RateLimiter(60, 3, "mvbio");
        logger.info("Commande MvBio initialisée");
    }

    @Override
    public String getName() {
        return "mvbio";
    }

    @Override
    public String getDescription() {
        return "Gérer sa biographie ou voir celle des autres utilisateurs";
    }

    @Override
    public String getUsage() {
        return "[voir/set/clear] [utilisateur/texte]";
    }

    @Override
    public String[] getAliases() {
        return new String[]{"bio", "biographie"};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        User author = event.getAuthor();
        String guildId = event.isFromGuild() ? event.getGuild().getId() : null;

        // Vérifier la limite de taux
        if (!rateLimiter.check(author.getId())) {
            event.getMessage().reply("⏱️ Tu dois attendre avant de pouvoir utiliser cette commande à nouveau.").queue();
            return;
        }

        // Enregistrer l'utilisation de la commande
        usageStatsService.logCommandUsage(author.getId(), "mvbio", guildId);

        if (args.length == 0) {
            // Afficher sa propre bio
            showBio(event, author.getId());
            return;
        }

        String subCommand = args[0].toLowerCase();
        switch (subCommand) {
            case "voir":
            case "show":
            case "view":
                // Afficher la bio d'un utilisateur mentionné
                if (event.getMessage().getMentions().getUsers().isEmpty()) {
                    event.getMessage().reply("Tu dois mentionner un utilisateur pour voir sa bio.").queue();
                    return;
                }
                User targetUser = event.getMessage().getMentions().getUsers().get(0);
                showBio(event, targetUser.getId());
                break;

            case "set":
            case "edit":
            case "update":
                // Modifier sa bio
                if (args.length < 2) {
                    event.getMessage().reply("Tu dois fournir un texte pour ta bio.").queue();
                    return;
                }
                // Reconstruire le texte de la bio sans la commande
                StringBuilder bioText = new StringBuilder();
                for (int i = 1; i < args.length; i++) {
                    bioText.append(args[i]).append(" ");
                }
                String newBio = bioText.toString().trim();

                // Vérifier la longueur de la bio
                if (newBio.length() > MAX_BIO_LENGTH) {
                    event.getMessage().reply("Ta bio est trop longue ! La limite est de " + MAX_BIO_LENGTH + " caractères.").queue();
                    return;
                }

                updateBio(event, author.getId(), newBio);
                break;

            case "clear":
            case "delete":
            case "remove":
                // Supprimer sa bio
                clearBio(event, author.getId());
                break;

            case "forceclear":
            case "forcedelete":
            case "admin":
                // Commande réservée aux administrateurs pour supprimer la bio d'un autre utilisateur
                if (!event.isFromGuild() || !event.getMember().hasPermission(Permission.ADMINISTRATOR)) {
                    event.getMessage().reply("Tu n'as pas les permissions nécessaires pour utiliser cette commande.").queue();
                    return;
                }

                if (event.getMessage().getMentions().getUsers().isEmpty()) {
                    event.getMessage().reply("Tu dois mentionner un utilisateur pour supprimer sa bio.").queue();
                    return;
                }

                User targetUserAdmin = event.getMessage().getMentions().getUsers().get(0);
                adminClearBio(event, targetUserAdmin.getId(), author.getId());
                break;

            default:
                // Afficher sa propre bio si la sous-commande n'est pas reconnue
                showBio(event, author.getId());
                break;
        }
    }

    /**
     * Affiche la bio d'un utilisateur
     * 
     * @param event L'événement du message
     * @param userId L'ID de l'utilisateur
     */
    private void showBio(MessageReceivedEvent event, String userId) {
        try {
            Bio bio = bioRepository.findByUserId(userId);
            User user = event.getJDA().retrieveUserById(userId).complete();

            if (bio == null || bio.getBioText() == null || bio.getBioText().isEmpty()) {
                if (userId.equals(event.getAuthor().getId())) {
                    event.getMessage().reply("Tu n'as pas encore de bio. Utilise `mvbio set <texte>` pour en définir une.").queue();
                } else {
                    event.getMessage().reply(user.getName() + " n'a pas de bio.").queue();
                }
                return;
            }

            MessageEmbed embed = createBioEmbed(user, bio);
            event.getMessage().replyEmbeds(embed).queue();

        } catch (Exception e) {
            logger.error("Erreur lors de l'affichage de la bio", e);
            event.getMessage().reply("Une erreur s'est produite lors de l'affichage de la bio.").queue();
        }
    }

    /**
     * Met à jour la bio d'un utilisateur
     * 
     * @param event L'événement du message
     * @param userId L'ID de l'utilisateur
     * @param bioText Le texte de la bio
     */
    private void updateBio(MessageReceivedEvent event, String userId, String bioText) {
        try {
            Bio bio = bioRepository.findByUserId(userId);

            if (bio == null) {
                // Créer une nouvelle bio
                bio = new Bio();
                bio.setUserId(userId);
            }

            bio.setBioText(bioText);
            bio.setUpdatedAt(Instant.now());

            bioRepository.save(bio);

            event.getMessage().reply("✅ Ta bio a été mise à jour avec succès !").queue();
            logger.info("Bio mise à jour pour l'utilisateur {}", userId);

        } catch (Exception e) {
            logger.error("Erreur lors de la mise à jour de la bio", e);
            event.getMessage().reply("Une erreur s'est produite lors de la mise à jour de ta bio.").queue();
        }
    }

    /**
     * Supprime la bio d'un utilisateur
     * 
     * @param event L'événement du message
     * @param userId L'ID de l'utilisateur
     */
    private void clearBio(MessageReceivedEvent event, String userId) {
        try {
            Bio bio = bioRepository.findByUserId(userId);

            if (bio == null || bio.getBioText() == null || bio.getBioText().isEmpty()) {
                event.getMessage().reply("Tu n'as pas de bio à supprimer.").queue();
                return;
            }

            bioRepository.delete(bio);

            event.getMessage().reply("✅ Ta bio a été supprimée avec succès.").queue();
            logger.info("Bio supprimée pour l'utilisateur {}", userId);

        } catch (Exception e) {
            logger.error("Erreur lors de la suppression de la bio", e);
            event.getMessage().reply("Une erreur s'est produite lors de la suppression de ta bio.").queue();
        }
    }

    /**
     * Supprime la bio d'un utilisateur (action administrateur)
     * 
     * @param event L'événement du message
     * @param targetUserId L'ID de l'utilisateur cible
     * @param adminUserId L'ID de l'administrateur qui effectue l'action
     */
    private void adminClearBio(MessageReceivedEvent event, String targetUserId, String adminUserId) {
        try {
            Bio bio = bioRepository.findByUserId(targetUserId);
            User targetUser = event.getJDA().retrieveUserById(targetUserId).complete();

            if (bio == null || bio.getBioText() == null || bio.getBioText().isEmpty()) {
                event.getMessage().reply(targetUser.getName() + " n'a pas de bio à supprimer.").queue();
                return;
            }

            bioRepository.delete(bio);

            event.getMessage().reply("✅ La bio de " + targetUser.getAsMention() + " a été supprimée.").queue();
            logger.info("Bio de l'utilisateur {} supprimée par l'administrateur {}", targetUserId, adminUserId);

        } catch (Exception e) {
            logger.error("Erreur lors de la suppression administrative de la bio", e);
            event.getMessage().reply("Une erreur s'est produite lors de la suppression de la bio.").queue();
        }
    }

    /**
     * Crée un embed pour afficher une bio
     * 
     * @param user L'utilisateur
     * @param bio La bio à afficher
     * @return L'embed créé
     */
    private MessageEmbed createBioEmbed(User user, Bio bio) {
        EmbedBuilder embed = new EmbedBuilder();

        embed.setAuthor(user.getName(), null, user.getEffectiveAvatarUrl());
        embed.setTitle("Biographie");
        embed.setDescription(bio.getBioText());
        embed.setColor(new Color(114, 137, 218)); // Couleur Discord bleu

        if (bio.getUpdatedAt() != null) {
            embed.setFooter("Dernière mise à jour");
            embed.setTimestamp(bio.getUpdatedAt());
        }

        return embed.build();
    }
}
