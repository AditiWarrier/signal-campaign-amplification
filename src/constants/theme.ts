/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#292B24',
    background: '#F5F1E8',
    backgroundElement: '#EEE8DC',
    backgroundSelected: '#DCE2D2',
    textSecondary: '#64675D',
    line: '#D8D2C5',
    brown: '#2E5B3C',
    brownLight: '#DCE2D2',
    green: '#2E5B3C',
    red: '#743C4F',
    espresso: '#292B24',
  },
  dark: {
    text: '#292B24',
    background: '#F5F1E8',
    backgroundElement: '#EEE8DC',
    backgroundSelected: '#DCE2D2',
    textSecondary: '#64675D',
    line: '#D8D2C5',
    brown: '#2E5B3C',
    brownLight: '#DCE2D2',
    green: '#2E5B3C',
    red: '#743C4F',
    espresso: '#292B24',
  },
} as const;

/** Shared warm palette for screen layouts and controls. */
export const Palette = {
  paper: Colors.light.background,
  text: Colors.light.text,
  espresso: Colors.light.espresso,
  muted: Colors.light.textSecondary,
  line: Colors.light.line,
  brown: Colors.light.brown,
  brownLight: Colors.light.brownLight,
  green: Colors.light.green,
  red: Colors.light.red,
  surface: Colors.light.backgroundElement,
  surfaceSoft: '#EEE8DC',
  backgroundSelected: Colors.light.backgroundSelected,
  placeholder: Colors.light.textSecondary,
  maroon: '#743C4F',
  maroonLight: '#F0E7EA',
  error: '#743C4F',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * SIGNAL shared visual identity. Home's charcoal campaign section remains a
 * deliberate section treatment; other colors use paper, olive, and selective mauve.
 */
export const Signal = {
  paper: '#F5F1E8',
  paperDeep: '#EEE8DC',
  ink: '#292B24',
  inkSoft: '#64675D',
  hairline: '#D8D2C5',
  forest: '#2E5B3C',
  forestDeep: '#2E5B3C',
  lake: '#2E5B3C',
  sun: '#2E5B3C',
  onDark: '#F5F1E8',
  scrim: '#0E130F',
  charcoal: '#151816',
  charcoalLine: '#2C312D',
  onDarkSoft: '#C7C9C0',
  butter: '#EEE8DC',
  maroon: '#743C4F',
  maroonLight: '#F0E7EA',
  oliveLight: '#DCE2D2',
} as const;

export const SignalFonts = {
  display: Platform.select({ web: 'Georgia, "Times New Roman", serif', ios: 'Georgia', default: 'serif' }) ?? 'serif',
  sans: Platform.select({ web: 'var(--font-display)', ios: 'System', default: 'sans-serif' }) ?? 'System',
} as const;

export const SignalType = {
  eyebrow: { fontSize: 12, lineHeight: 16, letterSpacing: 1.6, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 25 },
  small: { fontSize: 14, lineHeight: 21 },
  lead: { fontSize: 22, lineHeight: 30 },
  sectionTitle: { fontSize: 28, lineHeight: 34 },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
