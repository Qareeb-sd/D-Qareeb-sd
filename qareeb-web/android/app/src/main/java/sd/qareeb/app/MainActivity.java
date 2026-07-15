package sd.qareeb.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // إضافة أصلية للكابتن: خدمة أمامية + إشعارات الطلبات (بلا Firebase).
        registerPlugin(CaptainBgPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
