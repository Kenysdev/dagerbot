# Extensibility Guide

This document covers the three core modules introduced to make the bot extensible.
It is intended for contributors who want to add new features.

---

## Core modules overview

```
New feature
  ├── reads config    →  Settings Manager   (src/config/settingsManager.ts)
  ├── adds a command  →  Command Manager    (src/bot/commands/commandManager.ts)
  ├── handles events  →  Event Dispatcher   (src/bot/events/eventDispatcher.ts)
  └── persists data   →  Data Layer         (src/data/)
```

> [!IMPORTANT]
> The four core modules are never modified when adding a new feature.
> They are only **extended** — a new entry is added, nothing existing is changed.

---

## Core 1 — Settings Manager

Stores each guild's configuration as a versioned JSON row in SQLite, indexed by `guildId`.
One row per server — each row holds the complete configuration for that server,
plus a `version` number for future migration support.

**When adding a new feature, only two things change:**

1. Add the feature's defaults inside `defaultSettings()` in `settingsManager.ts`.
2. Add its types to `src/core/types.ts`.

Auto-merge handles the rest: on the next restart, every existing guild receives
the new fields automatically — no manual migration needed.

---

## Core 2 — Command Manager

Central registry for all slash commands. Handles Discord API registration and
interaction routing from a single place.

**Adding a new top-level command (e.g. `/poll`):**

1. Create `src/bot/commands/poll/index.ts` — export `createPollCommand(settingsManager)`.
2. Add the import and the catalog entry in `src/bot/commands/commandManager.ts`:

```typescript
// at the top of commandManager.ts
import { createPollCommand } from "./poll/index.js"; // <- add here

// --- Command catalog: add new commands here only ---
[
  createConfigCommand(deps.settingsManager),
  createRankCommand({ memeRepository: deps.dataLayer.memeRepository }),
  createPollCommand(deps.settingsManager), // <- add here
].forEach((cmd) => commands.set(cmd.name, cmd));
```

`discordBot.ts` is never modified when adding a new command.

**Adding a subcommand to `/config`:**

Each feature defines one file that registers both the builder definition and the handler:

```typescript
// src/bot/commands/config/subcommands/yourFeature.ts
export function yourFeatureSubcommand(
  builder: SlashCommandBuilder,
  handlers: SubcommandMap
): void {
  builder.addSubcommand(/* define options */);
  handlers.set("your-feature", handleYourFeature);
}
```

Then add one line in `src/bot/commands/config/index.ts`:

```typescript
yourFeatureSubcommand(builder, subcommands);
```

---

## Core 3 — Event Dispatcher

Two files handle all events with business logic:

- `src/bot/events/eventDispatcher.ts` — registers all `client.on()` calls with business logic and delegates to listeners
- `src/bot/events/listeners/` — one file per feature, per event

Infrastructure events (`ClientReady`, `Error`, `InteractionCreate`) stay in `discordBot.ts` — they are pure bot setup with no business logic and will never grow.

**Rule: never register a new `client.on()` with business logic outside `eventDispatcher.ts`.**

Current listeners:

| File | Event | Feature |
|---|---|---|
| `src/bot/events/listeners/memeListener.ts` | `MessageCreate` | Meme module + reward |
| `src/bot/events/listeners/chatAiListener.ts` | `MessageCreate` | AI chat |

**Adding a feature to an existing event:**

1. Create `src/bot/events/listeners/yourFeatureListener.ts`:

```typescript
import type { Message } from "discord.js";
import type { YourFeatureSettings } from "../../../core/types.js";

export async function handleYourFeature(
  message: Message,
  config: YourFeatureSettings
): Promise<void> {
  if (!config.enabled) return;
  // ...your logic here
}
```

2. Import and call it in `eventDispatcher.ts`:

```typescript
import { handleYourFeature } from "./listeners/yourFeatureListener.js";

// inside the MessageCreate listener:
await handleYourFeature(message, settings.yourFeature).catch((err) => {
  console.error("[yourFeature] Error:", err);
});
```

`discordBot.ts` is never modified when adding a new feature to an existing event.

**Adding a feature that needs a new event:**

Add a new `client.on()` block inside `eventDispatcher.ts` and create the corresponding listener file. Example — greeting new members on join:

```typescript
// src/bot/events/listeners/welcomeListener.ts
import type { GuildMember } from "discord.js";
import type { WelcomeSettings } from "../../../core/types.js";

export async function handleWelcome(
  member: GuildMember,
  config: WelcomeSettings
): Promise<void> {
  if (!config.enabled || !config.channelId) return;
  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel?.isTextBased()) return;
  await channel.send(config.message.replace("{user}", member.displayName));
}
```

```typescript
// src/bot/events/eventDispatcher.ts — add a new client.on() block
import { handleWelcome } from "./listeners/welcomeListener.js";

client.on(Events.GuildMemberAdd, async (member) => {
  const settings = await settingsManager.getSettings(member.guild.id);
  await handleWelcome(member, settings.welcome).catch((err) => {
    console.error("[welcomeFeature] Error:", err);
  });
});
```

`discordBot.ts` is never modified.

---

## Core 4 — Data Layer

Centralized data persistence layer. Any feature that needs to store data
uses this layer instead of connecting to the database directly.

**Key files:**
- `src/data/types.ts` — contracts for providers and repositories
- `src/data/index.ts` — assembles and injects all repositories
- `src/data/providers/` — one file per database provider
- `src/data/repositories/` — one file per feature, per provider

**When adding a feature that needs to persist data:**

1. Add its repository contract to `src/data/types.ts`:
```typescript
export type WelcomeRepository = {
  findByGuild: (guildId: string) => Promise<WelcomeRecord | null>;
  save: (guildId: string, data: WelcomeRecord) => Promise<void>;
};
```

2. Create its implementation in `src/data/repositories/sqliteWelcomeRepository.ts`
following the same pattern as `sqliteSettingsRepository.ts`.

3. Add it to `src/data/index.ts`:
```typescript
export type DataLayer = {
  settingsRepository: SettingsRepository;
  welcomeRepository: WelcomeRepository; // <- add here
};

export async function createDataLayer(): Promise<DataLayer> {
  const provider = createSqliteProvider();
  await provider.initialize();
  return {
    settingsRepository: createSettingsRepository(provider),
    welcomeRepository: createWelcomeRepository(provider), // <- add here
  };
}
```

**Provider strategy:**

Each database provider has its own branch. The only difference between branches
is `src/data/index.ts` and `package.json` — everything else is identical.
The maintainer decides which provider is the default in `main`.

**Adding a new provider:**

Create a new file in `src/data/providers/` implementing the `DbProvider` contract
from `types.ts`. Then create the corresponding repository implementations in
`src/data/repositories/`. See `sqliteSettingsRepository` as reference.

## Required Discord permissions

**Scopes:**
- `bot`
- `applications.commands`

| Permission | Required for |
|---|---|
| `Send Messages` | AI chat responses |
| `Add Reactions` | Meme module — auto-react |
| `Manage Messages` | Meme module — media-only mode |
| `Manage Roles` | Meme reward — assign role when goal is reached |
| `applications.commands` | Slash command registration |

> [!WARNING]
> If a new feature requires additional permissions:
> - **Bot permissions** (`Send Messages`, `Add Reactions`, etc.) can be updated manually
>   from Server Settings → Roles → bot role.
> - **New scopes** (`applications.commands`, etc.) require re-inviting the bot
>   with an updated OAuth2 URL.
