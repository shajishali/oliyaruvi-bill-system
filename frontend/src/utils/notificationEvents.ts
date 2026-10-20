export function emitNotificationsChanged() {
  window.dispatchEvent(new Event('oliyaruvi-notifications-changed'));
}
