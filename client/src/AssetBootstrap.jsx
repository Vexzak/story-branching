import { useCallback, useEffect, useRef, useState } from 'react';
import App from './App.jsx';

// This name is shared with the service worker's CacheFirst media route so
// resources downloaded here are the same responses used by gameplay offline.
const ASSET_CACHE = 'story-assets-v1';
const STATE_CACHE = 'branching-story-download-state-v1';
const STATE_KEY = new URL('/__story_asset_download_state__', window.location.origin).href;

async function readDownloadState() {
  const cache = await caches.open(STATE_CACHE);
  const response = await cache.match(STATE_KEY);
  return response ? response.json() : null;
}

async function saveDownloadState(state) {
  const cache = await caches.open(STATE_CACHE);
  await cache.put(STATE_KEY, new Response(JSON.stringify(state), {
    headers: { 'Content-Type': 'application/json' },
  }));
}

function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' || /quota|storage is full/i.test(error?.message || '');
}

async function downloadStoryAssets(onProgress) {
  if (!('caches' in window)) throw new Error('This browser does not support offline storage. Open the app in a recent browser.');
  const response = await fetch('/api/stories/assets', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not get the story resource list. Check your connection and retry.');
  const { assets = [] } = await response.json();
  const uniqueAssets = [...new Set(assets)].filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.origin === window.location.origin || ['localhost', '127.0.0.1'].includes(parsed.hostname);
    } catch {
      return false;
    }
  });

  const cache = await caches.open(ASSET_CACHE);
  let needsDownload = false;
  for (const url of uniqueAssets) {
    if (!(await cache.match(url))) { needsDownload = true; break; }
  }
  if (needsDownload && navigator.storage?.estimate) {
    const { quota, usage } = await navigator.storage.estimate();
    if (quota && usage != null && quota - usage < 256 * 1024) {
      throw new Error('This device is low on storage space. Free up some space, then retry downloading the stories.');
    }
  }

  let complete = 0;
  const missing = [];
  const failures = [];
  onProgress({ complete, total: uniqueAssets.length, status: 'Getting your stories ready…' });
  let cursor = 0;

  async function worker() {
    while (cursor < uniqueAssets.length) {
      const url = uniqueAssets[cursor++];
      try {
        let saved = !!(await cache.match(url));
        if (!saved) {
          let lastError;
          for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
            try {
              const assetResponse = await fetch(url, { mode: 'cors', cache: 'no-cache' });
              if (assetResponse.status === 404 || assetResponse.status === 410) {
                missing.push(url);
                lastError = null;
                break;
              }
              if (!assetResponse.ok && assetResponse.type !== 'opaque') {
                throw new Error(`Download failed (${assetResponse.status})`);
              }
              await cache.put(url, assetResponse);
              saved = true;
            } catch (error) {
              lastError = error;
              if (isQuotaError(error)) throw error;
              if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
            }
          }
          if (!saved && lastError) throw lastError;
        }
        if (saved) complete += 1;
      } catch (error) {
        if (isQuotaError(error)) throw error;
        failures.push({ url, error });
      }
      onProgress({
        complete,
        total: uniqueAssets.length - missing.length,
        status: failures.length ? 'Retrying a story resource…' : 'Downloading story pictures and sounds…',
      });
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(3, uniqueAssets.length) }, worker));
  } catch (error) {
    if (isQuotaError(error)) {
      throw new Error('There is not enough space on this device to save all story resources. Free up storage and retry.');
    }
    throw error;
  }
  if (failures.length) {
    throw new Error(`${failures.length} ${failures.length === 1 ? 'resource could' : 'resources could'} not be downloaded. Check your connection and retry.`);
  }

  const available = new Set(uniqueAssets.filter((url) => !missing.includes(url)));
  for (const request of await cache.keys()) {
    if (!available.has(request.url)) await cache.delete(request);
  }
  const total = uniqueAssets.length - missing.length;
  await saveDownloadState({ version: 1, completedAt: new Date().toISOString(), count: total, missing: missing.length });
  onProgress({ complete, total, status: 'Your stories are ready!' });
}

function LoadingScreen({ progress, error, onRetry }) {
  const percent = progress.total ? Math.round((progress.complete / progress.total) * 100) : 0;
  return (
    <main className="asset-welcome kids-theme" aria-live="polite">
      <section className="asset-card">
        <div className="asset-brand-mark" aria-hidden="true">✦</div>
        <p className="asset-brand">ISIP-SANGAY</p>
        <h1>Inihahanda ang mga kuwento mo</h1>
        <p className="asset-description">Ihanda ngayon para handa na ang mga pakikipagsapalaran mo.</p>
        {!error ? (
          <>
            <p className="asset-status">{progress.status}</p>
            <div className="asset-progress-track" role="progressbar" aria-label="Story downloads" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}>
              <span className="asset-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="asset-progress-caption"><strong>{progress.total ? percent : progress.status === 'Your stories are ready!' ? 100 : 0}%</strong><span>{progress.complete} / {progress.total} assets saved</span></div>
            <p className="asset-footnote">Panatilihing bukas ang pahina habang sine-save ang mga kuwento sa device na ito.</p>
          </>
        ) : (
          <div className="asset-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn" onClick={onRetry}>Subukang i-download muli</button>
          </div>
        )}
      </section>
    </main>
  );
}

export default function AssetBootstrap() {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState({ complete: 0, total: 0, status: 'Connecting to your story library…' });
  const [error, setError] = useState('');
  const syncInFlight = useRef(false);

  const sync = useCallback(async ({ firstRun = false } = {}) => {
    // Focus/online events can fire together. Keep one inventory refresh active
    // so concurrent cache cleanup/downloads cannot race each other.
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setError('');
    try {
      await downloadStoryAssets(setProgress);
      if (firstRun) setReady(true);
    } catch (err) {
      if (firstRun) setError(err.message || 'Could not prepare story resources.');
      else console.warn('Story resource refresh failed; using saved resources where available:', err.message);
    } finally {
      syncInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const savedState = await readDownloadState();
        if (!active) return;
        if (savedState?.version === 1) {
          setReady(true);
          // Returning launches never wait for a network check. Refresh the
          // published inventory so new media is available to returning
          // students, including when an installed app has stayed open.
          sync();
        } else {
          await sync({ firstRun: true });
        }
      } catch (err) {
        if (active) setError(err.message || 'Offline storage is unavailable.');
      }
    })();
    return () => { active = false; };
  }, [sync]);

  useEffect(() => {
    if (!ready) return undefined;
    const refresh = () => {
      if (navigator.onLine && document.visibilityState === 'visible') sync();
    };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    // A student may leave the PWA open while an administrator publishes.
    // Periodically check for the new immutable media URLs in that case too.
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, [ready, sync]);

  const retry = () => sync({ firstRun: true });
  return ready ? <App /> : <LoadingScreen progress={progress} error={error} onRetry={retry} />;
}
