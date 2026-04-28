import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand, SettingsManager } from "../../../core/types.js";
import { showSubcommand } from "./subcommands/show.js";
import { memeSubcommand } from "./subcommands/meme.js";
// import { NewFeatureSubcommand } from "./subcommands/NewFeature.js"; <- future feature

type SubcommandHandler = (
  interaction: ChatInputCommandInteraction,
  settingsManager: SettingsManager
) => Promise<void>;

export function createConfigCommand(settingsManager: SettingsManager): BotCommand {
  const builder = new SlashCommandBuilder()
    .setName("config")
    .setDescription("Manage bot settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

  // Each feature registers its builder portion and handler here.
  // Adding a new feature: call its subcommand function below — nothing else changes.
  const subcommands = new Map<string, SubcommandHandler>();

  showSubcommand(builder, subcommands);
  memeSubcommand(builder, subcommands);
  // welcomeSubcommand(builder, subcommands);

  return {
    name: "config",
    builder,
    handle: async (interaction) => {
      const sub = interaction.options.getSubcommand();
      const handler = subcommands.get(sub);

      if (!handler) {
        await interaction.reply({
          content: "Unknown subcommand.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await handler(interaction, settingsManager);
    },
  };
}
