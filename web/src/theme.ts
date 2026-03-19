/**
 * Theme constants — high-contrast geek theme.
 * Bright colors on pure black, maximum readability.
 */

export const colors = {
  // Backgrounds — pure black base
  bg: '#0a0a0a',
  bgDark: '#050505',
  bgSurface: '#141414',
  bgOverlay: 'rgba(0,0,0,0.7)',

  // Borders
  border: '#2a2a2a',
  borderHover: '#444',

  // Text — high contrast
  text: '#f0f0f0',
  textSecondary: '#cccccc',
  textMuted: '#777777',

  // Accent — vivid geek colors
  green: '#50fa7b',
  blue: '#6272a4',
  red: '#ff5555',
  yellow: '#f1fa8c',
  magenta: '#ff79c6',
  cyan: '#8be9fd',
  orange: '#ffb86c',

  // Selection
  selection: '#264f2a',
} as const;

export const spacing = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 13,
  lg: 14,
  xl: 15,
  xxl: 18,
  mobile: { input: 15, terminal: 11, tab: 14 },
  desktop: { input: 13, terminal: 13, tab: 13 },
} as const;

export const radii = {
  sm: 3,
  md: 6,
  lg: 8,
  xl: 12,
} as const;
