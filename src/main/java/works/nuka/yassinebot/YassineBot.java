package works.nuka.yassinebot;

import works.nuka.modularkit.ModuleManager;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.JDABuilder;
import net.dv8tion.jda.api.entities.Activity;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import net.dv8tion.jda.api.requests.GatewayIntent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.config.ConfigLoader;
import works.nuka.yassinebot.commands.impl.AICommand;
import works.nuka.yassinebot.listeners.CommandListener;
import works.nuka.yassinebot.modules.ModuleLoader;
import works.nuka.yassinebot.services.SchedulerService;
import works.nuka.yassinebot.services.TaskService;
import works.nuka.yassinebot.utils.HibernateUtil;

import java.util.EnumSet;

/**
 * Classe principale du bot Yassine
 */
public class YassineBot {
    private static final Logger logger = LoggerFactory.getLogger(YassineBot.class);
    private static JDA jda;
    private static ModuleManager moduleManager;

    public static void main(String[] args) {
        try {
            // Charger la configuration
            ConfigLoader.loadConfig();
            String token = System.getenv("TOKEN");
            if (token == null || token.isEmpty()) {
                logger.error("Token Discord non trouvé dans les variables d'environnement");
                System.exit(1);
            }

            // Initialiser Hibernate
            HibernateUtil.getSessionFactory();
            logger.info("Connexion à la base de données établie");

            // Préparer les intents nécessaires
            EnumSet<GatewayIntent> intents = EnumSet.of(
                GatewayIntent.GUILD_MESSAGES, 
                GatewayIntent.DIRECT_MESSAGES,
                GatewayIntent.MESSAGE_CONTENT,
                GatewayIntent.GUILD_MEMBERS,
                GatewayIntent.GUILD_BANS
            );

            // Créer l'instance JDA
            jda = JDABuilder.createDefault(token)
                    .setActivity(Activity.playing("Yassine Bot v1.0"))
                    .enableIntents(intents)
                    .addEventListeners(new CommandListener())
                    .build();

            // Attendre que la connexion soit établie
            jda.awaitReady();
            logger.info("Bot {} connecté et prêt!", jda.getSelfUser().getName());

            // Initialiser le gestionnaire de modules
            moduleManager = new ModuleManager();
            ModuleLoader.loadModules(moduleManager, jda);
            logger.info("Modules chargés avec succès");

        } catch (Exception e) {
            logger.error("Erreur lors du démarrage du bot", e);
            System.exit(1);
        }
    }

    /**
     * Obtient l'instance JDA du bot
     * @return l'instance JDA
     */
    public static JDA getJda() {
        return jda;
    }

    /**
     * Obtient le gestionnaire de modules
     * @return le gestionnaire de modules
     */
    public static ModuleManager getModuleManager() {
        return moduleManager;
    }
}
