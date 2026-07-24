import {
  ChannelType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from "discord.js";
import type { SettingsManager } from "../../../../core/types.js";

type SubcommandMap = Map<
  string,
  (i: ChatInputCommandInteraction, s: SettingsManager) => Promise<void>
>;

export function channelGuardSubcommand(
  builder: SlashCommandBuilder,
  handlers: SubcommandMap
): void {
  builder.addSubcommand((sub) =>
    sub
      .setName("channel-guard")
      .setDescription("View or update anti-spam channel guard settings")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Target channel to guard from spam")
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
      .addStringOption((opt) =>
        opt
          .setName("status")
          .setDescription("Enable or disable channel guard")
          .setRequired(false)
          .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })
      )
      .addRoleOption((opt) =>
        opt
          .setName("add-ignored-role")
          .setDescription("Role to whitelist from channel guard")
          .setRequired(false)
      )
      .addRoleOption((opt) =>
        opt
          .setName("remove-ignored-role")
          .setDescription("Role to remove from channel guard whitelist")
          .setRequired(false)
      )
  );

  handlers.set("channel-guard", async (interaction, settingsManager) => {
    if (!interaction.guildId) return;

    const channel = interaction.options.getChannel("channel");
    const statusStr = interaction.options.getString("status");
    const addRole = interaction.options.getRole("add-ignored-role");
    const removeRole = interaction.options.getRole("remove-ignored-role");

    const current = await settingsManager.getSettings(interaction.guildId);
    let updatedGuard = { ...current.channelGuard };
    let hasChanges = false;
    const changes: string[] = [];

    if (channel) {
      updatedGuard.channelId = channel.id;
      changes.push(`Channel set to <#${channel.id}>`);
      hasChanges = true;
    }

    if (statusStr) {
      updatedGuard.enabled = statusStr === "on";
      changes.push(`Channel guard set to **${statusStr}**`);
      hasChanges = true;
    }

    if (addRole) {
      if (!updatedGuard.ignoredRoleIds.includes(addRole.id)) {
        updatedGuard.ignoredRoleIds = [...updatedGuard.ignoredRoleIds, addRole.id];
        changes.push(`Added <@&${addRole.id}> to ignored roles`);
        hasChanges = true;
      } else {
        changes.push(`Role <@&${addRole.id}> is already in the ignored list`);
      }
    }

    if (removeRole) {
      if (updatedGuard.ignoredRoleIds.includes(removeRole.id)) {
        updatedGuard.ignoredRoleIds = updatedGuard.ignoredRoleIds.filter(
          (id) => id !== removeRole.id
        );
        changes.push(`Removed <@&${removeRole.id}> from ignored roles`);
        hasChanges = true;
      } else {
        changes.push(`Role <@&${removeRole.id}> was not in the ignored list`);
      }
    }

    if (!hasChanges && changes.length === 0) {
      // Just show current settings
      const channelDisplay = updatedGuard.channelId
        ? `<#${updatedGuard.channelId}>`
        : "Not set";
      const statusDisplay = updatedGuard.enabled ? "on" : "off";
      const rolesDisplay =
        updatedGuard.ignoredRoleIds.length > 0
          ? updatedGuard.ignoredRoleIds.map((id) => `<@&${id}>`).join(", ")
          : "None";

      await interaction.reply({
        content: `**Anti-Spam Channel Guard Settings**\n• Status: **${statusDisplay}**\n• Channel: ${channelDisplay}\n• Ignored Roles: ${rolesDisplay}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (hasChanges) {
      await settingsManager.saveSettings(interaction.guildId, {
        ...current,
        channelGuard: updatedGuard,
      });
    }

    await interaction.reply({
      content: `**Updated Channel Guard Settings:**\n${changes.map((c) => `• ${c}`).join("\n")}`,
      flags: MessageFlags.Ephemeral,
    });
  });
}
