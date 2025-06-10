package works.nuka.yassinebot.utils;

import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.MessageEmbed;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.awt.Color;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class CommandUtilsTest {

    @Mock
    private MessageReceivedEvent event;

    @Mock
    private Guild guild;

    @Mock
    private Member member;

    @Test
    void parseArgs_emptyArgs_returnsEmptyArray() {
        // Arrange
        String content = "!command";
        String prefix = "!";
        String commandName = "command";

        // Act
        String[] result = CommandUtils.parseArgs(content, prefix, commandName);

        // Assert
        assertEquals(0, result.length);
    }

    @Test
    void parseArgs_simpleArgs_returnsCorrectArray() {
        // Arrange
        String content = "!command arg1 arg2 arg3";
        String prefix = "!";
        String commandName = "command";

        // Act
        String[] result = CommandUtils.parseArgs(content, prefix, commandName);

        // Assert
        assertEquals(3, result.length);
        assertEquals("arg1", result[0]);
        assertEquals("arg2", result[1]);
        assertEquals("arg3", result[2]);
    }

    @Test
    void parseArgs_quotedArgs_handlesQuotesCorrectly() {
        // Arrange
        String content = "!command arg1 "argument with spaces" arg3";
        String prefix = "!";
        String commandName = "command";

        // Act
        String[] result = CommandUtils.parseArgs(content, prefix, commandName);

        // Assert
        assertEquals(3, result.length);
        assertEquals("arg1", result[0]);
        assertEquals("argument with spaces", result[1]);
        assertEquals("arg3", result[2]);
    }

    @Test
    void getMemberFromArg_withMention_callsGetMemberById() {
        // Arrange
        try (AutoCloseable mocks = MockitoAnnotations.openMocks(this)) {
            String userId = "123456789";
            String arg = "<@" + userId + ">";

            List<Member> members = new ArrayList<>();
            members.add(member);

            when(event.getGuild()).thenReturn(guild);
            when(guild.getMemberById(userId)).thenReturn(member);

            // Act
            Member result = CommandUtils.getMemberFromArg(event, arg);

            // Assert
            assertEquals(member, result);
        } catch (Exception e) {
            fail("Exception thrown: " + e.getMessage());
        }
    }

    @Test
    void getMemberFromArg_withId_callsGetMemberById() {
        // Arrange
        try (AutoCloseable mocks = MockitoAnnotations.openMocks(this)) {
            String userId = "123456789";

            when(event.getGuild()).thenReturn(guild);
            when(guild.getMemberById(userId)).thenReturn(member);

            // Act
            Member result = CommandUtils.getMemberFromArg(event, userId);

            // Assert
            assertEquals(member, result);
        } catch (Exception e) {
            fail("Exception thrown: " + e.getMessage());
        }
    }

    @Test
    void createEmbed_validParams_returnsEmbed() {
        // Arrange
        String title = "Test Title";
        String description = "Test Description";
        Color color = Color.BLUE;

        // Act
        MessageEmbed result = CommandUtils.createEmbed(title, description, color);

        // Assert
        assertNotNull(result);
        assertEquals(title, result.getTitle());
        assertEquals(description, result.getDescription());
        assertEquals(color.getRGB(), result.getColorRaw());
    }

    @Test
    void createErrorEmbed_validMessage_returnsRedEmbed() {
        // Arrange
        String message = "Error message";

        // Act
        MessageEmbed result = CommandUtils.createErrorEmbed(message);

        // Assert
        assertNotNull(result);
        assertEquals("❌ Erreur", result.getTitle());
        assertEquals(message, result.getDescription());
        assertEquals(Color.RED.getRGB(), result.getColorRaw());
    }

    @Test
    void getReason_emptyArgs_returnsDefaultMessage() {
        // Arrange
        String[] args = new String[1];
        args[0] = "target";
        int startIndex = 1;

        // Act
        String result = CommandUtils.getReason(args, startIndex);

        // Assert
        assertEquals("Aucune raison spécifiée", result);
    }

    @Test
    void getReason_validArgs_returnsJoinedString() {
        // Arrange
        String[] args = new String[4];
        args[0] = "target";
        args[1] = "This";
        args[2] = "is";
        args[3] = "reason";
        int startIndex = 1;

        // Act
        String result = CommandUtils.getReason(args, startIndex);

        // Assert
        assertEquals("This is reason", result);
    }

    @Test
    void parseDuration_validFormat_returnsDurationInMillis() {
        // Act & Assert
        assertEquals(1000, CommandUtils.parseDuration("1s")); // 1 seconde
        assertEquals(60000, CommandUtils.parseDuration("1m")); // 1 minute
        assertEquals(3600000, CommandUtils.parseDuration("1h")); // 1 heure
        assertEquals(86400000, CommandUtils.parseDuration("1d")); // 1 jour
    }

    @Test
    void parseDuration_invalidFormat_returnsNegativeOne() {
        // Act & Assert
        assertEquals(-1, CommandUtils.parseDuration("1x")); // Unité invalide
        assertEquals(-1, CommandUtils.parseDuration("")); // Chaîne vide
        assertEquals(-1, CommandUtils.parseDuration(null)); // Null
    }
}
