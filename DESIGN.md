---
name: BGMS Companion
description: The bgms.kr shell shrunk to an Overwolf companion for PUBG; amber bar, near-black ground, one status strip, then the last match.
colors:
  accent: "#f2a900"
  accent-rule: "#cc8b00"
  accent-dim: "rgba(242, 169, 0, 0.12)"
  ground: "#0d0d0d"
  surface: "#161616"
  elevated: "#1f1f1f"
  hover: "rgba(255, 255, 255, 0.04)"
  line: "rgba(255, 255, 255, 0.08)"
  line-strong: "rgba(255, 255, 255, 0.14)"
  text: "#ffffff"
  text-2: "rgba(255, 255, 255, 0.64)"
  text-3: "rgba(255, 255, 255, 0.5)"
  ok: "#4ade80"
  warn: "#f87171"
  warn-text: "#fca5a5"
  ink: "#000000"
typography:
  display:
    fontFamily: "Outfit, BGMS Korean, Pretendard, Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  wordmark:
    fontFamily: "Outfit, sans-serif"
    fontSize: "21px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Outfit, BGMS Korean, Pretendard, Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Outfit, BGMS Korean, Pretendard, Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 800
  body:
    fontFamily: "Outfit, BGMS Korean, Pretendard, Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Outfit, BGMS Korean, Pretendard, Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.06em"
  hud-value:
    fontFamily: "Outfit, BGMS Korean, Pretendard, Malgun Gothic, Apple SD Gothic Neo, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    fontFeature: "tnum"
  mono:
    fontFamily: "ui-monospace, Consolas, monospace"
    fontSize: "12px"
rounded:
  sm: "6px"
  control: "8px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  hud: "4px"
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "16px"
  xl: "20px"
components:
  app-bar:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    height: "48px"
    padding: "0 12px 0 20px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "#ffb914"
  button-secondary:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 14px"
  button-secondary-hover:
    backgroundColor: "#262626"
  button-disabled:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-3}"
  language-pill:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "30px"
    padding: "0 11px"
  language-pill-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.accent}"
  segmented-option:
    textColor: "{colors.text-2}"
    rounded: "{rounded.sm}"
    height: "30px"
    padding: "0 12px"
  segmented-option-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
  text-input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "38px"
    padding: "0 12px"
  status-strip:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  status-cell:
    padding: "14px 16px"
  match-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "20px 22px 18px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "18px"
  status-chip:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  mini-hud:
    backgroundColor: "rgba(13, 13, 13, 0.82)"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "30px"
    width: "340px"
  mini-brand:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    padding: "0 7px"
  knocked-flag:
    backgroundColor: "{colors.warn}"
    textColor: "{colors.ink}"
    padding: "2px 6px"
  ad-slot:
    width: "400px"
    height: "300px"
---

# Design System: BGMS Companion

## Overview

**Creative North Star: "The Shrunken Shell"**

The companion is bgms.kr carried down to a desktop window and a strip of HUD: the same amber header bar with its darker rule, the same BG/MS wordmark, the same near-black grounds and Outfit type, so a player moving from the app to the web replay feels no seam. Nothing here is a new brand; it is the web brand at companion scale.

Density is calm and operational. The desktop window reads top to bottom as one status strip, then the latest match, then collapsed settings. One amber number (the placement) and one amber button (the replay) carry the screen; everything else is white, grey, or hairline. The in-game HUD is a single translucent dark band, glanceable and silent, showing only what PUBG's own HUD does not.

The system refuses the settings-form-first utility window and the hero-metric card grid. Settings live behind a disclosure; numbers that matter sit in one inline sentence rather than a row of stat tiles.

**Key Characteristics:**
- Amber bar (48px) with a 2px darker-amber bottom rule, black text, BG black / MS white italic wordmark.
- Three near-black grounds layered by tone, separated by white hairlines; no drop shadows on the desktop window.
- Amber is reserved for the brand bar, the placement, the primary action, selected states, and focus.
- The moment track: a hairline match-length rail with knock, death, revive, and bookmark marks at their elapsed time.
- English first; Korean set in a renamed Pretendard subset ("BGMS Korean") behind Outfit in the same stack.

## Colors

One saturated amber on three near-black grounds, with green and red kept strictly for state.

### Primary
- **Ballistic Amber** (accent): the bgms.kr accent. Fills the app bar, the HUD brand cell, the primary button, selected segmented options, checked toggles, the language pill's text when selected, the placement figure, slider accent, focus outlines, and text selection. Also the "live" status lamp (it pulses).
- **Bar Rule Amber** (accent-rule): the 2px bottom rule under the app bar and the primary button's border. Never a fill.
- **Amber Wash** (accent-dim): the onboarding panel's background, the only tinted surface.

