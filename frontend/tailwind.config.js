/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    fontSize: {
      // 90% of default (16px * 0.9 = 14.4px)
      xs: ['0.675rem', { lineHeight: '0.9rem' }],    // was 0.75rem
      sm: ['0.7875rem', { lineHeight: '1.125rem' }], // was 0.875rem
      base: ['0.9rem', { lineHeight: '1.35rem' }],   // was 1rem
      lg: ['1.0125rem', { lineHeight: '1.575rem' }], // was 1.125rem
      xl: ['1.125rem', { lineHeight: '1.6875rem' }], // was 1.25rem
      '2xl': ['1.35rem', { lineHeight: '1.8rem' }],  // was 1.5rem
      '3xl': ['1.6875rem', { lineHeight: '2.025rem' }], // was 1.875rem
      '4xl': ['2.025rem', { lineHeight: '2.25rem' }], // was 2.25rem
    },
    spacing: {
      // 90% of default
      px: '1px',
      0: '0',
      0.5: '0.1125rem',
      1: '0.225rem',
      1.5: '0.3375rem',
      2: '0.45rem',
      2.5: '0.5625rem',
      3: '0.675rem',
      3.5: '0.7875rem',
      4: '0.9rem',
      5: '1.125rem',
      6: '1.35rem',
      7: '1.575rem',
      8: '1.8rem',
      9: '2.025rem',
      10: '2.25rem',
      12: '2.7rem',
      16: '3.6rem',
      20: '4.5rem',
      24: '5.4rem',
      32: '7.2rem',
      40: '9rem',
      48: '10.8rem',
      56: '12.6rem',
      64: '14.4rem',
    },
    extend: {
      colors: {
        // Primary Brand
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Accent / Secondary
        accent: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
        },
        // Success
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        // Warning
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Danger
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        // Neutral / Slate Extended
        slate: {
          850: '#172033',
          925: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.05)',
        'soft-lg': '0 4px 16px -4px rgba(0, 0, 0, 0.08)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.15)',
        'glow-accent': '0 0 20px rgba(217, 70, 239, 0.15)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}