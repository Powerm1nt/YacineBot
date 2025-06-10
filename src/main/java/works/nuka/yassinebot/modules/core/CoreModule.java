package works.nuka.yassinebot.modules.core;

import works.nuka.modularkit.Module;
import net.dv8tion.jda.api.JDA;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Module principal pour les fonctionnalités de base du bot
 */
public class CoreModule implements Module {
    private static final Logger logger = LoggerFactory.getLogger(CoreModule.class);
    private final JDA jda;
    private boolean enabled = false;

    /**
     * Crée un nouveau module principal
     * @param jda instance JDA
     */
    public CoreModule(JDA jda) {
        this.jda = jda;
    }

    @Override
    public String getId() {
        return "core";
    }

    @Override
    public String getName() {
        return "Module Principal";
    }

    @Override
    public String getDescription() {
        return "Fournit les fonctionnalités de base du bot";
    }

    @Override
    public String getVersion() {
        return "1.0.0";
    }

    @Override
    public String[] getAuthors() {
        return new String[]{"works.nuka"};
    }

    @Override
    public void onEnable() {
        logger.info("Activation du module principal");
        // Initialiser les fonctionnalités de base
        enabled = true;
    }

    @Override
    public void onDisable() {
        logger.info("Désactivation du module principal");
        enabled = false;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }
}
