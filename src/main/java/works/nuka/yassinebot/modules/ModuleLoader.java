package works.nuka.yassinebot.modules;

import works.nuka.modularkit.ModuleManager;
import net.dv8tion.jda.api.JDA;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import works.nuka.yassinebot.modules.core.CoreModule;

/**
 * Chargeur de modules pour le bot
 */
public class ModuleLoader {
    private static final Logger logger = LoggerFactory.getLogger(ModuleLoader.class);

    /**
     * Charge tous les modules du bot
     * @param moduleManager gestionnaire de modules
     * @param jda instance JDA
     */
    public static void loadModules(ModuleManager moduleManager, JDA jda) {
        try {
            // Charger le module principal
            moduleManager.loadModule(new CoreModule(jda));

            // Charger d'autres modules au besoin
            // moduleManager.loadModule(new AiModule(jda));
            // moduleManager.loadModule(new GamesModule(jda));
            // moduleManager.loadModule(new SchedulerModule(jda));

            logger.info("Modules chargés: {}", moduleManager.getLoadedModules().size());
        } catch (Exception e) {
            logger.error("Erreur lors du chargement des modules", e);
        }
    }
}
