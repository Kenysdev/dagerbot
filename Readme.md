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

Variables de entorno:

```
DISCORD_TOKEN=...
DISCORD_PREFIX=!
```

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
# REDIS_URL=redis://localhost:6379
```

Si no defines `OPENAI_SYSTEM_PROMPT`, se usa `src/config/systemPrompt.ts` por defecto.

## Arquitectura

- `src/app.ts` registra rutas y dependencias.
- `src/http/` controladores y rutas HTTP.
- `src/services/` lógica de negocio (chat).
- `src/core/` utilidades y stores de sesión.
- `src/infra/` clientes externos (OpenAI).

## Notas

- Historial se guarda en memoria o Redis (TTL) según `REDIS_URL`.
- Rate limit por IP y por sesión.
- Entendiste la wea?
