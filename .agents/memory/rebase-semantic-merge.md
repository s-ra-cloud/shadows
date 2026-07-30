---
name: Semantic rebase can drop module-level side effects
description: Task-merge rebases may reorder/merge function bodies and silently drop top-level side-effect calls.
---
The task-merge rebase resolves conflicts semantically (per function) and can reorder declarations and drop bare module-level statements (e.g. a top-level `recoverX();` init call).

**Why:** A startup-recovery call placed at module scope vanished during a rebase; only exported functions survived, so the feature silently never ran.

**How to apply:** Put startup side effects inside an explicitly invoked function called from route registration/bootstrap, not as a bare module-level statement — and after any rebase, grep that init calls still exist.
