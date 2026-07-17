import Screen from '@/components/Screen'
import SupportChat from '@/components/SupportChat'

/** الدعم داخل التطبيق للعميل — تذاكر ومحادثة مع الإدارة. */
export default function Support() {
  return (
    <Screen title="الدعم والمحادثة" back>
      <SupportChat />
    </Screen>
  )
}
