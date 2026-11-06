# Overview

**Document version:** 1.1

System identity, role, and boundary with the rest of the Forge ecosystem.

## Doctrine

VibeForge is local-first by default, cloud-accelerated by approval, and developer-authoritative at every irreversible boundary.

VibeForge is not an IDE replacement, not a model wrapper, and not a cloud coding bot. It is a governed AI engineering command system that surrounds existing coding tools with local repo truth, context control, agent workcells, board review, patch receipts, command gates, privacy-safe cloud escalation, and developer authority.

VibeForge does not compete with coding models. VibeForge governs them.

## Agent principle

Agents may propose. Boards may recommend. SMITH may gate. Developers decide. Receipts prove.

Nothing is trusted because it was generated. A claim is trusted only when it has evidence, a contract, validation, a receipt, and an authority decision behind it.

## Naming boundary (non-negotiable)

This is the single most important boundary in the whole system, and the one this document exists to make unambiguous:

- The bundled local Postgres store is the **VibeForge Local Evidence Vault** (also "VibeForge Vault" or "VibeForge Local Authority Store"). It is customer-side, private, and owns all sensitive engineering evidence: repo truth, agent runs, context packs, board reviews, receipts, AAR records, and local policy.
- **Cloud DataForge** is a separate, company-side (BDS-internal) system. It receives only privacy-safe operational analytics — usage counts, route class, credit cost, success/failure, error category, app/OS version, quota events. It never receives source code, prompts, diffs, raw logs, secrets, file paths, or repo/branch names.
- The local vault must **never** be called "DataForge" or "DataForge Local" in any commercial-facing string, generated file, or new code. See "Known naming debt" below for where this rule is already being violated in this repo today.
- Internal Forge component names (SMITH, YellowJacket, PCC, PACT, Rake, NeuronForge, NeuroForge, ForgeAgents) stay out of the commercial product UI. Capability-level language only (see [01-architecture.md](01-architecture.md) for the full component role map).

## Non-goals

VibeForge is explicitly **not**:

- A general-purpose coding agent or a competitor to the coding models it wraps.
- A place where AI output is silently applied — every risky or irreversible action requires developer approval (Human-On-The-Loop, not autonomous).
- A cloud-first product — cloud is an opt-in escalation lane with a mandatory preview, credit estimate, and redaction pass before every job, never an ownership lane.
- A source of canonical Forge-ecosystem-wide governance, credential brokerage, or command-plane authority — those remain owned elsewhere (see [01-architecture.md](01-architecture.md), "Forge_Command").
- A rebuild of Canva/Adobe Express/a generic editor, or of ForgeCustomer/admin/fleet-update business logic borrowed in spirit but not in code from Forge_Command.

## Known naming debt

Live source in this repo already uses "DataForge" for what the doctrine above calls the "VibeForge Local Evidence Vault":

```text
src/lib/core/api/dataforgeClient.ts
src/lib/core/api/dataforgeClient.enhanced.ts
src/lib/core/api/dataforgeClient.enhanced.test.ts
```

This list named six files until the dead-code sweep of 2026-10-30. Three of them — `src/lib/types/dataforge.ts`, `src/lib/stores/dataforgeStore.ts` and `src/lib/api/dataforge.ts` — were unreachable from every entry point in the application, and were deleted with the rest of the dead code. The debt is therefore half what it was, by removal rather than by rename: the three files above are still named `dataforge*` and still carry it.

This code predates the naming doctrine above and is **not** an example to copy. It is not renamed as part of this documentation pass — that is a deferred, later-phase change, tracked as accepted, documented naming debt rather than left as an unstated inconsistency. New code must use "VibeForge Local Evidence Vault" naming; it must not extend the `dataforge*` pattern.

## Completion language

Allowed: planned, implemented, validated, partially implemented, blocked, accepted limitation, deferred, unproven.

Avoid, unless backed by executable evidence and an audit trail: production ready, fully safe, final, no risk, complete, SLSA compliant, SOC2 ready, HIPAA compliant, fully autonomous coder, AI replaces developer, perfect security.
