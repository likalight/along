# Shopper surface

Mode: Operate. Operate within the newly approved warm brown, cream and olive reference direction.

## Approved intent

Conversation is the primary surface. A compact product stage supports the current reply; it does not become a separate dashboard. Voice and typed requests operate the same server-owned selection. The visible conversation, chosen product and available actions must agree.

## Current composition

A compact voice status row precedes the conversation. The latest request and assistant reply lead the product stage. Use one recommendation heading, with Newsreader for editorial hierarchy and DM Sans for details, both self-hosted. Avoid repeated recommendation headings or duplicate selected-product names above the listing. React Bits Circular Carousel presents product imagery with previous/next controls, live position, provenance and named product choices. The selected product's fit, compromise and price follow without another enclosing card. Specifications and additional evidence use progressive disclosure. Format only allowlisted shopper-facing facts as plain-language labels and values; never display raw JSON, nested objects or internal metadata. Product identity and reference price share a row, followed by labeled fit and compromise panels.

The stage is 230px tall, reducing to 205px below 600px. Details have a 640px maximum width. These values are extracted from product-carousel.module.css, not proposed measurements. The carousel uses a controlled cylinder preset with autoplay off. Swipe, keyboard arrows, Home/End, image clicks and named choices request focus; accepted server focus determines the displayed item.

## Conversation and voice

Keep recording, transcription, thinking and speech playback states legible. Typed input remains available alongside voice. Conversation controls stay in normal document flow (`position: relative; bottom: auto`) below content so they do not overlap the product on mobile. Safe-area padding is retained. Extra options and transcript remain expandable.

## Imagery and evidence

Use verified product-specific source imagery and display its provenance. If photography is unavailable or fails to load, show the clearly labeled catalog specification card. Never imply that a fact card is a photograph. Verification is an asset/data requirement; the documentation itself is not proof that every remote image remains reachable.

## Price basis

The product price is explicitly a reference price before shipping and extras. Any available seller offer is distinct from that reference and retains its availability and uncertainty labels. Purchases and seller offers remain simulated; server approval requirements remain intact.

## Responsive and accessible behavior

Use the shell's single-column measure and wrapping actions. Retain 44px carousel navigation controls, keyboard navigation, visible focus and polite position announcements. Reduced motion and missing 3D support use the static image view without removing product selection controls. Comparison may use a two-column mobile spread; this is separate from the one-selected-product carousel.

## Source of truth

Observed implementation: apps/shopper/app/globals.css; apps/shopper/components/canvas/canvas.module.css; product-carousel.module.css; ProductCarousel.tsx; ProductCanvas.tsx; react-bits/CircularCarousel.tsx and CircularCarousel.css. Product constraints: PRODUCT.md. No browser or end-to-end validation is asserted by this brief.

## Reference and review truth

The user-supplied `/Users/priyadharshan/Downloads/carousell info.png` establishes visual grammar, not product evidence. Do not reproduce its catalog items or invent ratings to match its appearance.

Show genuine source review metrics only when captured evidence supplies them; otherwise show one clear unavailable message for the source snapshot. Concurrent implementation includes a separate fictional demo-review presentation: if retained, label every metric and example as demo/fictional, and never present it as actual customer evidence. This is distinct from the genuine source snapshot.
