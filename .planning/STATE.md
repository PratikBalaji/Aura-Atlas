# AuraAtlas — State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Universities get a real-time early warning system for campus mental health — students get an anonymous outlet with AI support.
**Current focus:** Phase 1 — Demo Stability + Real-Time Map

## Current Position

- **Milestone:** Hackathon Win
- **Phase:** 1 of 3
- **Plan:** Demo seed + geolocation stability
- **Status:** Done

## Key Decisions

- YOLO mode — no confirmation steps, just execute
- Quick depth — 3 phases, tight scope
- Parallel execution where possible
- Skip research (full codebase already analyzed)
- Teammates actively working on profile + AR — avoid those files

## Active Issues / Blockers

- Demo seed button fails when the `checkins` table schema is older and lacks optional columns like `campus_name`
- Location tracking starts too aggressively on page load, surfacing browser geolocation errors before the user asks for location features

## Recent Progress

- 2026-03-22: GSD initialized, planning structure created
- 2026-03-22: Full codebase analyzed via Explore agent
- 2026-03-22: todo.md pushed to GitHub for team
- 2026-03-22: Started focused bugfix sprint for demo seeding + location UX stability
- 2026-03-22: Fixed demo seeding to tolerate optional schema drift and made location access opt-in

---
*Last updated: 2026-03-22 after initialization*
