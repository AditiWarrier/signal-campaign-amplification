/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#F0DFC7',
    background: '#74563F',
    backgroundElement: '#86694F',
    backgroundSelected: '#C4A17B',
    textSecondary: '#E2C9A9',
    line: '#9B7B5E',
    brown: '#C4A17B',
    brownLight: '#957657',
    green: '#9EAD91',
    red: '#F0AA91',
    espresso: '#302A25',
  },
  dark: {
    text: '#F0DFC7',
    background: '#74563F',
    backgroundElement: '#86694F',
    backgroundSelected: '#C4A17B',
    textSecondary: '#E2C9A9',
    line: '#9B7B5E',
    brown: '#C4A17B',
    brownLight: '#957657',
    green: '#9EAD91',
    red: '#F0AA91',
    espresso: '#302A25',
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
  surfaceSoft: '#7D6047',
  placeholder: '#F0DFC7',
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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
