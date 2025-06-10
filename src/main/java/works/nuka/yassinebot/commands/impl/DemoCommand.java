package works.nuka.yassinebot.commands.impl;

import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import works.nuka.yassinebot.commands.Command;

/**
 * Commande de démonstration
 */
public class DemoCommand implements Command {

    @Override
    public String getName() {
        return "demo";
    }

    @Override
    public String getDescription() {
        return "Affiche un message de démonstration";
    }

    @Override
    public String getUsage() {
        return "demo";
    }

    @Override
    public void execute(MessageReceivedEvent event, String[] args) {
        event.getMessage().reply("Voici une démonstration du bot ! 🤖").queue();
    }
}
