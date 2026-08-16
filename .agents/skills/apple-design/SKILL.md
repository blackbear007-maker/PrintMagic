---
name: apple-design
description: >-
  Apple Human Interface Guidelines (HIG) and macOS Sequoia / iOS design system standards.
  Use when designing light-mode, low-saturation, minimalist, and ultra-refined user interfaces
  featuring frosted glassmorphism, precise SF typography, squircle radius, and haptic feedback.
---

# Apple Design System & Human Interface Guidelines (HIG)

This skill provides comprehensive rules and guidelines for crafting Apple-caliber user interfaces: clean, bright, light-themed, low-saturation, and human-centric.

---

## 1. Color Palette (Light & Low Saturation)

Apple's design language prioritizes content over chrome. Backgrounds are quiet and luminous, text has high legibility with deep slate tones, and accent colors are refined and low-saturation.

```css
:root {
  /* Apple Backgrounds */
  --pm-bg-base: #f5f5f7;           /* Apple Signature Studio Canvas */
  --pm-bg-surface: #ffffff;        /* Pure White Elevated Surface */
  --pm-bg-elevated: #ffffff;
  --pm-bg-card: #ffffff;
  --pm-bg-glass: rgba(255, 255, 255, 0.82);
  --pm-bg-subtle: #fbfbfd;
  --pm-bg-tertiary: #f0f0f2;
  --pm-bg-hover: rgba(0, 0, 0, 0.04);
  --pm-bg-active: rgba(0, 0, 0, 0.08);

  /* Apple Text Hierarchy */
  --pm-text-primary: #1d1d1f;      /* Deep Slate Black (90% optical weight) */
  --pm-text-secondary: #6e6e73;    /* Mid-tone Slate Gray */
  --pm-text-muted: #86868b;        /* Light Slate Gray */
  --pm-text-subtle: #a1a1a6;

  /* Apple Borders & Dividers */
  --pm-border-subtle: rgba(0, 0, 0, 0.08);
  --pm-border-light: rgba(0, 0, 0, 0.05);
  --pm-border-active: rgba(0, 113, 227, 0.4);

  /* Apple Low-Saturation Accent Colors */
  --pm-accent-blue: #0071e3;       /* Apple System Blue */
  --pm-accent-blue-hover: #0077ed;
  --pm-accent-blue-bg: rgba(0, 113, 227, 0.08);
  
  --pm-accent-green: #34c759;      /* Apple System Green */
  --pm-accent-green-bg: rgba(52, 199, 89, 0.1);
  
  --pm-accent-orange: #ff9500;     /* Apple System Orange */
  --pm-accent-orange-bg: rgba(255, 149, 0, 0.1);

  --pm-accent-indigo: #5856d6;
  --pm-accent-red: #ff3b30;

  /* Apple Elevation & Multi-layer Shadows */
  --pm-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  --pm-shadow-md: 0 4px 16px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03);
  --pm-shadow-lg: 0 12px 36px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.03);
  --pm-shadow-sheet: 0 20px 48px rgba(0, 0, 0, 0.08), 0 2px 10px rgba(0, 0, 0, 0.04);

  /* Apple Typography */
  --pm-font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", "PingFang TC", "Microsoft JhengHei", sans-serif;
  --pm-font-mono: "SF Mono", Menlo, Monaco, Consolas, monospace;

  /* Apple Radiuses (Smooth Continuous Squircles) */
  --pm-radius-xs: 6px;
  --pm-radius-sm: 10px;
  --pm-radius-md: 14px;
  --pm-radius-lg: 20px;
  --pm-radius-xl: 28px;
  --pm-radius-full: 9999px;
}
```

---

## 2. Typography & Layout Principles

1. **Clarity & Deference**:
   - UI chrome should be whisper-quiet. The user's artwork and photos should be the hero.
   - Clean font weights: Use `400` for body, `500` for labels, `600` for titles, `700` for key stats. Avoid abrasive super-black weights.
   - Letter-spacing: `-0.015em` to `-0.025em` for titles (SF Pro optical tracking).

2. **Translucency & Materials (Glassmorphism)**:
   - Floating toolbars and modals use `backdrop-filter: blur(24px) saturate(180%)` with semi-transparent white background `rgba(255, 255, 255, 0.8)`.
   - Subtle 1px translucent border (`rgba(0, 0, 0, 0.06)`).

3. **Motion & Feedback**:
   - Bezier Curves: `cubic-bezier(0.16, 1, 0.3, 1)` (Apple's signature natural deceleration).
   - Press State: Subtle scale `transform: scale(0.98)` on click with smooth release.
