import { PermissionFlagsBits, type Message } from "discord.js";
import type { ChannelGuardSettings } from "../../../core/types.js";

// Authority over people: staff stays exempt even if the whitelist was never set.
const MODERATION_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
];

// Collapses a burst from the same account into a single ban call.
const banInFlight = new Set<string>();

export async function handleChannelGuard(
  message: Message,
  config: ChannelGuardSettings
): Promise<void> {
  if (!config.enabled || !config.channelId || !message.guild) return;
  if (message.channelId !== config.channelId) return;

  const context = `guild=${message.guild.id} user=${message.author.id}`;
  const member = message.member;

  // No exemption can be evaluated without member data, and a wrong ban is permanent.
  if (!member) {
    console.warn(`[channelGuard] ${context}: no member data, skipping`);
    return;
  }

  const hasIgnoredRole = member.roles.cache.some((role) =>
    config.ignoredRoleIds.includes(role.id)
  );
  if (hasIgnoredRole) return;

  if (member.permissions.any(MODERATION_PERMISSIONS)) return;

  // `bannable` reads the bot's own member, so it has to be resolved first.
  if (!message.guild.members.me) {
    await message.guild.members.fetchMe().catch((err) => {
      console.error(`[channelGuard] ${context}: could not fetch the bot's own member:`, err);
    });
  }

  if (!message.guild.members.me) return;

  if (!member.bannable) {
    console.warn(
      `[channelGuard] ${context}: cannot ban this member — check the bot's Ban Members permission and its role position`
    );
    return;
  }

  const key = `${message.guild.id}:${message.author.id}`;
  if (banInFlight.has(key)) return;
  banInFlight.add(key);

  try {
    try {
      if (message.deletable) {
        await message.delete();
      }
    } catch (err) {
      console.error(`[channelGuard] ${context}: failed to delete message:`, err);
    }

    // Ban user with reason "Spam" and delete messages sent in the specified time frame (default 1h)
    try {
      await message.guild.members.ban(message.author.id, {
        reason: "Spam",
        deleteMessageSeconds: config.deleteMessageSeconds || 3600,
      });
    } catch (err) {
      console.error(`[channelGuard] ${context}: failed to ban user:`, err);
    }
  } finally {
    banInFlight.delete(key);
  }
}
