# skill-gate

Status: ready-for-agent

## Problem Statement

当可供 Agent 使用的技能数量变大时,把所有技能的元数据一次性注入上下文会挤占窗口、稀释注意力,导致技能触发不准确甚至产生幻觉。用户需要一种按场景组织、按需取用的技能获取方式,同时还需要知道技能到底在什么时候被谁使用过——既在单个会话内,也跨越该仓库的所有会话。

## Solution

提供一个 DeepSeek Harness 插件(工具网关):把海量技能按**场景**组织成一棵**场景树**,Agent 只能通过一个 `skill_gateway` 工具按目的、渐进式地取用技能——先取**技能元数据**,决定后再二次加载技能全文;同时持久化记录**会话内使用记录**与**全局统计**。网关可开关;统计无论开关恒生效。

## User Stories

1. As an Agent, I want to query the gateway by purpose and receive the matching scene path plus that subtree's skill metadata, so that I only ever load skills relevant to the task at hand.
2. As an Agent, I want `find` to match against a scene's name, description, and tags (with skill name/description as a secondary signal), so that I can locate the right leaf even when my wording differs from the scene's.
3. As an Agent, I want `find` to return the matched scene path alongside the skills, so that I can see why each skill was matched.
4. As an Agent, I want to `load` a chosen skill's full content in one call, so that I can apply it without further round-trips.
5. As an Agent, I want `load` to return every file in the skill folder keyed by relative path (SKILL.md plus resources), so that I can follow references without guessing paths.
6. As an Agent, I want to `browse` the scene tree node by node, so that I can explore the tree when I don't yet know the exact purpose wording.
7. As an Agent, I want a clear hint in the system prompt to consult the gateway before starting a sub-task, so that I route skill needs through the gateway reliably.
8. As an Agent, I want the gateway, when switched off, to leave the harness default skill loading intact, so that I fall back to the pre-gateway behavior.

9. As a user, I want to create scenes with a name, description, and tags and nest them to arbitrary depth under a single root, so that I can build a classification tree that mirrors my work.
10. As a user, I want a scene to hold both child scenes and skills, so that a mid-level scene can group skills directly when appropriate.
11. As a user, I want to attach one skill to multiple scenes, so that a skill is reachable from every context where it applies.
12. As a user, I want to upload one scene-tree folder, so that I can import a whole tree of scenes and skills in a single operation.
13. As a user, I want folders without SKILL.md to become scenes and folders with SKILL.md to become skills whose whole subtree is imported as assets, so that the folder tree maps unambiguously to the scene tree.
14. As a user, I want scene-tree uploads validated — every SKILL.md needs non-empty, well-formed name and description — with per-item error messages, so that broken skills never enter the catalog.
15. As a user, I want re-uploading a same-name skill to update it in place, so that I can iterate on a skill without losing its usage history.
16. As a user, I want to delete a skill and have it unlinked from every scene and its files removed while its historical stats are retained, so that history stays honest.
17. As a user, I want to delete a scene and have its children cascade-delete while its skills are only unlinked (files kept), so that shared skills survive.
18. As a user, I want a toggle to enable or disable the gateway, so that I can switch between gated and default skill loading.
19. As a user, I want to customize where the gateway's data lives, with a sensible default, so that I can place it where my repo conventions expect.
20. As a user, I want the catalog and statistics to persist in the repository and survive restarts, so that the gateway is not ephemeral.

21. As a user, I want to see this session's skill-usage timeline (when each skill was used, its source, and scene path), so that I can review what happened in this session.
22. As a user, I want to see repository-wide per-skill usage — trigger count, share, and last-used time — so that I can tell which skills matter.
23. As a user, I want per-scene aggregation and the ability to filter by skill source, so that I can slice the statistics by context.
24. As a user, I want statistics to record usage from both the gateway and the harness default skill tool, so that the picture is complete regardless of the toggle.
25. As a user, I want statistics to keep working while the gateway is switched off, so that visibility is never lost.

## Implementation Decisions

### Module structure

The feature is split along one seam: a pure, framework-free **core module** owns every decision; two thin **adapters** own only DSH wiring.

- **Core module** (pure functions, plain JSON in/out, no DSH/Cordis dependencies): scene-tree CRUD, keyword matching, progressive loading, upload validation, usage recording, and global aggregation.
- **Host adapter** (Cordis plugin Host half): persistence through the filesystem, registration of the `skill_gateway` tool, the statistics observer, and the toggle.
- **Client adapter** (Cordis plugin Client half): the sidebar entry and panel UI, the upload flow, and the toggle control.

The core module is delivered as a repository package so the later durable-package promotion can reuse it; the adapters are delivered first as a dynamic plugin.

### Data shapes

**Catalog** (one catalog per repository):

