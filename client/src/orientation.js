export function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export async function lockLandscape() {
  if (typeof screen === 'undefined') return false;

  if (screen.orientation?.lock) {
    try {
      await screen.orientation.lock('landscape-primary');
      return true;
    } catch {
      try {
        await screen.orientation.lock('landscape');
        return true;
      } catch {
        // Try older browser implementations below before reporting unsupported.
      }
    }
  }

  const legacyLock = screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation;
  if (legacyLock) {
    return Boolean(
      legacyLock.call(screen, 'landscape-primary')
      || legacyLock.call(screen, 'landscape')
    );
  }

  return false;
}
