// One Accord design tokens. Generated from tokens.json.
export const oneAccord = {
  color: {
    day: {
      ink: '#141414',
      'ink-muted': '#5C554C',
      ground: '#FFFFFF',
      'surface-muted': '#F3F1EE',
      surface: '#FFFFFF',
      border: '#E3DACB',
      fire: '#E52A2A',
      'fire-ink': '#C81E1E',
      'on-fire': '#FFFFFF',
      gold: '#F5C400',
      'on-gold': '#141414',
      glow: '#F28C28',
      'city-lagos': '#F5C400',
      'city-abuja': '#E52A2A',
      'status-go': '#1E8A4C',
      'status-check': '#F2B33D',
      'status-stop': '#B42328',
    },
    night: {
      ink: '#F7F1E6',
      'ink-muted': '#B8B0A4',
      ground: '#121212',
      'surface-muted': '#1E1C1A',
      surface: '#1E1C1A',
      border: '#33302B',
      fire: '#FF4D3D',
      'fire-ink': '#FF4D3D',
      'on-fire': '#FFFFFF',
      gold: '#F5C400',
      'on-gold': '#141414',
      glow: '#F28C28',
      'city-lagos': '#F5C400',
      'city-abuja': '#FF4D3D',
      'status-go': '#3FC07A',
      'status-check': '#F2B33D',
      'status-stop': '#E5484D',
    },
  },
  font: {
    display: '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif',
    wide: '"Archivo", system-ui, sans-serif',
    body: '"Archivo", system-ui, sans-serif',
  },
  type: {
    'display-xl': {
      fontSize: '64px',
      lineHeight: '0.95',
      fontWeight: 800,
    },
    'display-lg': {
      fontSize: '40px',
      lineHeight: '1',
      fontWeight: 800,
    },
    'display-md': {
      fontSize: '28px',
      lineHeight: '1.05',
      fontWeight: 700,
    },
    strip: {
      fontSize: '18px',
      lineHeight: '1.2',
      fontWeight: 800,
    },
    label: {
      fontSize: '12px',
      lineHeight: '1.3',
      fontWeight: 700,
    },
    body: {
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: 400,
    },
    'body-strong': {
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: 600,
    },
    small: {
      fontSize: '13px',
      lineHeight: '18px',
      fontWeight: 400,
    },
  },
  space: {
    'space-1': '4px',
    'space-2': '8px',
    'space-3': '16px',
    'space-4': '24px',
    'space-5': '40px',
  },
  radius: {
    'radius-sm': '4px',
    'radius-md': '10px',
    'radius-lg': '18px',
  },
} as const;

export type OneAccordTheme = keyof typeof oneAccord.color;
