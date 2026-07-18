import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthContext'
import { useRide } from '@/store/RideContext'
import { getActiveCustomerRide, getPendingRateRide } from '@/lib/api'

/**
 * إن كان للعميل رحلة جارية، يستعيد حالتها ويعيده لشاشتها فوراً — يمنع فقدان
 * الرحلة عند الضغط على «رجوع» أو الخروج من التطبيق ثم العودة (كان يهبط على
 * شاشة الطلب الجديد ولا يجد رحلته).
 *
 * يُستدعى في شاشات «بدء طلب جديد» (الرئيسية/تحديد الموقع). يرجّع true أثناء
 * الفحص لعرض مؤشّر تحميل بدل وميض شاشة الطلب.
 */
export function useResumeActiveRide(): boolean {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { restore } = useRide()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!profile?.id) {
      setChecking(false)
      return
    }
    let alive = true
    void getActiveCustomerRide(profile.id).then(async (ride) => {
      if (!alive) return
      if (ride) {
        restore(ride)
        navigate(
          ride.status === 'searching' || ride.status === 'requested' ? '/find-driver' : '/trip',
          { replace: true },
        )
        return
      }
      // لا رحلة جارية — لكن قد تكون رحلة اكتملت والتطبيق مغلق ولم تُقيَّم بعد.
      const toRate = await getPendingRateRide(profile.id)
      if (!alive) return
      if (toRate) {
        restore(toRate)
        navigate('/rate', { replace: true })
      } else {
        setChecking(false)
      }
    })
    return () => {
      alive = false
    }
  }, [profile?.id, navigate, restore])

  return checking
}
