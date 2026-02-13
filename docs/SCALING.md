# Риски и план масштабирования

## Текущие риски

### R1: Concurrency на DKP wallet
**Риск:** При высокой нагрузке Serializable isolation может вызывать retry-ошибки.  
**Митигация:** Retry loop с exponential backoff (до 3 попыток). Мониторинг serialization failures.

### R2: WebSocket scalability
**Риск:** Один процесс Node.js ограничен ~10K одновременных WS-соединений.  
**Митигация:** Redis adapter для Socket.IO уже подготовлен. При >5K пользователей — горизонтальное масштабирование API.

### R3: Auction hot-path
**Риск:** Активный аукцион с 100+ участниками создаёт burst нагрузку на DB.  
**Митигация:** Bid validation можно кешировать в Redis. Lot state — read from Redis, write to DB.

### R4: Single point of failure (PostgreSQL)
**Риск:** Потеря данных при сбое.  
**Митигация:** WAL archiving, pg_basebackup, streaming replication в production.

## Вертикальное масштабирование

1. **PostgreSQL** — увеличение RAM, CPU, SSD IOPS. Connection pooling через PgBouncer.
2. **Redis** — увеличение maxmemory, RDB/AOF persistence.
3. **API** — Node.js cluster mode (PM2) для использования всех CPU cores.
4. **MinIO** — увеличение дискового пространства.

## Горизонтальное масштабирование

### Phase 1: Multi-instance API (10K-50K users)
- Запуск 2-4 API инстансов за nginx/HAProxy
- Socket.IO Redis adapter для shared state
- Sticky sessions НЕ нужны (Redis adapter handles it)
- BullMQ workers на отдельных инстансах

### Phase 2: Read replicas (50K-200K users)
- PostgreSQL streaming replication
- Read queries → replica, Write queries → primary
- Prisma `$extends` для read/write splitting
- Redis cluster для cache tier

### Phase 3: Microservices (200K+ users)
- Выделение auction-service (hottest path)
- Event-driven architecture (NATS/Kafka)
- Отдельная БД для audit_logs (append-only, partitioned)
- CDN для static assets (MinIO → CloudFront/Cloudflare)

## Мониторинг (рекомендации для production)

- **APM:** Datadog / New Relic / Grafana + Tempo
- **Metrics:** Prometheus + Grafana
- **Logs:** Structured JSON → ELK / Loki
- **Alerts:** PagerDuty / OpsGenie
- **Uptime:** /health/ready + external monitors

## Backup Strategy

| Данные | Метод | Частота | Retention |
|--------|-------|---------|-----------|
| PostgreSQL | pg_dump + WAL archiving | Ежечасно + continuous | 30 дней |
| Redis | RDB snapshots | Каждые 15 мин | 7 дней |
| MinIO | mc mirror + versioning | Ежедневно | 90 дней |
| Audit logs | Отдельный partition, never delete | — | Бессрочно |
