import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api';
import {
  getStudentId,
  loadOfflineProgress,
  saveOfflineProgress,
  syncOfflineProgress,
} from '../offlineProgress';
import { lockLandscape } from '../orientation';

/*
 * Scenes with saved characters/objects are drawn inside a 16:9 frame that always
 * covers the screen (like background-size: cover). The background and every
 * object live in that same frame and use percentages, so the composition looks
 * the same on phones, tablets and desktops. Scenes without objects keep the
 * original full-screen background exactly as before.
 */
const ART_CSS = `
.vn-art { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.vn-art-frame {
  position: absolute; left: 50%; top: 50%;
  width: max(100vw, calc(100vh * 16 / 9)); aspect-ratio: 16 / 9;
  transform: translate(-50%, -50%);
  background-size: cover; background-position: center; background-repeat: no-repeat;
}
.vn-art-obj { position: absolute; max-width: none; user-select: none; -webkit-user-drag: none; }
@keyframes vn-fade { from { opacity: 0 } to { opacity: var(--vn-opacity, 1) } }
@keyframes vn-left { from { opacity: 0; translate: -45vw 0 } to { opacity: var(--vn-opacity, 1); translate: 0 0 } }
@keyframes vn-right { from { opacity: 0; translate: 45vw 0 } to { opacity: var(--vn-opacity, 1); translate: 0 0 } }
@keyframes vn-top { from { opacity: 0; translate: 0 -45vh } to { opacity: var(--vn-opacity, 1); translate: 0 0 } }
@keyframes vn-bottom { from { opacity: 0; translate: 0 45vh } to { opacity: var(--vn-opacity, 1); translate: 0 0 } }
@keyframes vn-zoom { from { opacity: 0; scale: .2 } to { opacity: var(--vn-opacity, 1); scale: 1 } }
@keyframes vn-bounce { 0% { opacity: 0; scale: .3 } 55% { opacity: 1; scale: 1.12 } 75% { scale: .92 } 100% { opacity: var(--vn-opacity, 1); scale: 1 } }
`;

const INTRO_ANIMATIONS = { fade: 'vn-fade', left: 'vn-left', right: 'vn-right', top: 'vn-top', bottom: 'vn-bottom', zoom: 'vn-zoom', bounce: 'vn-bounce' };

function RotatePrompt() {
  const [lockMessage, setLockMessage] = useState('');
  const requestLandscape = async () => {
    try {
      const locked = await lockLandscape();
      if (!locked) setLockMessage('Hindi sinusuportahan ng browser na ito ang awtomatikong pag-landscape. Itagilid ang telepono.');
    } catch {
      setLockMessage('Hindi ma-lock ng browser ang orientation. Itagilid ang telepono o tingnan ang auto-rotate setting.');
    }
  };

  return (
    <div className="vn-rotate-overlay" role="status" aria-live="polite">
      <div className="vn-rotate-card">
        <span className="vn-rotate-icon" aria-hidden="true">↻</span>
        <h2>Itagilid ang telepono para sa kuwento</h2>
        <p>Susubukan ng app na ilipat ang screen sa landscape. Kung hindi ito suportado, itagilid ang telepono nang pahiga.</p>
        <button type="button" className="vn-rotate-button" onClick={requestLandscape}>Subukang i-landscape</button>
        {lockMessage && <p className="vn-rotate-help">{lockMessage}</p>}
      </div>
    </div>
  );
}

