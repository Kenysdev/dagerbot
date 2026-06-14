import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { BotCommand } from "../../../core/types.js";
import type { MemeRepository } from "../../../data/types.js";
import { rankMemeSubcommand } from "./subcommands/meme.js";

type SubcommandHandler = (
  interaction: ChatInputCommandInteraction,
  memeRepository: MemeRepository
) => Promise<void>;

export function createRankCommand(deps: {
  memeRepository: MemeRepository;
}): BotCommand {
  const builder = new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Show server rankings")
    .setContexts(InteractionContextType.Guild);

  const subcommands = new Map<string, SubcommandHandler>();

  rankMemeSubcommand(builder, subcommands);
  // otherSubcommand(builder, subcommands); <- future feature

  return {
    name: "rank",
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

      await handler(interaction, deps.memeRepository);
    },
  };
}

