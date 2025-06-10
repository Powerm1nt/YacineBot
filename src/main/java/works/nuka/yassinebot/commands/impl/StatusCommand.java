package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.YassineBot;
import works.nuka.yassinebot.commands.Command;
import works.nuka.yassinebot.utils.HibernateUtil;

import java.awt.Color;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.RuntimeMXBean;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

/**
 * Commande pour afficher les informations sur l'état du bot
 */
public class StatusCommand implements Command {
    private static final Logger logger = LoggerFactory.getLogger(StatusCommand.class);
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
            .withZone(ZoneId.systemDefault());

    @Override
    public String getName() {
        return "status";
    }

    @Override
    public String getDescription() {
        return "Affiche des informations sur l'état du bot";
    }

    @Override
    public String getUsage() {
        return "status";
    }

    @Override
    public String[] getAliases() {
        return new String[]{"info", "uptime", "stats"};
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        try {
            JDA jda = YassineBot.getJda();
            RuntimeMXBean runtimeMXBean = ManagementFactory.getRuntimeMXBean();
            MemoryMXBean memoryMXBean = ManagementFactory.getMemoryMXBean();

            // Statistiques de base
            int guildCount = jda.getGuilds().size();
            int userCount = jda.getGuilds().stream().mapToInt(Guild::getMemberCount).sum();
            long uptimeMillis = runtimeMXBean.getUptime();
            Duration uptime = Duration.ofMillis(uptimeMillis);
            long usedMemory = memoryMXBean.getHeapMemoryUsage().getUsed() / (1024 * 1024);
            long maxMemory = memoryMXBean.getHeapMemoryUsage().getMax() / (1024 * 1024);

            // Créer l'embed
            EmbedBuilder embed = new EmbedBuilder()
                    .setTitle("📊 Statut du Bot")
                    .setColor(Color.GREEN)
                    .setThumbnail(jda.getSelfUser().getEffectiveAvatarUrl())
                    .addField("Nom", jda.getSelfUser().getName(), true)
                    .addField("ID", jda.getSelfUser().getId(), true)
                    .addField("Ping", jda.getGatewayPing() + "ms", true)
                    .addField("Serveurs", String.valueOf(guildCount), true)
                    .addField("Utilisateurs", String.valueOf(userCount), true)
                    .addField("Uptime", formatUptime(uptime), true)
                    .addField("Mémoire", usedMemory + "MB / " + maxMemory + "MB", true)
                    .addField("Version JDA", jda.getClass().getPackage().getImplementationVersion(), true)
                    .addField("Version Java", System.getProperty("java.version"), true)
                    .setFooter("Démarré le " + FORMATTER.format(Instant.now().minusMillis(uptimeMillis)));

            // Ajouter des infos sur la base de données
            try {
                boolean dbConnected = HibernateUtil.getSessionFactory().isOpen();
                embed.addField("Base de données", dbConnected ? "✅ Connectée" : "❌ Déconnectée", true);
            } catch (Exception e) {
                embed.addField("Base de données", "❌ Erreur: " + e.getMessage(), true);
            }

            event.getMessage().replyEmbeds(embed.build()).queue();
        } catch (Exception e) {
            logger.error("Erreur lors de l'exécution de la commande status", e);
            event.getMessage().reply("❌ Une erreur s'est produite lors de la récupération des informations.").queue();
        }
    }

    /**
     * Formate la durée d'uptime en texte lisible
     *
     * @param uptime La durée d'uptime
     * @return Une chaîne formatée
     */
    private String formatUptime(Duration uptime) {
        long days = uptime.toDays();
        long hours = uptime.toHours() % 24;
        long minutes = uptime.toMinutes() % 60;
        long seconds = uptime.getSeconds() % 60;

        StringBuilder sb = new StringBuilder();
        if (days > 0) sb.append(days).append("j ");
        if (hours > 0 || days > 0) sb.append(hours).append("h ");
        if (minutes > 0 || hours > 0 || days > 0) sb.append(minutes).append("m ");
        sb.append(seconds).append("s");

        return sb.toString();
    }
}
