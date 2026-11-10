# Deployment (pilotdeal.online)

One VM runs `docker-compose.prod.yml`:

| Service | Role                                                                                             | Published |
| ------- | ------------------------------------------------------------------------------------------------ | --------- |
| `caddy` | HTTPS (Let's Encrypt), serves the static site at `/`, proxies `/demo` to `web`, redirects `www.` | 80, 443   |
| `web`   | Dashboard, built with `BASE_PATH=/demo`                                                          | no        |
| `api`   | REST API, applies migrations on start                                                            | no        |
| `db`    | PostgreSQL with pgvector                                                                         | no        |

Only Caddy is reachable from the internet. `db`, `api` and `web` talk over the compose network.

## Server .env

The stack reads `.env` in the repository root on the server (`~/PilotDeal/.env`, mode 600).
See `deploy/.env.prod.example`. `POSTGRES_PASSWORD` is required and must be URL-safe:

```sh
cp deploy/.env.prod.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" .env
chmod 600 .env
```

The password is fixed when the database volume is first created; changing it later in `.env`
does not change it in PostgreSQL.

## First start

```sh
docker compose -f docker-compose.prod.yml up -d --build --wait
docker compose -f docker-compose.prod.yml exec -T api node dist/prisma/seed.js
```

DNS for the domain and `www.` must point to the server before the first start, so Caddy can get
the certificates.

## Daily reseed

`deploy/reseed-demo.sh` restores the sample data. Install it with `crontab -e`:

```
17 4 * * * bash /home/ubuntu/PilotDeal/deploy/reseed-demo.sh >> /home/ubuntu/reseed-demo.log 2>&1
```

## Update after a push

```sh
cd ~/PilotDeal
git pull
docker compose -f docker-compose.prod.yml up -d --build --wait
docker image prune -f
```

Only changed images are rebuilt; migrations run when the `api` container starts. The database and
the certificates live in named volumes and survive rebuilds.

## Useful commands

```sh
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy web api
```