function SceneArt({ bg, objects }) {
  return (
    <div className="vn-art" aria-hidden="true">
      <div className="vn-art-frame" style={bg ? { backgroundImage: `url("${bg}")` } : undefined}>
        {objects.map((o) => (
          <img
            key={o.id}
            className="vn-art-obj"
            src={o.src}
            alt=""
            draggable={false}
            style={{
              left: `${o.x * 100}%`,
              top: `${o.y * 100}%`,
              width: `${o.w * 100}%`,
              height: `${o.h * 100}%`,
              opacity: o.opacity ?? 1,
              transform: `translate(-50%, -50%) rotate(${o.rotation || 0}deg) scale(${o.flipX ? -1 : 1}, ${o.flipY ? -1 : 1})`,
              '--vn-opacity': o.opacity ?? 1,
              animation: INTRO_ANIMATIONS[o.intro] ? `${INTRO_ANIMATIONS[o.intro]} ${o.duration ?? 0.6}s ${o.delay ?? 0}s both` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

const objectsOf = (scene) =>
  Array.isArray(scene?.character_config?.objects) ? scene.character_config.objects : [];

function localScene(content, sceneId) {
  return sceneId && content?.scenes?.[sceneId] ? content.scenes[sceneId] : null;
}

function localGame(pack, storyId, progress = null, fallbackSceneId = null) {
  const savedStory = pack?.stories?.find((story) => story.id === storyId);
  if (savedStory && savedStory.unlocked === false) return null;
  const content = savedStory?.content;
  const scene = localScene(
    content,
    progress?.currentSceneId || fallbackSceneId || content?.starting_scene_id
  );
  if (!savedStory || !scene) return null;
  return {
    offline: true,
    content,
    offlineProgress: progress,
    session: {
      id: progress?.serverSessionId || `offline-${storyId}`,
      story_id: storyId,
      current_scene_id: scene.id,
      status: progress?.status || 'in_progress',
    },
    story: content.story,
    scene,
  };
}

function isNetworkError(error) {
  return !navigator.onLine || error instanceof TypeError;
}

function makeOfflineProgress(userId, storyId, sceneId, serverSessionId = null, previous = null) {
  return {
    version: 1,
    userId,
    storyId,
    baseSceneId: previous?.actions?.length ? previous.baseSceneId : sceneId,
    currentSceneId: sceneId,
    status: 'in_progress',
    serverSessionId: serverSessionId || previous?.serverSessionId || null,
    restart: previous?.restart === true,
    actions: previous?.actions || [],
  };
}

function advanceOfflineGame(game, actionId, choiceId) {
  const choice = game.scene.choices?.find((item) => item.id === choiceId);
  if (!choice) throw new Error('Hindi makita ang sagot na iyon sa naka-save na kuwento.');

  const progress = {
    ...game.offlineProgress,
    actions: [...game.offlineProgress.actions, {
      id: actionId,
      choiceId,
      sceneId: game.scene.id,
    }],
  };
  const isCorrect = game.scene.scene_type !== 'decision' || !!choice.is_correct;
  if (!isCorrect) {
    return {
      game: { ...game, offlineProgress: progress },
      progress,
      failure: {
        scene: localScene(game.content, choice.failure_scene_id),
        feedback: choice.feedback,
      },
      note: '',
    };
  }

  const nextScene = localScene(game.content, choice.destination_scene_id);
  if (!nextScene) throw new Error('Wala ang susunod na eksena sa naka-save na kuwento.');
  const status = nextScene.scene_type === 'ending' ? 'completed' : 'in_progress';
  progress.currentSceneId = nextScene.id;
  progress.status = status;
  return {
    game: {
      ...game,
      scene: nextScene,
      offlineProgress: progress,
      session: { ...game.session, current_scene_id: nextScene.id, status },
    },
    progress,
    failure: null,
    note: choice.feedback || '',
  };
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function paginateStoryText(text, limit = 1100) {
  const paragraphs = (text ?? '').trim().split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  if (!paragraphs.length) return [];
  const pages = [];
  let page = '';
  for (const paragraph of paragraphs) {
    for (const word of paragraph.split(/\s+/)) {
      const next = page ? `${page} ${word}` : word;
      if (next.length > limit && page) {
        pages.push(page.trim());
        page = word;
      } else {
        page = next;
      }
    }
    page = `${page}\n\n`;
  }
  if (page.trim()) pages.push(page.trim());
  return pages;
}

function BookButton({ onClick, highlighted = false }) {
  return (
    <button
      type="button"
      className={`vn-book-button${highlighted ? ' vn-book-button-highlight' : ''}`}
      aria-label="Basahin ang buong istorya"
      title="Basahin ang buong istorya"
      onClick={onClick}
    >
      <img src="/images/Book.png" alt="" />
    </button>
  );
}

function BookModal({ story, pages, page, setPage, onClose }) {
  return (
    <div className="vn-book-scrim" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="vn-book-modal" role="dialog" aria-modal="true" aria-labelledby="vn-book-title">
        <div className="vn-book-header">
          <div>
            <h2 id="vn-book-title">{story?.title}</h2>
            {story?.author && <p>Akda ni {story.author}</p>}
          </div>
          <button type="button" className="vn-book-close" onClick={onClose} aria-label="Isara ang aklat">Isara</button>
        </div>
        <article className="vn-book-page" key={page}>
          {pages.length ? pages[page] : 'Wala pang tekstong nailalagay para sa istoryang ito.'}
        </article>
        {pages.length > 0 && (
          <div className="vn-book-controls">
            <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>Nakaraan</button>
            <span>Pahina {page + 1} sa {pages.length}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(pages.length - 1, current + 1))} disabled={page === pages.length - 1}>Susunod</button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function StoryPlayer() {
  const { storyId } = useParams();
  const [game, setGame] = useState(null); // { session, story, scene }
  const [entry, setEntry] = useState(null);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookPage, setBookPage] = useState(0);
  const [failure, setFailure] = useState(null); // { scene, feedback }
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [syncWarning, setSyncWarning] = useState('');
  const [showChoices, setShowChoices] = useState(false);
  const choiceOrders = useRef(new Map());
  const syncingOfflineProgress = useRef(false);
  const audioRef = useRef(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const orderChoices = useCallback((data) => {
    if (!data?.session?.id || !data.scene?.id || !Array.isArray(data.scene.choices)) return data;
    let sceneOrders = choiceOrders.current.get(data.session.id);
    if (!sceneOrders) {
      sceneOrders = new Map();
      choiceOrders.current.set(data.session.id, sceneOrders);
    }
    let order = sceneOrders.get(data.scene.id);
    if (!order) {
      order = shuffle(data.scene.choices).map((choice) => choice.id);
      sceneOrders.set(data.scene.id, order);
    }
    const choicesById = new Map(data.scene.choices.map((choice) => [choice.id, choice]));
    return {
      ...data,
      scene: { ...data.scene, choices: order.map((id) => choicesById.get(id)).filter(Boolean) },
    };
  }, []);

  const start = useCallback(
    async (restart = false) => {
      setLoading(true);
      setShowChoices(false);
      setError('');
      setFailure(null);
      setNote('');
      try {
        const userId = await getStudentId();
        if (userId) {
          const pending = await loadOfflineProgress(userId, storyId);
          if (pending?.actions?.length || pending?.restart) {
            const syncedGame = await syncOfflineProgress(userId, storyId);
            if (!restart) {
              setGame(orderChoices(syncedGame));
              setSyncWarning('');
              return;
            }
          }
        }
        const response = await apiFetch('/sessions', {
          method: 'POST',
          body: { storyId, restart },
        });
        const data = orderChoices(response);
        if (userId) {
          try {
            const previous = await loadOfflineProgress(userId, storyId);
            if (previous?.actions?.length) {
              throw new Error('Pending offline actions must sync before making a new server checkpoint.');
            }
            await saveOfflineProgress(makeOfflineProgress(
              userId,
              storyId,
              data.session.current_scene_id,
              data.session.id,
              restart ? null : previous
            ));
          } catch (cacheError) {
            console.warn('Could not save an offline story checkpoint:', cacheError.message);
            setNote('Hindi mai-save ang offline progress sa device na ito.');
          }
        }
        setGame(data);
      } catch (err) {
        try {
          const savedPack = await apiFetch('/stories/offline-pack');
          const userId = await getStudentId();
          if (!userId) throw err;
          let progress = await loadOfflineProgress(userId, storyId);
          if (restart) {
            if (progress?.actions?.length) {
              throw new Error('May offline progress na hindi pa nasasabay. Ikonekta muna sa internet bago magsimula muli.');
            }
            const firstSceneId = entry?.firstScene?.id || savedPack?.stories
              ?.find((story) => story.id === storyId)?.content?.starting_scene_id;
            progress = firstSceneId
              ? { ...makeOfflineProgress(userId, storyId, firstSceneId), restart: true }
              : null;
          } else if (!progress) {
            const baseSceneId = entry?.savedGame?.session?.current_scene_id || entry?.firstScene?.id;
            if (baseSceneId) {
              progress = makeOfflineProgress(
                userId,
                storyId,
                baseSceneId,
                entry?.savedGame?.session?.id || null
              );
            }
          }
          const savedGame = localGame(savedPack, storyId, progress, entry?.firstScene?.id);
          if (!savedGame) throw new Error('Hindi na-save ang kuwentong ito para laruin offline sa device na ito.');
          await saveOfflineProgress(progress);
          setGame(orderChoices(savedGame));
          setNote('Offline na laro · naka-save sa device ang progress at awtomatikong susubukang i-sync kapag may internet.');
        } catch (offlineError) {
          setError(offlineError.message || err.message);
        }
      } finally {
        setLoading(false);
      }
    },
    [storyId, orderChoices, entry]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setGame(null);
    setEntry(null);
    setError('');
    setSyncWarning('');
    setBookOpen(false);
    setBookPage(0);
    (async () => {
      try {
        const userId = await getStudentId();
        let progress = userId ? await loadOfflineProgress(userId, storyId) : null;
        let progressSyncFailed = false;
        if ((progress?.actions?.length || progress?.restart) && navigator.onLine) {
          try {
            await syncOfflineProgress(userId, storyId);
            progress = await loadOfflineProgress(userId, storyId);
            setSyncWarning('');
          } catch (syncError) {
            progressSyncFailed = true;
            if (active) setSyncWarning(syncError.message || 'May offline progress na hindi pa nasasabay.');
          }
        }
        let data = await apiFetch(`/sessions/entry/${storyId}`);
        if (progress && (progress.actions?.length || !navigator.onLine || progressSyncFailed)) {
          const pack = await apiFetch('/stories/offline-pack');
          const savedGame = localGame(pack, storyId, progress);
          if (savedGame) data = { ...data, savedGame };
        }
        if (!active) return;
        setEntry(data);
        if (!data.tutorialSeen) {
          setTutorialVisible(true);
          apiFetch('/me/book-tutorial', { method: 'PATCH' }).catch((err) => {
            console.warn('Hindi ma-save ang estado ng gabay sa aklat:', err.message);
          });
        } else {
          setTutorialVisible(false);
        }
      } catch (err) {
        try {
          const pack = await apiFetch('/stories/offline-pack');
          const savedStory = pack?.stories?.find((item) => item.id === storyId);
          const content = savedStory?.content;
          const firstScene = localScene(content, content?.starting_scene_id);
          if (savedStory?.unlocked === false) throw new Error('Hindi pa bukas ang istoryang ito.');
          if (!savedStory || !firstScene) throw err;
          const userId = await getStudentId();
          const progress = userId ? await loadOfflineProgress(userId, storyId) : null;
          const savedGame = progress?.currentSceneId
            ? localGame(pack, storyId, progress, firstScene.id)
            : null;
          if (active) {
            setEntry({
              story: content.story,
              firstScene,
              savedGame,
              tutorialSeen: true,
              offline: true,
            });
            setTutorialVisible(false);
          }
        } catch (offlineError) {
          if (active) setError(offlineError.message || err.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [storyId]);

  useEffect(() => {
    if (!game?.offline) return undefined;
    let active = true;

    const attemptSync = async () => {
      if (!navigator.onLine || syncingOfflineProgress.current) return;
      syncingOfflineProgress.current = true;
      setBusy(true);
      try {
        const userId = await getStudentId();
        if (!userId) throw new Error('Mag-log in muli para ma-sync ang offline progress.');
        const syncedGame = await syncOfflineProgress(userId, storyId);
        if (active && syncedGame) {
          setGame(orderChoices(syncedGame));
          setFailure(null);
          setNote('Matagumpay na na-sync ang offline progress.');
          setSyncWarning('');
        }
      } catch (syncError) {
        if (active) {
          const message = syncError.message || 'Hindi pa na-sync ang offline progress.';
          setSyncWarning(message);
          setNote(`Nananatiling naka-save sa device ang progress. ${message}`);
        }
      } finally {
        syncingOfflineProgress.current = false;
        if (active) setBusy(false);
      }
    };

    const onConnectionChange = () => { attemptSync(); };
    window.addEventListener('online', onConnectionChange);
    window.addEventListener('focus', onConnectionChange);
    document.addEventListener('visibilitychange', onConnectionChange);
    if ((game.offlineProgress?.actions?.length || game.offlineProgress?.restart) && navigator.onLine) attemptSync();

    return () => {
      active = false;
      window.removeEventListener('online', onConnectionChange);
      window.removeEventListener('focus', onConnectionChange);
      document.removeEventListener('visibilitychange', onConnectionChange);
    };
  }, [game?.offline, game?.offlineProgress?.actions?.length, storyId, orderChoices]);

  const activeSceneId = game?.scene?.id;
  const activeAudioUrl = game?.scene?.sound_effect_path;
  useEffect(() => {
    const audio = audioRef.current;
    setAudioBlocked(false);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    if (activeAudioUrl) audio.src = activeAudioUrl;
    else audio.removeAttribute('src');
    audio.load();
    if (!activeAudioUrl) return;
    const playback = audio.play();
    if (playback?.catch) playback.catch(() => setAudioBlocked(true));
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [activeSceneId, activeAudioUrl, loading, !!failure]);

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, []);

  const enableSceneAudio = () => {
    const audio = audioRef.current;
    if (!audio || !activeAudioUrl) return;
    audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  };

  async function choose(choiceId) {
    if (busy || !game) return;
    setBusy(true);
    setError('');
    const actionId = game.offline ? null : crypto.randomUUID();
    try {
      if (game.offline) {
        const action = advanceOfflineGame(game, crypto.randomUUID(), choiceId);
        await saveOfflineProgress(action.progress);
        setShowChoices(false);
        setGame(action.game);
        setFailure(action.failure);
        setNote(action.note);
        return;
      }
      const data = await apiFetch(`/sessions/${game.session.id}/choices`, {
        method: 'POST',
        body: { choiceId, clientActionId: actionId, expectedSceneId: game.scene.id },
      });
      const { result, ...next } = data;
      const userId = await getStudentId();
      if (userId) {
        try {
          const previous = await loadOfflineProgress(userId, storyId);
          if (!previous?.actions?.length) {
            await saveOfflineProgress(makeOfflineProgress(
              userId,
              storyId,
              next.session.current_scene_id,
              next.session.id
            ));
          }
        } catch (cacheError) {
          console.warn('Could not save an offline story checkpoint:', cacheError.message);
          setSyncWarning('Hindi mai-save ang offline checkpoint sa device na ito.');
        }
      }
      // Every newly loaded scene starts with its narration. A failure overlay
      // remains on the current question and can be retried without losing it.
      setShowChoices(false);
      setGame(orderChoices(next));
      if (result.correct === false) {
        setFailure({ scene: result.failure_scene, feedback: result.feedback });
        setNote('');
      } else {
        setFailure(null);
        setNote(result.feedback || '');
        setShowChoices(false);
      }
    } catch (err) {
      if (!game.offline && isNetworkError(err)) {
        try {
          const userId = await getStudentId();
          if (!userId) throw err;
          const pack = await apiFetch('/stories/offline-pack');
          const previous = await loadOfflineProgress(userId, storyId);
          const progress = {
            ...makeOfflineProgress(userId, storyId, game.scene.id, game.session.id, previous),
            actions: [
              ...(previous?.actions || []),
              { id: actionId, choiceId, sceneId: game.scene.id },
            ],
          };
          const local = localGame(pack, storyId, {
            ...progress,
            actions: progress.actions.slice(0, -1),
          }, game.scene.id);
          if (!local) throw new Error('Hindi naka-save ang kasalukuyang eksena para laruin offline.');
          const action = advanceOfflineGame(local, actionId, choiceId);
          await saveOfflineProgress(action.progress);
          setGame(action.game);
          setFailure(action.failure);
          setShowChoices(false);
          setNote('Nawala ang internet. Naka-save sa device ang progress at awtomatikong susubukang i-sync kapag bumalik ang koneksyon.');
        } catch (offlineError) {
          setError(offlineError.message || err.message);
        }
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const storyForBook = game?.story?.full_story_text?.trim() ? game.story : entry?.story ?? game?.story;
  const bookPages = paginateStoryText(storyForBook?.full_story_text);
  const openBook = () => { setBookPage(0); setBookOpen(true); };
  const closeBook = () => setBookOpen(false);

  if (loading) {
    return (
      <div className="vn-stage vn-loading-stage">
        <div className="vn-loading-indicator" role="status" aria-live="polite">
          <span className="vn-loading-spinner" aria-hidden="true" />
          <span>Naglo-load…</span>
        </div>
      </div>
    );
  }

  if (!game) {
    if (entry) {
      const pausedScene = entry.savedGame?.scene ?? entry.firstScene;
      const pausedBg = pausedScene?.background_image_path;
      const pausedObjects = objectsOf(pausedScene);
      const hasBook = true;
      return (
        <div className="vn-stage" style={pausedBg && !pausedObjects.length ? { backgroundImage: `url("${pausedBg}")` } : undefined}>
          <style>{ART_CSS}</style>
          <RotatePrompt />
          {pausedObjects.length > 0 && <SceneArt key={`paused-${pausedScene?.id}`} bg={pausedBg} objects={pausedObjects} />}
          <div className="vn-entry-shade" aria-hidden="true" />
          <Link className="vn-back" to="/home">Bumalik</Link>
          {hasBook && <BookButton onClick={openBook} highlighted={tutorialVisible} />}

          {entry.savedGame ? (
            <div className="vn-entry-content vn-returning-content">
              <div className="vn-entry-actions">
                <button type="button" className="vn-choice" onClick={() => {
                  setGame(orderChoices(entry.savedGame));
                }}>Magpatuloy</button>
                <button type="button" className="vn-choice" onClick={() => start(true)}>Umulit</button>
              </div>
              <p className="vn-saved-note">
                {entry.savedGame.offline
                  ? 'May offline progress na naka-save sa device na ito. Magpapatuloy ito sa parehong eksena at awtomatikong susubukang i-sync kapag may internet.'
                  : `May naka-save kang laro sa “${pausedScene?.title || 'Eksena'}”. Gusto mo bang magsimula muli o magpatuloy kung saan ka huling huminto?`}
              </p>
              {syncWarning && (
                <div className="alert alert-warn" role="status">
                  {syncWarning}{' '}
                  <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>
                    Subukang i-sync muli
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="vn-entry-content">
              {hasBook && !tutorialVisible && <button type="button" className="vn-entry-book-note" onClick={openBook}>Basahin ang buong istorya</button>}
              <button type="button" className="vn-choice vn-entry-start" onClick={() => start(false)}>Simulan</button>
            </div>
          )}

          {tutorialVisible && hasBook && (
            <div className="vn-book-tutorial" role="dialog" aria-label="Gabay sa aklat">
              <div className="vn-book-tutorial-card">
                <strong>Basahin ang buong istorya</strong>
                <button type="button" className="vn-choice" onClick={() => { setTutorialVisible(false); start(false); }}>Laktawan</button>
              </div>
              <span className="vn-book-tutorial-arrow" aria-hidden="true">&#8599;</span>
            </div>
          )}
          {bookOpen && <BookModal story={storyForBook} pages={bookPages} page={bookPage} setPage={setBookPage} onClose={closeBook} />}
        </div>
      );
    }
    return (
      <div className="panel stack">
        <div className="alert alert-error">{error || 'Hindi ma-load ang istoryang ito.'}</div>
        <div>
          <button type="button" className="btn" onClick={() => start(false)}>Subukan muli</button>{' '}
          <Link className="btn btn-ghost" to="/home">Bumalik</Link>
        </div>
      </div>
    );
  }

  const { session, scene } = game;
  const completed = session.status === 'completed';
  const bg = scene?.background_image_path;
  const objects = objectsOf(scene);
  const hasArt = objects.length > 0;
  const choices = scene?.choices ?? [];
  const hasChoices = choices.length > 0;

  const audioPrompt = audioBlocked && activeAudioUrl ? (
    <button type="button" className="vn-choice" onClick={enableSceneAudio} style={{ marginBottom: 12 }}>
      Pindutin para patugtugin ang tunog ng eksena
    </button>
  ) : null;

  // Failure view: same screen, the student stays on the same decision.
  if (failure) {
    const failHasOwnArt = !!failure.scene?.background_image_path || objectsOf(failure.scene).length > 0;
    const failObjects = failHasOwnArt ? objectsOf(failure.scene) : objects;
    const failBg = failure.scene?.background_image_path || bg;
    const failHasArt = failObjects.length > 0;
    return (
      <div
        className="vn-stage"
        style={failBg && !failHasArt ? { backgroundImage: `url("${failBg}")` } : undefined}
      >
        <audio ref={audioRef} preload="auto" aria-hidden="true" />
        <style>{ART_CSS}</style>
        <RotatePrompt />
        {failHasArt && <SceneArt key={`failure-${failure.scene?.id || scene?.id}`} bg={failBg} objects={failObjects} />}
        {game.offline && <div className="vn-offline-badge" role="status">Naka-save sa device · awtomatikong susubukang i-sync kapag may internet</div>}
        <Link className="vn-back" to="/home">
          ← Stories
        </Link>
        <BookButton onClick={openBook} />
        <div className="vn-box vn-failure-panel vn-narration-panel">
          <div className="vn-name">{failure.scene?.title || 'Not quite'}</div>
          <p className="vn-text">
            {failure.scene?.narration || 'Hindi iyon ang tamang sagot.'}
          </p>
          {failure.feedback && <p className="vn-sub">{failure.feedback}</p>}
          <div className="vn-choices">
            <button type="button" className="vn-choice" onClick={() => setFailure(null)}>
              Subukan muli
            </button>
          </div>
        </div>
        {bookOpen && <BookModal story={storyForBook} pages={bookPages} page={bookPage} setPage={setBookPage} onClose={closeBook} />}
      </div>
    );
  }

  return (
    <div
      className="vn-stage"
      style={bg && !hasArt ? { backgroundImage: `url("${bg}")` } : undefined}
    >
      <audio ref={audioRef} preload="auto" aria-hidden="true" />
      <style>{ART_CSS}</style>
      <RotatePrompt />
      {hasArt && <SceneArt key={`scene-${scene?.id}`} bg={bg} objects={objects} />}
      {game.offline && (
        <div className="vn-offline-badge" role="status">
          {game.offlineProgress?.actions?.length
            ? `Naka-save sa device · ${game.offlineProgress.actions.length} aksyon ang nakapila para i-sync`
            : 'Naka-save sa device · awtomatikong mag-si-sync kapag may internet'}
        </div>
      )}
      {completed && <div className="vn-complete-toast" role="status">⭐ Tapos na ang kuwento!</div>}

      <Link className="vn-back" to="/home" onClick={(e) => e.stopPropagation()}>
        ← Stories
      </Link>

      <BookButton onClick={openBook} />
      <div className={`vn-box${scene?.narration ? ' vn-narration-panel' : ''}`}>
        {error && <div className="alert alert-error">{error}</div>}

        {completed ? (
          <div className="vn-choices">
            {audioPrompt}
            {note && <p className="vn-sub">{note}</p>}
            <div className="vn-name">{scene?.title}</div>
            <p className="vn-text">{scene?.narration}</p>
            {scene?.dialogue && <p className="vn-text vn-dialogue">“{scene.dialogue}”</p>}
            <button type="button" className="vn-choice" onClick={() => start(true)}>
              Laruin muli
            </button>
            <Link className="vn-choice" to="/home">
              Bumalik sa mga kuwento
            </Link>
          </div>
        ) : showChoices ? (
          <div className="vn-choice-screen">
            {audioPrompt}
            <button
              type="button"
              className="vn-choice vn-flow-back"
              onClick={() => setShowChoices(false)}
            >
              Bumalik
            </button>
            <div className="vn-choices">
              {choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="vn-choice"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    choose(c.id);
                  }}
                >
                  {c.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {audioPrompt}
            {note && <p className="vn-sub">{note}</p>}
            <div className="vn-name">{scene?.title}</div>
            <p className="vn-text">{scene?.narration}</p>
            {scene?.dialogue && <p className="vn-text vn-dialogue">“{scene.dialogue}”</p>}
            {hasChoices && (
              <div className="vn-flow-actions">
                <button
                  type="button"
                  className="vn-choice vn-flow-next"
                  disabled={busy}
                  onClick={() => {
                    if (scene?.scene_type === 'narrative' && choices.length === 1) choose(choices[0].id);
                    else setShowChoices(true);
                  }}
                >
                  Magpatuloy
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {bookOpen && <BookModal story={storyForBook} pages={bookPages} page={bookPage} setPage={setBookPage} onClose={closeBook} />}
    </div>
  );
}
