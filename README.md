# RenderCV Toolkit

Shared, host-neutral primitives for RenderCV applications.

## Packages

- `@rendercv/primitives` parses variants, applies compatibility normalization, filters variants and entries, and compiles canonical effective RenderCV YAML.
- `@rendercv/renderer` defines the renderer protocol. Its `@rendercv/renderer/cli` export provides the bounded Bun/server CLI adapter.

Hosts retain responsibility for URL/GitHub fetching, credentials, persistence, approvals, browser workers, and UI. The compiler performs no network or filesystem access.

Both packages are intended to be consumed from a pinned Git submodule so changes to compiler behavior are explicit and reviewable.
