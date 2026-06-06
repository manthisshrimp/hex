# Habits — UI Specification

The UI is a first-class deliverable. Every component must be implemented to
match this spec. Visual correctness is as important as functional correctness.

---

## Design Principles

1. **Game first, app second.** Every screen should feel like you opened a PC
   game, not installed another productivity tool. If it could pass as a
   settings screen in a habit app, it is not done yet.

2. **Feedback is physical.** Every mechanical event produces a visible
   consequence. Missing a habit hurts — the player must see and feel the
   damage. Completing one rewards — the player must feel the gold land.

3. **Expressive, not flashy.** Animations are PC-game style: large damage
   numbers, screen-level reactions, satisfying weight. Not mobile micro-
   animations or subtle fades. Think Diablo 2 hitting a champion pack.

4. **Dark is the default.** Light mode does not exist. The darkness is
   intentional — it makes the gold and red pop.

5. **Mobile first, desktop respected.** Layout is designed for a phone held
   in one hand. Desktop gets wider panels and more visible stat detail, but
   every interaction works on mobile first.

---

## Visual Foundation

### Colour Tokens

Define these as CSS custom properties on `:root`.

```css
/* Backgrounds */
--color-bg:           #080604;   /* page background */
--color-surface:      #1c1510;   /* panel / card background */
--color-surface-mid:  #251c15;   /* slightly elevated surface */
--color-surface-high: #2e231a;   /* hover / active surface */

/* Borders */
--color-border:       #6b4f1a;   /* bronze bevel — default border */
--color-border-hi:    #c8a44a;   /* gold trim catch-light */
--color-border-glow:  #f0c040;   /* animated gold shimmer */

/* Health */
--color-hp-full:      #cc0000;
--color-hp-mid:       #993300;   /* used below 50% */
--color-hp-low:       #660000;   /* used below 30% */
--color-hp-pulse:     #ff4444;   /* heartbeat highlight colour */

/* Currency */
--color-gold:         #ffd700;
--color-gold-dim:     #c8a020;

/* Importance tiers (D2 item rarity) */
--color-imp-low:      #c8c8c8;   /* white  — normal */
--color-imp-medium:   #6b94ff;   /* blue   — magic */
--color-imp-high:     #ffff00;   /* yellow — rare */

/* Text */
--color-text:         #c8b882;   /* parchment — primary body */
--color-text-muted:   #7a6a4a;   /* greyed stat */
--color-text-label:   #a08850;   /* section headers */

/* Floating numbers */
--color-num-damage:   #ff2020;
--color-num-gold:     #ffd700;
--color-num-regen:    #44cc44;

/* States */
--color-overdue:      #ff4040;
--color-complete:     #4a4535;   /* dimmed completed card background */
--color-burnout-veil: rgba(0, 0, 0, 0.45);  /* screen desaturation overlay */
```

### Textures

All textures are CSS-only (no image files required for the base implementation).
Use layered `box-shadow`, `border`, and subtle `background-image` gradients to
approximate stone and leather.

**Stone panel texture:**
```css
background-color: var(--color-surface);
background-image:
  repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.08) 2px,
    rgba(0,0,0,0.08) 4px
  );
```

**Bronze bevel border (all panels and cards):**
```css
border: 2px solid var(--color-border);
box-shadow:
  inset 0 1px 0 var(--color-border-hi),   /* top catch-light */
  inset 0 -1px 0 #3a2a08,                  /* bottom shadow */
  0 4px 12px rgba(0, 0, 0, 0.6);           /* drop shadow */
```

### Typography

Load from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?
  family=Cinzel+Decorative:wght@700&
  family=Cinzel:wght@400;600&
  family=IM+Fell+English&
  display=swap" rel="stylesheet">
