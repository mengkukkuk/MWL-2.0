import { createTheme } from '@mantine/core';

/**
 * Inter is never fetched — there is no webfont link and no bundled @font-face,
 * so it only applies on machines that happen to have it installed. Everything
 * after it is a system face, and the Thai entries are load-bearing: every
 * EmployeeName in this database is Thai and none of the Latin faces cover that
 * range. Browsers fall back per-glyph, so a Thai name in a Latin-labelled UI
 * picks up Leelawadee UI (Windows) / Thonburi (macOS) / Noto Sans Thai (Linux,
 * Android) while the surrounding chrome stays on the Latin face.
 */
const FONT_STACK = [
  'Inter',
  '"Segoe UI"',
  '"Leelawadee UI"',
  '"Noto Sans Thai"',
  'Thonburi',
  'ui-sans-serif',
  '-apple-system',
  'BlinkMacSystemFont',
  'sans-serif',
].join(', ');

export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'lg',
  fontFamily: FONT_STACK,
  headings: { fontFamily: FONT_STACK, fontWeight: '700' },
  components: {
    Card: { defaultProps: { withBorder: true, shadow: 'none', radius: 'lg' } },
    Paper: { defaultProps: { withBorder: true, radius: 'lg' } },
    Button: { defaultProps: { radius: 'md' } },
    ActionIcon: { defaultProps: { radius: 'md' } },
    TextInput: { defaultProps: { radius: 'md' } },
    PasswordInput: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md' } },
    SegmentedControl: { defaultProps: { radius: 'md' } },
  },
});
