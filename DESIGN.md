---
name: Along
description: Warm, readable shopping conversations with inspectable product evidence.
colors:
  primary: "#d1d4ac"
  primary-hover: "#e1e3c6"
  primary-ink: "#292b20"
  ink: "#f1eadf"
  muted: "#c6b9a7"
  paper: "#29241e"
  line: "#514637"
  surface: "#302a22"
  image-ground: "#f1ecdf"
  focus: "#d9c99e"
  fit-surface: "#3b3d2d"
  compromise-surface: "#352e25"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(30px, 4vw, 40px)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "14px"
  reply:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.65
rounded:
  action: "8px"
  primary: "10px"
  field: "16px"
  card: "14px"
spacing:
  compact: "8px"
  field: "16px"
  content: "16px"
  section: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.primary}"
    padding: "0 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
  input:
    backgroundColor: "transparent"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
---

# Design System: Along

## Overview

Along uses the approved warm brown, cream and olive direction. Newsreader headings introduce the recommendation; DM Sans keeps the conversation, product facts and controls readable. This captures the current CSS and supplied visual direction, without assigning an invented creative metaphor.

The supplied shopping screenshot informs visual grammar: a clear product-and-price row, compact supporting facts and distinct fit and compromise panels. Its products, ratings and claims are not evidence for Along's catalog. Surface-specific composition is recorded in `.impeccable/surfaces/shopper.md`.

**Key Characteristics:**
- Warm brown surfaces with cream text and olive actions.
- Editorial serif headings paired with readable sans-serif details.
- Plain-language facts with visible provenance and price basis.

## Colors

Olive identifies primary actions and selected emphasis. Cream ink and warm muted text establish hierarchy on brown paper. The shell and canvas share these final color values. Secondary surfaces separate evidence, while pale cream provides a contained image ground. The fit panel uses an olive-brown surface; the compromise panel uses a warmer brown. Frontmatter values are extracted from the final CSS declarations.

## Typography

**Display Font:** Newsreader with Georgia and serif fallbacks.
**Body Font:** DM Sans with system sans-serif fallbacks.

Both families are self-hosted through `app/fonts.css` with font-display swap. Newsreader has local regular and medium faces; DM Sans has regular through bold faces. Main headings use the display role and reduce to 31px on mobile. Replies use the reply role with a maximum measure of 68ch, reducing to 15px on mobile. Inputs use 16px type. Product titles use 25px medium DM Sans; prices use 25px tabular numerals, with both reducing to 23px below 700px. These are observed component values, not an invented universal scale.

## Layout

Use content-led vertical flow and wrapping controls. The current shopper column is capped at 760px with 24px side clearance; below 760px it uses 18px side clearance. A product-and-price row places identity left and price right. Fit and compromise panels follow as short readable blocks. Expanded conversation options have a maximum height of `min(320px, 45dvh)`.

## Elevation & Depth

The current shell and canvas choice cards use no shadows. Warm tonal layering and restrained borders separate content. The selected carousel detail remains borderless and transparent. Carousel depth is interaction-specific and should not tilt the surrounding facts or controls.

## Shapes

Actions use modest rounded corners. The composer has 16px corners, while the send control and carousel arrows are circular. Cards retain 14px corners; fit and compromise panels use 12px corners. The latest request uses a simple 12px rounded rectangle.

## Components

### Buttons

Primary actions are pale olive with dark text and a minimum height of 44px. Their hover fill lightens. Ghost actions use warm muted text. Shell focus retains a visible three-pixel outline with four-pixel offset, now in the warm focus color. Disabled controls reduce opacity. Canvas actions have ten-pixel corners and minimum 44px height.

### Inputs / Fields

The composer uses the brown surface, a warm border and no shadow. Cream input text and warm muted placeholder text remain distinct. The input expands without forcing horizontal overflow; the send control is 44px square.

### Cards / Containers

Evidence and comparison cards use brown surfaces with thin warm borders. Selected carousel product details remove the outer card border and padding. The title and reference price lead; labeled fit and compromise panels explain the trade-off. Additional specifications appear on demand as plain-language label/value pairs from the approved allowlist. Never render arbitrary nested objects, raw JSON or internal metadata as product facts.

### Navigation

Carousel navigation uses circular previous/next buttons, a live position count and named choices. The selected choice is underlined and heavier. Navigation remains usable without the animated presentation.

### Chips

Canvas context labels are transparent and borderless in the final overrides, wrapping with restrained spacing. They communicate context rather than decorative metrics.

### Motion

Respect reduced motion. The product wrapper renders a static image when reduced motion is requested or 3D support is absent, while retaining navigation. Existing CSS disables animation and transitions for reduced-motion users.

## Do's and Don'ts

### Do:
- **Do** preserve readable price basis, uncertainty and imagery provenance.
- **Do** retain visible focus states and non-animated product navigation.
- **Do** use final CSS declarations rather than superseded blue-and-white styling.
- **Do** distinguish genuine source metrics from explicitly fictional demo reviews.

### Don't:
- **Don't** present generic artwork as verified product photography.
- **Don't** hide the reference-price basis behind a bare price.
- **Don't** expose raw JSON or internal catalog metadata in shopper details.
- **Don't** copy products, ratings or claims from the visual reference.

### Greeting and waiting states

Before products arrive, the animated orb is the focal point: 168px on desktop and 140px on mobile, above the greeting or current request. Once products arrive it becomes compact and the React Bits Circular Carousel takes the stage. The conversation does not reserve an empty product region; the redundant disclaimer footer is removed. Voice and reference settings sit in a compact disclosure beside the main actions. Preserve this compact app layout when applying gpt-taste typography, contrast, and motion guidance.

The opening group is vertically centered in the available viewport below the navigation, with equal 32px minimum top/bottom padding. It grows naturally when the keyboard or long conversation needs space. On product arrival the main returns to document flow; the orb moves and shrinks over 450ms, disabled for reduced motion.
