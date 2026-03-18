/**
 * Theme constants — centralized color palette, spacing, and font sizes.
 * Tokyo Night inspired theme used across all components.
 */

export const colors = {
  // Backgrounds
  bg: '#1a1b26',
  bgDark: '#13141c',
  bgSurface: '#1f2335',
  bgOverlay: 'rgba(0,0,0,0.6)',

  // Borders
  border: '#292d3e',
  borderHover: '#3b4261',

  // Text
  text: '#c0caf5',
  textSecondary: '#a9b1d6',
  textMuted: '#565f89',

  // Accent
  blue: '#7aa2f7',
  green: '#9ece6a',
  red: '#f7768e',
  yellow: '#e0af68',
  magenta: '#bb9af7',
  cyan: '#7dcfff',

  // Selection
  selection: '#33467c',

  // Terminal-specific
  termBlack: '#15161e',
  termBrightBlack: '#414868',
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
  mobile: {
    input: 15,
    terminal: 10,
    tab: 14,
  },
  desktop: {
    input: 13,
    terminal: 13,
    tab: 13,
  },
} as const;

export const radii = {
  sm: 3,
  md: 6,
  lg: 8,
  xl: 12,
} as const;

export const terminalTheme = {
  background: colors.bg,
  foreground: colors.text,
  cursor: colors.text,
  cursorAccent: colors.bg,
  selectionBackground: colors.selection,
  black: colors.termBlack,
  red: colors.red,
  green: colors.green,
  yellow: colors.yellow,
  blue: colors.blue,
  magenta: colors.magenta,
  cyan: colors.cyan,
  white: colors.textSecondary,
  brightBlack: colors.termBrightBlack,
  brightRed: colors.red,
  brightGreen: colors.green,
  brightYellow: colors.yellow,
  brightBlue: colors.blue,
  brightMagenta: colors.magenta,
  brightCyan: colors.cyan,
  brightWhite: colors.text,
} as const;
