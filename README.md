# LightPSA

A PSA / Ticketing System for MSPs — tickets, boards, clients & contacts, contracts/billing, SLA policies, automation rules, a knowledge base, asset tracking, dispatch scheduling, CSAT surveys, and reporting. See [`plan.md`](./plan.md) for the full build history and architecture notes.

## Quick start

```bash
docker compose up -d
```

This brings up Postgres, applies pending migrations, and starts the app at **http://localhost:3131**. Adminer (DB admin UI) is at **http://localhost:8080** (system: PostgreSQL, server: `postgres`, user/password: `psa`/`psa`, database: `psa`).

To load the demo data (safe to run once — the seed script skips itself if the database already has data):

```bash
docker compose run --rm migrate npx prisma db seed
```

For day-to-day development (hot reload), run the app on the host instead of in a container:

```bash
npm install
npm run dev
```

## Demo login credentials

Every seeded account shares the same password: **`password123`**

### Staff (sign in via the "Staff" tab at `/login`)

| Email | Role |
|---|---|
| `priya.admin@ourmsp.com` | ADMIN |
| `marcus.manager@ourmsp.com` | MANAGER |
| `alice.tech@ourmsp.com` | TECHNICIAN |
| `ben.tech@ourmsp.com` | TECHNICIAN |

ADMIN and MANAGER can access Billing, Automation, SLA Policies, and Reports; TECHNICIAN cannot (redirected to `/unauthorized`). All four can use Tickets, Boards, Clients, the Knowledge Base, and the Schedule.

### Client portal (sign in via the "Client Portal" tab at `/login`)

| Email | Client | Portal access |
|---|---|---|
| `diane.cross@acmecorp.com` | Acme Corp | Yes |
| `kevin.ortiz@acmecorp.com` | Acme Corp | Yes |
| `renee.fields@acmecorp.com` | Acme Corp | No (intentionally disabled — negative-access test case) |
| `sam.patel@acmecorp.com` | Acme Corp — Downtown Branch (child company) | Yes |
| `lauren.hayes@brightpathdental.com` | BrightPath Dental | Yes |
| `nina.alvarez@brightpathdental.com` | BrightPath Dental | Yes |
| `ivy.chen@summitlegal.com` | Summit Legal Group | Yes |
| `harold.reyes@summitlegal.com` | Summit Legal Group | No (intentionally disabled — negative-access test case) |

Portal contacts can only ever see their own client's tickets and KB articles marked external — never another client's data, and never internal-only content, even if they know the exact URL/id (enforced at the database query level, not just hidden in the UI).

## Deploying to a self-hosted VM

`docker compose up -d` (above) is unchanged for local dev — it still auto-loads `docker-compose.override.yml`, which is what publishes Postgres/the app's ports and starts Adminer.

A real deployment instead runs `docker-compose.yml` + `docker-compose.prod.yml` with **explicit `-f` flags**, which skips that auto-load and adds [Nginx Proxy Manager](https://nginxproxymanager.com/) in front of the app for TLS:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Then, one-time, through NPM's own admin UI at `http://<vm-ip>:81` (no default credentials on first boot — you create the admin account there): add a proxy host for your real domain pointing at `app:3131`, and request its Let's Encrypt cert. Set `AUTH_TRUST_HOST=true` and real `POSTGRES_*` credentials in `.env` before starting — see `.env.example` for what's required.

To try this whole path locally first without touching your dev stack, run `./scripts/test-prod-stack.sh up` — it brings up the identical two-file stack under a separate, isolated Compose project so it can run alongside the everyday dev containers. `./scripts/test-prod-stack.sh down` tears it back down. Real TLS can't be tested this way (Let's Encrypt needs a public domain), but the proxy wiring itself can — add a proxy host for `localhost` with SSL off and visit `http://localhost`.

For nightly Postgres backups, see `scripts/backup-db.sh` (meant to be driven by a host cron job) and `scripts/restore-db.sh`.

## Notes

- These credentials and the seed data they log into (`prisma/seed.ts`) are for local development and demos only — never reuse this password scheme anywhere real accounts exist.
- Infrastructure secrets (`AUTH_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, etc.) are configured via `.env` — see `.env.example` for what's required and what each one does.
