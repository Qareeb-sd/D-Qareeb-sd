/** أدوات تنسيق عربية للأرقام والعملة. */

const nf = new Intl.NumberFormat('ar-SD')

/** تنسيق رقم بالفواصل العربية. */
export const num = (n: number) => nf.format(n)

/** تنسيق مبلغ بالجنيه السوداني. */
export const money = (n: number) => `${nf.format(Math.round(n))} ج.س`

/** تنسيق مسافة بالكيلومتر. */
export const km = (n: number) => `${nf.format(Math.round(n * 10) / 10)} كم`

/** تنسيق زمن بالدقائق. */
export const mins = (n: number) => `${nf.format(Math.max(1, Math.round(n)))} دقيقة`

/** رمز عضوية العميل/السائق: C/D + الرقم كما هو (C1، C2 … D1، D2 …). */
export const memberCode = (role: string | null | undefined, no: number | null | undefined) =>
  no == null ? '' : `${role === 'driver' ? 'D' : 'C'}${no}`
