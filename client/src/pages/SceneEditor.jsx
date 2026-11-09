import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from 'react-konva';
import Konva from 'konva';
import { apiFetch } from '../api';
import { supabase } from '../supabase';

/*
 * Visual scene editor.
 *
 * Coordinates: every object is stored as fractions of a 16:9 canvas
 *   x, y  = centre of the object (0..1 of canvas width / height)
 *   w, h  = size (fraction of canvas width / height)
 * The student player draws the same 16:9 frame, so a saved layout looks the
 * same on every screen size.
 */

const BASE = '/admin/content';
const CANVAS_W = 1600;
const CANVAS_H = 900;
const MAX_OBJECTS = 100;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const ASSET_TYPES = ['image/png', 'image/webp', 'image/jpeg'];
const ASSET_MIME = 'application/x-scene-asset';

const SE_CSS = `
.se { display: flex; flex-direction: column; gap: 14px; }
.se-bar {
  position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 8px 12px; background: var(--ed-paper); border: 2px solid var(--ed-line); border-radius: 16px;
  box-shadow: var(--ed-shadow);
}
.se-title { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 160px; }
.se-title h1 { font-size: 1.15rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.se-bar-actions { display: flex; align-items: center; gap: 12px; }

.se-grid { display: grid; grid-template-columns: 250px minmax(0, 1fr) 290px; gap: 14px; align-items: start; }
.se-grid-preview { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 1150px) { .se-grid { grid-template-columns: 1fr; } }

.se-panel { padding: 16px; }
.se-panel h2 { font-size: 1.05rem; margin-bottom: 10px; }
.se-sub { margin: 14px 0 8px; font-size: 0.82rem; font-weight: 800; color: var(--ed-muted); text-transform: uppercase; letter-spacing: 0.04em; }

.se-drop-zone {
  display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
  padding: 14px 10px; border: 2px dashed #cfc9ee; border-radius: 14px; background: var(--ed-bg);
  color: var(--ed-muted); font-weight: 700; font-size: 0.85rem; cursor: pointer; position: relative;
}
.se-drop-zone:hover, .se-drop-zone-on { border-color: var(--ed-grape); background: var(--ed-grape-soft); color: var(--ed-grape-dark); }
.se-drop-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

.se-assets { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; max-height: 52vh; overflow: auto; padding: 2px; }
.se-asset {
  position: relative; display: flex; flex-direction: column; gap: 4px; padding: 6px;
  border: 2px solid var(--ed-line); border-radius: 12px; background: #fff; cursor: grab;
}
.se-asset:hover { border-color: var(--ed-grape); }
.se-checker {
  background-color: #fff;
  background-image: linear-gradient(45deg, #ece9f8 25%, transparent 25%, transparent 75%, #ece9f8 75%),
    linear-gradient(45deg, #ece9f8 25%, transparent 25%, transparent 75%, #ece9f8 75%);
  background-size: 14px 14px; background-position: 0 0, 7px 7px;
}
.se-asset-img { height: 72px; border-radius: 8px; display: grid; place-items: center; overflow: hidden; }
.se-asset-img img { max-width: 100%; max-height: 100%; object-fit: contain; pointer-events: none; }
.se-asset .ed-btn { min-height: 30px; padding: 3px 8px; font-size: 0.78rem; }

.se-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
.se-toolbar .se-spacer { flex: 1; }
.se-check { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 700; color: var(--ed-muted); }

.se-canvas {
  position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; user-select: none;
  border: 2px solid var(--ed-line); border-radius: 16px; background-color: #dcd8f1;
  background-size: cover; background-position: center; background-repeat: no-repeat;
}
.se-canvas .konvajs-content { position: absolute !important; top: 0; left: 0; }
.se-nobg {
  position: absolute; inset: 0; display: grid; place-items: center; text-align: center; padding: 20px;
  color: var(--ed-muted); font-weight: 700; pointer-events: none;
}
.se-safe {
  position: absolute; top: 0; bottom: 0; left: 12.5%; width: 75%; pointer-events: none;
  border-left: 2px dashed rgba(255,255,255,0.9); border-right: 2px dashed rgba(255,255,255,0.9);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.25);
}
.se-safe span { position: absolute; top: 6px; left: 8px; padding: 2px 8px; border-radius: 999px; background: rgba(0,0,0,0.55); color: #fff; font-size: 0.72rem; font-weight: 800; }
.se-dropping { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(109, 69, 240, 0.18); border: 3px dashed var(--ed-grape); border-radius: 14px; color: var(--ed-grape-dark); font-weight: 800; pointer-events: none; }
.se-drag-ghost { position: fixed; z-index: 1000; width: 110px; max-height: 160px; object-fit: contain; pointer-events: none; transform: translate(-50%, -50%); filter: drop-shadow(0 4px 8px #0005); }
.se-pbox {
  position: absolute; left: 4%; right: 4%; bottom: 5%; padding: 14px 18px 12px; border-radius: 12px;
  background: rgba(40, 20, 70, 0.78); color: #fff; border-top: 2px solid rgba(255,255,255,0.25); pointer-events: none;
}
.se-pbox strong { display: inline-block; margin-bottom: 4px; padding: 2px 12px; border-radius: 6px; background: #4c1d95; font-size: 0.85rem; }
.se-pbox p { margin: 0; font-size: clamp(0.8rem, 1.6vw, 1.1rem); line-height: 1.5; }
.se-empty-hint {
  position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%); width: min(82%, 520px);
  display: flex; flex-direction: column; gap: 2px; text-align: center; padding: 10px 14px;
  border-radius: 12px; background: rgba(40, 20, 70, 0.78); color: #fff; font-size: 0.9rem; pointer-events: none;
}
.se-empty-hint span { opacity: 0.9; font-size: 0.82rem; }
.se-asset .ed-btn-primary { box-shadow: none; }
.se-hint { margin: 8px 0 0; color: var(--ed-muted); font-size: 0.85rem; }

.se-empty { text-align: center; color: var(--ed-muted); font-weight: 700; padding: 18px 8px; }

.se-num { display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; font-weight: 800; color: var(--ed-muted); }
.se-num-box { position: relative; display: block; }
.se-num-box .ed-input { padding: 6px 28px 6px 10px; font-size: 0.9rem; }
.se-num-box em { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font-style: normal; font-size: 0.75rem; color: var(--ed-muted); pointer-events: none; }
.se-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.se-btnrow { display: flex; flex-wrap: wrap; gap: 6px; }
.se-btnrow .ed-btn { min-height: 34px; padding: 5px 10px; font-size: 0.82rem; }

.se-layers { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow: auto; }
.se-layer {
  display: flex; align-items: center; gap: 8px; padding: 4px 6px; width: 100%;
  border: 2px solid var(--ed-line); border-radius: 10px; background: #fff; font: inherit; cursor: pointer; text-align: left; color: var(--ed-ink);
}
.se-layer:hover { border-color: #b9b4dc; }
.se-layer-on { border-color: var(--ed-grape); background: var(--ed-grape-soft); }
.se-layer-img { width: 34px; height: 34px; border-radius: 6px; display: grid; place-items: center; overflow: hidden; flex: none; }
.se-layer-img img { max-width: 100%; max-height: 100%; object-fit: contain; }
.se-layer span.se-layer-name { font-weight: 800; font-size: 0.82rem; flex: 1; }
.se-layer small { color: var(--ed-muted); font-weight: 700; }
`;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const newId = () => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function normalizeLayout(cfg) {
  const list = Array.isArray(cfg?.objects) ? cfg.objects : [];
  return list
    .filter((o) => o && typeof o.src === 'string' && o.id)
    .map((o) => ({
      id: String(o.id),
      src: o.src,
      x: isNum(o.x) ? o.x : 0.5,
      y: isNum(o.y) ? o.y : 0.5,
      w: isNum(o.w) ? o.w : 0.2,
      h: isNum(o.h) ? o.h : 0.3,
      rotation: isNum(o.rotation) ? o.rotation : 0,
      opacity: isNum(o.opacity) ? o.opacity : 1,
      flipX: o.flipX === true,
      flipY: o.flipY === true,
      intro: ['none', 'fade', 'left', 'right', 'top', 'bottom', 'zoom', 'bounce'].includes(o.intro) ? o.intro : 'none',
      duration: isNum(o.duration) ? o.duration : 0.6,
      delay: isNum(o.delay) ? o.delay : 0,
    }));
}

