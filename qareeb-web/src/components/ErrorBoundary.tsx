import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

/**
 * حاجز أخطاء عالمي — يمسك أي خطأ في العرض فيمنع الشاشة البيضاء،
 * ويعرض بديلاً عربياً واضحاً مع زرّ إعادة المحاولة.
 * نقطة `componentDidCatch` جاهزة لربط تتبّع أخطاء (Sentry/LogRocket) لاحقاً.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // موضع الربط بخدمة تتبّع الأخطاء لاحقاً (Sentry.captureException…).
    console.error('[qareeb] خطأ غير متوقّع:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl">😟</div>
        <div>
          <p className="text-lg font-bold">حدث خطأ غير متوقّع</p>
          <p className="mt-1 text-sm text-ink-soft">نعتذر — أعد المحاولة، وإن تكرّر تواصل مع الدعم.</p>
        </div>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          إعادة تحميل التطبيق
        </button>
      </div>
    )
  }
}
