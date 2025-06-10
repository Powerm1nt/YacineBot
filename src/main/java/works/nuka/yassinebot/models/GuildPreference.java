package works.nuka.yassinebot.models;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Entité représentant les préférences d'une guilde Discord
 */
@Entity
@Table(name = "guild_preferences")
public class GuildPreference {
    @Id
    @Column(name = "guild_id")
    private String guildId;

    // Paramètres généraux
    @Column(name = "prefix")
    private String prefix;

    @Column(name = "auto_messages_enabled")
    private Boolean autoMessagesEnabled;

    @Column(name = "ai_enabled")
    private Boolean aiEnabled;

    // Configuration du système de modération
    @Column(name = "mod_log_channel_id")
    private String modLogChannelId;

    @Column(name = "welcome_channel_id")
    private String welcomeChannelId;

    @Column(name = "welcome_message")
    private String welcomeMessage;

    // Métadonnées
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // Constructeurs
    public GuildPreference() {
    }

    public GuildPreference(String guildId) {
        this.guildId = guildId;
        this.aiEnabled = true;
        this.autoMessagesEnabled = false;
    }

    // Getters et Setters
    public String getGuildId() {
        return guildId;
    }

    public void setGuildId(String guildId) {
        this.guildId = guildId;
    }

    public String getPrefix() {
        return prefix;
    }

    public void setPrefix(String prefix) {
        this.prefix = prefix;
    }

    public Boolean getAutoMessagesEnabled() {
        return autoMessagesEnabled;
    }

    public void setAutoMessagesEnabled(Boolean autoMessagesEnabled) {
        this.autoMessagesEnabled = autoMessagesEnabled;
    }

    public Boolean getAiEnabled() {
        return aiEnabled;
    }

    public void setAiEnabled(Boolean aiEnabled) {
        this.aiEnabled = aiEnabled;
    }

    public String getModLogChannelId() {
        return modLogChannelId;
    }

    public void setModLogChannelId(String modLogChannelId) {
        this.modLogChannelId = modLogChannelId;
    }

    public String getWelcomeChannelId() {
        return welcomeChannelId;
    }

    public void setWelcomeChannelId(String welcomeChannelId) {
        this.welcomeChannelId = welcomeChannelId;
    }

    public String getWelcomeMessage() {
        return welcomeMessage;
    }

    public void setWelcomeMessage(String welcomeMessage) {
        this.welcomeMessage = welcomeMessage;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
