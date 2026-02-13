# Architecture Decision Records (ADR)

## ADR-001: Monorepo with pnpm workspaces + Turborepo

**Status:** Accepted  
**Context:** Need shared types, unified tooling, and atomic commits across backend/frontend.  
**Decision:** pnpm workspaces for dependency management, Turborepo for task orchestration.  
**Rationale:** pnpm is fastest and most disk-efficient. Turborepo provides caching and parallel builds. Both are mature and well-supported.

---

## ADR-002: NestJS 11 with Fastify adapter

**Status:** Accepted  
**Context:** Need a structured, scalable Node.js backend framework.  
**Decision:** NestJS 11 with Fastify adapter instead of Express.  
**Rationale:** NestJS provides modular architecture, DI, guards, interceptors. Fastify is 2-3x faster than Express. NestJS 11 is the latest stable release.

---

## ADR-003: Prisma ORM with PostgreSQL 16

**Status:** Accepted  
**Context:** Need type-safe database access with migrations.  
**Decision:** Prisma as ORM, PostgreSQL 16 as database.  
**Rationale:** Prisma provides excellent TypeScript integration, auto-generated types, migration system. PostgreSQL 16 supports advanced features (row-level locks, serializable transactions) needed for DKP economy.

---

## ADR-004: Serializable Isolation for DKP Wallet Operations

**Status:** Accepted  
**Context:** DKP wallet operations (credit, debit, hold, finalize, release) must be atomic and race-condition free.  
**Decision:** Use `Prisma.$transaction` with `isolationLevel: Serializable` for all wallet mutations.  
**Rationale:** Serializable isolation prevents phantom reads, write skew, and lost updates. Critical for financial-like operations where balance integrity is paramount.  
**Tradeoff:** Slightly lower throughput on wallet writes; acceptable given expected load.

---

## ADR-005: Idempotency Keys for Critical Write Operations

**Status:** Accepted  
**Context:** Network retries and client-side double-submits could cause duplicate DKP transactions or bids.  
**Decision:** Support `X-Idempotency-Key` header; store key as unique constraint in transactions and bids.  
**Rationale:** Industry-standard approach (Stripe, etc.) for preventing duplicate mutations. Simple to implement with unique DB constraints.

---

## ADR-006: Anti-Sniper Mechanism for Auctions

**Status:** Accepted  
**Context:** Last-second bids ("sniping") undermine fair auctions.  
**Decision:** If a bid arrives within the last N seconds (default 20s), extend the lot timer by M seconds (default 30s). Both N and M are configurable per auction.  
**Rationale:** Standard approach used by eBay-style platforms. Prevents sniping while keeping auctions finite.

---

## ADR-007: Deterministic Randomizer with Auditable Proof

**Status:** Accepted  
**Context:** Randomizer must be fair, verifiable, and reproducible.  
**Decision:** Generate cryptographic random seed, hash with SHA-256, use hash bytes to derive roll value. Store seed, hash, weights, roll, and algorithm version as immutable proof.  
**Rationale:** Allows any party to verify the draw by re-running the algorithm with the stored seed. Algorithm versioning allows future improvements without breaking audit trail.

---

## ADR-008: Weighted Randomizer with Inverse BM/Level Priority

**Status:** Accepted  
**Context:** Weaker players should have slightly higher chances in randomizer draws.  
**Decision:** `weight = 1 + bonus` where `bonus ∈ [0.03, 0.05]`, calculated by inverse normalization of BM and level.  
**Rationale:** Small bonus (3-5%) gives meaningful priority to weaker players without making it unfair. Bonus range is tight enough to feel fair while still helping undergeared players.

---

## ADR-009: Append-Only Audit Log

**Status:** Accepted  
**Context:** All critical actions must be traceable for dispute resolution and compliance.  
**Decision:** `audit_logs` table with actor, action, entity, before/after state, IP, user-agent. No UPDATE/DELETE operations on this table.  
**Rationale:** Immutable trail enables forensics, dispute resolution, and admin accountability. Before/after snapshots allow state reconstruction.

---

## ADR-010: JWT with Refresh Token Rotation

**Status:** Accepted  
**Context:** Need stateless auth with session revocation capability.  
**Decision:** Short-lived access tokens (15min) + long-lived refresh tokens (7d) with rotation. Refresh token reuse triggers full session revocation.  
**Rationale:** Short access tokens limit exposure. Rotation detects token theft. Reuse detection (family revocation) is industry best practice.

---

## ADR-011: Socket.IO for Realtime Communication

**Status:** Accepted  
**Context:** Auctions, randomizer, and notifications need real-time updates.  
**Decision:** Socket.IO with Redis adapter for horizontal scaling readiness.  
**Rationale:** Socket.IO provides auto-reconnect, room management, and fallback to polling. Redis adapter enables multi-instance deployment without sticky sessions.

---

## ADR-012: Dark Fantasy UI Theme

**Status:** Accepted  
**Context:** UI should match MMORPG aesthetic while remaining functional.  
**Decision:** Dark theme with gold accents, Cinzel display font for headings, Inter for body. Rarity-based color coding for items.  
**Rationale:** Dark theme reduces eye strain during long gaming sessions. Gold accents convey premium/fantasy feel. Rarity colors match common MMORPG conventions.

---

## ADR-013: Backend-Only Authorization

**Status:** Accepted  
**Context:** Security requires that authorization checks cannot be bypassed.  
**Decision:** All RBAC/ABAC checks via NestJS guards and policies on backend. Frontend only uses role data for UI display (showing/hiding elements).  
**Rationale:** Frontend code is untrusted. Any authorization logic must be server-enforced. Frontend role checks are purely UX optimizations.

---

## ADR-014: UTC Storage, Asia/Almaty Display

**Status:** Accepted  
**Context:** Users are primarily in Kazakhstan (Asia/Almaty, UTC+5).  
**Decision:** Store all timestamps in UTC in PostgreSQL. Convert to Asia/Almaty on frontend display.  
**Rationale:** UTC storage is database best practice. Allows future multi-timezone support. Single conversion point (frontend) simplifies logic.
