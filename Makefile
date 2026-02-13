.PHONY: up down init test lint seed build clean logs

up:
	docker compose up -d --build

down:
	docker compose down

init: up
	@echo "Waiting for services to be healthy..."
	@timeout 15 > NUL 2>&1 || sleep 15
	docker compose exec api npx prisma migrate deploy
	docker compose exec api npx prisma db seed
	@echo "=== Ymir Clan Hub is ready! ==="
	@echo "Web:     http://localhost:5173"
	@echo "API:     http://localhost:3000/api/v1"
	@echo "Swagger: http://localhost:3000/api/docs"
	@echo "Mailpit: http://localhost:8025"
	@echo "MinIO:   http://localhost:9001"

test:
	docker compose exec api pnpm test

lint:
	docker compose exec api pnpm lint

seed:
	docker compose exec api npx prisma db seed

build:
	docker compose build

clean:
	docker compose down -v --remove-orphans
	docker system prune -f

logs:
	docker compose logs -f

migrate:
	docker compose exec api npx prisma migrate deploy

studio:
	docker compose exec api npx prisma studio
