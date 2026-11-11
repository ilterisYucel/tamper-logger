# tamper-logger

Tamper-evident, HMAC-chained audit logging for Node.js (>=20) and Bun. Built
for NIS-2–style audit trails: every event is signed and chained to the previous
one, so deletion, reordering or mutation of a log file is detectable.

## Install

```bash
npm install tamper-logger
# or
bun add tamper-logger
```

## Usage

```ts
import { TamperLogger, FileSink } from "tamper-logger";

const logger = new TamperLogger({
  signingKey: process.env.LOG_SIGNING_KEY!, // HMAC key material (env/file — never in code)
  service: "my-service",
  sinks: [new FileSink({ path: "/var/log/my-service/audit.log" })],
  level: "info",
});

// Audit/security categories are fail-closed: if the sink write fails, log() throws.
await logger.log({
  level: "info",
  category: "audit",
  eventCode: "user_login",
  message: "user logged in",
  context: { userId: "u-1" },
});
```

`eventCode` is a free string; inject your own closed set with
`eventCodeValidator` if you need a strict dictionary (a rejected code makes
`log()` throw — fail-closed).

### Verify a log file (NIS-2 evidence)

```bash
npx verify-log /var/log/my-service/audit.log --key "$LOG_SIGNING_KEY"
# or: verify-log <file> --key-file /etc/my-service/log-signing.key
```

Exit codes: `0` chain valid · `1` tampering detected · `2` usage/key error.

## Sinks

`console`, `file`, `timescale` (via a minimal `{ execute(sql, params) }` executor),
`syslog` (RFC 5424/UDP), `http-webhook` (`X-Signature: sha256=…`, retry/backoff),
`smtp`, `http-sms`, `alert-notifier` (5-minute cooldown; alert failures never
affect audit writes).

## Guarantees

- `app` category: batched, drop policy with counters and health degradation.
- `audit` / `security`: **fail-closed** — batching is flushed, the write is
  synchronous with the call, and errors propagate to the caller.
- Redaction of sensitive keys (`password`, `token`, `authorization`, `secret`,
  `api_key`, `apikey`) in a case-insensitive, partial-match way.
- `verifyChain` never reorders input: file order is the chain order; a new
  `GENESIS` segment is a service restart, not tampering.

## Documentation

Architecture and decisions: [`docs/TAMPER-LOGGER-MIMARISI.md`](docs/TAMPER-LOGGER-MIMARISI.md).

## License

MIT
