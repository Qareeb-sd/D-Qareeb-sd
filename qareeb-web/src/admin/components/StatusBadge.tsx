type StatusType =
  | 'completed'
  | 'pending'
  | 'cancelled'
  | 'in_progress'
  | 'accepted'
  | 'online'
  | 'offline'
  | 'approved'
  | 'rejected'
  | 'forming'
  | 'dispatched'
  | 'active'

const statusStyles: Record<StatusType, { bg: string; text: string; label: string }> = {
  completed:   { bg: '#E8F1EC', text: '#1B6B3F', label: 'مكتملة' },
  pending:     { bg: '#FBF4DD', text: '#A88528', label: 'معلّقة' },
  cancelled:   { bg: '#FDECEB', text: '#C5453B', label: 'ملغاة' },
  in_progress: { bg: '#E3EEF7', text: '#3A6FB0', label: 'جارية' },
  accepted:    { bg: '#E8F1EC', text: '#1B6B3F', label: 'مقبولة' },
  online:      { bg: '#E8F1EC', text: '#1B6B3F', label: 'متصل' },
  offline:     { bg: '#F0F0EE', text: '#8B9189', label: 'غير متصل' },
  approved:    { bg: '#E8F1EC', text: '#1B6B3F', label: 'معتمد' },
  rejected:    { bg: '#FDECEB', text: '#C5453B', label: 'مرفوض' },
  forming:     { bg: '#FBF4DD', text: '#A88528', label: 'تكوين' },
  dispatched:  { bg: '#E3EEF7', text: '#3A6FB0', label: 'مرسل' },
  active:      { bg: '#E8F1EC', text: '#1B6B3F', label: 'نشط' },
}

interface StatusBadgeProps {
  status: StatusType | string
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const s = statusStyles[status as StatusType] || {
    bg: '#F0F0EE',
    text: '#8B9189',
    label: status,
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}
