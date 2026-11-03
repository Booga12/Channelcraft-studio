// The start-up splash (#61): a small window of its own (static/splash.html) shows first, while the
// app window loads hidden. The app says when it's ready; the splash, once its animation has had
// its time, fades out and asks for the app window. If anything hangs, the app window shows anyway.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

/// Whether the app window has finished starting up, and whether it's been shown.
#[derive(Default)]
pub struct Splash {
    ready: AtomicBool,
    shown: AtomicBool,
}

#[derive(serde::Serialize)]
pub struct SplashState {
    version: String,
    ready: bool,
}

/// The app window has loaded (its start screen is ready).
#[tauri::command]
pub fn app_ready(splash: State<Splash>) {
    splash.ready.store(true, Ordering::SeqCst);
}

/// What the splash needs: the version to show, and whether the app is ready.
#[tauri::command]
pub fn splash_state(app: AppHandle, splash: State<Splash>) -> SplashState {
    SplashState { version: app.package_info().version.to_string(), ready: splash.ready.load(Ordering::SeqCst) }
}

/// The splash has faded out: show the app window and close the splash.
#[tauri::command]
pub fn splash_done(app: AppHandle) {
    show_app(&app);
}

/// Shows the app window (once) and closes the splash.
pub fn show_app(app: &AppHandle) {
    let splash = app.state::<Splash>();
    if splash.shown.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
    if let Some(w) = app.get_webview_window("splash") {
        let _ = w.close();
    }
}

/// Never stuck behind the splash: the app window shows after 20 seconds whatever happens.
pub fn start_fallback(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(20));
        show_app(&app);
    });
}
