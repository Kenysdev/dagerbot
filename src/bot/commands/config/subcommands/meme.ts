import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from "discord.js";
import type { AppSettings, SettingsManager } from "../../../../core/types.js";
import { MAX_REACT_EMOJIS } from "../../../../features/meme.js";

type SubcommandMap = Map<
  string,
  (i: ChatInputCommandInteraction, s: SettingsManager) => Promise<void>
>;

// Unicode emoji or Discord custom emoji format <:name:id> / <a:name:id>
const EMOJI_REGEX =
  /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|<a?:\w+:\d+>)$/u;

function isValidEmoji(value: string): boolean {
  return EMOJI_REGEX.test(value.trim());
}

function parseEmojis(raw: string): string[] {
  // Handles both space-separated and consecutive emojis from Discord's picker
  return (
    raw.trim().match(
      /\p{Emoji_Presentation}|\p{Extended_Pictographic}|<a?:\w+:\d+>/gu
    ) ?? []
  );
}

export function memeSubcommand(
  builder: SlashCommandBuilder,
  handlers: SubcommandMap
): void {
  builder.addSubcommand((sub) =>
    sub
      .setName("meme")
      .setDescription("View or update meme module settings")
      .addChannelOption((opt) =>
        opt.setName("channel").setDescription("Meme channel").setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("auto-react")
          .setDescription("Toggle auto reactions on images and videos")
          .setRequired(false)
          .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
      )
      .addStringOption((opt) =>
        opt
          .setName("emojis")
          .setDescription(`Reaction emojis, space-separated (max ${MAX_REACT_EMOJIS})`)
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("media-only")
          .setDescription("Delete non-media messages in the meme channel")
          .setRequired(false)
          .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
      )
  );

  handlers.set("meme", handleMeme);
}

async function handleMeme(
  interaction: ChatInputCommandInteraction,
  settingsManager: SettingsManager
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "This command only works in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId;
  const channel = interaction.options.getChannel("channel");
  const autoReact = interaction.options.getString("auto-react");
  const emojisRaw = interaction.options.getString("emojis");
  const mediaOnly = interaction.options.getString("media-only");
  const nothingProvided = !channel && !autoReact && !emojisRaw && !mediaOnly;

  // No options — show current config
  if (nothingProvided) {
    const { meme } = await settingsManager.getSettings(guildId);
    await interaction.reply({
      content: [
        "**Meme Module Settings**",
        `  • channel: ${meme.channelId ? `<#${meme.channelId}>` : "not set"}`,
        `  • auto-react: ${meme.autoReact.enabled ? "✅ on" : "❌ off"}`,
        `  • emojis: ${meme.autoReact.emojis.join(" ")}`,
        `  • media-only: ${meme.mediaOnly.enabled ? "✅ on" : "❌ off"}`,
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Validate emojis before applying any change
  if (emojisRaw) {
    const emojis = parseEmojis(emojisRaw);

    if (emojis.length === 0) {
      await interaction.reply({
        content: "❌ No valid emojis found. Use unicode emojis or server custom emojis.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (emojis.length > MAX_REACT_EMOJIS) {
      await interaction.reply({
        content: `❌ Maximum ${MAX_REACT_EMOJIS} emojis allowed.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const invalidEmojis = emojis.filter((e) => !isValidEmoji(e));
    if (invalidEmojis.length > 0) {
      await interaction.reply({
        content: `❌ Invalid emoji(s): ${invalidEmojis.join(" ")}. Use unicode emojis or server custom emojis only.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const current = await settingsManager.getSettings(guildId);
  const updated: AppSettings = JSON.parse(JSON.stringify(current));
  const changes: string[] = [];

  if (channel) {
    updated.meme.channelId = channel.id;
    changes.push(`Channel → <#${channel.id}>`);
  }
  if (autoReact) {
    updated.meme.autoReact.enabled = autoReact === "on";
    changes.push(`Auto-react → ${autoReact === "on" ? "✅ on" : "❌ off"}`);
  }
  if (emojisRaw) {
    const emojis = parseEmojis(emojisRaw);
    updated.meme.autoReact.emojis = emojis;
    changes.push(`Emojis → ${emojis.join(" ")}`);
  }
  if (mediaOnly) {
    updated.meme.mediaOnly.enabled = mediaOnly === "on";
    changes.push(`Media-only → ${mediaOnly === "on" ? "✅ on" : "❌ off"}`);
  }

  await settingsManager.saveSettings(guildId, updated);

  await interaction.reply({
    content: `✅ Meme settings updated:\n${changes.join("\n")}`,
    flags: MessageFlags.Ephemeral,
  });
}
