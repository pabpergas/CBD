```markdown
# Design System Document: The Intelligence Layer

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Curator"**
This design system moves away from the "chat-bubble" cliché of standard AI tools. Instead, it adopts the persona of a sophisticated editorial platform. It treats technical RAG (Retrieval-Augmented Generation) data not as raw output, but as a curated intelligence report. 

To achieve a "high-end editorial" feel, we reject the rigid, boxed-in grids of traditional SaaS. We prioritize **intentional asymmetry**, where the sidebar and main canvas feel like a single, continuous workspace separated by tonal shifts rather than hard lines. By utilizing overlapping elements and a dramatic typography scale, we transform a technical tool into a premium research environment.

---

## 2. Colors & Tonal Depth
The palette is rooted in the "Deep Charcoal" spectrum, designed to minimize eye strain while projecting an aura of technical authority.

### The "No-Line" Rule
**Strict Directive:** 1px solid borders are prohibited for sectioning. Structural boundaries must be defined exclusively through background color shifts. For example, a `surface-container-low` chat input should sit within a `surface` background. The contrast between these two tokens is the "border."

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-translucent materials.
*   **Base Layer:** `surface` (#0e0e0e) - The infinite canvas.
*   **Contextual Sections:** `surface-container` (#1a1a1a) - Used for major sidebar or secondary panels.
*   **Interactive Elements:** `surface-container-highest` (#262626) - For active source cards or focused inputs.

### The "Glass & Gradient" Rule
To evoke the "Electric Blue/Violet" AI persona, use **Glassmorphism** for floating citations or context menus. 
*   **Token:** Use `primary` at 10% opacity with a 20px `backdrop-blur`.
*   **Signature Texture:** Primary CTAs should not be flat. Use a linear gradient: `primary_dim` to `primary` at a 135-degree angle to provide a "lithographic" soul to the interface.

---

## 3. Typography: The Editorial Voice
We utilize a dual-font strategy to balance technical precision with high-end readability.

*   **Display & Headlines (Manrope):** Chosen for its geometric soul and modern proportions. Use `display-md` for empty states or major section headers to create an authoritative, "magazine" feel.
*   **Body & Labels (Inter):** The workhorse. Inter’s tall x-height ensures that complex RAG citations and technical prose remain legible at `body-sm` sizes.
*   **The Contrast Play:** Pair a `headline-sm` title with a `label-md` uppercase subtitle (using `on_surface_variant`) to create a clear information hierarchy without needing icons.

---

## 4. Elevation & Depth
In this system, elevation is a function of light and tone, not drop shadows.

*   **Tonal Layering:** Depth is achieved by stacking. Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a "recessed" or "inset" look that feels integrated into the architecture.
*   **Ambient Shadows:** For floating elements (like a citation hover-card), use an ultra-diffused shadow: `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);`. No hard edges.
*   **The Ghost Border:** If accessibility requires a container boundary, use the "Ghost Border" technique: `outline-variant` (#484847) at **15% opacity**. It should be felt, not seen.
*   **Layering Logic:**
    1.  Sidebar (`surface-container-low`)
    2.  Main Canvas (`surface`)
    3.  Source Cards (`surface-container-high`)
    4.  Active Floating Menus (`surface-bright` + Glassmorphism)

---

## 5. Components

### Sophisticated Chat Interface
*   **The Input:** A wide, expansive field using `surface-container-highest`. No visible border. Use a subtle `primary` glow (5px blur) only when the field is focused.
*   **The Response:** Text is delivered on the `surface` background. AI responses are not in bubbles; they are separated by generous vertical white space (32px+).

### Document Source Cards
*   **Layout:** Use `surface-container-high`. Avoid dividers.
*   **Interaction:** On hover, the card should transition to `surface-bright`.
*   **Citations:** Small chips using `secondary_container` with `on_secondary_container` text. Corners are `md` (0.75rem).

### Sidebar (The Context Engine)
*   **Structure:** A fixed panel on the left or right using `surface-container-low`. 
*   **Lists:** List items are separated by `16px` of padding, never by lines. The active state is indicated by a subtle `primary_dim` vertical accent (2px wide) on the inner edge.

### Buttons
*   **Primary:** Gradient of `primary_dim` to `primary`. Roundedness: `full`.
*   **Secondary:** Ghost style. No background, `outline-variant` (ghost opacity), text in `on_surface`.
*   **Tertiary:** Text-only in `primary`.

---

## 6. Do's and Don'ts

### Do
*   **Do** use extreme white space. Technical data needs room to breathe to avoid feeling overwhelming.
*   **Do** use `primary` (Violet) sparingly. It is a "spark" of intelligence, not a paint bucket. Use it for highlights, cursor focus, and active AI states.
*   **Do** use `manrope` for numbers. The geometric shapes of the numbers in Manrope feel precise and technical.

### Don't
*   **Don't** use 100% white (#FFFFFF) for long-form body text. Use `on_surface_variant` (#adaaaa) for secondary info to reduce glare.
*   **Don't** use standard "Material Design" shadows. They feel too "Android" and not enough "High-End Web."
*   **Don't** use sharp corners. Use the `DEFAULT` (0.5rem) or `md` (0.75rem) tokens to keep the interface feeling approachable and modern.
*   **Don't** use dividers between chat messages. The hierarchy should be clear through typography and spacing alone.