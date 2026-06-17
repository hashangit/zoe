---
title: Authentication
description: Zoe Agent Server API key format, generation, scopes, and auth methods.
---

# Authentication

Zoe Agent Server uses API keys for authentication. Every request (except the health check) must include a valid key with appropriate permissions.

## API key format

Keys follow the format:

```
sk_zoe_{64-character-hex}
```

Example:

```
sk_zoe_a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd
```

Keys are generated using 32 random bytes (256 bits of entropy) and prefixed with `sk_zoe_` for easy identification.

## Generating keys

### CLI

::: code-group

```bash [Default scopes]
zoe server keygen
```

```bash [Custom scopes]
zoe server keygen --scopes agent:run,agent:read
```

```bash [With label]
zoe server keygen --scopes admin --label "production-admin"
```

:::

### Programmatic

```typescript
import { generateApiKey } from "zoe-agent/server";

const entry = generateApiKey(["agent:run", "agent:read"], {
  label: "my-app",
});

console.log(entry.key);   // sk_zoe_...
console.log(entry.scopes); // ["agent:run", "agent:read"]
```

## Key storage

API keys are stored in:

```
~/.zoe/server-keys.json
```

The file is created with `0o600` permissions (owner read/write only). The store is a JSON array:

```json
{
  "keys": [
    {
      "key": "sk_zoe_a1b2c3...",
      "scopes": ["agent:run"],
      "created": "2026-04-08T12:00:00.000Z",
      "label": "generated"
    }
  ]
}
```

### Key management

| Action | CLI | Programmatic |
|---|---|---|
| Generate | `zoe server keygen` | `generateApiKey(scopes, options)` |
| List | `zoe server keys` | `loadApiKeys(filePath?)` |
| Revoke | `zoe server revoke <key>` | `revokeApiKey(key, filePath?)` |

::: warning File permissions
Ensure `~/.zoe/server-keys.json` remains `0o600`. The server caches keys in memory and reloads when the file changes, so modifications take effect without restart.
:::

## Scopes

Scopes control what actions an API key can perform.

| Scope | Description | Endpoints |
|---|---|---|
| `agent:run` | Execute chat generation | `POST /v1/chat`, WebSocket `chat` |
| `agent:read` | Read session data | `GET /v1/sessions/:id`, WebSocket `resume`/`reconnect` |
| `admin` | Full access to all operations | All endpoints |

### Scope checks

- `GET /v1/health` -- no key required
- `GET /v1/models` -- any valid key
- `GET /v1/skills` -- any valid key
- `POST /v1/chat` -- requires `agent:run`
- `GET /v1/sessions/:id` -- requires `agent:read`
- WebSocket -- any valid key, operations check specific scopes

::: info Admin scope includes all
The `admin` scope grants access to all operations. Use it only for internal tooling or development.
:::

## Auth methods

Three methods are supported for passing API keys:

### 1. Custom header (recommended for REST)

```bash
curl http://localhost:7337/v1/chat \
  -H "X-Zoe-API-Key: sk_zoe_..."
```

### 2. Authorization Bearer header

```bash
curl http://localhost:7337/v1/chat \
  -H "Authorization: Bearer sk_zoe_..."
```

### 3. Query parameter (WebSocket only)

```javascript
const ws = new WebSocket("ws://localhost:7337/ws?token=sk_zoe_...");
```

### Lookup order

The server checks credentials in this order:

1. `X-Zoe-API-Key` header
2. `Authorization: Bearer` header
3. `token` query parameter

The first valid key found is used. If none is provided, the request is rejected with `401 UNAUTHORIZED`.

## Error responses

### Missing key (401)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid API key"
  }
}
```

### Insufficient scope (403)

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "API key lacks 'agent:run' scope"
  }
}
```
