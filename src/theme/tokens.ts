// Bespoke Design Tokens for Nexus Notes

export const tokens = {
  colors: {
    dark: {
      bg: {
        canvas: '#090D16',       // Deep Obsidian Space
        surface: '#0F1626',      // Primary card surface
        surfaceSubtle: '#141D32',// Hover / Secondary surface
        surfaceElevated: '#1A253F', // Modals / Popovers
        border: 'rgba(255, 255, 255, 0.08)',
        borderFocus: '#6366F1',
      },
      text: {
        primary: '#F8FAFC',
        secondary: '#94A3B8',
        muted: '#64748B',
        accent: '#818CF8',
      },
      brand: {
        primary: '#6366F1',      // Vibrant Indigo
        primaryHover: '#4F46E5',
        secondary: '#A855F7',    // Electric Purple
        accent: '#EC4899',       // Rose Neon
        cyan: '#06B6D4',         // Cyan highlight
        emerald: '#10B981',      // Mint / Synced indicator
        amber: '#F59E0B',        // Offline warning
        rose: '#EF4444',         // Conflict / Error
      },
      glass: {
        background: 'rgba(15, 22, 38, 0.72)',
        border: 'rgba(255, 255, 255, 0.1)',
        backdropBlur: 'blur(16px)',
      },
    },
    light: {
      bg: {
        canvas: '#F8FAFC',       // Clean, crisp canvas
        surface: '#FFFFFF',      // Pure white card surface
        surfaceSubtle: '#F1F5F9',// Light gray subtle
        surfaceElevated: '#FFFFFF',
        border: 'rgba(15, 23, 42, 0.08)',
        borderFocus: '#4F46E5',
      },
      text: {
        primary: '#0F172A',
        secondary: '#475569',
        muted: '#94A3B8',
        accent: '#4F46E5',
      },
      brand: {
        primary: '#4F46E5',
        primaryHover: '#4338CA',
        secondary: '#9333EA',
        accent: '#DB2777',
        cyan: '#0891B2',
        emerald: '#059669',
        amber: '#D97706',
        rose: '#DC2626',
      },
      glass: {
        background: 'rgba(255, 255, 255, 0.8)',
        border: 'rgba(15, 23, 42, 0.06)',
        backdropBlur: 'blur(16px)',
      },
    },
  },
  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      heading: "'Plus Jakarta Sans', 'Inter', sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },
  radius: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
  shadows: {
    dark: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.5)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -4px rgba(0, 0, 0, 0.6)',
      glowPrimary: '0 0 24px -4px rgba(99, 102, 241, 0.35)',
      glowSecondary: '0 0 24px -4px rgba(168, 85, 247, 0.35)',
      glowEmerald: '0 0 20px -4px rgba(16, 185, 129, 0.4)',
    },
    light: {
      sm: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
      md: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
      lg: '0 10px 20px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.05)',
      glowPrimary: '0 0 24px -4px rgba(79, 70, 229, 0.25)',
      glowSecondary: '0 0 24px -4px rgba(147, 51, 234, 0.25)',
      glowEmerald: '0 0 20px -4px rgba(5, 150, 105, 0.25)',
    },
  },
  gradients: {
    primary: 'linear-gradient(135deg, #6366F1 0%, #A855F7 50%, #EC4899 100%)',
    subtleDark: 'linear-gradient(180deg, rgba(20, 29, 50, 0.6) 0%, rgba(15, 22, 38, 0.6) 100%)',
    subtleLight: 'linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(241, 245, 249, 0.8) 100%)',
    glassHighlight: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 100%)',
  },
  transitions: {
    default: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    smooth: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
  },
};
