# Sports Betting Platform - Exciting Minimal Styling Guide

## Overview
This styling guide defines the "Exciting Minimal" design system for a sports betting platform. The aesthetic combines high-energy, dynamic elements with clean, minimal design principles to create an engaging yet sophisticated user experience.

## Core Design Philosophy
- **Exciting Minimal**: Bold, dynamic, and energetic while maintaining clean, uncluttered interfaces
- **Sports Betting Focus**: Designed specifically for sports betting with emphasis on odds, live data, and urgency
- **High Energy**: Uses animations, gradients, and micro-interactions to create excitement
- **Professional Polish**: Maintains sophistication and trustworthiness expected in betting platforms

## Color System
```css
/* Primary Colors - Use for main actions, selected states */
--primary: oklch(0.52 0.2 272);
--primary-foreground: oklch(0.99 0 0);

/* Chart Colors - Use for data visualization, live indicators */
--chart-1: oklch(0.52 0.2 272); /* Live/Active */
--chart-2: oklch(0.58 0.18 264); /* Popular/Hot */
--chart-3: oklch(0.62 0.15 252); /* Secondary data */

/* Accent Colors - Use for secondary actions, hover states */
--accent: oklch(0.96 0.02 109);
--accent-foreground: oklch(0.35 0.05 270);

/* Background Colors - Use with transparency for glass effects */
--background: oklch(0.98 0.01 110);
--card: oklch(0.99 0.005 110);
--muted: oklch(0.96 0.01 106);

/* Border Colors - Use with transparency for subtle separation */
--border: oklch(0.93 0.01 106);
```

## Typography System
```css
/* Font Weights */
font-normal: 400
font-medium: 500
font-semibold: 600
font-bold: 700
font-black: 900  /* Use for emphasis, headers, important data */

/* Font Sizes */
text-xs: 0.75rem    /* Labels, badges, metadata */
text-sm: 0.875rem   /* Secondary text, odds */
text-base: 1rem     /* Body text */
text-lg: 1.125rem   /* Important data */
text-xl: 1.25rem    /* Subheaders */
text-2xl: 1.5rem    /* Headers */
text-3xl: 1.875rem  /* Page titles */

/* Typography Rules */
- Headers: font-black, uppercase, tracking-tight
- Labels: font-black, uppercase, text-xs
- Data: font-black, tabular-nums for numbers
- Body: font-medium, normal case
```

## Border System
```css
/* Border Widths */
border: 2px solid /* Standard for all interactive elements */
border-t-2, border-b-2 /* For table headers/footers */

/* Border Colors */
border-primary/30: Default state
border-primary/40: Hover state
border-primary/60: Selected/Active state
border-transparent: Default for unselected items

/* Border Styles */
- Rounded corners: rounded-2xl for cards, rounded-xl for buttons
- Consistent 2px width for all interactive elements
- Use transparency for subtle effects
```

## Shadow System
```css
/* Shadow Hierarchy */
shadow-sm: Subtle elements
shadow-md: Standard interactive elements
shadow-lg: Hover states
shadow-xl: Selected/Active elements
shadow-2xl: Modals, overlays

/* Colored Shadows */
shadow-primary/10: Subtle primary shadow
shadow-primary/30: Strong primary shadow
shadow-chart-1/20: Live indicator shadows
```

## Animation System
```css
/* Standard Transitions */
transition-all duration-300 ease-out /* Default for all interactions */
transition-colors duration-300 /* For color changes */
transition-transform duration-300 /* For scale/rotate effects */

/* Key Animations */
animate-pulse: Live indicators, popular items
animate-bounce: Selected items, notifications
animate-ping: Live status indicators

/* Transform Effects */
hover:scale-105: Standard hover
hover:scale-110: Emphasis hover
hover:scale-125: Icons, small elements
hover:rotate-1: Cards, large elements
hover:rotate-12: Icons
hover:-translate-y-1: Lift effect
hover:-translate-y-2: Strong lift effect
```

## Component Patterns

### 1. Headers
```jsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className="relative">
      <div className="absolute inset-0 bg-chart-1 rounded-full animate-ping" />
      <div className="relative w-3 h-3 bg-chart-1 rounded-full animate-pulse" />
    </div>
    <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
      Section Title
    </h2>
    <div className="flex items-center gap-2">
      <span className="bg-gradient-to-r from-chart-1 to-chart-2 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
        COUNT
      </span>
      <span className="text-xs text-muted-foreground font-medium animate-pulse">
        STATUS
      </span>
    </div>
  </div>
  
  {/* Dropdown */}
  <div className="relative">
    <select className="bg-gradient-to-r from-card to-card/80 border-2 border-primary/30 text-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer hover:border-primary/50 hover:scale-105">
      {/* Options with emojis */}
    </select>
  </div>
</div>
```

