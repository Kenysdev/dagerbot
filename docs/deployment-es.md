# Guía de despliegue

Referencia de variables de entorno, puesta en producción y el endpoint de salud.
Para el Readme queda lo que hace el bot; aquí vive el detalle de operación.

---

## Variables de entorno

Se leen de `.env` (vía `dotenv`) o del entorno del proceso. `.env.example` sirve de
plantilla. **Estas son todas las que el código lee**; cualquier otra no hace nada.

> [!TIP]
> Las variables sin valor por defecto se comprueban por «tiene contenido», no por «es
> válida». Dejarlas **vacías** desactiva limpiamente lo que dependa de ellas, con un aviso
> claro en el log; rellenarlas con un texto de relleno hace lo contrario: el arranque las
> da por buenas y el fallo aparece después, al usarlas.

### Discord

| Variable | Por defecto | Para qué |
|---|---|---|
| `DISCORD_TOKEN` | — | Token del bot. Sin ella el bot no se conecta: el proceso avisa y sigue vivo, pero no hace nada. |
| `DISCORD_CLIENT_ID` | — | Identificador de la aplicación. Sin ella el bot se conecta y chatea, pero **no registra los slash commands**: no habrá `/config` ni `/rank`. |
| `DISCORD_PREFIX` | `!` | Prefijo alternativo a mencionar al bot. Requiere el intent `Message Content`. |
| `DISCORD_GUILD_ID` | — | **Solo desarrollo.** Registra los comandos al instante en ese servidor. Sin ella se registran globalmente, y Discord tarda en propagarlos. |
| `CONFIG_PERMISSION` | `Administrator` | Permiso exigido para usar `/config`. Admite `Administrator`, `ManageGuild`, `BanMembers`, `KickMembers`, `ModerateMembers` y `ManageChannels`. Un valor que no esté en esa lista **no da error**: se ignora y se usa `Administrator`. Se aplica al registrar los comandos, así que cambiarla exige reiniciar. |

### Chat

| Variable | Por defecto | Para qué |
|---|---|---|
| `OPENAI_API_KEY` | — | Clave de OpenAI. Sin ella el bot arranca con **el chat desactivado**; el resto de características funciona igual. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Modelo de chat. |
| `OPENAI_SYSTEM_PROMPT` | el de `src/config/systemPrompt.ts` | Personalidad del bot. Permite cambiarla en un despliegue concreto sin tocar el repositorio. |
| `MAX_INPUT_CHARS` | `4096` | Longitud máxima, **en caracteres**, del texto que se manda al modelo. Se mide sobre el texto ya montado, que incluye el nombre de quien escribe y el mensaje citado si se respondió a alguien. Por encima se rechaza sin gastar la consulta. |
| `HISTORY_LIMIT` | `10` | Mensajes que se recuerdan por conversación. Cuenta **también los del bot**, así que 10 son unos cinco intercambios. |
| `SESSION_TTL_SECONDS` | `3600` | Inactividad tras la cual se olvida una conversación. |
| `RATE_LIMIT_USER_PER_MIN` | `10` | Tope por usuario de Discord, sumando todos los canales. Cada mensaje por encima sería una consulta a OpenAI que paga el dueño del bot. |
| `RATE_LIMIT_SESSION_PER_MIN` | `100` | Tope por conversación (`servidor:canal:usuario`). |

### Infraestructura

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | — sin definir | Si se define, levanta el endpoint de salud. Ver más abajo. |
| `MONGODB_URI` | — | Cadena de conexión, **solo si el proveedor activo es Mongo**. Se aceptan también `MONGO_URL` y `DATABASE_URL`, por si la plataforma inyecta una de esas; el orden de prioridad es `MONGODB_URI` → `MONGO_URL` → `DATABASE_URL`. |

SQLite no necesita configuración: crea `data/bot.db` en el directorio desde el que se
ejecuta el proceso.

Esta lista de variables es **la misma en todas las ramas**; `.env` y `.env.example` no
cambian entre proveedores. Lo que decide el proveedor activo es la rama que despliegas —
ver «Proveedores de datos y ramas» en el Readme.

---

## Puesta en producción

```bash
pnpm install --frozen-lockfile   # incluye devDependencies, necesarias para compilar
pnpm build
pnpm prune --prod                # elimina las devDependencies
node dist/main.js
```

