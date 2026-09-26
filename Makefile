.PHONY: up down rebuild

up:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

rebuild:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
