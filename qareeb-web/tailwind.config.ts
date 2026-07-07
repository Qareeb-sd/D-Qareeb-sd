import type { Config } from 'tailwindcss'

/**
 * هوية "قريب" البصرية — ثابتة، تُستخدم في كل المشروع.
 * Qareeb brand tokens. Do not change hex values without design approval.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // الأخضر السوداني
        green: {
          DEFAULT: '#1B6B3F',
          dark: '#125531',
          soft: '#E8F1EC',
          mint: '#F3F8F4',
        },
        // الذهبي
        gold: {
          DEFAULT: '#C9A138',
          deep: '#A88528',
          soft: '#FBF4DD',
        },
        // الليموني (شعار السائق)
        lemon: '#F2E21C',
        // محايدات
        bg: '#FAF7F2',
        ink: {
          DEFAULT: '#1A1F1B',
          soft: '#52584E',
          muted: '#8B9189',
        },
        hairline: '#E5E7E2',
        // إشارات
        danger: '#C5453B',
        warning: '#D88A2B',
        info: '#3A6FB0',
      },
      fontFamily: {
        sans: ['Tajawal', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 2px 12px rgba(26, 31, 27, 0.06)',
        lift: '0 8px 28px rgba(26, 31, 27, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config
