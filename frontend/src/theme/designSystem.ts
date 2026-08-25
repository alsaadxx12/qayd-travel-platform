import { createTheme, MantineColorsTuple } from '@mantine/core';

// Vibrant Professional Orange Color Palette
const orangeColors: MantineColorsTuple = [
  '#fff7ed', // 0
  '#ffedd5', // 1
  '#fed7aa', // 2
  '#fdba74', // 3
  '#fb923c', // 4
  '#f97316', // 5
  '#ea580c', // 6 - Primary Orange
  '#c2410c', // 7 - Deep Orange
  '#9a3412', // 8
  '#7c2d12', // 9
];

export const mantineTheme = createTheme({
  primaryColor: 'orange',
  primaryShade: 6,
  colors: {
    orange: orangeColors,
    emerald: orangeColors, // Seamless fallback alias for existing emerald tokens
  },
  fontFamily: "'IBM Plex Sans Arabic', 'Segoe UI', system-ui, -apple-system, sans-serif",
  headings: {
    fontFamily: "'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif",
    fontWeight: '700',
  },
  defaultRadius: 'sm', // 6px - 8px radius
  cursorType: 'pointer',
  components: {
    Button: {
      defaultProps: {
        size: 'xs',
      },
    },
    TextInput: {
      defaultProps: {
        size: 'xs',
      },
    },
    Select: {
      defaultProps: {
        size: 'xs',
      },
    },
    Table: {
      defaultProps: {
        highlightOnHover: true,
        withTableBorder: true,
        withColumnBorders: true,
      },
    },
  },
});
