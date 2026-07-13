package sd.qareeb.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * خدمة أمامية تُبقي عملية تطبيق الكابتن حيّة أثناء «متصل»، فيبقى اتصال Realtime
 * مستقبِلاً للطلبات حتى والتطبيق مصغّر أو الشاشة مقفلة. تتوقّف عند «غير متصل».
 * لا تحتاج Firebase. النوع specialUse (بلا حدّ زمني وبلا إذن موقع وقت التشغيل).
 */
public class KeepAliveService extends Service {
    public static final String CHANNEL_ID = "qareeb_online";
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = launch == null ? null : PendingIntent.getActivity(
            this, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("قريب كابتن — متصل")
            .setContentText("أنت متصل وتستقبل الطلبات")
            .setSmallIcon(getApplicationInfo().icon)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW);
        if (pi != null) b.setContentIntent(pi);

        try {
            ServiceCompat.startForeground(
                this, 1, b.build(),
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                    ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    : 0);
        } catch (Exception ignored) {
            // في حال رفض النظام النوع، تبقى الخدمة عاملة بلا انهيار.
        }

        acquireLock();
        return START_STICKY;
    }

    private void acquireLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "qareeb:captain-online");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire();
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "حالة الاتصال", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("يُبقي الكابتن متصلاً لاستقبال الطلبات");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
    }
}
