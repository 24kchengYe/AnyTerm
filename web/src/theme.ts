/**
 * Theme — Matrix hacker aesthetic.
 * Deep black background, neon green accents, high contrast.
 */

export const colors = {
  // Backgrounds
  bg: '#0c0c0c',
  bgDark: '#060606',
  bgSurface: '#161616',
  bgOverlay: 'rgba(0,0,0,0.8)',

  // Borders — subtle green tint
  border: '#1a2a1a',
  borderHover: '#2a4a2a',
  borderActive: '#00ff41',

  // Text
  text: '#e0e0e0',
  textSecondary: '#aaaaaa',
  textMuted: '#666666',

  // Accents — neon
  green: '#00ff41',        // Primary accent (Matrix green)
  greenDim: '#00cc33',
  greenBg: '#00ff4115',
  red: '#ff3333',
  redBg: '#ff333315',
  yellow: '#ffff00',
  blue: '#00aaff',
  cyan: '#00ffff',
  magenta: '#ff00ff',
} as const;
