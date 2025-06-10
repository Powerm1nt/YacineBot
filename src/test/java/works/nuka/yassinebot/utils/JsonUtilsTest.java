package works.nuka.yassinebot.utils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JsonUtilsTest {

    @TempDir
    Path tempDir;

    @Test
    void toJson_validObject_returnsJsonString() {
        // Arrange
        Map<String, Object> testObject = new HashMap<>();
        testObject.put("name", "TestName");
        testObject.put("value", 123);
        testObject.put("active", true);

        // Act
        String result = JsonUtils.toJson(testObject);

        // Assert
        assertNotNull(result);
        assertTrue(result.contains("\"name\":\"TestName\""));
        assertTrue(result.contains("\"value\":123"));
        assertTrue(result.contains("\"active\":true"));
    }

    @Test
    void fromJson_validJson_returnsObject() {
        // Arrange
        String json = "{\"name\":\"TestName\",\"value\":123,\"active\":true}";

        // Act
        @SuppressWarnings("unchecked")
        Map<String, Object> result = JsonUtils.fromJson(json, Map.class);

        // Assert
        assertNotNull(result);
        assertEquals("TestName", result.get("name"));
        assertEquals(123, ((Number) result.get("value")).intValue());
        assertEquals(true, result.get("active"));
    }

    @Test
    void saveToFile_validObject_savesFile() throws IOException {
        // Arrange
        Map<String, Object> testObject = new HashMap<>();
        testObject.put("name", "TestName");
        testObject.put("value", 123);

        Path filePath = tempDir.resolve("test.json");
        String filePathStr = filePath.toString();

        // Act
        boolean result = JsonUtils.saveToFile(testObject, filePathStr);

        // Assert
        assertTrue(result);
        assertTrue(Files.exists(filePath));
        String fileContent = Files.readString(filePath);
        assertTrue(fileContent.contains("\"name\" : \"TestName\""));
        assertTrue(fileContent.contains("\"value\" : 123"));
    }

    @Test
    void loadFromFile_existingFile_loadsObject() throws IOException {
        // Arrange
        String jsonContent = "{\"name\":\"TestName\",\"value\":123}";
        Path filePath = tempDir.resolve("test-load.json");
        Files.writeString(filePath, jsonContent);

        // Act
        @SuppressWarnings("unchecked")
        Map<String, Object> result = JsonUtils.loadFromFile(filePath.toString(), Map.class);

        // Assert
        assertNotNull(result);
        assertEquals("TestName", result.get("name"));
        assertEquals(123, ((Number) result.get("value")).intValue());
    }

    @Test
    void loadFromFile_nonExistentFile_returnsNull() {
        // Arrange
        String filePath = tempDir.resolve("non-existent.json").toString();

        // Act
        Map<String, Object> result = JsonUtils.loadFromFile(filePath, Map.class);

        // Assert
        assertNull(result);
    }

    @Test
    void createObjectNode_returnsEmptyNode() {
        // Act
        ObjectNode result = JsonUtils.createObjectNode();

        // Assert
        assertNotNull(result);
        assertEquals(0, result.size());
    }

    @Test
    void getValueByPath_validPath_returnsValue() {
        // Arrange
        String json = "{\"user\":{\"profile\":{\"name\":\"John\",\"age\":30}}}";

        // Act
        JsonNode result = JsonUtils.getValueByPath(json, "user.profile.name");

        // Assert
        assertNotNull(result);
        assertEquals("John", result.asText());
    }

    @Test
    void getValueByPath_invalidPath_returnsNull() {
        // Arrange
        String json = "{\"user\":{\"profile\":{\"name\":\"John\"}}}";

        // Act
        JsonNode result = JsonUtils.getValueByPath(json, "user.settings.theme");

        // Assert
        assertNull(result);
    }

    @Test
    void mergeJson_validObjects_returnsMergedJson() {
        // Arrange
        String mainJson = "{\"name\":\"John\",\"age\":30,\"settings\":{\"theme\":\"dark\"}}";
        String updateJson = "{\"age\":31,\"settings\":{\"language\":\"fr\"},\"active\":true}";

        // Act
        String result = JsonUtils.mergeJson(mainJson, updateJson);

        // Assert
        assertNotNull(result);
        JsonNode resultNode = JsonUtils.fromJson(result, JsonNode.class);
        assertEquals("John", resultNode.get("name").asText());
        assertEquals(31, resultNode.get("age").asInt()); // Valeur mise à jour
        assertEquals("dark", resultNode.get("settings").get("theme").asText()); // Valeur préservée
        assertEquals("fr", resultNode.get("settings").get("language").asText()); // Nouvelle valeur
        assertTrue(resultNode.get("active").asBoolean()); // Nouvelle propriété
    }
}
