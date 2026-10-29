import { isTauriRuntime } from "@/lib/tauri";

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (isTauriRuntime()) {
      const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === "granted";
      }
      return granted;
    }
    if ("Notification" in window) {
      if (Notification.permission === "granted") return true;
      const perm = await Notification.requestPermission();
      return perm === "granted";
    }
  } catch {
    // ignore
  }
  return false;
}

export async function sendNotification(title: string, body: string): Promise<void> {
  try {
    if (isTauriRuntime()) {
      const { sendNotification: tauriNotify } = await import("@tauri-apps/plugin-notification");
      await tauriNotify({ title, body });
      return;
    }
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    // ignore
  }
}
