package works.nuka.yassinebot.utils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/**
 * Utilitaire pour manipuler des données JSON
 */
public class JsonUtils {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Convertit un objet en chaîne JSON
     * 
     * @param object L'objet à convertir
     * @return La chaîne JSON ou null en cas d'erreur
     */
    public static String toJson(Object object) {
        try {
            return objectMapper.writeValueAsString(object);
        } catch (Exception e) {
            LogUtils.error("JsonUtils", "Erreur lors de la sérialisation en JSON", e);
            return null;
        }
    }

    /**
     * Convertit une chaîne JSON en objet du type spécifié
     * 
     * @param json La chaîne JSON
     * @param valueType Le type de l'objet résultant
     * @return L'objet converti ou null en cas d'erreur
     */
    public static <T> T fromJson(String json, Class<T> valueType) {
        try {
            return objectMapper.readValue(json, valueType);
        } catch (Exception e) {
            LogUtils.error("JsonUtils", "Erreur lors de la désérialisation du JSON", e);
            return null;
        }
    }

    /**
     * Charge un fichier JSON et le convertit en objet du type spécifié
     * 
     * @param filePath Le chemin vers le fichier JSON
     * @param valueType Le type de l'objet résultant
     * @return L'objet chargé ou null en cas d'erreur
     */
    public static <T> T loadFromFile(String filePath, Class<T> valueType) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                return null;
            }
            return objectMapper.readValue(file, valueType);
        } catch (Exception e) {
            LogUtils.error("JsonUtils", "Erreur lors du chargement du fichier JSON: " + filePath, e);
            return null;
        }
    }

    /**
     * Sauvegarde un objet dans un fichier JSON
     * 
     * @param object L'objet à sauvegarder
     * @param filePath Le chemin du fichier de destination
     * @return true si la sauvegarde a réussi, false sinon
     */
    public static boolean saveToFile(Object object, String filePath) {
        try {
            // Créer les répertoires parents si nécessaire
            File file = new File(filePath);
            if (!file.getParentFile().exists()) {
                file.getParentFile().mkdirs();
            }

            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file, object);
            return true;
        } catch (Exception e) {
            LogUtils.error("JsonUtils", "Erreur lors de la sauvegarde du fichier JSON: " + filePath, e);
            return false;
        }
    }

    /**
     * Crée un nœud d'objet JSON vide
     * 
     * @return Un ObjectNode vide
     */
    public static ObjectNode createObjectNode() {
        return objectMapper.createObjectNode();
    }

    /**
     * Crée un nœud de tableau JSON vide
     * 
     * @return Un ArrayNode vide
     */
    public static ArrayNode createArrayNode() {
        return objectMapper.createArrayNode();
    }

    /**
     * Extrait une valeur d'un nœud JSON par chemin
     * 
     * @param json Le JSON source
     * @param path Le chemin d'accès à la valeur (séparé par des points)
     * @return La valeur extraite ou null si non trouvée
     */
    public static JsonNode getValueByPath(String json, String path) {
        try {
            JsonNode rootNode = objectMapper.readTree(json);
            String[] pathParts = path.split("\\.");

            JsonNode currentNode = rootNode;
            for (String part : pathParts) {
                if (currentNode == null) {
                    return null;
                }
                currentNode = currentNode.path(part);
            }

            return currentNode.isMissingNode() ? null : currentNode;
        } catch (Exception e) {
            LogUtils.error("JsonUtils", "Erreur lors de l'extraction de valeur par chemin", e);
            return null;
        }
    }

    /**
     * Fusionne deux objets JSON
     * 
     * @param mainJson Le JSON principal qui sera mis à jour
     * @param updateJson Le JSON contenant les mises à jour
     * @return Le JSON fusionné ou null en cas d'erreur
     */
    public static String mergeJson(String mainJson, String updateJson) {
        try {
            JsonNode mainNode = objectMapper.readTree(mainJson);
            JsonNode updateNode = objectMapper.readTree(updateJson);

            JsonNode result = merge((ObjectNode) mainNode, updateNode);
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            LogUtils.error("JsonUtils", "Erreur lors de la fusion JSON", e);
            return null;
        }
    }

    /**
     * Méthode interne pour fusionner des nœuds JSON
     */
    private static JsonNode merge(ObjectNode mainNode, JsonNode updateNode) {
        updateNode.fieldNames().forEachRemaining(fieldName -> {
            JsonNode value = updateNode.get(fieldName);
            if (value.isObject() && mainNode.has(fieldName) && mainNode.get(fieldName).isObject()) {
                merge((ObjectNode) mainNode.get(fieldName), value);
            } else {
                mainNode.set(fieldName, value);
            }
        });
        return mainNode;
    }

    /**
     * Charge tous les fichiers JSON d'un répertoire
     * 
     * @param directoryPath Le chemin du répertoire
     * @param valueType Le type des objets à charger
     * @return Une liste des objets chargés
     */
    public static <T> List<T> loadAllFromDirectory(String directoryPath, Class<T> valueType) {
        List<T> result = new ArrayList<>();
        try {
            Files.walk(Paths.get(directoryPath))
                    .filter(path -> path.toString().endsWith(".json"))
                    .forEach(path -> {
                        T object = loadFromFile(path.toString(), valueType);
                        if (object != null) {
                            result.add(object);
                        }
                    });
        } catch (IOException e) {
            LogUtils.error("JsonUtils", "Erreur lors du chargement des fichiers JSON du répertoire: " + directoryPath, e);
        }
        return result;
    }
}
