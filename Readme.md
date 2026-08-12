# Dagerbot

Bot de Discord multi-servidor escrito en TypeScript: conversación con un modelo de
lenguaje, dinámicas de comunidad y reglas por canal. Cada servidor activa y configura lo
que quiere desde Discord, sin tocar el código ni reiniciar el bot.

## Características

| Característica | Qué hace | Comando |
|---|---|---|
| **Chat** | Conversa con un modelo de OpenAI recordando el hilo por usuario y canal. Responde en DM, si lo mencionas, si usas el prefijo o si respondes a uno de sus mensajes. | — |
| **Memes** | Reacciona automáticamente a las imágenes y vídeos de un canal, y opcionalmente borra lo que no sea media. | `/config meme` |
| **Recompensa** | Otorga un rol al alcanzar una cantidad de memes publicados. | `/config meme-reward` |
| **Ranking** | Top de usuarios por memes, navegable por páginas. | `/rank meme` |
| **Canal trampa** | Banea a quien escriba en un canal señuelo. La moderación queda exenta por permisos. | `/config channel-guard` |

`/config show` muestra el estado de todo. Los `/config` exigen el permiso indicado en
`CONFIG_PERMISSION` (`Administrator` por defecto).

## Requisitos en Discord

**Scopes:** `bot` · `applications.commands`

**Permisos:** `Send Messages` · `Add Reactions` · `Manage Messages` · `Manage Roles`.
El canal trampa necesita además `Ban Members` en el servidor y `View Channel` +
`Manage Messages` en el canal; `/config channel-guard` lo verifica y se niega a armar la
trampa si falta alguno.

**Intent privilegiado: `Message Content`.** Hay que activarlo en el Portal de
Desarrolladores. Sin él, Discord entrega vacíos el contenido y los adjuntos de los mensajes
de servidor, con dos excepciones: los DM y los mensajes que **mencionan** al bot. En la
práctica eso significa que el chat por mención y por DM sigue funcionando, pero **el
prefijo deja de responder y las características de memes dejan de ver los adjuntos**. A
partir de 100 servidores, Discord exige solicitarlo y que te lo aprueben.

> [!NOTE]
> Si una característica nueva necesita permisos adicionales, se actualizan a mano desde
> Configuración del servidor → Roles → rol del bot. Un **scope** nuevo, en cambio, obliga a
> re-invitar el bot con un enlace OAuth2 actualizado.

## Puesta en marcha

```bash
cp .env.example .env    # mínimo: DISCORD_TOKEN y DISCORD_CLIENT_ID
pnpm install
pnpm dev                # arranca en local, sin compilar
```

El resto de variables tiene valor por defecto. Lo que ocurre si dejas alguna vacía:

- **Sin `DISCORD_TOKEN`** el bot no se conecta a Discord: el proceso avisa y sigue vivo,
  pero no hace nada.
- **Sin `DISCORD_CLIENT_ID`** se conecta y chatea, pero **no registra los slash commands**:
  te quedas sin `/config` ni `/rank`.
- **Sin `OPENAI_API_KEY`** arranca con el chat desactivado. Memes, recompensa, ranking y
  canal trampa funcionan igual.

Para producción —compilar, desplegar y el endpoint de salud— ve a la
[guía de despliegue](docs/deployment-es.md).

## Documentación

| Guía | Qué cubre |
|---|---|
| **[Despliegue](docs/deployment-es.md)** | Referencia completa de variables de entorno, puesta en producción y el endpoint de salud opcional. |
| **[Extensibilidad](docs/extensibility-es.md)** | Cómo agregar una característica sin tocar el núcleo: comandos, eventos, configuración y capa de datos. |

## Proveedores de datos y ramas

Cada proveedor de base de datos tiene su propia rama. **Desplegar con otro proveedor
significa desplegar la rama correspondiente** — no hay variable de entorno que lo cambie.

| Rama | Proveedor | Historial de chat |
|------|-----------|-------------------|
| `riven/main` | SQLite (`data/bot.db`) | en memoria |
| `riven/provider-mongo` | MongoDB (`MONGODB_URI`) | MongoDB |

Los archivos de todos los proveedores están presentes en todas las ramas, pero cada rama
solo compila e instala el suyo: los del proveedor inactivo quedan excluidos del build
(`tsconfig.json`) y su driver no se instala en producción.

## Limpiar slash commands

Los comandos globales y los de un guild son sets independientes en Discord y no se
deduplican por nombre, así que una copia obsoleta en un scope puede quedar visible junto a
la versión actualizada de otro. Este script los elimina bajo demanda, sin tocar el registro
del arranque. Requiere `DISCORD_TOKEN` y `DISCORD_CLIENT_ID` en el entorno.

```bash
pnpm commands:clear -- --global          # limpia el scope global (afecta a TODOS los servidores)
pnpm commands:clear -- --guild 123 456   # limpia uno o varios guilds
pnpm commands:clear -- --guild 123,456   # también acepta lista separada por comas
```

Puedes combinar `--global` y `--guild`. Sin argumentos, imprime la ayuda y no hace nada.

> [!NOTE]
> Si tras limpiar el cliente de Discord sigue mostrando los comandos viejos, refresca con
> `Ctrl/Cmd+R` — es caché del cliente. Los de guild se actualizan al instante; los globales
> pueden tardar en reflejarse.

## Arquitectura

```
src/
  main.ts       arranque: lee el entorno, monta las dependencias y las cablea
  bot/          adaptador de Discord: cliente, comandos slash, eventos y listeners
  features/     la lógica de cada característica, sin depender de Discord
  data/         capa de datos: proveedores, repositorios y sus contratos
  config/       entorno del proceso y configuración de cada servidor
  core/         lo compartido que no pertenece a ninguna capa
  infra/        adaptadores con el mundo fuera del proceso
  scripts/      comandos de mantenimiento que se publican con el bot
docs/           guías de extensibilidad y de despliegue
data/bot.db     base de datos SQLite, creada al arrancar
```

## Notas

- **El historial de chat es efímero.** Cada conversación guarda como mucho
  `HISTORY_LIMIT` mensajes —contando los del bot— y se olvida tras `SESSION_TTL_SECONDS`
  de inactividad. Es contexto para el modelo, no un registro que se conserve.
- **Dos topes de uso en el chat**: uno por usuario de Discord, sumando todos sus canales y
  DM, y otro por conversación, entendida como el trío servidor-canal-usuario.
- **Límite de longitud.** El texto que se manda al modelo se mide en caracteres; por
  encima de `MAX_INPUT_CHARS` se rechaza antes de gastar la consulta.
- Entendiste la wea?