- `version` — schema version, for future migration.
- `rootSceneId` — the single root scene.
- `scenes` — a map from scene id to `{ id, name, description, tags[], parentId, children[], skills[] }`. `skills` holds skill names (the skill's unique key), enabling multi-parent attachment.
- `skills` — a map from skill name to `{ name, description, createdAt, updatedAt }`. Skill content lives in the skill's own folder; only metadata is inlined here.

**Skill folder** (one folder = one skill): a root `SKILL.md` plus any sibling resource files/directories, preserved verbatim. `load` returns the whole folder as a map of relative path → file content.

**Usage record**: `{ skillName, source, scenePath?, timestamp, sessionId }` where `source` is `gateway` or `agent-skills` and `scenePath` is present only when the use was reached through a scene.

**Config**: `{ enabled: boolean }` — the gateway toggle, repository-scoped.

### API contracts

The gateway exposes a single tool, `skill_gateway`, with three actions:

- **`find(purpose)`** → the best-matching scene path plus that scene's recursively gathered skill metadata (deduplicated, grouped by scene). Matching ranks scene `name`/`description`/`tags` first and skill `name`/`description` second.
- **`browse(sceneId?)`** → one node's `{ name, description, tags, children[], direct skills metadata }`; omitted id means the root.
- **`load(skillName, scenePath?)`** → the skill folder as a relative-path → content map; this action is what records a "use" (source `gateway`, with the optional `scenePath`).

The core module's public surface mirrors these three behaviors plus catalog CRUD, upload validation, usage recording, and aggregation, so the tool and the UI both delegate to it.

### Specific interactions

- **Progressive loading**: discovery returns metadata only; full content is fetched only by an explicit `load`.
- **Keyword matching**: tokenize the purpose and score scenes by matches against `name`/`description`/`tags`; skills match secondarily on `name`/`description`. A scene hit returns the entire subtree's skills.
- **Scene-tree upload**: the selected folder is the scene-tree root and merges into the existing root; a folder without a direct `SKILL.md` is a scene, while a folder with one is a skill whose entire subtree is imported as assets. Existing scenes on the same path are reused rather than duplicated.
- **Upload validation**: every skill found in an uploaded scene tree must have a root `SKILL.md` whose frontmatter parses to a non-empty `name` (matching `[a-z0-9][a-z0-9-]*`) and `description`; otherwise the whole upload is rejected with per-item reasons.
- **Duplicate names**: scene-tree upload overwrites an existing same-name skill in place, preserving the name key, existing scene attachments and usage history. Direct single-skill upload keeps its confirmation flow.
- **Deletion**: deleting a skill unlinks it from all scenes and removes its files but keeps its historical usage; deleting a scene cascades to its children and unlinks (does not delete) its skills.
- **Toggle**: repository-scoped, default on. Off removes the tool and the prompt but keeps the statistics observer running.
- **Statistics**: the observer records gateway `load` calls and harness-default `skill` tool calls alike; global stats are repository-wide and all-time, computed as per-skill trigger count, share of all triggers, and last-used time, plus per-scene aggregation, filterable by source.
- **Storage location**: defaults to a `.skillgate/` directory at the working-directory root; a per-repository anchor file may point elsewhere, and relocating migrates existing data to preserve statistics.

### Architectural decisions

- Persistence is repository-scoped files rather than DSH storage or settings (see ADR-0001).
- v1 runs alongside the harness's default skills without suppressing them (see ADR-0002).

## Testing Decisions

A good test asserts external behavior — the observable input→output contract — never internal implementation.

- **What to test**: the core module's public functions only. In particular: `find` matching and subtree assembly, `browse` shape, `load`'s folder→map rendering, scene-tree upload parsing/merge rules, duplicate-update semantics, delete/unlink semantics, and usage aggregation (counts, share, last-used, per-scene, source filter).
- **What not to test**: the DSH adapters (filesystem service, tool registration, statistics observer, RPC, Slots UI) — these are verified by integration in the GUI, not by unit tests.
- **Prior art**: the repository has no existing tests, so this establishes the pattern — pure, dependency-free tests with no DSH runtime.

## Out of Scope

- Suppressing or hiding the harness's default `skill` tool and `available_skills` (the "exclusive" mode); v1 is additive (ADR-0002).
- Pulling skills from GitHub or URLs, and importing from the existing `.agents/skills/` directory.
- Tags on skills themselves (tags exist only on scenes).
- Hard enforcement beyond the system-prompt hint (no tool guard or pre-step interception).
- A rolling time window for statistics (v1 is all-time only).
- A separate "exposure vs use" metric (only "use" is counted).
- Promoting the dynamic plugin into a durable package (a follow-up after validation).

## Further Notes

- The gateway's system prompt should phrase the trigger positively ("consult the gateway before a sub-task when a skill may match your purpose") rather than as a blanket "query before every action".
- Skill names double as the unique key and the on-disk folder name, so the charset constraint is load-bearing, not cosmetic.
- Multi-parent attachment means "which scene was the skill used through" is recorded on the use, not derived from a single parent.
