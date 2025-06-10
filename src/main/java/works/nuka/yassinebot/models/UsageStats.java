package works.nuka.yassinebot.models;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Entité pour stocker les statistiques d'utilisation du bot
 */
@Entity
@Table(name = "usage_stats")
public class UsageStats {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "guild_id")
    private String guildId;

    @Column(name = "channel_id", nullable = false)
    private String channelId;

    @Column(name = "command_name")
    private String commandName;

    @Column(name = "action_type", nullable = false)
    private String actionType;

    @Column(name = "arguments")
    private String arguments;

    @CreationTimestamp
    @Column(name = "timestamp", nullable = false, updatable = false)
    private LocalDateTime timestamp;

    @Column(name = "success")
    private Boolean success;

    @Column(name = "error_message")
    private String errorMessage;

    // Constructeurs
    public UsageStats() {
    }

    public UsageStats(String userId, String channelId, String actionType) {
        this.userId = userId;
        this.channelId = channelId;
        this.actionType = actionType;
        this.success = true;
    }

    // Getters et setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getGuildId() {
        return guildId;
    }

    public void setGuildId(String guildId) {
        this.guildId = guildId;
    }

    public String getChannelId() {
        return channelId;
    }

    public void setChannelId(String channelId) {
        this.channelId = channelId;
    }

    public String getCommandName() {
        return commandName;
    }

    public void setCommandName(String commandName) {
        this.commandName = commandName;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public String getArguments() {
        return arguments;
    }

    public void setArguments(String arguments) {
        this.arguments = arguments;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public Boolean getSuccess() {
        return success;
    }

    public void setSuccess(Boolean success) {
        this.success = success;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    @Override
    public String toString() {
        return "UsageStats{" +
                "id=" + id +
                ", userId='" + userId + '\'' +
                ", actionType='" + actionType + '\'' +
                ", commandName='" + commandName + '\'' +
                ", timestamp=" + timestamp +
                ", success=" + success +
                '}';
    }
}