```

| Role | Font | Weight | Size (mobile) |
|---|---|---|---|
| App title / page headers | Cinzel Decorative | 700 | 1.4rem |
| Habit names | Cinzel | 600 | 1rem |
| Section labels | Cinzel | 400 | 0.75rem, uppercase, letter-spacing 0.1em |
| Body / stats | IM Fell English | 400 | 0.95rem |
| Numbers (HP, gold, counters) | IM Fell English | 400 | tabular-nums |
| Muted / secondary | IM Fell English | 400 | 0.85rem, italic |

---

## Animation System

All animations use CSS keyframes. JavaScript triggers them by toggling classes.
No animation library required for V1.

### Floating Number

Used for: damage, completion gold, regen ticks, gold spend.

```css
@keyframes float-number {
  0%   { opacity: 1;   transform: translateY(0)   scale(1); }
  20%  { opacity: 1;   transform: translateY(-12px) scale(1.15); }
  100% { opacity: 0;   transform: translateY(-60px) scale(0.9); }
}
```

- Duration: 1.5s for damage, 1.2s for gold, 0.8s for regen
- Position: absolutely placed over the triggering element, pointer-events none
- Multiple numbers stagger by 120ms and offset horizontally ±20px randomly
- Font size: 2rem for damage, 1.8rem for gold, 1rem for regen
- Font: Cinzel, bold, colour from token

### Card Completion Flash

On completing a habit:

```css
@keyframes completion-flash {
  0%   { box-shadow: 0 0 0px  var(--color-gold); }
  30%  { box-shadow: 0 0 40px var(--color-gold); }
  100% { box-shadow: 0 0 8px  var(--color-border-hi); }
}
```
Duration: 600ms. After flash, card transitions to completed state (200ms fade).

### HP Bar Liquid Fill

On load or after damage, the HP bar animates from its previous value to current:
```css
transition: width 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
```
The bar overshoots slightly on a fresh completion (brief 2% overextend then
settles) to give a liquid sloshing feel.

### HP Heartbeat (≤30% HP)

```css
@keyframes heartbeat {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}
/* applied to the HP fill element only */
animation: heartbeat 1.2s ease-in-out infinite;
```

### Damage Cascade (on page load)

When the daily tick has processed missed deadlines since last visit, damage
numbers play on load in sequence:
- Each missed habit produces one damage number over the HP bar
- Numbers stagger 300ms apart
- HP bar animates down as each number fires
- If total damage ≥ 30 HP: brief full-screen dark red veil flash (150ms, 20% opacity)
- If player hit 0 HP: burnout sequence plays after cascade (see Burnout below)

### Burnout State Transition

Triggered when HP reaches 0 during a damage cascade:
1. Screen desaturates (CSS filter: grayscale 60%) over 1s
2. Red veil fades in (--color-burnout-veil) over 800ms
3. "FORSAKEN" label replaces HP number with a slow pulsing red glow
4. Navigation icons dim to 40% opacity
5. All habit cards darken further
State persists until HP > 0.

### Gold Earn (completion)

1. Card flash (above)
2. Gold floating number rises from card
3. Gold balance in header increments digit-by-digit over 400ms (count-up)

---

## Component Library

### `<HpBar>`

Full-width bar pinned just below the top header. Never scrolls off screen.

**Structure:**
```
┌── stone border (top) ──────────────────────────────────┐
│  [████████████████░░░░░░░░░]  72 / 100                 │
└── stone border (bottom) ───────────────────────────────┘
```

- Bar height: 28px mobile, 32px desktop
- Fill colour transitions via CSS: full → mid → low based on breakpoints
- Parchment text overlaid at right: `{hp} / 100`
- At burnout: fill goes black, text becomes `FORSAKEN` in red with glow pulse

### `<GoldDisplay>`

Top-right corner of header. Always visible.

```
⚜ 1,240
```

- `⚜` or a simple SVG coin icon in `--color-gold`
- Number in Cinzel, gold colour, tabular-nums
- Animates count-up on earn events
- Subtle gold glow on the icon that intensifies when gold increases

### `<HabitCard>`

The primary interactive component. One per active or suspended habit.

**Layout:**
```
┌──────────────────────────────────────────────┐
│  Morning Run                          ★★★    │  ← name (Cinzel, importance colour) + stars
│  ──────────────────────────────────────────  │  ← thin gold divider
│  Daily Quest  ·  High Importance            │  ← IM Fell English, parchment
│  Mastery  [████████░░░░]  68%                │  ← mastery bar
│  Due: Today                                  │  ← red if overdue, muted if future
│                                              │
│                    [ COMPLETE ]              │  ← beveled button
└──────────────────────────────────────────────┘
```

**Importance colour application:**
- Name text colour: `--color-imp-{low|medium|high}`
- Left edge accent: 4px solid stripe in importance colour
- High importance: animated shimmer on the left border (`border-image` or
  pseudo-element with a gold gradient that moves over 3s, looping)

**Mastery bar:**
- Bronze-bordered track, 8px tall
- Fill colour matches importance colour
- Segmented into 10 blocks with 1px gaps

**Due label:**
- `Due: Today` — `--color-overdue` (red)
- `Due: Tomorrow`, `Due: in N days` — `--color-text-muted`
- `Overdue: N days ago` — `--color-overdue` + italic

**Complete button:**
```css
background: linear-gradient(180deg, #3a2a10 0%, #1c1408 100%);
border: 2px solid var(--color-border);
box-shadow: inset 0 1px 0 var(--color-border-hi), 0 3px 6px rgba(0,0,0,0.5);
color: var(--color-text);
font-family: 'Cinzel', serif;
letter-spacing: 0.08em;
```
On hover: border shifts to `--color-border-glow`, inner glow appears.
On press: button depresses (translateY 2px, shadow reduces).
On complete: fires completion flash + floating number + transitions card to
completed state.

**Completed state:**
- Background: `--color-complete`
- Name: greyed to `--color-text-muted`
- Complete button replaced by a rune glyph `✦` in gold
- Left border accent dims to 30% opacity
- Card is non-interactive

**Paused state (Habits page only):**
- Border style: dashed instead of solid
- Name: `--color-text-muted`, italic
- No due label, no Complete button
- Resume `▶` and Delete `✕` icon buttons at bottom right

**Windowed habit with reschedule available:**
- Below the Complete button: `[ DELAY — 50 ⚜ ]` in smaller text
- If insufficient gold: button disabled, faded, tooltip "insufficient gold"

### `<SectionHeader>`

Used to label groups of cards (TODAY'S QUESTS, UPCOMING, ACTIVE QUESTS, etc.)

```css
font-family: 'Cinzel', serif;
font-size: 0.7rem;
font-weight: 400;
text-transform: uppercase;
letter-spacing: 0.14em;
color: var(--color-text-label);
border-bottom: 1px solid var(--color-border);
padding-bottom: 4px;
margin-bottom: 12px;
```

### `<BottomNav>`

Fixed to viewport bottom. Full width. Stone-textured background.

```
┌──────────────────────────────────────────┐
│  ┌────────┐    ┌────────┐    ┌────────┐  │
│  │   🛡   │    │   📜   │    │   📖   │  │
│  └────────┘    └────────┘    └────────┘  │
│  Dashboard    Quests      Chronicle      │
└──────────────────────────────────────────┘
```

- Tab buttons: 56×56px, bronze beveled border
- Active tab: inner gold glow (`box-shadow: inset 0 0 16px rgba(240,192,64,0.4)`)
- Icons: SVG — shield, scroll, open book. Sized 28px.
- Label: Cinzel, 9px, below icon, muted when inactive, parchment when active
- No indicator dot — the glow is the indicator
- Height: 72px (safe area padding handled via `env(safe-area-inset-bottom)`)

### `<StatBar>` (mastery / consistency)

Reusable segmented bar.

- 10 segments, 1px gap between
- Filled segments: importance colour at 90% opacity
- Empty segments: `--color-surface-high`
- Bronze border surrounds the whole track
- Percentage label to the right in IM Fell English

### `<ModalPanel>` (add / edit habit)

Full-screen overlay on mobile, centred panel on desktop.

- Background: `--color-surface` with stone texture
- Heavy bronze border
- Title in Cinzel Decorative
- Form fields styled as D2-style input boxes: dark inset, thin gold border
- Importance selector: three labelled rune-buttons (Normal / Magic / Rare),
  each glowing in their respective colour when selected
- Frequency selector: Daily / Windowed — same rune-button style
- Window days input (shown only when Windowed selected): number input
  with `+` / `-` stepper buttons
- Save button: full-width, styled as Complete button but larger
- Cancel: small text link below, muted

---

## Page Layouts

### Dashboard (`/`)

**Mobile:**
```
┌──────────────────────────────┐
│  HABITS          ⚜ 1,240    │  ← header bar, 48px
├──────────────────────────────┤
│  [████████████░░░░]  72/100  │  ← HpBar, 28px, sticky
├──────────────────────────────┤
│                              │  ← scrollable content below
│  TODAY'S QUESTS              │  ← SectionHeader
│  <HabitCard> × N             │
│                              │
│  UPCOMING                    │
│  Simple list rows:           │
│  · Dentist check  12 days    │
│  · Weekly Review   5 days    │
│                              │
│  (bottom padding 88px        │
│   for nav bar)               │
└──────────────────────────────┘
│  [ 🛡 ] [ 📜 ] [ 📖 ]       │  ← BottomNav, 72px fixed
```

**Desktop additions:**
- Max content width 640px, centred
- HP bar becomes 480px wide, centred under header
- Stats sidebar could be added in a later iteration

### Quests (`/habits`)

**Mobile:**
```
┌──────────────────────────────┐
│  HABITS          ⚜ 1,240    │
├──────────────────────────────┤
│  [HpBar sticky]              │
├──────────────────────────────┤
│  ACTIVE QUESTS      [+ ADD]  │  ← ADD is a small Cinzel button, top right
│  <HabitCard> × N             │  ← full card with mastery, deadline, buttons
│                              │
│  SUSPENDED                   │
│  <HabitCard paused> × N      │
└──────────────────────────────┘
│  [ 🛡 ] [ 📜 ] [ 📖 ]       │
```

The system habit (Open the app) appears first in the Active list with a
lock icon instead of pause/delete buttons. Its card has the same styling but
a subtle "INNATE" label beneath the name in muted text.

### Chronicle (`/history`)

**Mobile:**
```
┌──────────────────────────────┐
│  HABITS          ⚜ 1,240    │
├──────────────────────────────┤
│  [HpBar sticky]              │
├──────────────────────────────┤
│  VITALITY RECORD             │  ← HP line chart, 180px tall
│  [chart]                     │     dark background, red line
│                              │     gold dot at current HP
│  BATTLE RECORD               │  ← per-habit heatmap grid
│  Morning Run                 │
│  [■■□■■■□■■■■■□■■■■■■□■■■]  │  ← 30 cells, bronze border
│  Meditation                  │
│  [■■■■□■■■■□■■■■■■□■■■■■■■] │
│                              │
│  TREASURY                    │  ← gold line chart
│  [chart]                     │
└──────────────────────────────┘
│  [ 🛡 ] [ 📜 ] [ 📖 ]       │
```

Chart styling:
- Background: `--color-surface`, no gridlines (or very faint bronze lines)
- HP chart line: `--color-hp-full`, with a dark red fill beneath
- Gold chart line: `--color-gold`
- Heatmap: filled cells in importance colour, empty in `--color-surface-high`,
  bronze grid border, today's cell has a gold outline

---

## Responsive Behaviour

The mobile layout is the default. Desktop (≥768px) adjustments:

- Content max-width: 640px, centred with dark side gutters
- HP bar and header: full 640px width
- Cards: same layout, slightly more horizontal padding
- Bottom nav becomes a left sidebar (72px wide, icon-only) at ≥768px
- Modal panels: 480px wide, vertically centred overlay

---

## States and Edge Cases

| State | Visual treatment |
|---|---|
| No habits yet | Dashboard shows only the system habit card; section header reads "YOUR FIRST QUEST" |
| All habits completed today | Section header reads "ALL QUESTS COMPLETE"; brief gold shimmer across the panel on achieving this |
| HP exactly 100 | HP bar shows a faint gold overflow glow — full health is celebrated |
| Insufficient gold for reschedule | Delay button faded, lock icon, tooltip |
| Habit with 0% consistency | Mastery bar empty; damage label reads "Unproven — no penalty yet" |
| First app open (no character yet) | Brief intro sequence: HP bar fills from 0 to 100 over 1.5s; single floating `+100` in gold; then normal dashboard |

---

## Implementation Notes

- All colour tokens as CSS custom properties — no hardcoded hex values in
  component files
- Floating numbers are absolutely positioned DOM elements appended to a
  `#float-layer` div that sits above all content (z-index: 1000,
  pointer-events: none)
- Animations triggered by JS class toggling, not inline styles
- `prefers-reduced-motion`: skip all transitions and floating numbers; apply
  final states immediately
- No animation library needed for V1 — all CSS keyframes
- Google Fonts loaded in `index.html`, not via CSS @import, to avoid FOUT
