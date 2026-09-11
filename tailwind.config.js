/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Slack Aubergine brand ramp — primary is Slack's signature
        // deep purple (#611C69 light / #A559A5 dark). Components follow
        // the existing `text-brand-600 dark:text-brand-400` pattern.
        brand: {
          50: '#faf5fb',
          100: '#f3e8f4',
          200: '#e7d1ea',
          300: '#d4add9',
          400: '#c07cc0',
          500: '#a559a5',
          600: '#611c69',
          700: '#4b154c',
          800: '#3d1240',
          900: '#331037',
          950: '#1e0821',
        },
        // Warm purple-gray neutral ramp — complements the aubergine
        // accent and reads correctly in dark-mode surfaces via
        // `dark:bg-surface-900` convention.
        surface: {
          50: '#faf8fb',
          100: '#f4f0f7',
          200: '#e5dde8',
          300: '#cfc3d4',
          400: '#8c7a94',
          500: '#6b5a73',
          600: '#5a4660',
          700: '#45354b',
          800: '#2d2333',
          900: '#1a0f24',
          950: '#0d0614',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'shimmer': 'shimmer 2s infinite',
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
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
