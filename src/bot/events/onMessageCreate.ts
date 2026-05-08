import { Events, type Client, type Message } from "discord.js";
import type {MemeSettings, MemeRewardSettings, SettingsManager } from "../../core/types.js";
import { MemeRepository } from "../../data/types.js";
import { 
  hasMediaAttachment, 
  selectEmojis,
  hasReachedGoal,
  buildRewardMessage,
} from "../../features/meme.js";

async function handleMemeFeature(
  message: Message,
  config: MemeSettings
): Promise<void> {
  if (!config.channelId || message.channelId !== config.channelId) return;

  const contentTypes = [...message.attachments.values()].map(
    (a) => a.contentType
  );
  const hasMedia = hasMediaAttachment(contentTypes);

  if (config.autoReact.enabled && hasMedia) {
    const toReact = selectEmojis(config.autoReact.emojis, config.autoReact.random);
    for (const emoji of toReact) {
      await message.react(emoji);
    }
  }

  if (config.mediaOnly.enabled && !hasMedia) {
    // Requires "Manage Messages" permission in the meme channel
    await message.delete();
  }
}

async function handleMemeRewardFeature(
  message: Message,
  config: MemeRewardSettings,
  memeConfig: MemeSettings,
  memeRepository: MemeRepository
): Promise<void> {
  if (!config.enabled || !config.roleId || !message.guildId) return;

  if (!memeConfig.channelId || message.channelId !== memeConfig.channelId) return;

  const contentTypes = [...message.attachments.values()].map(
    (a) => a.contentType
  );
  if (!hasMediaAttachment(contentTypes)) return;

  const { count } = await memeRepository.increment(message.guildId, message.author.id);
  if (!hasReachedGoal(count, config.goal)) return;

  const member = await message.guild?.members.fetch(message.author.id);
  if (!member) return;

  // Skip if member already has the role
  if (member.roles.cache.has(config.roleId)) return;

  await member.roles.add(config.roleId);

  const rewardMessage = buildRewardMessage(
    config.message,
    `<@${message.author.id}>`,
    `<@&${config.roleId}>`
  );
  if (message.channel.isTextBased() && !message.channel.isDMBased()) {
    await message.channel.send(rewardMessage);
  }
}

export function registerMessageCreateEvent(
  client: Client,
  settingsManager: SettingsManager,
  memeRepository: MemeRepository
): void {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.guildId) return;

    const settings = await settingsManager.getSettings(message.guildId);

    await handleMemeFeature(message, settings.meme).catch((err) => {
      console.error("[memeFeature] Error handling message:", err);
    });

    await handleMemeRewardFeature(message, settings.memeReward, settings.meme, memeRepository).catch((err) => {
      console.error("[memeRewardFeature] Error handling message:", err);
    });

    // next feature
    // await handle<NameFeature>(message, settings.<NameFeature>).catch((err) => {
    //   console.error("[<NameFeature>Feature] Error handling message:", err);
    // });
  });
}