const imageCache = new Map();
function loadImage(src) {
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src));
  return new Promise((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => {
      imageCache.set(src, el);
      resolve(el);
    };
    el.onerror = () => reject(new Error('Hindi ma-load ang larawang iyon.'));
    el.src = src;
  });
}

function useLoadedImage(src) {
  const [img, setImg] = useState(() => imageCache.get(src) ?? null);
  useEffect(() => {
    let live = true;
    if (imageCache.has(src)) {
      setImg(imageCache.get(src));
    } else {
      loadImage(src)
        .then((el) => live && setImg(el))
        .catch(() => live && setImg(null));
    }
    return () => {
      live = false;
    };
  }, [src]);
  return img;
}

async function uploadAsset(storyId, file) {
  if (!ASSET_TYPES.includes(file.type)) throw new Error('Pumili ng PNG, WebP o JPEG na larawan.');
  if (file.size > MAX_ASSET_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const response = await fetch(`/api${BASE}/stories/${storyId}/images?kind=asset`, {
    method: 'POST',
    headers: { 'Content-Type': file.type, Authorization: `Bearer ${token}` },
    body: file,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) throw new Error(payload?.error || `Upload failed (${response.status})`);
  return payload.url;
}

/* ------------------------------------------------------------------ */
/* One draggable picture on the canvas                                 */
/* ------------------------------------------------------------------ */
function SceneObject({ obj, interactive, preview, registerNode, onSelect, onDragEnd, onTransformEnd }) {
  const image = useLoadedImage(obj.src);
  const lastAnimation = useRef({ intro: obj.intro, duration: obj.duration, delay: obj.delay, preview });
  const width = obj.w * CANVAS_W;
  const height = obj.h * CANVAS_H;

  useEffect(() => {
    const changedAnimation = lastAnimation.current.intro !== obj.intro
      || lastAnimation.current.duration !== obj.duration
      || lastAnimation.current.delay !== obj.delay;
    const enteredPreview = preview && !lastAnimation.current.preview;
    lastAnimation.current = { intro: obj.intro, duration: obj.duration, delay: obj.delay, preview };

    const node = nodeRef.current;
    if (!node || (!changedAnimation && !enteredPreview)) return undefined;

    node.stop();
    const x = obj.x * CANVAS_W;
    const y = obj.y * CANVAS_H;
    const finalScaleX = obj.flipX ? -1 : 1;
    const finalScaleY = obj.flipY ? -1 : 1;
    const finalOpacity = obj.opacity;
    const intro = obj.intro;
    if (!intro || intro === 'none') {
      node.setAttrs({ x, y, opacity: finalOpacity, scaleX: finalScaleX, scaleY: finalScaleY });
      node.getLayer()?.batchDraw();
      return undefined;
    }

    const start = { x, y, opacity: finalOpacity, scaleX: finalScaleX, scaleY: finalScaleY };
    const finish = { ...start, duration: obj.duration ?? 0.6 };
    if (intro === 'fade') start.opacity = 0;
    if (intro === 'left') start.x = x - CANVAS_W * 0.55;
    if (intro === 'right') start.x = x + CANVAS_W * 0.55;
    if (intro === 'top') start.y = y - CANVAS_H * 0.55;
    if (intro === 'bottom') start.y = y + CANVAS_H * 0.55;
    if (intro === 'zoom' || intro === 'bounce') {
      start.scaleX = finalScaleX * 0.15;
      start.scaleY = finalScaleY * 0.15;
    }
    node.setAttrs(start);
    node.getLayer()?.batchDraw();

    const timer = window.setTimeout(() => {
      node.to({
        ...finish,
        delay: 0,
        easing: intro === 'bounce' ? Konva.Easings.BounceEaseOut
          : intro === 'zoom' ? Konva.Easings.BackEaseOut
            : Konva.Easings.EaseOut,
      });
    }, Math.max(0, (obj.delay ?? 0) * 1000));
    return () => {
      window.clearTimeout(timer);
      node.stop();
    };
  }, [obj.intro, obj.duration, obj.delay, obj.x, obj.y, obj.opacity, obj.flipX, obj.flipY, preview]);

  const nodeRef = useRef(null);

  return (
    <KonvaImage
      ref={(node) => {
        nodeRef.current = node;
        registerNode(obj.id, node);
      }}
      image={image || undefined}
      x={obj.x * CANVAS_W}
      y={obj.y * CANVAS_H}
      width={width}
      height={height}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={obj.rotation}
      scaleX={obj.flipX ? -1 : 1}
      scaleY={obj.flipY ? -1 : 1}
      opacity={obj.opacity}
      draggable={interactive}
      listening={interactive}
      onMouseDown={() => onSelect(obj.id)}
      onTouchStart={() => onSelect(obj.id)}
      onDragStart={() => onSelect(obj.id)}
      onDragEnd={(e) => onDragEnd(obj.id, e.target)}
      onTransformEnd={(e) => onTransformEnd(obj.id, e.target)}
    />
  );
}

function NumField({ label, value, onChange, min, max, step = 1, suffix }) {
  const fmt = (v) => (isNum(v) ? String(Math.round(v * 10) / 10) : '');
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value]);

  return (
    <label className="se-num">
      <span>{label}</span>
      <span className="se-num-box">
        <input
          className="ed-input"
          type="number"
          value={text}
          min={min}
          max={max}
          step={step}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            setText(fmt(value));
          }}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
        />
        {suffix && <em>{suffix}</em>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* The editor                                                          */
/* ------------------------------------------------------------------ */
export default function SceneEditor({ storyId, scene, onClose, notify = () => {} }) {
  const initial = useMemo(() => normalizeLayout(scene.character_config), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [objects, setObjects] = useState(initial);
  const objectsRef = useRef(initial);
  objectsRef.current = objects;
  const past = useRef([]);
  const future = useRef([]);
  const lastCommit = useRef({ key: null, t: 0 });

  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState(false);
  const [showSafe, setShowSafe] = useState(false);
  const [keepRatio, setKeepRatio] = useState(true);

  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [zoneOn, setZoneOn] = useState(false);
  const [canvasDrop, setCanvasDrop] = useState(false);
  const [assetDrag, setAssetDrag] = useState(null);

  const wrapRef = useRef(null);
  const [cw, setCw] = useState(0);
  const nodeRefs = useRef({});
  const trRef = useRef(null);

  const dirty = JSON.stringify(objects) !== savedJson;
  const bg = scene.background_image_path;
  const selected = objects.find((o) => o.id === selectedId) ?? null;
  const selectedIndex = selected ? objects.findIndex((o) => o.id === selectedId) : -1;

  /* ---------- history ---------- */
  const commit = useCallback((updater, key) => {
    const prev = objectsRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    if (next === prev) return;
    const now = Date.now();
    const coalesce = key && lastCommit.current.key === key && now - lastCommit.current.t < 700;
    if (!coalesce) {
      past.current.push(prev);
      if (past.current.length > 100) past.current.shift();
    }
    lastCommit.current = { key: key ?? null, t: now };
    future.current = [];
    objectsRef.current = next;
    setObjects(next);
  }, []);

  const undo = useCallback(() => {
    if (!past.current.length) return;
    future.current.push(objectsRef.current);
    const prev = past.current.pop();
    lastCommit.current = { key: null, t: 0 };
    objectsRef.current = prev;
    setObjects(prev);
    setSelectedId((id) => (prev.some((o) => o.id === id) ? id : null));
  }, []);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current.push(objectsRef.current);
    const next = future.current.pop();
    lastCommit.current = { key: null, t: 0 };
    objectsRef.current = next;
    setObjects(next);
    setSelectedId((id) => (next.some((o) => o.id === id) ? id : null));
  }, []);

  const patchObject = useCallback(
    (id, patch, key) => commit((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)), key),
    [commit]
  );

  /* ---------- canvas size ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setCw(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [preview]);

  const scale = cw / CANVAS_W;
  const ch = (cw * CANVAS_H) / CANVAS_W;

  /* ---------- transformer follows the selected node ---------- */
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId && !preview ? nodeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, preview, objects, cw]);

  /* ---------- asset library ---------- */
  useEffect(() => {
    let live = true;
    apiFetch(`${BASE}/stories/${storyId}/assets`)
      .then((r) => live && setAssets(r.assets ?? []))
      .catch((err) => live && notify('error', err.message, 9000))
      .finally(() => live && setAssetsLoading(false));
    return () => {
      live = false;
    };
  }, [storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadFiles = useCallback(
    async (fileList) => {
      const files = [...fileList];
      if (!files.length) return [];
      setUploading(true);
      const urls = [];
      try {
        for (const file of files) {
          try {
            const url = await uploadAsset(storyId, file);
            urls.push(url);
            setAssets((prev) => [{ name: url.split('/').pop(), url }, ...prev]);
          } catch (err) {
            notify('error', err.message, 9000);
          }
        }
        if (urls.length) notify('success', urls.length === 1 ? 'Na-upload na ang larawan.' : `${urls.length} pictures uploaded.`, 3000);
      } finally {
        setUploading(false);
      }
      return urls;
    },
    [storyId, notify]
  );

  /* ---------- object actions ---------- */
  const addObject = useCallback(
    async (src, fx = 0.5, fy = 0.5) => {
      if (objectsRef.current.length >= MAX_OBJECTS) {
        notify('error', `A scene can hold up to ${MAX_OBJECTS} pictures.`, 6000);
        return;
      }
      try {
        const el = await loadImage(src);
        const fit = Math.min((CANVAS_W * 0.35) / el.naturalWidth, (CANVAS_H * 0.6) / el.naturalHeight);
        const obj = {
          id: newId(),
          src,
          x: round(clamp(fx, 0, 1)),
          y: round(clamp(fy, 0, 1)),
          w: round((el.naturalWidth * fit) / CANVAS_W),
          h: round((el.naturalHeight * fit) / CANVAS_H),
          rotation: 0,
          opacity: 1,
          flipX: false,
          intro: 'none',
          duration: 0.6,
          delay: 0,
        };
        commit((list) => [...list, obj]);
        setSelectedId(obj.id);
      } catch (err) {
        notify('error', err.message, 6000);
      }
    },
    [commit, notify]
  );

  // Use pointer tracking for library-to-canvas placement. Native HTML drag only
  // paints its preview in the browser drag image, hiding the asset until drop.
  useEffect(() => {
    if (!assetDrag) return undefined;
    const move = (event) => setAssetDrag((drag) => drag ? { ...drag, clientX: event.clientX, clientY: event.clientY } : drag);
    const up = async (event) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        const left = rect.left + (wrapRef.current?.clientLeft ?? 0);
        const top = rect.top + (wrapRef.current?.clientTop ?? 0);
        await addObject(assetDrag.src, clamp((event.clientX - left) / cw, 0, 1), clamp((event.clientY - top) / ch, 0, 1));
      }
      setAssetDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [assetDrag, addObject, cw, ch]);

  const duplicateSelected = useCallback(() => {
    const cur = objectsRef.current;
    const i = cur.findIndex((o) => o.id === selectedId);
    if (i < 0) return;
    if (cur.length >= MAX_OBJECTS) {
      notify('error', `A scene can hold up to ${MAX_OBJECTS} pictures.`, 6000);
      return;
    }
    const copy = { ...cur[i], id: newId(), x: round(cur[i].x + 0.03), y: round(cur[i].y + 0.03) };
    commit((list) => {
      const next = [...list];
      next.splice(i + 1, 0, copy);
      return next;
    });
    setSelectedId(copy.id);
  }, [selectedId, commit, notify]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit((list) => list.filter((o) => o.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, commit]);

  const moveLayer = useCallback(
    (how) => {
      commit((list) => {
        const i = list.findIndex((o) => o.id === selectedId);
        if (i < 0) return list;
        const target =
          how === 'front' ? list.length - 1 : how === 'back' ? 0 : how === 'up' ? i + 1 : i - 1;
        if (target < 0 || target >= list.length || target === i) return list;
        const next = [...list];
        const [item] = next.splice(i, 1);
        next.splice(target, 0, item);
        return next;
      });
    },
    [selectedId, commit]
  );

  /* ---------- canvas events ---------- */
  const registerNode = useCallback((id, node) => {
    if (node) nodeRefs.current[id] = node;
    else delete nodeRefs.current[id];
  }, []);

  const handleDragEnd = useCallback(
    (id, node) => patchObject(id, { x: round(node.x() / CANVAS_W), y: round(node.y() / CANVAS_H) }),
    [patchObject]
  );

  const handleTransformEnd = useCallback(
    (id, node) => {
      const sx = node.scaleX();
      const sy = node.scaleY();
      // Resizing must never change orientation. Konva can report a negative
      // scale during transforms (especially after rotation), so only the
      // explicit flip buttons are allowed to change these saved flags.
      const current = objectsRef.current.find((obj) => obj.id === id);
      const flipX = current?.flipX === true;
      const flipY = current?.flipY === true;
      const w = node.width() * Math.abs(sx);
      const h = node.height() * Math.abs(sy);
      node.scaleX(flipX ? -1 : 1);
      node.scaleY(flipY ? -1 : 1);
      patchObject(id, {
        x: round(node.x() / CANVAS_W),
        y: round(node.y() / CANVAS_H),
        w: round(w / CANVAS_W),
        h: round(h / CANVAS_H),
        rotation: round(node.rotation(), 2),
        flipX,
        flipY,
      });
    },
    [patchObject]
  );

  const onCanvasDragOver = (e) => {
    const types = [...(e.dataTransfer?.types ?? [])];
    if (types.includes(ASSET_MIME) || types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setCanvasDrop(true);
    }
  };

  const onCanvasDrop = async (e) => {
    e.preventDefault();
    setCanvasDrop(false);
    const rect = wrapRef.current.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const src = e.dataTransfer.getData(ASSET_MIME);
    if (src) {
      addObject(src, fx, fy);
    } else if (e.dataTransfer.files?.length) {
      const urls = await uploadFiles(e.dataTransfer.files);
      for (const url of urls) await addObject(url, fx, fy);
    }
  };

  /* ---------- keyboard shortcuts ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (preview) {
        return;
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (selectedId && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 0.02 : 0.004;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const o = objectsRef.current.find((x) => x.id === selectedId);
        if (o) patchObject(selectedId, { x: round(o.x + dx), y: round(o.y + dy) }, `${selectedId}:nudge`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, preview, selectedId, duplicateSelected, deleteSelected, patchObject]);

  // Warn before closing the browser tab with unsaved work.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  /* ---------- save / close ---------- */
  async function save() {
    setSaving(true);
    try {
      await apiFetch(`${BASE}/scenes/${scene.id}`, {
        method: 'PATCH',
        body: { character_config: objects.length ? { version: 1, objects } : null },
      });
      setSavedJson(JSON.stringify(objects));
      notify('success', 'Na-save ang ayos ng eksena. I-publish ang kuwento para makita ito ng mga mag-aaral.', 4000);
    } catch (err) {
      notify('error', err.message || 'Hindi ma-save ang ayos.', 9000);
    } finally {
      setSaving(false);
    }
  }

  const requestClose = () => {
    if (dirty && !window.confirm('May mga pagbabagong hindi pa nase-save. Umalis nang hindi sine-save?')) return;
    onClose();
  };

  /* ---------- property helpers ---------- */
  const setPct = (field) => (v) => patchObject(selectedId, { [field]: round(clamp(v, -50, 150) / 100) }, `${selectedId}:${field}`);

  const setWidth = (v) => {
    if (!selected) return;
    const w = round(clamp(v, 1, 200) / 100);
    const h = keepRatio ? round(selected.h * (w / selected.w)) : selected.h;
    patchObject(selectedId, { w, h }, `${selectedId}:size`);
  };
  const setHeight = (v) => {
    if (!selected) return;
    const h = round(clamp(v, 1, 200) / 100);
    const w = keepRatio ? round(selected.w * (h / selected.h)) : selected.w;
    patchObject(selectedId, { w, h }, `${selectedId}:size`);
  };

  const layersTopFirst = [...objects].reverse();

  return (
    <div className="se">
      <style>{SE_CSS}</style>

      <div className="se-bar">
        <button type="button" className="ed-btn ed-btn-ghost" onClick={requestClose}>
          ← Back to scene
        </button>
        <div className="se-title">
          <h1>{scene.title || 'Untitled scene'}</h1>
          <span className="ed-pill">Biswal na editor</span>
        </div>
        <div className="se-bar-actions">
          <span className={dirty ? 'ed-save-state ed-save-dirty' : 'ed-save-state'}>
            {saving ? 'Saving…' : dirty ? 'May pagbabagong hindi pa nase-save' : '✓ All saved'}
          </span>
          <button type="button" className="ed-btn ed-btn-primary" disabled={saving || !dirty} onClick={save}>
            I-save ang eksena
          </button>
        </div>
      </div>

      <div className={preview ? 'se-grid se-grid-preview' : 'se-grid'}>
        {/* ---------------- Library ---------------- */}
        {!preview && (
          <aside className="ed-card se-panel">
            <h2>Mga tauhan at bagay</h2>
            <label
              className={uploading ? 'ed-btn ed-btn-primary ed-file ed-disabled' : 'ed-btn ed-btn-primary ed-file'}
              style={{ width: '100%', marginBottom: 10 }}
            >
              {uploading ? 'Uploading…' : '+ Mag-upload ng tauhan o bagay'}
              <input
                type="file"
                multiple
                accept="image/png,image/webp,image/jpeg"
                disabled={uploading}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files?.length) uploadFiles(files);
                  e.target.value = '';
                }}
              />
            </label>
            <label
              className={zoneOn ? 'se-drop-zone se-drop-zone-on' : 'se-drop-zone'}
              onDragOver={(e) => {
                if ([...(e.dataTransfer?.types ?? [])].includes('Files')) {
                  e.preventDefault();
                  setZoneOn(true);
                }
              }}
              onDragLeave={() => setZoneOn(false)}
              onDrop={(e) => {
                e.preventDefault();
                setZoneOn(false);
                uploadFiles(e.dataTransfer.files);
              }}
            >
              <strong>O i-drop dito ang mga larawan</strong>
              <span>Pinakamainam ang PNG na may transparent na likuran (hanggang 5 MB bawat isa).</span>
              <input
                type="file"
                multiple
                accept="image/png,image/webp,image/jpeg"
                disabled={uploading}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files?.length) uploadFiles(files);
                  e.target.value = '';
                }}
              />
            </label>

            <p className="ed-hint">I-drag ang larawan papunta sa eksena o pindutin ang “+ Idagdag sa eksena”.</p>

            {assetsLoading ? (
              <p className="se-empty">Naglo-load ng mga larawan…</p>
            ) : assets.length === 0 ? (
              <p className="se-empty">Wala pang larawan. Mag-upload muna ng tauhan sa itaas.</p>
            ) : (
              <div className="se-assets">
                {assets.map((a) => (
                  <div
                    key={a.url}
                    className="se-asset"
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      if (e.target.closest('button')) return;
                      e.preventDefault();
                      setAssetDrag({ src: a.url, clientX: e.clientX, clientY: e.clientY });
                    }}
                    onDoubleClick={() => addObject(a.url)}
                  >
                    <div className="se-asset-img se-checker">
                      <img src={a.url} alt="" draggable={false} />
                    </div>
                    <button type="button" className="ed-btn ed-btn-primary" onClick={() => addObject(a.url)}>
                      + Idagdag sa eksena
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}

        {/* ---------------- Canvas ---------------- */}
        <section>
          <div className="se-toolbar">
            {!preview && (
              <>
                <button type="button" className="ed-btn ed-btn-small" disabled={!past.current.length} onClick={undo}>
                  Undo
                </button>
                <button type="button" className="ed-btn ed-btn-small" disabled={!future.current.length} onClick={redo}>
                  Redo
                </button>
                <label className="se-check">
                  <input type="checkbox" checked={showSafe} onChange={(e) => setShowSafe(e.target.checked)} />
                  Show safe area
                </label>
              </>
            )}
            <span className="se-spacer" />
            <button
              type="button"
              className={preview ? 'ed-btn ed-btn-small ed-btn-primary' : 'ed-btn ed-btn-small'}
              onClick={() => {
                setPreview((p) => !p);
                setSelectedId(null);
              }}
            >
              {preview ? 'Bumalik sa pag-edit' : 'Silipin ang eksena'}
            </button>
          </div>

          <div
            ref={wrapRef}
            className="se-canvas"
            style={bg ? { backgroundImage: `url("${bg}")` } : undefined}
            onDragOver={preview ? undefined : onCanvasDragOver}
            onDragLeave={() => setCanvasDrop(false)}
            onDrop={preview ? undefined : onCanvasDrop}
          >
            {!bg && (
              <div className="se-nobg">
                <span>Wala pang larawan sa likuran. Magdagdag nito sa mga setting ng eksena para lumitaw dito.</span>
              </div>
            )}

            {cw > 0 && (
              <Stage width={cw} height={ch} scaleX={scale} scaleY={scale} style={{ position: 'absolute', top: 0, left: 0 }}>
                <Layer listening={!preview}>
                  <Rect
                    x={0}
                    y={0}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    fill="rgba(0,0,0,0.001)"
                    onMouseDown={() => setSelectedId(null)}
                    onTouchStart={() => setSelectedId(null)}
                  />
                  {objects.map((o) => (
                    <SceneObject
                      key={o.id}
                      obj={o}
                      interactive={!preview}
                      preview={preview}
                      registerNode={registerNode}
                      onSelect={setSelectedId}
                      onDragEnd={handleDragEnd}
                      onTransformEnd={handleTransformEnd}
                    />
                  ))}
                  <Transformer
                    ref={trRef}
                    visible={!preview && !!selectedId}
                    flipEnabled={false}
                    keepRatio={keepRatio}
                    rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                    rotationSnapTolerance={5}
                    anchorSize={11}
                    anchorCornerRadius={3}
                    anchorStroke="#6d45f0"
                    anchorFill="#ffffff"
                    borderStroke="#6d45f0"
                    borderStrokeWidth={2}
                    rotateAnchorOffset={32}
                    boundBoxFunc={(oldBox, newBox) => (newBox.width < 24 || newBox.height < 24 ? oldBox : newBox)}
                  />
                </Layer>
              </Stage>
            )}

            {!preview && objects.length === 0 && cw > 0 && (
              <div className="se-empty-hint">
                <strong>Wala pang tauhan sa eksenang ito.</strong>
                <span>Mag-upload ng larawan sa kaliwa, pagkatapos ay pindutin ang “+ Idagdag sa eksena” o i-drag ito rito.</span>
              </div>
            )}

            {showSafe && !preview && (
              <div className="se-safe">
                <span>Ligtas na bahagi 4:3</span>
              </div>
            )}

            {preview && (
              <div className="se-pbox">
                <strong>{scene.title || 'Untitled scene'}</strong>
                <p>{scene.narration}</p>
                {scene.dialogue && <p>“{scene.dialogue}”</p>}
              </div>
            )}

            {canvasDrop && !preview && <div className="se-dropping">Ihulog para idagdag sa eksena</div>}
          </div>
          {assetDrag && <img className="se-drag-ghost" src={assetDrag.src} alt="" style={{ left: assetDrag.clientX, top: assetDrag.clientY }} />}

          <p className="se-hint">
            {preview
              ? 'This is how students will see the scene (without the editing outlines).'
              : 'Click a picture to select it. Drag to move, use the corner handles to resize and the top handle to rotate. Delete removes it, arrow keys nudge it.'}
          </p>
        </section>

        {/* ---------------- Properties ---------------- */}
        {!preview && (
          <aside className="ed-card se-panel">
            <h2>Napiling larawan</h2>
            {!selected ? (
              <p className="se-empty">Pindutin ang larawan sa eksena para baguhin ang laki, puwesto at iba pa.</p>
            ) : (
              <>
                <div className="se-fields">
                  <NumField label="X position" suffix="%" value={selected.x * 100} onChange={setPct('x')} step={0.5} />
                  <NumField label="Y position" suffix="%" value={selected.y * 100} onChange={setPct('y')} step={0.5} />
                  <NumField label="Width" suffix="%" value={selected.w * 100} onChange={setWidth} min={1} max={200} step={0.5} />
                  <NumField label="Height" suffix="%" value={selected.h * 100} onChange={setHeight} min={1} max={200} step={0.5} />
                  <NumField
                    label="Rotation"
                    suffix="°"
                    value={selected.rotation}
                    onChange={(v) => patchObject(selectedId, { rotation: round(clamp(v, -360, 360), 2) }, `${selectedId}:rot`)}
                    min={-360}
                    max={360}
                  />
                  <NumField
                    label="Opacity"
                    suffix="%"
                    value={selected.opacity * 100}
                    onChange={(v) => patchObject(selectedId, { opacity: round(clamp(v, 0, 100) / 100) }, `${selectedId}:op`)}
                    min={0}
                    max={100}
                  />
                </div>

                <label className="se-check" style={{ marginTop: 10 }}>
                  <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} />
                  Keep proportions when resizing
                </label>

                <div className="se-sub">Mga aksyon</div>
                <label className="se-num" style={{ marginTop: 10 }}>Intro animation
                  <select className="ed-input" value={selected.intro} onChange={(e) => patchObject(selectedId, { intro: e.target.value })}>
                    <option value="none">Wala</option><option value="fade">Unti-unting lumitaw</option>
                    <option value="left">Dumulas papasok mula sa kaliwa</option><option value="right">Dumulas papasok mula sa kanan</option>
                    <option value="top">Dumulas papasok mula sa itaas</option><option value="bottom">Dumulas papasok mula sa ibaba</option>
                    <option value="zoom">Lumalapit</option><option value="bounce">Patalbog na lumitaw</option>
                  </select>
                </label>
                {selected.intro !== 'none' && <div className="se-fields" style={{ marginTop: 8 }}>
                  <NumField label="Duration" suffix="s" value={selected.duration} onChange={(v) => patchObject(selectedId, { duration: round(clamp(v, 0.1, 10), 2) })} min={0.1} max={10} step={0.1} />
                  <NumField label="Delay" suffix="s" value={selected.delay} onChange={(v) => patchObject(selectedId, { delay: round(clamp(v, 0, 10), 2) })} min={0} max={10} step={0.1} />
                </div>}
                <div className="se-btnrow">
                  <button type="button" className="ed-btn" onClick={() => patchObject(selectedId, { flipX: !selected.flipX })}>
                    Flip sideways
                  </button>
                  <button type="button" className="ed-btn" onClick={() => patchObject(selectedId, { flipY: !selected.flipY })}>
                    Flip upside down
                  </button>
                  <button type="button" className="ed-btn" onClick={duplicateSelected}>
                    Duplicate
                  </button>
                  <button type="button" className="ed-btn ed-btn-danger-text" onClick={deleteSelected}>
                    Delete
                  </button>
                </div>

                <div className="se-sub">
                  Layer {selectedIndex + 1} of {objects.length}
                </div>
                <div className="se-btnrow">
                  <button type="button" className="ed-btn" disabled={selectedIndex === objects.length - 1} onClick={() => moveLayer('front')}>
                    To front
                  </button>
                  <button type="button" className="ed-btn" disabled={selectedIndex === objects.length - 1} onClick={() => moveLayer('up')}>
                    Forward
                  </button>
                  <button type="button" className="ed-btn" disabled={selectedIndex === 0} onClick={() => moveLayer('down')}>
                    Backward
                  </button>
                  <button type="button" className="ed-btn" disabled={selectedIndex === 0} onClick={() => moveLayer('back')}>
                    To back
                  </button>
                </div>
              </>
            )}

            <div className="se-sub">Lahat ng patong (nasa itaas muna)</div>
            {objects.length === 0 ? (
              <p className="se-empty">Wala pang laman ang eksenang ito.</p>
            ) : (
              <ul className="se-layers">
                {layersTopFirst.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={o.id === selectedId ? 'se-layer se-layer-on' : 'se-layer'}
                      onClick={() => setSelectedId(o.id)}
                    >
                      <span className="se-layer-img se-checker">
                        <img src={o.src} alt="" />
                      </span>
                      <span className="se-layer-name">Larawan {objects.indexOf(o) + 1}</span>
                      <small>{Math.round(o.opacity * 100)}%</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
