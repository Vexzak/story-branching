export function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export async function lockLandscape() {
  if (!screen.orientation?.lock) return false;
  await screen.orientation.lock('landscape');
  return true;
}
