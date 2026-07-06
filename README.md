# @creaditor/page-kit

**The single source of truth for programmatic creaditor landing-page construction.**

Deterministic "hands" for building on-brand creaditor pages: the element catalog,
the tree factories, brand-token/palette/contrast resolution, and section
composition. Pure data-in → component-tree-out — **no Redis, no Mongo, no
editor-api models.**

## Who consumes it

| Consumer | Role | How it applies the tree |
|---|---|---|
| `editor-api` MCP server | external Claude builds pages via MCP tools | publishes `edit:patch` (already has a Redis client) |
| `cdtr-studio` landing-chat ability | studio's own AI builds pages | publishes `edit:patch` (add a Redis client) |
| `frontend` (later) | editor menu / section templates | imports the catalog data directly |

Both AI paths are just *brains* calling these deterministic *hands*. This package
is what stops the catalog + builder from being duplicated per consumer.

## Applying a tree (execution is NOT in this package)

A consumer with a Redis client persists a built tree by publishing onto the
editor-api `edit:patch` pipeline. Use `editPatch()` so the wire envelope is
single-sourced:

```js
const pageKit = require('@creaditor/page-kit');

const section = pageKit.composeSection('hero', { headline: 'Welcome' }, palette, pageBg);
const tx = [{ type: 'CREATE', componentId: section.id, parentId: rootId, index: 0, body: section }];
await redis.publish('edit:patch', JSON.stringify(pageKit.editPatch(siteId, userId, tx)));
```

Ids in the tree are client-generated (`cid()`), so the publisher already knows
every created id — the fire-and-forget publish needs no response.

## Source of truth boundaries

- **Section templates**, the **builder**, and the **`edit:patch` envelope** are
  owned here.
- **Element default bodies** (`catalog.json`) are *derived from* the frontend
  editor catalog (the editor owns what an element structurally *is*). Today they
  are seeded from editor-api's extracted snapshot; a generator repointed at the
  frontend catalog should keep them fresh (see the MCP handoff's extract script).

## Layout

- `builder.js` — the pure builder (factories, color/contrast, palette, tokens, `composeSection`)
- `catalog.json` — element default bodies (derived from the frontend catalog)
- `sections.json` — brand-tokenized section templates (authored here; also consumed by the frontend)
- `index.js` — public entry (`ELEMENT_TYPES`, `editPatch`, re-exports the builder)
- `index.d.ts` — types for TS consumers (studio)