### 2. Cards
```jsx
<div className="group relative bg-gradient-to-br from-card via-card to-accent/20 border-2 border-primary/40 rounded-2xl p-6 shadow-xl transition-all duration-300 cursor-pointer hover:shadow-2xl hover:-translate-y-2 hover:border-primary/60 hover:scale-105 hover:rotate-1">
  {/* Animated Border Gradient */}
  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-chart-1/20 to-primary/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
  
  {/* Content */}
  
  {/* Hover Effect Gradient */}
  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
</div>
```

### 3. Buttons
```jsx
<button className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 transition-transform shadow-lg hover:shadow-xl">
  Button Text
</button>

<button className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:scale-105 transition-transform shadow-lg hover:shadow-xl">
  Secondary
</button>
```

### 4. Badges
```jsx
<span className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-110 transition-transform">
  Badge Text
</span>

<span className="bg-gradient-to-r from-chart-1 to-chart-2 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
  Live/Active
</span>
```

### 5. Tables
```jsx
<div className="bg-gradient-to-br from-card via-card to-accent/20 border-2 border-primary/40 rounded-2xl shadow-xl overflow-hidden">
  <table className="w-full">
    <thead className="bg-gradient-to-r from-primary/10 to-primary/5 border-b-2 border-primary/30">
      <tr className="text-left">
        <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-foreground">
          Header
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border/50">
      <tr className="group transition-all duration-300 cursor-pointer hover:bg-gradient-to-r hover:from-accent/30 hover:to-accent/20 hover:scale-[1.02]">
        {/* Cells */}
      </tr>
    </tbody>
  </table>
</div>
```

## Interactive Elements

### Form Inputs
```jsx
<input className="bg-gradient-to-r from-card to-card/80 border-2 border-primary/30 text-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/50 hover:scale-105" />
```

### Odds Display
```jsx
<span className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-lg text-xs font-black tabular-nums hover:scale-110 transition-transform cursor-pointer shadow-md">
  {odds > 0 ? '+' : ''}{odds}
</span>
```

### Live Indicators
```jsx
<div className="relative">
  <div className="absolute inset-0 bg-chart-1 rounded-full animate-ping" />
  <div className="relative w-2 h-2 bg-chart-1 rounded-full animate-pulse" />
</div>
```

## Spacing System
```css
/* Component Spacing */
space-y-4: Standard element spacing
space-y-6: Section spacing
space-y-8: Major section spacing
space-y-12: Page section spacing

/* Internal Spacing */
p-4: Standard padding
p-5: Enhanced padding
p-6: Large padding
px-4, py-2: Button padding
px-6, py-4: Table cell padding
```

## Special Effects

### Glass Morphism
```css
bg-background/80 backdrop-blur-xl
bg-card/40 backdrop-blur-sm
```

### Gradients
```css
bg-gradient-to-r from-primary to-primary/80
bg-gradient-to-br from-card via-card to-accent/20
bg-gradient-to-r from-chart-1 to-chart-2
```

### Popular/Live Items
- Add 🔥 emoji for popular items (90%+ threshold)
- Add animate-pulse for live indicators
- Use chart colors for live/active states
- Add scale effects for emphasis

## Implementation Rules

### 1. Consistency
- Always use 2px borders for interactive elements
- Always use font-black for headers and important data
- Always use uppercase for headers and labels
- Always include hover effects with scale transforms

### 2. Animations
- Use duration-300 for all transitions
- Include ease-out for natural movement
- Add subtle animations to live/active elements
- Use transform effects for engagement

### 3. Colors
- Use primary colors for main actions
- Use chart colors for data and live indicators
- Use accent colors for secondary actions
- Maintain 30-60% opacity for borders and backgrounds

### 4. Typography
- Use tabular-nums for all numeric data
- Use tracking-tight for headers
- Use uppercase for labels and badges
- Maintain consistent font weight hierarchy

### 5. Responsive Design
- Use responsive prefixes (sm:, md:, lg:)
- Maintain touch targets (min 44px)
- Ensure horizontal scroll for tables
- Test on all screen sizes

## Component Checklist
When creating new components, ensure they include:
- [ ] 2px borders with color transitions
- [ ] Font-black typography for headers
- [ ] Uppercase text for labels
- [ ] Hover effects with scale transforms
- [ ] Smooth transitions (duration-300)
- [ ] Gradient backgrounds where appropriate
- [ ] Shadow effects for depth
- [ ] Proper spacing and padding
- [ ] Responsive design considerations
- [ ] Accessibility features (focus states, ARIA labels)

## Testing Guidelines
- Test all hover states and animations
- Verify color contrast ratios
- Check responsive behavior
- Validate accessibility features
- Ensure consistent spacing and alignment
- Test interactive elements with keyboard navigation

This styling guide ensures all components maintain the exciting minimal aesthetic while providing a cohesive, engaging user experience across the entire sports betting platform.