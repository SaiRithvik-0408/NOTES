import { createTheme, ThemeOptions } from '@mui/material/styles';
import { tokens } from './tokens';

export const createAppTheme = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';
  const c = isDark ? tokens.colors.dark : tokens.colors.light;
  const s = isDark ? tokens.shadows.dark : tokens.shadows.light;

  const options: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: c.brand.primary,
        light: isDark ? '#818CF8' : '#6366F1',
        dark: c.brand.primaryHover,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: c.brand.secondary,
        contrastText: '#FFFFFF',
      },
      background: {
        default: c.bg.canvas,
        paper: c.bg.surface,
      },
      text: {
        primary: c.text.primary,
        secondary: c.text.secondary,
      },
      divider: c.bg.border,
      success: { main: c.brand.emerald },
      warning: { main: c.brand.amber },
      error: { main: c.brand.rose },
      info: { main: c.brand.cyan },
    },
    typography: {
      fontFamily: tokens.typography.fontFamily.sans,
      h1: {
        fontFamily: tokens.typography.fontFamily.heading,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        lineHeight: 1.15,
      },
      h2: {
        fontFamily: tokens.typography.fontFamily.heading,
        fontWeight: 700,
        letterSpacing: '-0.025em',
        lineHeight: 1.2,
      },
      h3: {
        fontFamily: tokens.typography.fontFamily.heading,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1.25,
      },
      h4: {
        fontFamily: tokens.typography.fontFamily.heading,
        fontWeight: 600,
        letterSpacing: '-0.015em',
      },
      h5: {
        fontFamily: tokens.typography.fontFamily.heading,
        fontWeight: 600,
      },
      h6: {
        fontFamily: tokens.typography.fontFamily.heading,
        fontWeight: 600,
      },
      subtitle1: {
        fontSize: '1rem',
        fontWeight: 500,
        color: c.text.secondary,
      },
      subtitle2: {
        fontSize: '0.875rem',
        fontWeight: 500,
        color: c.text.muted,
      },
      body1: {
        fontSize: '0.9375rem',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '0.8125rem',
        lineHeight: 1.5,
      },
      button: {
        fontFamily: tokens.typography.fontFamily.sans,
        fontWeight: 600,
        textTransform: 'none',
        letterSpacing: '-0.01em',
      },
    },
    shape: {
      borderRadius: 10,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            boxSizing: 'border-box',
          },
          body: {
            backgroundColor: c.bg.canvas,
            color: c.text.primary,
            overflowX: 'hidden',
          },
          '::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '::-webkit-scrollbar-thumb': {
            background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
            borderRadius: '4px',
          },
          '::-webkit-scrollbar-thumb:hover': {
            background: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.sm,
            padding: '8px 16px',
            transition: tokens.transitions.default,
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          },
          containedPrimary: {
            background: tokens.gradients.primary,
            boxShadow: s.glowPrimary,
            '&:hover': {
              background: tokens.gradients.primary,
              filter: 'brightness(1.1)',
              boxShadow: s.glowPrimary,
            },
          },
          outlined: {
            borderColor: c.bg.border,
            '&:hover': {
              borderColor: c.brand.primary,
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(79, 70, 229, 0.04)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: c.bg.surface,
            border: `1px solid ${c.bg.border}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? c.bg.canvas : c.bg.surfaceSubtle,
            borderRight: `1px solid ${c.bg.border}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: c.glass.background,
            backdropFilter: c.glass.backdropBlur,
            WebkitBackdropFilter: c.glass.backdropBlur,
            borderBottom: `1px solid ${c.bg.border}`,
            color: c.text.primary,
            boxShadow: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            borderRadius: tokens.radius.xs,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#1E293B' : '#0F172A',
            color: '#FFFFFF',
            fontSize: '0.75rem',
            padding: '4px 8px',
            borderRadius: tokens.radius.xs,
            border: `1px solid ${c.bg.border}`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: tokens.radius.md,
            border: `1px solid ${c.bg.border}`,
            backgroundColor: c.bg.surfaceElevated,
            backgroundImage: 'none',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.sm,
            margin: '2px 8px',
            padding: '6px 12px',
            transition: tokens.transitions.default,
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.1)',
              color: c.brand.primary,
              '&:hover': {
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(79, 70, 229, 0.15)',
              },
            },
            '&:hover': {
              backgroundColor: c.bg.surfaceSubtle,
            },
          },
        },
      },
    },
  };

  return createTheme(options);
};
