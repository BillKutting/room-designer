/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'gradient-shift': 'gradientShift 20s ease-in-out infinite',
        'orb-float-1': 'orbFloat 15s ease-in-out infinite',
        'orb-float-2': 'orbFloat 18s ease-in-out infinite reverse',
        'orb-float-3': 'orbFloat 12s ease-in-out infinite',
        'orb-float-4': 'orbFloat 20s ease-in-out infinite 2s',
        'orb-float-5': 'orbFloat 16s ease-in-out infinite reverse 4s',
        'gradient-line-1': 'gradientLine 8s ease-in-out infinite',
        'gradient-line-2': 'gradientLine 10s ease-in-out infinite 2s',
        'gradient-line-3': 'gradientLine 12s ease-in-out infinite 4s',
        'gradient-line-4': 'gradientLine 9s ease-in-out infinite 6s',
        'corner-pulse-1': 'cornerPulse 6s ease-in-out infinite',
        'corner-pulse-2': 'cornerPulse 8s ease-in-out infinite 3s',
      },
      keyframes: {
        gradientShift: {
          '0%, 100%': { 
            background: 'linear-gradient(to bottom right, rgba(13, 153, 255, 0.3), rgba(26, 26, 26, 1), rgba(0, 212, 255, 0.3))'
          },
          '25%': { 
            background: 'linear-gradient(to top left, rgba(13, 153, 255, 0.3), rgba(26, 26, 26, 1), rgba(0, 212, 255, 0.3))'
          },
          '50%': { 
            background: 'linear-gradient(to top right, rgba(0, 212, 255, 0.3), rgba(26, 26, 26, 1), rgba(13, 153, 255, 0.3))'
          },
          '75%': { 
            background: 'linear-gradient(to bottom left, rgba(0, 212, 255, 0.3), rgba(26, 26, 26, 1), rgba(13, 153, 255, 0.3))'
          },
        },
        orbFloat: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px) scale(1)' },
          '25%': { transform: 'translateY(-30px) translateX(20px) scale(1.05)' },
          '50%': { transform: 'translateY(-15px) translateX(-25px) scale(0.95)' },
          '75%': { transform: 'translateY(25px) translateX(15px) scale(1.02)' },
        },
        gradientLine: {
          '0%, 100%': { opacity: '0.1', transform: 'scaleX(0.8)' },
          '50%': { opacity: '0.4', transform: 'scaleX(1.2)' },
        },
        cornerPulse: {
          '0%, 100%': { opacity: '0.1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(1.1)' },
        },
      },
    },
  },
  plugins: [],
} 