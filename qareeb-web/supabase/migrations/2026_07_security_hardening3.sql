-- ============================================================
--  تحصين أمني — الجولة الثالثة (سياسات RLS المتبقّية).
--  شغّل هذا المقطع مرّة واحدة في Supabase SQL Editor.
--
--  الجذر المشترك: سياسات «FOR ALL» أو «with check» غير مقيّدة بالأعمدة كانت
--  تسمح بالكتابة المباشرة والالتفاف حول الدوال الآمنة. العميل لا يكتب مباشرةً
--  إلا أعمدة محدّدة — لذا القيد أدناه لا يكسر التطبيق (تُحقّق من كل مسار).
-- ============================================================

-- ── ١) [حرج] users: العميل كان يزوّر نقاط الولاء نقداً ويسجّل نفسه أدمن ──
--    مُطلِق prevent_role_change يمنع تغيير role بالـUPDATE فقط، لا الإدراج ولا
--    بقية الأعمدة (loyalty_points كان قابلاً للكتابة الذاتية ثم يُستبدل نقداً).
--    نحصر الكتابة على مستوى الأعمدة: الإدراج بدور «customer» فقط، والتعديل
--    على حقول الملف الشخصي فقط. الدوال الآمنة تعمل كمالك فتتجاوز هذا القيد.
drop policy if exists "own profile" on public.users;
create policy "read own profile"   on public.users for select using (auth.uid() = id);
create policy "insert own profile" on public.users for insert to authenticated
  with check (auth.uid() = id and role = 'customer');
create policy "update own profile" on public.users for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

revoke insert, update on public.users from authenticated;
grant  select on public.users to authenticated;
grant  insert (id, phone, full_name, birthdate, role) on public.users to authenticated;
grant  update (full_name, birthdate, sos_contact1, sos_contact2) on public.users to authenticated;

-- ── ٢) [حرج] rides: سياسة «قبول السائق» كانت تتيح لأي مستخدم تعديل رحلة ──
--    مفتوحة وإعادة كتابة أجرتها (ثم تُخصم من محفظة العميل عند التسوية).
--    القبول يتمّ عبر accept_ride (دالة آمنة)، فلا حاجة للسياسة إطلاقاً.
drop policy if exists "driver accept ride" on public.rides;

-- ── ٣) [عالٍ] rides: سياسة «رؤية الطلبات المفتوحة» كانت تكشف موقع الالتقاط ──
--    والعميل والأجرة لكل مستخدم مصادَق (+ بثّ Realtime). السائقون يحصلون على
--    الطلبات عبر list_available_rides (دالة آمنة)، فلا حاجة للسياسة الواسعة.
drop policy if exists "drivers see open rides" on public.rides;

-- ── ٤) [عالٍ] driver_applications: المتقدّم كان يعتمد طلبه بنفسه أو يزوّر ──
--    المراجِع ويفسد طابور المراجعة. يبقى الإنشاء «قيد المراجعة» والقراءة فقط؛
--    الاعتماد/الرفض عبر الدوال الآمنة.
drop policy if exists "own driver application" on public.driver_applications;
create policy "read own driver application" on public.driver_applications
  for select using (auth.uid() = user_id);
create policy "create own driver application" on public.driver_applications
  for insert to authenticated with check (auth.uid() = user_id and status = 'pending');

-- ── ٥) [متوسّط] commute_orders: منع انتحال منظّم آخر عند الإنشاء، وتقييد ──
--    قبول السائق ليكون الانتقال dispatched→active فقط (لا العبث بالوجهة/الوقت).
drop policy if exists "create commute orders" on public.commute_orders;
create policy "create commute orders" on public.commute_orders
  for insert to authenticated with check (auth.uid() = organizer_id);

drop policy if exists "driver accept commute" on public.commute_orders;
create policy "driver accept commute" on public.commute_orders
  for update using (status = 'dispatched')
  with check (auth.uid() = driver_id and status = 'active');
