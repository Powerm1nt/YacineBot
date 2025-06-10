package works.nuka.yassinebot.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;

/**
 * Chargeur de configuration pour le bot
 */
public class ConfigLoader {
    private static final Logger logger = LoggerFactory.getLogger(ConfigLoader.class);
    private static final Properties properties = new Properties();
    private static final String CONFIG_FILE = "config.properties";
    private static final Path CONFIG_PATH = Paths.get(CONFIG_FILE);

    /**
     * Charge la configuration depuis le fichier ou crée un fichier par défaut
     */
    public static void loadConfig() {
        if (!Files.exists(CONFIG_PATH)) {
            createDefaultConfig();
        }

        try (FileInputStream fis = new FileInputStream(CONFIG_FILE)) {
            properties.load(fis);
            logger.info("Configuration chargée avec succès");

            // Transférer les propriétés aux variables d'environnement si non définies
            properties.forEach((key, value) -> {
                String envKey = key.toString().toUpperCase().replace('.', '_');
                if (System.getenv(envKey) == null) {
                    System.setProperty(envKey, value.toString());
                }
            });
        } catch (IOException e) {
            logger.error("Erreur lors du chargement de la configuration", e);
        }
    }

    /**
     * Crée un fichier de configuration par défaut
     */
    private static void createDefaultConfig() {
        try {
            Files.createFile(CONFIG_PATH);
            logger.info("Fichier de configuration créé: {}", CONFIG_PATH);

            // Ajouter des valeurs par défaut
            properties.setProperty("bot.prefix", "y!");
            properties.setProperty("bot.name", "Yassine");

            // Sauvegarder les propriétés par défaut
            try (var fos = Files.newOutputStream(CONFIG_PATH)) {
                properties.store(fos, "Configuration par défaut du bot Yassine");
            }
        } catch (IOException e) {
            logger.error("Erreur lors de la création du fichier de configuration", e);
        }
    }

    /**
     * Obtient une propriété de configuration
     * @param key clé de la propriété
     * @param defaultValue valeur par défaut si la propriété n'existe pas
     * @return la valeur de la propriété ou la valeur par défaut
     */
    public static String getProperty(String key, String defaultValue) {
        return properties.getProperty(key, defaultValue);
    }

    /**
     * Obtient le préfixe de commande du bot
     * @return le préfixe de commande
     */
    public static String getCommandPrefix() {
        return getProperty("bot.prefix", "y!");
    }

    /**
     * Obtient le nom du bot
     * @return le nom du bot
     */
    public static String getBotName() {
        return getProperty("bot.name", "Yassine");
    }
}
