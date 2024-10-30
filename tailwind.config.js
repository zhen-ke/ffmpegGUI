const { dialog } = require('electron');

module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        border: {
          dark: '#353F4F',
        },
        primary: {
          DEFAULT: '#1a73e8',
          dark: '#1557b0',
        },
        background: {
          light: '#ffffff',
          dark: '#0F172A',
          textarea: '#1E293B',
          dialog: 'rgba(15, 23, 42, 0.8)',
          header: '#1E293B',
        },
        text: {
          light: '#000000',
          dark: '#e2e8f0',
          lightDark: '#94a3b8',
        },
      },
    },
  },
  plugins: [],
};
