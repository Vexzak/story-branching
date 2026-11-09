// Thin fetch wrapper for the Express API. Automatically attaches the current
// Supabase access token and normalizes error handling.
import { supabase } from './supabase';

export async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers: extraHeaders,
    signal,
  } = options;

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const headers = { ...(extraHeaders || {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const offlineCacheable = method === 'GET' && ['/me', '/stories', '/stories/offline-pack'].includes(path);
  let cacheKey = null;
  if (offlineCacheable && 'caches' in window) {
    const userId = data?.session?.user?.id || 'signed-out';
    const keyUrl = new URL(`/api${path}`, window.location.origin);
    keyUrl.searchParams.set('__offline_user', userId);
    cacheKey = keyUrl.href;
  }

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    if (cacheKey) {
      const cache = await caches.open('branching-story-api-v1');
      const cached = await cache.match(cacheKey);
      if (cached) return cached.json();
    }
    throw networkError;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = payload?.details;
    throw error;
  }

  if (cacheKey) {
    if (payload) {
      try {
        const cache = await caches.open('branching-story-api-v1');
        await cache.put(cacheKey, new Response(JSON.stringify(payload), {
          headers: { 'Content-Type': 'application/json' },
        }));
      } catch (error) {
        console.warn('Could not save offline story data:', error.message);
      }
    }
  }

  return payload;
}
