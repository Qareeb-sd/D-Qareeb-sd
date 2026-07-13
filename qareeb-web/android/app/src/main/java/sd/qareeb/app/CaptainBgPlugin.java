package sd.qareeb.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * جسر Capacitor لتشغيل/إيقاف الخدمة الأمامية وإطلاق إشعار «طلب جديد» أصلي
 * (صوت + اهتزاز + يظهر على شاشة القفل). كل ذلك بلا Firebase.
 */
@CapacitorPlugin(
    name = "CaptainBg",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
        @Permission(alias = "location", strings = {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        })
    }
)
public class CaptainBgPlugin extends Plugin {
    static final String RIDE_CHANNEL = "qareeb_rides";
    static final long[] VIBRATE = new long[] { 0, 400, 200, 400 };

    @Override
    public void load() {
        createRideChannel();
    }

    /** تشغيل الخدمة الأمامية (عند «متصل»). */
    @PluginMethod
    public void start(PluginCall call) {
        Intent i = new Intent(getContext(), KeepAliveService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(i);
        } else {
            getContext().startService(i);
        }
        call.resolve();
    }

    /** إيقاف الخدمة (عند «غير متصل»). */
    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), KeepAliveService.class));
        call.resolve();
    }

    /** إشعار طلب رحلة جديد — صوت + اهتزاز + أولوية عالية. */
    @PluginMethod
    public void notifyRide(PluginCall call) {
        String title = call.getString("title", "طلب رحلة جديد");
        String body = call.getString("body", "يوجد راكب قريب منك — افتح قريب للقبول");

        NotificationCompat.Builder b = new NotificationCompat.Builder(getContext(), RIDE_CHANNEL)
            .setSmallIcon(getContext().getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(VIBRATE)
            .setAutoCancel(true);

        Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
        if (launch != null) {
            PendingIntent pi = PendingIntent.getActivity(
                getContext(), 2, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            b.setContentIntent(pi);
        }

        try {
            NotificationManagerCompat.from(getContext()).notify(1001, b.build());
        } catch (SecurityException ignored) {
            // إذن الإشعارات مرفوض — نتجاهل بلا انهيار.
        }
        call.resolve();
    }

    /** طلب إذن الإشعارات (Android 13+). */
    @PluginMethod
    public void requestNotif(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notifCallback");
        } else {
            call.resolve();
        }
    }

    @PermissionCallback
    private void notifCallback(PluginCall call) {
        call.resolve();
    }

    /** طلب إذن الموقع وقت التشغيل (لعمل تتبّع الموقع في WebView). */
    @PluginMethod
    public void requestLocation(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationCallback");
        } else {
            call.resolve();
        }
    }

    @PermissionCallback
    private void locationCallback(PluginCall call) {
        call.resolve();
    }

    private void createRideChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(
                RIDE_CHANNEL, "طلبات الرحلات", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("تنبيه عند وصول طلب رحلة جديد");
            ch.enableVibration(true);
            ch.setVibrationPattern(VIBRATE);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
    }
}
