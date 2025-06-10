package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.MessageEmbed;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.YassineBot;
import works.nuka.yassinebot.commands.Command;
import works.nuka.yassinebot.models.Task;
import works.nuka.yassinebot.services.TaskService;

import java.awt.Color;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Commande pour gérer les tâches planifiées
 */
public class SchedulerCommand implements Command {
    private static final Logger logger = LoggerFactory.getLogger(SchedulerCommand.class);
    private static final DateTimeFormatter INPUT_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter OUTPUT_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm");

    private final TaskService taskService;

    public SchedulerCommand() {
        this.taskService = new TaskService(YassineBot.getJda());
    }

    @Override
    public String getName() {
        return "scheduler";
    }

    @Override
    public String getDescription() {
        return "Gère les tâches planifiées";
    }

    @Override
    public String getUsage() {
        return "scheduler [create/list/delete/info] [arguments]";
    }

    @Override
    public String[] getAliases() {
        return new String[]{"schedule", "task", "tasks"};
    }

    @Override
    public Permission[] getRequiredPermissions() {
        return new Permission[]{Permission.MESSAGE_SEND};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        if (args.length == 0) {
            showHelp(event);
            return;
        }

        String subCommand = args[0].toLowerCase();
        switch (subCommand) {
            case "create", "add", "new" -> handleCreate(event, Arrays.copyOfRange(args, 1, args.length));
            case "list", "all" -> handleList(event);
            case "delete", "remove", "del" -> handleDelete(event, Arrays.copyOfRange(args, 1, args.length));
            case "info", "show", "get" -> handleInfo(event, Arrays.copyOfRange(args, 1, args.length));
            case "help" -> showHelp(event);
            default -> event.getMessage().reply("❌ Sous-commande inconnue. Utilisez `scheduler help` pour voir les commandes disponibles.").queue();
        }
    }

    /**
     * Gère la sous-commande pour créer une tâche
     */
    private void handleCreate(MessageReceivedEvent event, String[] args) {
        if (args.length < 2) {
            event.getMessage().reply("❌ Utilisation: `scheduler create <date> <heure> <titre>`\n" +
                    "Exemple: `scheduler create 01/01/2026 14:30 Réunion importante`").queue();
            return;
        }

        try {
            // Parser la date et l'heure (format DD/MM/YYYY HH:MM)
            String dateTimeStr = args[0] + " " + args[1];
            LocalDateTime dateTime;
            try {
                dateTime = LocalDateTime.parse(dateTimeStr, INPUT_FORMATTER);
                if (dateTime.isBefore(LocalDateTime.now())) {
                    event.getMessage().reply("❌ La date spécifiée est dans le passé.").queue();
                    return;
                }
            } catch (DateTimeParseException e) {
                event.getMessage().reply("❌ Format de date/heure invalide. Utilisez le format JJ/MM/AAAA HH:MM.").queue();
                return;
            }

            // Extraire le titre (tous les arguments restants)
            String title = String.join(" ", Arrays.copyOfRange(args, 2, args.length));
            if (title.isEmpty()) {
                event.getMessage().reply("❌ Vous devez spécifier un titre pour la tâche.").queue();
                return;
            }

            // Créer la tâche
            String guildId = event.isFromGuild() ? event.getGuild().getId() : null;
            Task task = taskService.createTask(
                    title,
                    "Tâche créée par " + event.getAuthor().getName(),
                    dateTime,
                    event.getAuthor().getId(),
                    guildId,
                    event.getChannel().getId()
            );

            // Envoyer la confirmation
            EmbedBuilder embed = new EmbedBuilder()
                    .setTitle(":calendar_spiral: Tâche planifiée")
                    .setDescription("Votre tâche a été planifiée avec succès !")
                    .setColor(Color.GREEN)
                    .addField("Titre", task.getTitle(), false)
                    .addField("Date et heure", dateTime.format(OUTPUT_FORMATTER), false)
                    .addField("ID", task.getId().toString(), false)
                    .setFooter("Utilisez 'scheduler info 
