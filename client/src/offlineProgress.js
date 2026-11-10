import { supabase } from './supabase';
import { apiFetch } from './api';

const CACHE_NAME = 'branching-story-offline-progress-v1';
const PROGRESS_VERSION = 1;

function progressKey(userId, storyId) {
  const key = new URL('/__offline_story_progress__', window.location.origin);
  key.searchParams.set('user', userId);
  key.searchParams.set('story', storyId);
  return key.href;
}

export async function getStudentId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user?.id ?? null;
}

export async function loadOfflineProgress(userId, storyId) {
  if (!userId || !('caches' in window)) return null;
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(progressKey(userId, storyId));
  if (!response) return null;

  const progress = await response.json();
  if (progress.version !== PROGRESS_VERSION || progress.userId !== userId || progress.storyId !== storyId) {
    return null;
  }
  return progress;
}

export async function saveOfflineProgress(progress) {
  if (!('caches' in window)) throw new Error('Hindi masuportahan ng browser na ito ang offline progress saving.');
  const cache = await caches.open(CACHE_NAME);
  await cache.put(progressKey(progress.userId, progress.storyId), new Response(JSON.stringify({
    ...progress,
    version: PROGRESS_VERSION,
    updatedAt: new Date().toISOString(),
  }), {
    headers: { 'Content-Type': 'application/json' },
  }));
}

export async function syncOfflineProgress(userId, storyId) {
  let progress = await loadOfflineProgress(userId, storyId);
  if (!progress || (!progress.actions?.length && !progress.restart)) return null;

  let game;
  if (progress.serverSessionId && !progress.restart) {
    game = await apiFetch(`/sessions/${progress.serverSessionId}`);
  } else {
    game = await apiFetch('/sessions', {
      method: 'POST',
      body: { storyId, restart: progress.restart === true },
    });
    progress = { ...progress, serverSessionId: game.session.id, restart: false };
    await saveOfflineProgress(progress);
  }

  while (progress.actions.length) {
    const action = progress.actions[0];
    game = await apiFetch(`/sessions/${game.session.id}/choices`, {
      method: 'POST',
      body: {
        choiceId: action.choiceId,
        clientActionId: action.id,
        expectedSceneId: action.sceneId,
      },
    });
    progress = {
      ...progress,
      actions: progress.actions.slice(1),
      currentSceneId: game.session.current_scene_id,
      status: game.session.status,
    };
    await saveOfflineProgress(progress);
  }

  progress = {
    ...progress,
    baseSceneId: game.session.current_scene_id,
    currentSceneId: game.session.current_scene_id,
    status: game.session.status,
    restart: false,
  };
  await saveOfflineProgress(progress);
  return game;
}