### Neutral
- **Night Ground** (ground): window background and text-input fill; the HUD band is this color at 82% opacity.
- **Carbon Surface** (surface): status strip, match card, settings panels, disabled buttons, the hollow center of ring marks on the moment track.
- **Raised Carbon** (elevated): secondary buttons, the match status chip, keycaps, toggle track when off.
- **Hairline** (line) and **Firm Hairline** (line-strong): every border and divider; firm for buttons, inputs, scrollbar thumb, and the moment rail.
- **Hover Veil** (hover): hover fill on clickable status cells.
- **White / Soft White / Dim White** (text, text-2, text-3): primary text; secondary text and mode names; labels, hints, ticks, footer.
- **Ink** (ink): black text and marks on amber and on red.

### State
- **Signal Green** (ok): "on" lamps and the revive ring.
- **Signal Red** (warn): "warn" lamps, the death mark, the HUD KO flag.
- **Soft Red** (warn-text): warning text on dark grounds (status value in warn tone, death time label, diagnostics warning, HUD service warning). Signal Red is a fill; Soft Red is its legible text form.

### Named Rules
**The Two Amber Moments Rule.** On the desktop window's main view, amber appears in the bar and in at most two content places: the placement figure and the primary replay button. Selected controls and focus inherit amber, but no decorative amber.

**The Lamp Grammar Rule.** Status is told by a lamp of four tones only: off (hollow grey ring), on (green), live (amber, pulsing 1.8s), warn (red with soft-red value text). New statuses map to one of these four; no new colors.

## Typography

**Display Font:** Outfit variable (Latin subset, weight 100-900)
**Body Font:** Outfit, falling back per glyph to "BGMS Korean" (Pretendard Variable 1.3.9 Hangul subset), then Pretendard, Malgun Gothic, Apple SD Gothic Neo, Segoe UI
**Label/Mono Font:** ui-monospace / Consolas, for raw diagnostic identifiers only

**Character:** One geometric sans carrying everything from the 900-weight italic wordmark to 11px labels; weight, not a second family, makes the hierarchy. Hangul joins through the same stack so Korean sits at the same color as English.

### Hierarchy
- **Display** (800, 44px, 1.05, tabular): the placement figure ("#3 / 98") in amber. Once per screen.
- **Wordmark** (900 italic, 21px, uppercase, -0.04em): the BGMS mark in the app bar; the HUD brand cell repeats it at 12px.
- **Headline** (800, 24px, -0.02em): the match heading (map name), with the mode beside it at 600/15px in soft white.
- **Title** (800, 15px): panel and onboarding headings; disclosure summaries at 700/14px; status values at 700/15px.
- **Body** (400-600, 13-15px, 1.5): the inline result sentence (15px, numbers in 800 tabular white), panel notes, onboarding steps, button text (700/13px; 800 on primary). Hints and footer at 12px.
- **Label** (700, 11px, 0.06em, uppercase): status cell labels, control labels, diagnostic terms, the match status chip (800, 0.04em).

### Named Rules
**The Tabular Numbers Rule.** Every number a player compares (placement, headshots, longest kill, moment times, hotkeys, HUD counters, slider value) is set with tabular figures.

**The Eleven Pixel Floor Rule.** No text anywhere, desktop or HUD, is set below 11px.

## Layout

The desktop window is a two-column grid: a fluid content column and a fixed 400px ad rail, 20px gap and 20px outer padding, capped at 1400px wide. At the 1000x560 minimum the content column keeps about 550px. The app bar is sticky at the top and doubles as the window drag handle; the ad rail is sticky 68px from the top, aligned with the status strip.

The content column stacks with a 16px gap: status strip, match card, onboarding (first run only), the Settings disclosure (hairline above, collapsed by default, auto-opened only when setup is incomplete), and a quiet footer. Inside settings, panels flow in an auto-fit grid of 300px minimum columns with a 14px gap; the diagnostics panel spans the full row.

The in-game window is fixed at 348x78, transparent, and click-through: one 30px-tall band (with a 4px inset) holding brand, phase, and counters, with at most one line of shadowed status text below. When width runs short, counter labels truncate and the values never do.

Spacing steps are 4 (HUD inset), 6, 8 (button and pill gaps), 14 (panel internals, settings grid), 16 (content stack), and 20 (page gutter and card padding).

### Named Rules
**The Ad Rail Rule.** The Overwolf ad container is exactly 400x300, has no children other than what the ad SDK inserts, keeps a transparent background, and is always visible. It never sits beside a view that is only settings; settings stay a collapsible part of the status-and-match view.

## Elevation & Depth

The desktop window is flat. Depth comes from tonal steps (ground, surface, elevated) and white hairlines, never from drop shadows. The two inset shadows in use are borders in disguise: the keycap's bottom edge and the toggle/segmented-control hairline ring.

Shadows exist only where the HUD sits over the moving game image and must stay legible.

### Shadow Vocabulary
- **HUD lift** (`box-shadow: 0 2px 10px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.08)`): the mini HUD band, separating it from any game scene.
- **HUD text halo** (`text-shadow: 0 1px 2px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)`): the status line under the band, which has no background of its own.
- **Keycap** (`box-shadow: inset 0 -1px 0 rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.14)`): hotkey values.

