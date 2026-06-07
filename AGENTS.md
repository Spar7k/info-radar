# AGENTS.md

## Project Context

This is the workspace for building **信息雷达 / 周报机器人** (Info Radar / Weekly Report Robot) — an AI-powered information aggregation, deduplication, scoring, and recommendation system that generates daily Top 5 digests and weekly summary reports.

The `agents-radar/` subdirectory contains a cloned reference project for audit and module reuse.

---

## UI Design Rules

### Mandatory Design Reference

**Before any UI work, you MUST read [DESIGN.md](./DESIGN.md).**

The design system defined in `DESIGN.md` is the single source of truth for all visual decisions in this project.

### Core Rules

1. **Read DESIGN.md first.** Never start a UI change without reviewing it.
2. **Do not redesign the style from scratch each time.** The design system is fixed — only evolve it deliberately.
3. **Do not mix multiple brand styles.** This project uses the Linear + Notion inspired design language. Do not introduce Material Design, Tailwind UI defaults, shadcn defaults, or any other design system without explicit request.
4. **Default style = Linear + Notion inspired information dashboard.** Unless the user explicitly asks to switch styles, keep this.
5. **Keep business logic and UI changes separate.** When asked to improve UI, do not refactor data fetching, pipelines, or report generation.
6. **Prefer incremental improvement over rewrite.** Improve spacing, typography, color consistency, states, and responsiveness — don't rebuild the entire frontend from scratch.

### Design Tokens Quick Reference

When building new pages or components, use these CSS variables (defined in [DESIGN.md](./DESIGN.md) §4.1):

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-page` | `#f7f7f8` | Page background |
| `--bg-surface` | `#ffffff` | Card / panel background |
| `--text-primary` | `#171717` | Titles, headings |
| `--text-secondary` | `#52525b` | Body text, descriptions |
| `--text-muted` | `#71717a` | Metadata, timestamps |
| `--accent` | `#5e6ad2` | Primary actions, active states, score highlights |
| `--border-subtle` | `#e5e7eb` | Card borders, dividers |

Font stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`

### When Creating New UI

- Use cards with `border-radius: 16px` and `1px solid var(--border-subtle)` borders
- Use the 4-tier text color hierarchy: primary → secondary → muted → faint
- Buttons: `border-radius: 10px`, `font-weight: 500`
- Tags: pill-shaped (`border-radius: 999px`), subtle background
- Avoid: gradients, heavy shadows, bright random colors, large decorations, flashy animations

### Component Checklist

For each new UI component, verify:
- [ ] Colors come from the design token system
- [ ] Font uses the defined font stack
- [ ] Spacing uses the `--space-*` scale (4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px)
- [ ] Empty, loading, and error states are handled
- [ ] External links open in new tabs
- [ ] Copy text is concise and product-like (no clickbait language)

---

## Existing UI Audit (agents-radar/index.html)

The reference project has a Web UI at `agents-radar/index.html`. Here is a gap analysis against [DESIGN.md](./DESIGN.md):

### Major Gaps

| Aspect | Current | DESIGN.md Target |
|--------|---------|-----------------|
| **Font** | `Space Mono` (monospace) | `Inter` + system sans-serif |
| **Color accent** | `#E8A03D` (orange/amber) | `#5e6ad2` (indigo) |
| **Aesthetic** | Terminal / hacker dashboard | Linear + Notion SaaS dashboard |
| **Dark theme default** | `data-theme="dark"` | Light-first (`--bg-page: #f7f7f8`) |
| **Border radius** | `4px` buttons, sharp cards | `16px` cards, `10px` buttons |
| **Animations** | `blink`, `breathe` keyframes | Avoid decorative animations |

### What Already Works Well

- CSS custom properties for theming (light/dark toggle)
- Clean sidebar-based navigation layout
- Responsive content area with max-width constraint
- Search functionality in the sidebar
- Markdown rendering for report content
- Language toggle (ZH/EN) per report

### What to Align

When building the **info-radar** frontend (new pages, not modifying agents-radar):

1. Replace monospace font stack with the DESIGN.md system font stack
2. Switch accent color to `#5e6ad2`
3. Use light theme as default (with dark mode as optional toggle)
4. Increase border radius on cards and buttons to match the design spec
5. Remove decorative animations
6. Use the `--space-*` spacing scale consistently
7. Implement DESIGN.md §7 component styles (cards, tags, buttons, metric cards, recommendation cards)

**Do NOT refactor `agents-radar/index.html` now.** This audit exists to guide NEW UI work in the info-radar project.
