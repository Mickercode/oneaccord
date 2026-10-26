// One Accord Tailwind preset. Import tokens.css once so the CSS variables exist.
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        oa: {
          ink: 'var(--oa-ink)',
          'ink-muted': 'var(--oa-ink-muted)',
          ground: 'var(--oa-ground)',
          'surface-muted': 'var(--oa-surface-muted)',
          surface: 'var(--oa-surface)',
          border: 'var(--oa-border)',
          fire: 'var(--oa-fire)',
          'fire-ink': 'var(--oa-fire-ink)',
          'on-fire': 'var(--oa-on-fire)',
          gold: 'var(--oa-gold)',
          'on-gold': 'var(--oa-on-gold)',
          glow: 'var(--oa-glow)',
          'city-lagos': 'var(--oa-city-lagos)',
          'city-abuja': 'var(--oa-city-abuja)',
          'status-go': 'var(--oa-status-go)',
          'status-check': 'var(--oa-status-check)',
          'status-stop': 'var(--oa-status-stop)',
        },
      },
      fontFamily: {
        'oa-display': ['Barlow Condensed', 'Arial Narrow', 'system-ui', 'sans-serif'],
        'oa-wide': ['Archivo', 'system-ui', 'sans-serif'],
        'oa-body': ['Archivo', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'oa-1': '4px',
        'oa-2': '8px',
        'oa-3': '16px',
        'oa-4': '24px',
        'oa-5': '40px',
      },
      borderRadius: {
        'oa-sm': '4px',
        'oa-md': '10px',
        'oa-lg': '18px',
      },
    },
  },
};
