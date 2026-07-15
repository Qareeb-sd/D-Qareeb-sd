/**
 * إدارة شفافية الـWebView عند استخدام خريطة قوقل الأصلية (Native).
 *
 * المكوّن الأصلي @capacitor/google-maps يضع الخريطة **خلف** الـWebView ويجعل
 * خلفيّة الـWebView شفّافة، فتظهر الخريطة من خلف أي عنصر بلا خلفيّة. لذلك:
 *  - نضيف الصنف `native-map-open` على <html> طالما هناك خريطة واحدة على الأقل حيّة،
 *    وهو يجعل خلفيّة body/#root شفّافة (انظر index.css) حتى تُرى الخريطة.
 *  - عدّاد مرجعي حتى لا نُزيل الشفافية إن كانت أكثر من خريطة حيّة (نادر لكنه آمن).
 */
let liveMaps = 0

export function acquireMapTransparency() {
  liveMaps += 1
  if (liveMaps === 1) document.documentElement.classList.add('native-map-open')
}

export function releaseMapTransparency() {
  liveMaps = Math.max(0, liveMaps - 1)
  if (liveMaps === 0) document.documentElement.classList.remove('native-map-open')
}
