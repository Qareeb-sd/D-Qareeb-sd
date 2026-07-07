/** أدوات تنسيق عربية للأرقام والعملة. */

const nf = new Intl.NumberFormat('ar-SD')

/** تنسيق رقم بالفواصل العربية. */
export const num = (n: number) => nf.format(n)

/** تنسيق مبلغ بالجنيه السوداني. */
export const money = (n: number) => `${nf.format(Math.round(n))} ج.س`

/** تنسيق مسافة بالكيلومتر. */
export const km = (n: number) => `${nf.format(Math.round(n * 10) / 10)} كم`
