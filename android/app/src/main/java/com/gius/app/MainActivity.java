package com.gius.app;

/**
 * The app shell — identity only.
 *
 * <p>All of the behaviour lives in {@link ShellActivity}, which is byte-for-byte
 * identical in the organisation's four repos; this class supplies the three
 * values that differ. ⛔ אין להוסיף כאן לוגיקה (סבב 41) — התנהגות שנוספת
 * לאפליקציה אחת בלבד מחזירה בדיוק את ארבעת העותקים החופשיים שהחילוץ החליף;
 * מה שנחוץ לכולן נכנס ל-`ShellActivity`, ומה שנחוץ לאחת עובר דרך
 * `installBridge()`/`onShellNavigation()` ונרשם כחריגה מנומקת.
 *
 * <p>אין כאן גשר מקורי: בקוד של האפליקציה הזו אין `navigator.share`.
 */public class MainActivity extends ShellActivity {

    @Override
    protected String appUrl() { return "https://ygtotlrl-lab.github.io/gius/"; }

    @Override
    protected String offlineLine() { return "גיוס לא הצליח להתחבר."; }

    @Override
    protected String accentColor() { return "#0f766e"; }
}