- **Requisitos:** Node 22.13 o superior (lo exige la versión de pnpm fijada) y pnpm
  (`corepack enable` o `npm i -g pnpm`).
- **VPS:** los comandos de arriba corren tal cual. Conviene lanzar el proceso con un gestor
  (systemd, pm2) en lugar de `node` directo, para que sobreviva a reinicios.
- **PaaS (Railway, Render…):** suelen detectar el lockfile de pnpm y ejecutar install,
  `build` y `start` por su cuenta; ahí `pnpm prune --prod` es opcional.
- **SQLite necesita sistema de archivos persistente.** En plataformas con almacenamiento
  efímero (p. ej. Railway sin volumen) los datos se pierden en cada despliegue: montar un
  volumen o desplegar la rama del proveedor Mongo.
- **En local:** `pnpm dev` ejecuta el TypeScript directamente. `pnpm start` corre el
  compilado, así que necesita un `pnpm build` previo.

---

## Endpoint de salud y `PORT`

Un bot de Discord es un **cliente saliente**: abre él mismo la conexión hacia el gateway y
no necesita escuchar en ningún puerto. Un socket de escucha es un adaptador de despliegue
—una concesión al hosting—, no una buena práctica intrínseca. Por eso va condicionado.

**La regla es una sola:**

- **`PORT` sin definir** — es el caso por defecto. `startHealthServer` no se llama nunca:
  no se abre ningún socket, no se registra ningún listener y no queda nada escuchando. El
  módulo se carga pero está inerte, con coste cero.
- **`PORT` definida** — se levanta un servidor mínimo con el módulo `http` de Node:
  - `GET /health` y `HEAD /health` → `200` con `{"ok":true}`.
  - Cualquier otro verbo sobre esa ruta → `405` con la cabecera `Allow`.
  - Cualquier otra ruta → `404`. No sirve archivos y no existe ninguna otra ruta.
  - Si el puerto no se puede abrir, se registra el error y **el bot sigue funcionando**: el
    endpoint es accesorio.

**Cuándo definirla:** solo si la plataforma exige un puerto abierto para dar el despliegue
por vivo, o si quieres apuntar un monitor de uptime contra el bot. En un VPS con systemd o
pm2 no hace falta: el supervisor ya reinicia el proceso si muere.

> [!IMPORTANT]
> `{"ok":true}` es una constante. Confirma que el proceso vive y responde, **no** que el
> bot esté conectado a Discord. Si el gateway se cae y no reconecta, `/health` sigue
> diciendo que todo va bien. Sirve para mantener despierta una instancia y para detectar un
> proceso muerto; no detecta un bot zombi.

Si defines `PORT` en un VPS, el puerto queda escuchando en `0.0.0.0`, accesible desde fuera.
Protégelo con cortafuegos si no lo necesitas expuesto.

### Qué exige cada plataforma

> [!WARNING]
> Esta tabla describe las condiciones de terceros y **envejece**: los proveedores cambian
> planes, límites y comportamientos sin avisar. Verificada por última vez en **agosto de
> 2026**; contrástala con la documentación vigente antes de decidir un despliegue.

| Plataforma | ¿Exige puerto abierto? | Qué hacer |
|---|---|---|
| **VPS propio** (systemd, pm2) | No | No definir `PORT`. La vitalidad la garantiza el supervisor. |
| **Render — Web Service** | **Sí**, o el despliegue falla | Render define `PORT` solo. En el plan gratuito el servicio duerme a los ~15 min de inactividad, y el WebSocket saliente hacia Discord no cuenta como tráfico entrante: apuntar un monitor de uptime a `/health`. |
| **Render — Background Worker** | No | Es el tipo de servicio correcto para un bot, pero solo existe en planes de pago. No definir `PORT`. |
| **Railway** | No | Opcional; definir `PORT` solo si se quiere el endpoint. |
| **Fly.io** | No, salvo que se declaren `[[services]]` en `fly.toml` | No declarar servicios ni definir `PORT`. |
| **Heroku — dyno web** | **Sí**, hay que enlazar `$PORT` en menos de 60 s | `PORT` se define solo. |
| **Heroku — dyno worker** | No | No definir `PORT`. |
| **Docker / Kubernetes** | No | Preferir healthcheck por comando (`exec`). Para sonda HTTP, definir `PORT` y usar `httpGet`. |
