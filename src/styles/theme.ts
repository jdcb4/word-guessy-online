export const theme = {
  colors: {
    primary: {
      DEFAULT: 'hsl(var(--primary))',
      foreground: 'hsl(var(--primary-foreground))',
      muted: 'hsl(var(--primary) / 0.6)',
    },
    background: {
      DEFAULT: 'hsl(var(--background))',
      muted: 'hsl(var(--muted))',
    },
    destructive: {
      DEFAULT: 'hsl(var(--destructive))',
      foreground: 'hsl(var(--destructive-foreground))',
    },
    success: {
      DEFAULT: 'hsl(var(--success))',
      foreground: 'hsl(var(--success-foreground))',
    },
  },
  spacing: {
    container: {
      center: true,
      padding: '2rem',
      maxWidth: '768px',
    },
  },
}; 