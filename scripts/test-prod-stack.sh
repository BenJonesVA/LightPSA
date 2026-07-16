#!/bin/sh
# Runs the exact same files the real VM deployment uses
# (docker-compose.yml + docker-compose.prod.yml), but under a separate
# Compose project name and its own volumes/network — so it never touches
# the everyday dev stack (`docker compose up -d`, project "psa") and can run
# fully in parallel with it. NPM's ports (80/443/81) don't collide with
# dev's (3131/8080/5432) anyway, but the isolated project name is what lets
# both sets of `app`/`postgres`/`migrate` containers coexist without one
# recreating the other's containers out from under it.
#
# What this can't test locally: real TLS. Let's Encrypt needs a public
# domain with DNS pointed at a reachable IP, which localhost isn't. Add a
# proxy host in NPM (http://localhost:81) for domain "localhost" -> app:3131
# with SSL off, then visit http://localhost — that exercises the identical
# proxy_pass wiring the real deploy will use, just without the cert step.
#
# Usage: ./scripts/test-prod-stack.sh [up|down]
set -eu
cd "$(dirname "$0")/.."

ACTION="${1:-up}"
PROJECT="psa-prod-test"

case "$ACTION" in
	up)
		docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.prod.yml up -d --build
		echo
		echo "NPM admin UI:  http://localhost:81  (first login: admin@example.com / changeme)"
		echo "App (via NPM): http://localhost      (after you add a proxy host for 'localhost' -> app:3131)"
		;;
	down)
		docker compose -p "$PROJECT" -f docker-compose.yml -f docker-compose.prod.yml down
		;;
	*)
		echo "usage: $0 [up|down]" >&2
		exit 1
		;;
esac
