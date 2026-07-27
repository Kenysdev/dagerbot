# Dagerbot HTTP Backend

Backend en TypeScript con Fastify para chatbot de discord en el antro usando OpenAI y async/await.

## Endpoints

- `GET /health` → `{ ok: true }`
- `POST /chat` → `{ reply: string }`

### Body esperado

```json
{
  "sessionId": "uuid",
  "text": "hola",
  "conversationId": "opcional"
}
```

### Ejemplo de respuesta

```json
{ "reply": "..." }
```

## Discord bot

- Responde en DM a cualquier mensaje.
- En servidores responde si mencionas al bot o si usas prefijo (por defecto `!`).
- Usa el mismo backend/servicio interno que `/chat`.
- `/config show` — muestra el estado de todos los módulos.
- `/config meme` — configura el módulo de memes (canal, reacciones, modo solo-media, random-react).
- `/config meme-reward` — configura la recompensa por acumulación de memes (rol, meta, mensaje).
- `/rank meme` — muestra el top de usuarios con más memes publicados, navegable por páginas.

Variables de entorno:

```
DISCORD_TOKEN=...
DISCORD_PREFIX=!
DISCORD_CLIENT_ID=... # Required for slash command registration
CONFIG_PERMISSION=... # Permission required to use /config commands
DISCORD_GUILD_ID=...  # solo para desarrollo, omitir en producción
# Si no defines `DISCORD_GUILD_ID`, los comandos se registran globalmente.
```

## Permisos requeridos

Al invitar el bot, asegurarse de incluir los siguientes permisos y scopes:

**Scopes:**
- `bot`
- `applications.commands`

**Permisos del bot:**
- `Send Messages`
- `Add Reactions`
- `Manage Messages`
- `Manage Roles`

> [!WARNING]
> Si se agrega una característica nueva que requiera permisos adicionales:
> - **Permisos del bot** (`Send Messages`, `Add Reactions`, etc.) pueden actualizarse
>   manualmente desde Configuración del servidor → Roles → rol del bot.
> - **Scopes** nuevos (`applications.commands`, etc.) requieren re-invitar el bot
>   con un enlace OAuth2 actualizado.


## Variables de entorno

```
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
# OPENAI_SYSTEM_PROMPT=Eres Dagerbot. Responde en espanol y se guapo mañosón.
PORT=3000
MAX_INPUT_CHARS=4096
HISTORY_LIMIT=10
SESSION_TTL_SECONDS=3600
RATE_LIMIT_IP_PER_MIN=60
RATE_LIMIT_SESSION_PER_MIN=100
```

Si no defines `OPENAI_SYSTEM_PROMPT`, se usa `src/config/systemPrompt.ts` por defecto.

## Arquitectura

- `src/app.ts` registra rutas y dependencias.
- `src/http/` controladores y rutas HTTP.
- `src/services/` lógica de negocio (chat).
- `src/core/` utilidades y stores de sesión.
- `src/infra/` clientes externos (OpenAI).
- `src/bot/` cliente de Discord, comandos slash y eventos.
- `src/features/` lógica de características independiente de Discord.
- `src/config/settingsManager.ts` configuración dinámica por servidor.
- `src/data/` capa de datos — proveedores, repositorios y contratos.
- `data/bot.db` base de datos SQLite generada automáticamente al arrancar.

## Proveedores de datos y ramas

Cada proveedor de base de datos tiene su propia rama. **Desplegar con otro proveedor
significa desplegar la rama correspondiente** — no hay variable de entorno que lo cambie.

| Rama | Proveedor | Historial de chat |
|------|-----------|-------------------|
| `riven/main` | SQLite (`data/bot.db`) | en memoria |
| `riven/provider-mongo` | MongoDB (`MONGODB_URI`) | MongoDB |

Los archivos de todos los proveedores están presentes en todas las ramas, pero cada
rama solo compila e instala el suyo: los del proveedor inactivo quedan excluidos del
build (`tsconfig.json`) y su driver no se instala en producción.

Despliegue:

```bash
pnpm install --frozen-lockfile   # incluye devDependencies, necesarias para compilar
pnpm build
pnpm prune --prod                # elimina las devDependencies
node dist/main.js
```

Notas de despliegue:

- **Requisitos:** Node 20 o superior (lo exigen `better-sqlite3` y `mongoose`) y pnpm
  (`corepack enable` o `npm i -g pnpm`).
- **Servidor propio (VPS):** los comandos de arriba corren tal cual. Conviene lanzar el proceso
  con un gestor (systemd, pm2) en lugar de `node` directo, para que sobreviva a reinicios.
- **PaaS (Railway, Render, etc.):** suelen detectar el lockfile de pnpm y ejecutar install,
  `build` y `start` por su cuenta; ahí `pnpm prune --prod` es opcional (solo reduce el tamaño).
- **SQLite necesita sistema de archivos persistente.** En plataformas con almacenamiento
  efímero (p. ej. Railway sin volumen) los datos se pierden en cada despliegue: montar un
  volumen o desplegar la rama del proveedor Mongo.
- **En local:** `pnpm dev` ejecuta el TypeScript directamente, sin compilar. `pnpm start` corre
  el compilado, así que necesita un `pnpm build` previo.

Detalles del modelo y cómo agregar un proveedor nuevo: [docs/extensibility-es.md](docs/extensibility-es.md).

## Extensibilidad

El bot tiene una arquitectura modular — agregar nuevas características sin tocar el núcleo.
Ver [docs/extensibility-es.md](docs/extensibility-es.md) para la guía completa.

## Notas

- Historial de chat en memoria: efímero, no se persiste. Guarda los últimos `HISTORY_LIMIT` mensajes por sesión, expira tras `SESSION_TTL_SECONDS` de inactividad y se pierde al reiniciar el bot.
- Rate limit por IP y por sesión.
- Entendiste la wea?
