# Position Gesture Trace Above Blur Layer — Variant I (Derive Height from State)

**Issue:** [#3791](https://github.com/cybersemics/em/issues/3791)
**Date:** 2026-05-11
**Approach:** Decouple the blur from `PopupBase`; compute its height from the rendered command count and known row metrics — no `ResizeObserver`.

**Supersedes the sizing gap in** [2026-03-20-gesture-trace-above-blur-design.md](2026-03-20-gesture-trace-above-blur-design.md), which proposes the same stacking change but leaves "full viewport coverage" unresolved.

## Problem

Same as Variant A1 — see [2026-05-11-gesture-trace-above-blur-design-a1.md](2026-05-11-gesture-trace-above-blur-design-a1.md#problem).

## Target Layer Order

Same as Variant A1 — see [Variant A1, Target Layer Order](2026-05-11-gesture-trace-above-blur-design-a1.md#target-layer-order-front--back).

## Design

The stacking change is identical to Variant A1. The difference is **how the blur knows its height**: no observer, no measurement, no DOM read. Height is computed from existing state and design tokens.

### 1. `panda.config.ts`

Same as Variant A1 — add `gestureMenuBlur` z-index token below `gestureTrace`.

### 2. New shared constants (in `src/constants.ts` or a new `src/components/GestureMenu.constants.ts`)

Define the height metrics for a command row in one place so the formula stays in sync with the visual layout:

```ts
export const GESTURE_MENU_COMMAND_ROW_HEIGHT = 48   // px, must match CommandItem styling
export const GESTURE_MENU_TOP_PADDING = 20          // px, top inset of the popup content
export const GESTURE_MENU_BOTTOM_PADDING = 20       // px, bottom inset
```

Reference these constants from both the styled command rows AND the height formula so the two cannot drift.

### 3. `src/stores/gesture.ts`

Add `gestureMenuHeight: number` (default `0`) and a setter `setGestureMenuHeight`.

### 4. `src/components/GestureMenu.tsx`

- **Move `<ProgressiveBlur />` out of `PopupBase`.** Render it as a sibling.
- **Compute the height from existing state.** Where `useFilteredCommands` returns the command list (already computed at [GestureMenu.tsx:180-183](../../src/components/GestureMenu.tsx:180)):

  ```ts
  const computedHeight =
    GESTURE_MENU_TOP_PADDING +
    commands.length * GESTURE_MENU_COMMAND_ROW_HEIGHT +
    GESTURE_MENU_BOTTOM_PADDING
  ```

- Write the result to the store on change:

  ```ts
  useEffect(() => {
    setGestureMenuHeight(computedHeight)
    return () => setGestureMenuHeight(0)
  }, [computedHeight])
  ```

### 5. `ProgressiveBlur` (inside `GestureMenu.tsx`)

Same styling as Variant A1 — see [Variant A1, ProgressiveBlur styles](2026-05-11-gesture-trace-above-blur-design-a1.md#4-progressiveblur-inside-gesturemenutsx).

### 6. `TraceGesture.tsx`

**No changes.**

### 7. `CommandItem.tsx` (or wherever a command row is styled)

Replace any hard-coded row height with the shared `GESTURE_MENU_COMMAND_ROW_HEIGHT` constant so the formula and the visual layout are guaranteed to match.

## Why No "Lag"

The computed height is updated synchronously via `useEffect` whenever `commands.length` changes — same frame as the commands themselves re-render. There is no second pass through the browser layout engine to discover the new height. From a frame-budget perspective, this is the cheapest possible option: a few arithmetic ops, no observers, no DOM reads.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Formula drifts from actual layout.** Anyone restyling a command row (padding, font size, adding subtitles, etc.) without updating `GESTURE_MENU_COMMAND_ROW_HEIGHT` will cause the blur to end at a wrong position — the exact symptom the original issue complains about. | Centralize the constant; reference it from both the styling and the formula. Add a comment in `CommandItem.tsx` warning that changes to row height MUST update the constant. Consider a Playwright/visual test that fails on drift. |
| **Variable-height command rows.** If any command type has a different height (e.g., multi-line label, active/selected styling that adds padding), the formula is wrong. | Audit `CommandItem` rendering. If variable heights are possible, this variant is **not viable** without an `if` ladder — and at that point Variant A1 is simpler. |
| **Future addition of a header/footer inside the popup content.** | Add corresponding constants (`HEADER_HEIGHT`, `FOOTER_HEIGHT`) and include them in the formula. Same drift risk. |
| **Subpixel rounding.** Multiplied row counts can produce non-integer pixel values that look slightly off. | Floor or round the result. Minor cosmetic only. |

## What Does NOT Change

Same as Variant A1.

## Open Questions

- **Are command rows truly uniform?** This is the load-bearing assumption. If any command type renders taller or shorter than `GESTURE_MENU_COMMAND_ROW_HEIGHT`, the formula breaks. Verify by inspecting `CommandItem.tsx` and all its variants before committing to this variant.
- **What about the entering/exiting animation?** If commands fade in via opacity but the popup height jumps when they mount, the formula is already correct for the final state. Verify there are no transitional layouts (e.g., commands rendered with `height: 0` while animating) that would make the popup briefly shorter than the formula predicts.

## Verification

- Visually identical to today, including blur fade-out at the bottom of the popup.
- Add a quick visual test: change the number of commands across the supported range and confirm the blur's bottom edge matches the last command row.
- Frame-rate audit: zero per-frame cost, by construction.

## Comparison to Variant A1

| | A1 (ResizeObserver) | I (Derive from state) |
|---|---|---|
| Source of truth for height | Actual layout | Formula |
| Frame cost | Effectively zero (observer fires only on size change) | Effectively zero (recomputes only on commands change) |
| Robustness to styling changes | Self-correcting — layout drives the value | Fragile — formula must be kept in sync with styles |
| Code surface | One observer + one store field | Three constants + one formula + one store field + careful coupling to row styling |
| Boss-friendliness re: per-frame | Should be fine; explain that the observer is event-driven, not per-frame | Trivially zero |

If row heights are uniform and unlikely to change, Variant I is the cheapest and most boss-defensible option. If row heights vary or styles evolve, Variant A1 is safer.
