import {
  REST,
  Routes,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "../../core/types.js";

export type CommandManager = {
  add: (command: BotCommand) => void;
  route: (interaction: ChatInputCommandInteraction) => Promise<void>;
  registerToDiscord: (
    clientId: string,
    token: string,
    guildId?: string
  ) => Promise<void>;
};

export function createCommandManager(): CommandManager {
  const commands = new Map<string, BotCommand>();

  return {
    add: (command) => {
      commands.set(command.name, command);
    },

    route: async (interaction) => {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.handle(interaction);
    },

    registerToDiscord: async (clientId, token, guildId) => {
      const rest = new REST().setToken(token);
      const body = [...commands.values()].map((c) => c.builder.toJSON());

      if (guildId) {
        await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body }
        );
        console.log("[commands] Registered to guild.");
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body });
        console.log("[commands] Registered globally.");
      }
    },
  };
}
