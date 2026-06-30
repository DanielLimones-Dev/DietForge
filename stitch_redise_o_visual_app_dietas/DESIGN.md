---
name: Obsidian Precision
colors:
  surface: '#111318'
  surface-dim: '#111318'
  surface-bright: '#37393e'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1c20'
  surface-container: '#1e2024'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e8'
  on-surface-variant: '#bec8d2'
  inverse-surface: '#e2e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#88929b'
  outline-variant: '#3e4850'
  surface-tint: '#89ceff'
  primary: '#89ceff'
  on-primary: '#00344d'
  primary-container: '#0ea5e9'
  on-primary-container: '#003751'
  inverse-primary: '#006591'
  secondary: '#b9c8de'
  on-secondary: '#233143'
  secondary-container: '#39485a'
  on-secondary-container: '#a7b6cc'
  tertiary: '#ffb86e'
  on-tertiary: '#492900'
  tertiary-container: '#de8712'
  on-tertiary-container: '#4d2b00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#d4e4fa'
  secondary-fixed-dim: '#b9c8de'
  on-secondary-fixed: '#0d1c2d'
  on-secondary-fixed-variant: '#39485a'
  tertiary-fixed: '#ffdcbd'
  tertiary-fixed-dim: '#ffb86e'
  on-tertiary-fixed: '#2c1600'
  on-tertiary-fixed-variant: '#693c00'
  background: '#111318'
  on-background: '#e2e2e8'
  surface-variant: '#333539'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '300'
    lineHeight: '1.1'
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '300'
    lineHeight: '1.5'
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-padding-desktop: 64px
  container-padding-mobile: 24px
  section-gap: 120px
  element-gap: 24px
  gutter: 32px
---

## Brand & Style

The design system is defined by a "Quiet Confidence" philosophy, catering to high-end SaaS environments where clarity and focus are paramount. The aesthetic is ultra-professional and minimalist, leaning into an architectural structure that prioritizes negative space over decorative elements.

The style is a hybrid of **Minimalism** and **Refined Glassmorphism**. It utilizes a dark, obsidian-toned environment to reduce eye strain and establish a premium, high-tech atmosphere. Visual interest is generated through subtle texture and light-play rather than heavy color application. The emotional response is one of calm authority, precision, and elite performance.

## Colors

The palette is centered on "Obsidian"—a range of deep charcoals that provide more depth and sophistication than pure black. 

- **Primary (Cyan):** Used exclusively for high-impact focus points, critical calls to action, and active state indicators. It should be used sparingly to maintain its power as a visual cue.
- **Secondary (Slate):** Used for supporting text and non-critical iconography, providing a soft contrast against the dark background.
- **Surface Strategy:** Backgrounds utilize `#0A0C10`. Elevated containers or cards use a slightly lighter `#11141B`.
- **Accents:** Use subtle gradients of the primary cyan (low opacity) only for hover states or soft glows behind glass elements.

## Typography

The typography in the design system uses **Hanken Grotesk** to achieve an "architectural" feel. 

Refinement rules:
- **Tracking:** Headlines and labels use increased letter-spacing to create an airy, premium rhythm.
- **Weight:** Display and secondary body styles favor thinner weights (300) to convey sophistication. 
- **Hierarchy:** Contrast is established through size and tracking rather than aggressive bolding. 
- **Labels:** Small utility text should often be in uppercase with wide tracking for a technical, high-precision look.

## Layout & Spacing

The design system employs a **Fluid Grid** with generous white space. Elements are allowed to "breathe" significantly to reduce cognitive load and emphasize the minimalist aesthetic.

- **Desktop:** 12-column grid with a 32px gutter. Outer margins are a minimum of 64px to center focus on content.
- **Tablet:** 8-column grid with 24px gutters.
- **Mobile:** 4-column grid with 16px gutters and 24px margins.
- **Vertical Rhythm:** A strict 8px base unit. Section spacing is intentionally oversized (120px+) to create distinct mental breaks between different functional areas.

## Elevation & Depth

Depth is communicated through **Glassmorphism** and **Subtle Tonal Layers**. 

- **Surfaces:** Instead of heavy shadows, use semi-transparent background blurs (Backdrop Filter: blur 12px) on cards with a background opacity of 40-60%.
- **Borders:** Every container is defined by an ultra-thin (0.5px) border. Use white at 8% opacity for the top and left edges, and 4% for the bottom and right edges to simulate a faint, directional light source.
- **Shadows:** Only use shadows for the highest-level overlays (modals). These shadows should be extremely diffused (60px-80px blur), low opacity (15%), and tinted with the Obsidian surface color to avoid a "muddy" look.

## Shapes

The shape language is "Soft" yet disciplined. While the roundedness is present, it is subtle enough to maintain a professional, geometric rigor.

- **Standard Elements:** Buttons and input fields use a 4px (0.25rem) radius.
- **Cards & Modals:** Large containers use an 8px (0.5rem) radius.
- **Interactive States:** Avoid "pill" shapes for standard buttons to maintain the architectural, structured aesthetic. Reserved pill shapes only for status tags or chips.

## Components

- **Buttons:** Primary buttons use a solid Obsidian fill with a subtle 0.5px Cyan border and white text. Ghost buttons use no fill and 0.5px border. No heavy gradients.
- **Input Fields:** Backgrounds are slightly darker than the surface. Borders are 0.5px. The active state is indicated by a subtle Cyan glow (2px blur) and a 1px Cyan border.
- **Cards:** Utilize the glassmorphism rules. Content should be padded with a minimum of 32px to maintain the spacious feel.
- **Chips/Tags:** Minimalist design with a 0.5px border and no fill. Text uses the `label-caps` typography style.
- **Iconography:** Use 1px or 1.5px stroke widths. Icons must be monochrome (Slate) unless they represent a critical active state (Cyan).
- **Lists:** Rows are separated by 0.5px lines with 4% white opacity. Increase row height to at least 64px to ensure a premium, uncrowded layout.