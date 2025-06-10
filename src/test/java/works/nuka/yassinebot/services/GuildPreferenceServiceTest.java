package works.nuka.yassinebot.services;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import works.nuka.yassinebot.models.GuildPreference;
import works.nuka.yassinebot.repositories.GuildPreferenceRepository;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

class GuildPreferenceServiceTest {

    private AutoCloseable closeable;

    @Mock
    private GuildPreferenceRepository repository;

    private GuildPreferenceService service;

    @BeforeEach
    void setUp() {
        closeable = MockitoAnnotations.openMocks(this);

        // Remplacer le constructeur normal par une méthode qui permet d'injecter le mock
        service = new GuildPreferenceService() {
            @Override
            protected GuildPreferenceRepository createRepository() {
                return repository;
            }
        };
    }

    @AfterEach
    void tearDown() throws Exception {
        closeable.close();
    }

    @Test
    void getGuildPreferences_whenPreferencesExist_returnsPreferences() {
        // Arrange
        String guildId = "123456789";
        GuildPreference expectedPreference = new GuildPreference(guildId);
        expectedPreference.setPrefix("!");

        when(repository.findByGuildId(guildId)).thenReturn(Optional.of(expectedPreference));

        // Act
        GuildPreference result = service.getGuildPreferences(guildId);

        // Assert
        assertNotNull(result);
        assertEquals(guildId, result.getGuildId());
        assertEquals("!", result.getPrefix());
    }

    @Test
    void getGuildPreferences_whenPreferencesDoNotExist_returnsNewPreference() {
        // Arrange
        String guildId = "123456789";
        when(repository.findByGuildId(guildId)).thenReturn(Optional.empty());

        // Act
        GuildPreference result = service.getGuildPreferences(guildId);

        // Assert
        assertNotNull(result);
        assertEquals(guildId, result.getGuildId());
        assertTrue(result.getAiEnabled()); // Valeur par défaut
    }

    @Test
    void saveGuildPreferences_returnsRepositoryResult() {
        // Arrange
        String guildId = "123456789";
        GuildPreference preference = new GuildPreference();
        when(repository.save(any(GuildPreference.class))).thenReturn(true);

        // Act
        boolean result = service.saveGuildPreferences(guildId, preference);

        // Assert
        assertTrue(result);
        assertEquals(guildId, preference.getGuildId()); // Vérifie que l'ID a été défini
    }

    @Test
    void updateGuildPreference_delegatesToRepository() {
        // Arrange
        String guildId = "123456789";
        String key = "prefix";
        String value = "!";
        when(repository.updatePreference(anyString(), anyString(), any())).thenReturn(true);

        // Act
        boolean result = service.updateGuildPreference(guildId, key, value);

        // Assert
        assertTrue(result);
    }

    @Test
    void isAiEnabled_whenPreferenceIsNull_returnsTrue() {
        // Arrange
        String guildId = "123456789";
        GuildPreference preference = new GuildPreference(guildId);
        preference.setAiEnabled(null); // Simuler une préférence non définie

        when(repository.findByGuildId(guildId)).thenReturn(Optional.of(preference));

        // Act
        boolean result = service.isAiEnabled(guildId);

        // Assert
        assertTrue(result); // La valeur par défaut est true
    }

    @Test
    void isAiEnabled_whenPreferenceIsFalse_returnsFalse() {
        // Arrange
        String guildId = "123456789";
        GuildPreference preference = new GuildPreference(guildId);
        preference.setAiEnabled(false); // Simuler une préférence désactivée

        when(repository.findByGuildId(guildId)).thenReturn(Optional.of(preference));

        // Act
        boolean result = service.isAiEnabled(guildId);

        // Assert
        assertFalse(result);
    }

    @Test
    void areAutoMessagesEnabled_whenPreferenceIsNull_returnsFalse() {
        // Arrange
        String guildId = "123456789";
        GuildPreference preference = new GuildPreference(guildId);
        preference.setAutoMessagesEnabled(null); // Simuler une préférence non définie

        when(repository.findByGuildId(guildId)).thenReturn(Optional.of(preference));

        // Act
        boolean result = service.areAutoMessagesEnabled(guildId);

        // Assert
        assertFalse(result); // La valeur par défaut est false
    }

    @Test
    void areAutoMessagesEnabled_whenPreferenceIsTrue_returnsTrue() {
        // Arrange
        String guildId = "123456789";
        GuildPreference preference = new GuildPreference(guildId);
        preference.setAutoMessagesEnabled(true); // Simuler une préférence activée

        when(repository.findByGuildId(guildId)).thenReturn(Optional.of(preference));

        // Act
        boolean result = service.areAutoMessagesEnabled(guildId);

        // Assert
        assertTrue(result);
    }
}
