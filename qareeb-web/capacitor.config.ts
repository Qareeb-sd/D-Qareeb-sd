import type { CapacitorConfig } from '@capacitor/cli'

/**
 * إعداد Capacitor — يغلّف تطبيق الويب (dist) في تطبيق أندرويد/iOS أصلي.
 * البناء: npm run build ثم npx cap sync android.
 *
 * للتطوير الحيّ على الهاتف (اختياري): فك تعليق server.url وضع IP جهازك،
 * ثم شغّل npm run dev — يتحدّث التطبيق فوراً دون إعادة بناء.
 */
const config: CapacitorConfig = {
  appId: 'sd.qareeb.app',
  appName: 'قريب',
  webDir: 'dist',
  // server: {
  //   url: 'http://192.168.1.10:5173',
  //   cleartext: true,
  // },
  android: {
    // يسمح بتحميل خرائط قوقل/Supabase عبر https داخل WebView
    allowMixedContent: false,
  },
}

export default config