### Named Rules
**The Flat Window Rule.** Nothing on the desktop window casts a shadow. If a surface needs separation, step its tone or add a hairline.

## Shapes

Corners follow the bgms.kr scale of 6/10/14, with 8px as the build's control radius. Small selectable parts (segmented options, keycaps) use 6px; buttons, inputs, language pills, the icon button, and the HUD band use 8px; the status strip, panels, and onboarding use 10px; the match card, the one hero container, uses 14px. Fully round only for chips, toggles, lamps, and the ring marks on the moment track. Borders are always 1px hairlines; the only heavier strokes are the app bar's 2px rule and the 2.5px moment rings.

The moment track has its own fixed glyph set, drawn in CSS, never as text characters: hollow amber ring (knocked), hollow green ring (revived), red 4x20 bar (death), white rotated square (bookmark), thin grey ticks at 0:00 and the end time.

## Components

### Buttons
- **Shape:** gently rounded (8px), 36px tall, 14px side padding, 13px/700 text.
- **Primary:** amber fill, darker-amber border, black 800 text. Hover lightens to a brighter amber. One per view: the replay action.
- **Secondary:** raised-carbon fill with a firm hairline, white text; hover lifts the fill one step and brightens the border.
- **Pressed:** all buttons sink 1px.
- **Disabled:** carbon fill, hairline border, dim text, not-allowed cursor.
- **Link button:** soft-white underlined text with a hairline underline; turns amber on hover (footer only).

### Status Strip
- **Style:** one carbon bar with a 10px radius split into three equal cells by hairlines. Each cell: an 11px uppercase label over a lamp and a one-to-three-word value at 15px/700.
- **States:** off / on / live / warn per the Lamp Grammar Rule. Cells that act (overlay toggle, handoff settings) take the hover veil.

### Match Card
- **Corner Style:** 14px, carbon, hairline border, 20/22/18px padding.
- **Content order:** map heading with mode, status chip right; placement in amber display type with the inline result sentence beside it; the moment track; actions; one 12px hint line.

### Moment Track (signature)
A 2px firm-hairline rail spanning the match length, with marks placed at elapsed time and an 11px tabular time label under each. Labels of marks closer than 2.5% of the rail drop to a second line; the death label is soft red and bold. Empty matches show the rail in the lighter hairline. Hidden from assistive tech; a visually hidden sentence carries the same moments.

### Chips
- **Status chip:** pill, raised carbon, 11px/800 uppercase soft-white text ("FINISHED").
- **Language pills:** on the amber bar, transparent with black 72% text; selected is a black pill with amber text.

### Inputs / Fields
- **Text input:** night-ground fill, firm hairline, 8px, 38px tall, amber caret. Focus swaps the border to amber with a 1px inset amber ring.
- **Toggle:** a native checkbox drawn as a 38x22 pill; off is raised carbon with a grey knob, on is amber with a black knob.
- **Segmented control:** night-ground track with a hairline ring, 30px options, selected option amber with black text.
- **Range:** native slider with amber accent; the value shows in amber tabular figures in the label row.

### Navigation
The app bar is the only navigation: wordmark and "Companion" name left, language pills and the close icon (SVG cross) right. Focus rings inside the bar are black instead of amber.

### Mini HUD
A 30px dark band at 82% opacity, 8px corners, HUD lift shadow. Left to right: amber brand cell with black italic "BGMS", amber uppercase phase (truncates at 84px), hairline-divided counters (11px uppercase soft label, 13px/800 tabular white value), and a red KO flag with black text pushed right when knocked. Overall opacity follows the user's setting (35-100%).

## Do's and Don'ts

### Do:
- **Do** keep the app bar identical to bgms.kr: amber fill, 2px darker-amber rule, BG black / MS white italic wordmark.
- **Do** separate surfaces by tone step and 1px white hairline only.
- **Do** set every comparable number in tabular figures.
- **Do** keep all text at 11px or larger, including the HUD.
- **Do** keep the ad slot at 400x300, empty, transparent, and always beside the status-and-match view.
- **Do** write every string in English first and add Korean through i18n; regenerate the Korean font subset when Korean strings change.
- **Do** let HUD labels truncate before values.

### Don't:
- **Don't** add drop shadows to the desktop window; shadows belong only to the HUD over the game.
- **Don't** introduce colors outside the token set; state uses only green, red, soft red, and amber.
- **Don't** show the ad rail beside a view that is only settings.
- **Don't** lay out match numbers as a grid of stat tiles; they read as one sentence beside the placement.
- **Don't** add HUD items that repeat what PUBG's own HUD shows (kills, alive count, health, weapon, kill feed).
- **Don't** draw moment marks or icons with text glyphs; use CSS shapes or inline SVG.
