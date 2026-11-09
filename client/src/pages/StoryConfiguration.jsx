import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { supabase } from '../supabase';
import SceneEditor from './SceneEditor';

const EDITOR_CSS = `
/* Story editor (admin). Everything is prefixed with .ed so it never clashes
   with the student-facing styles (.vn-*, .story-*) in your main stylesheet.
   Add this to index.html for the rounded font:
   <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800&display=swap" rel="stylesheet"> */

.ed {
  --ed-ink: #25214a;
  --ed-muted: #6a6890;
  --ed-line: #e4e1f4;
  --ed-paper: #ffffff;
  --ed-bg: #f6f5fd;
  --ed-grape: #6d45f0;
  --ed-grape-dark: #5430cc;
  --ed-grape-soft: #eee9ff;

  --ed-start: #17a673;     --ed-start-soft: #e1f6ed;     --ed-start-ink: #0e6d4a;
  --ed-narrative: #2f8bf0; --ed-narrative-soft: #e3f0ff; --ed-narrative-ink: #1b5fae;
  --ed-decision: #6d45f0;  --ed-decision-soft: #eee9ff;  --ed-decision-ink: #4a2bb5;
  --ed-failure: #ee5a5a;   --ed-failure-soft: #ffe9e9;   --ed-failure-ink: #a52b2b;
  --ed-ending: #f2a300;    --ed-ending-soft: #fff2cf;    --ed-ending-ink: #7a5300;

  --ed-shadow: 0 1px 2px rgba(37, 33, 74, 0.05), 0 4px 14px rgba(37, 33, 74, 0.06);

  font-family: 'Nunito', 'Trebuchet MS', system-ui, sans-serif;
  color: var(--ed-ink);
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 1rem;
  line-height: 1.5;
}

.ed *, .ed *::before, .ed *::after { box-sizing: border-box; }

.ed h1, .ed h2, .ed h3 { margin: 0; font-weight: 800; line-height: 1.2; }
.ed h1 { font-size: 1.6rem; }
.ed h2 { font-size: 1.25rem; }
.ed h3 { font-size: 1.05rem; }

.ed-muted { color: var(--ed-muted); margin: 0; }
.ed-hint { color: var(--ed-muted); font-size: 0.85rem; margin: 4px 0 0; }
.ed-opt { color: var(--ed-muted); font-weight: 500; }

/* ---------- Buttons ---------- */
.ed-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 16px; min-height: 42px;
  border: 2px solid var(--ed-line);
  border-radius: 12px;
  background: var(--ed-paper);
  color: var(--ed-ink);
  font: inherit; font-weight: 700; font-size: 0.92rem;
  cursor: pointer;
  transition: transform 0.08s ease, background 0.15s ease, border-color 0.15s ease;
}
.ed-btn:hover:not(:disabled) { border-color: var(--ed-grape); background: var(--ed-grape-soft); }
.ed-btn:active:not(:disabled) { transform: translateY(1px); }
.ed-btn:disabled, .ed-disabled { opacity: 0.5; cursor: not-allowed; }
.ed-btn:focus-visible, .ed-input:focus-visible, .ed-scene-pick:focus-visible, .ed-type-chip:focus-visible,
.ed-tab:focus-visible, .ed-seg-btn:focus-visible, .ed-icon-btn:focus-visible, .ed-add-btn:focus-visible,
.ed-story-tile:focus-visible, .ed-story-open:focus-visible, .ed-loose-btn:focus-visible {
  outline: 3px solid var(--ed-ending);
  outline-offset: 2px;
}

.ed-btn-primary {
  background: var(--ed-grape); border-color: var(--ed-grape); color: #fff;
  box-shadow: 0 3px 0 var(--ed-grape-dark);
}
.ed-btn-primary:hover:not(:disabled) { background: var(--ed-grape-dark); border-color: var(--ed-grape-dark); }
.ed-btn-primary:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 var(--ed-grape-dark); }
.ed-btn-ghost { background: transparent; border-color: transparent; color: var(--ed-muted); }
.ed-btn-ghost:hover:not(:disabled) { background: var(--ed-grape-soft); border-color: transparent; color: var(--ed-grape-dark); }
.ed-btn-small { min-height: 34px; padding: 5px 12px; font-size: 0.85rem; }
.ed-btn-danger-text { color: var(--ed-failure-ink); }
.ed-btn-danger-text:hover:not(:disabled) { background: var(--ed-failure-soft); color: var(--ed-failure-ink); }

.ed-file { position: relative; overflow: hidden; }
.ed-file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

.ed-icon-btn {
  width: 30px; height: 30px; border: 0; border-radius: 8px;
  background: transparent; color: var(--ed-muted); font-size: 0.65rem; cursor: pointer;
}
.ed-icon-btn:hover:not(:disabled) { background: var(--ed-grape-soft); color: var(--ed-grape); }
.ed-icon-btn:disabled { opacity: 0.3; cursor: default; }

.ed-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* ---------- Form fields ---------- */
.ed-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.ed-label { font-weight: 800; font-size: 0.88rem; }
.ed-input {
  width: 100%; padding: 10px 12px;
  border: 2px solid var(--ed-line); border-radius: 12px;
  font: inherit; background: #fff; color: var(--ed-ink);
}
.ed-input:hover { border-color: #cfc9ee; }
.ed-input:focus { border-color: var(--ed-grape); box-shadow: 0 0 0 4px var(--ed-grape-soft); outline: none; }
textarea.ed-input { resize: vertical; line-height: 1.5; }

/* ---------- Cards ---------- */
.ed-card {
  background: var(--ed-paper);
  border: 2px solid var(--ed-line);
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--ed-shadow);
}
.ed-card > h2 { margin-bottom: 12px; }
.ed-narrow { max-width: 720px; }

.ed-hero { padding: 4px 0 0; }
.ed-hero p { margin: 4px 0 0; color: var(--ed-muted); }

/* ---------- Alerts / status ---------- */
.ed-alert { padding: 12px 14px; border-radius: 14px; border: 2px solid transparent; font-weight: 700; }
.ed-alert ul { margin: 6px 0 0 18px; padding: 0; font-weight: 500; }
.ed-alert-error { background: var(--ed-failure-soft); border-color: #ffc4c4; color: var(--ed-failure-ink); }
.ed-alert-ok { background: var(--ed-start-soft); border-color: #b5ebd2; color: var(--ed-start-ink); }
.ed-alert-warn { background: var(--ed-ending-soft); border-color: #ffe39a; color: var(--ed-ending-ink); }
.ed-report { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }

.ed-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 11px; border-radius: 999px;
  background: var(--ed-ending-soft); color: var(--ed-ending-ink);
  font-size: 0.78rem; font-weight: 800; white-space: nowrap;
}
.ed-pill-live { background: var(--ed-start-soft); color: var(--ed-start-ink); }
.ed-pill-live::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--ed-start); }

.ed-note {
  background: var(--ed-ending-soft); color: var(--ed-ending-ink);
  border-radius: 12px; padding: 10px 12px; margin: 0 0 12px; font-weight: 700;
}

/* ---------- Story list ---------- */
.ed-story-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.ed-story-tile {
  position: relative; display: flex; flex-direction: column; text-align: left; font: inherit; color: inherit;
  padding: 0; overflow: hidden;
  background: var(--ed-paper);
  border: 2px solid var(--ed-line); border-radius: 18px;
  box-shadow: var(--ed-shadow);
  transition: transform 0.12s ease, border-color 0.12s ease;
}
.ed-story-tile:hover { border-color: var(--ed-grape); transform: translateY(-2px); }
.ed-story-new { cursor: default; border-style: dashed; box-shadow: none; background: transparent; }
.ed-story-thumb {
  position: relative; aspect-ratio: 16 / 9; display: grid; place-items: center;
  font-size: 0.85rem; font-weight: 700; color: var(--ed-muted);
  background: linear-gradient(135deg, var(--ed-grape-soft), var(--ed-narrative-soft));
  overflow: hidden;
}
.ed-story-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ed-story-thumb-title {
  position: absolute; top: 9px; right: 9px; z-index: 1; max-width: 48%;
  padding: 5px 10px; border: 1px solid rgba(255,255,255,0.7); border-radius: 10px;
  background: rgba(34, 27, 54, 0.82); color: #fff; font-size: 0.92rem; font-weight: 800;
  line-height: 1.2; text-align: right; overflow-wrap: anywhere; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.ed-story-thumb-new { background: var(--ed-ending-soft); color: var(--ed-ending); font-size: 2.4rem; font-weight: 800; }
.ed-story-info { padding: 14px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; flex: 1; }
.ed-story-info strong { font-size: 1.1rem; font-weight: 800; }
.ed-story-info .ed-btn { align-self: stretch; }
.ed-tile-cta { margin-top: auto; color: var(--ed-grape); font-weight: 800; font-size: 0.9rem; }
.ed-story-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; width: 100%; }
.ed-story-card-head > strong { min-width: 0; overflow-wrap: anywhere; }
.ed-story-thumb-controls { position: absolute; top: 8px; left: 8px; z-index: 2; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
.ed-story-card-controls { display: flex; align-items: center; gap: 5px; }
.ed-story-sequence { display: flex; align-items: center; gap: 4px; padding: 3px 5px; border-radius: 10px; background: var(--ed-bg); font-weight: 800; white-space: nowrap; }
.ed-story-sequence button { width: 26px; height: 26px; padding: 0; border: 1px solid var(--ed-line); border-radius: 7px; background: #fff; color: var(--ed-ink); font: inherit; cursor: pointer; }
.ed-story-sequence button:disabled { opacity: 0.35; cursor: default; }
.ed-story-lock { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,0.94); color: var(--ed-ink); font-size: 0.72rem; line-height: 1.2; font-weight: 800; }
.ed-story-lock input { margin: 0; flex: none; }
.ed-story-open { width: 100%; margin-top: 4px; }
.ed-story-sequence-bar { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-bottom: 12px; }

/* ---------- Top bar ---------- */
.ed-topbar {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 8px 12px;
  background: var(--ed-paper);
  border: 2px solid var(--ed-line); border-radius: 16px;
  box-shadow: var(--ed-shadow);
}
.ed-topbar-title { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 160px; }
.ed-topbar-title h1 { font-size: 1.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed-topbar-actions { display: flex; align-items: center; gap: 12px; }
.ed-save-state { font-size: 0.85rem; font-weight: 700; color: var(--ed-start-ink); }
.ed-save-dirty { color: var(--ed-ending-ink); }
.ed-draft-note { font-size: 0.9rem; }

/* ---------- Steps / tabs ---------- */
.ed-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.ed-tab {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 16px 8px 10px; min-height: 42px;
  border: 2px solid var(--ed-line); border-radius: 999px;
  background: var(--ed-paper); color: var(--ed-ink);
  font: inherit; font-weight: 800; cursor: pointer;
}
.ed-tab:hover { border-color: var(--ed-grape); }
.ed-tab-num {
  display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
  background: var(--ed-grape-soft); color: var(--ed-grape); font-size: 0.8rem;
}
.ed-tab-active { background: var(--ed-grape); border-color: var(--ed-grape); color: #fff; }
.ed-tab-active .ed-tab-num { background: #fff; }

/* ---------- Scenes layout ---------- */
.ed-grid { display: grid; grid-template-columns: 320px 1fr; gap: 16px; align-items: start; }
.ed-left { position: sticky; top: 80px; max-height: calc(100vh - 96px); overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding: 3px; margin: -3px; }
@media (max-width: 860px) {
  .ed-grid { grid-template-columns: 1fr; }
  .ed-left { position: static; max-height: none; overflow: visible; }
}

.ed-scene-list { list-style: none; margin: 12px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ed-scene {
  position: relative; display: flex; align-items: center; gap: 2px; padding: 3px;
  border: 2px solid var(--ed-line); border-radius: 14px; background: #fff;
}
.ed-scene:hover { border-color: #cfc9ee; }
.ed-scene-active, .ed-scene-active:hover { border-color: var(--ed-grape); background: var(--ed-grape-soft); }
.ed-scene-pick {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 5px;
  border: 0; background: none; font: inherit; color: inherit; text-align: left;
  cursor: pointer; border-radius: 10px;
}
.ed-scene-text { display: flex; flex-direction: column; min-width: 0; }
.ed-scene-text strong { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed-scene-text small { color: var(--ed-muted); font-weight: 600; font-size: 0.78rem; }
.ed-order { display: flex; flex-direction: column; }
.ed-order .ed-icon-btn { height: 22px; }

/* Scene type tiles: solid colour, white icon */
.ed-scene-icon {
  flex: none; display: grid; place-items: center;
  width: 34px; height: 34px; border-radius: 11px;
  background: var(--ed-muted); color: #fff;
}
.ed-scene-icon-lg { width: 48px; height: 48px; border-radius: 15px; }
.ed-scene-icon.ed-t-start { background: var(--ed-start); }
.ed-scene-icon.ed-t-narrative { background: var(--ed-narrative); }
.ed-scene-icon.ed-t-decision { background: var(--ed-decision); }
.ed-scene-icon.ed-t-failure { background: var(--ed-failure); }
.ed-scene-icon.ed-t-ending { background: var(--ed-ending); }

.ed-ico { display: block; flex: none; }

.ed-handle {
  flex: none; display: grid; place-items: center; width: 20px; align-self: stretch;
  color: #b9b4dc; font-weight: 800; letter-spacing: -2px; font-size: 0.85rem;
  cursor: grab; user-select: none; border-radius: 8px;
}
.ed-handle:hover { color: var(--ed-grape); }
.ed-handle:active { cursor: grabbing; }
.ed-scene-dragging { opacity: 0.4; }
.ed-drop-before::before, .ed-drop-after::after {
  content: ''; position: absolute; left: 4px; right: 4px; height: 4px; border-radius: 4px; background: var(--ed-grape);
}
.ed-drop-before::before { top: -6px; }
.ed-drop-after::after { bottom: -6px; }

/* Mapa ng kuwento */
.ed-map-scroll { max-height: 380px; overflow: auto; margin-top: 10px; border-radius: 14px; background: var(--ed-bg); }
.ed-map-body { position: relative; min-width: 240px; }
.ed-map-svg { position: absolute; top: 0; left: 0; z-index: 1; pointer-events: none; }
.ed-map-row {
  position: absolute; z-index: 0; left: 0; right: 0;
  display: flex; flex-direction: column; justify-content: center; text-align: left;
  border: 0; background: transparent; font: inherit; color: inherit; cursor: pointer; border-radius: 10px;
}
.ed-map-row:hover:not(:disabled) { background: rgba(109, 69, 240, 0.08); }
.ed-map-row-active { background: var(--ed-grape-soft); }
.ed-map-row:focus-visible { outline: 3px solid var(--ed-ending); outline-offset: -3px; }
.ed-map-row strong { font-size: 0.92rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ed-map-row small { color: var(--ed-muted); font-weight: 700; }
.ed-map-row small.ed-map-problem { color: var(--ed-failure-ink); font-weight: 800; }
.ed-map-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin: 10px 0 0; font-size: 0.78rem; font-weight: 700; color: var(--ed-muted); }
.ed-key { display: inline-block; width: 18px; height: 0; border-top: 3px solid; margin-right: -6px; }
.ed-key-right { border-color: #17a673; }
.ed-key-wrong { border-color: #ee5a5a; border-top-style: dashed; }
.ed-key-back { border-color: #b9b4dc; border-top-style: dashed; }
.ed-loose { margin-top: 12px; padding: 10px 12px; border-radius: 14px; background: var(--ed-ending-soft); display: flex; flex-direction: column; gap: 6px; align-items: flex-start; color: var(--ed-ending-ink); }
.ed-loose-item { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
.ed-loose-from { color: var(--ed-ending-ink); font-weight: 700; padding-left: 6px; }
.ed-loose-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border: 2px solid #ffe39a; border-radius: 999px; background: #fff;
  font: inherit; font-weight: 800; font-size: 0.85rem; cursor: pointer; color: var(--ed-ink);
}
.ed-loose-btn:hover:not(:disabled) { border-color: var(--ed-ending); }

/* ---------- Notifications & loading ---------- */
.ed-toasts {
  position: fixed; top: 68px; right: 16px; z-index: 1000;
  display: flex; flex-direction: column; gap: 10px;
  width: min(360px, calc(100vw - 32px)); pointer-events: none;
}
.ed-toast {
  pointer-events: auto; display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; border-radius: 14px;
  border: 2px solid var(--ed-line); background: #fff;
  box-shadow: 0 10px 28px rgba(37, 33, 74, 0.18);
  font-weight: 700; animation: ed-toast-in 0.18s ease-out;
}
.ed-toast-text { flex: 1; }
.ed-toast-ico {
  flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%;
  color: #fff; font-size: 0.78rem; font-weight: 800; background: var(--ed-muted);
}
.ed-toast-working { border-color: #cfc3fa; }
.ed-toast-success { border-color: #b5ebd2; background: var(--ed-start-soft); color: var(--ed-start-ink); }
.ed-toast-success .ed-toast-ico { background: var(--ed-start); }
.ed-toast-error { border-color: #ffc4c4; background: var(--ed-failure-soft); color: var(--ed-failure-ink); }
.ed-toast-error .ed-toast-ico { background: var(--ed-failure); }
.ed-toast-warn { border-color: #ffe39a; background: var(--ed-ending-soft); color: var(--ed-ending-ink); }
.ed-toast-warn .ed-toast-ico { background: var(--ed-ending); }
.ed-toast-x {
  border: 0; background: transparent; color: inherit; font-size: 1.3rem; line-height: 1;
  padding: 2px 8px; border-radius: 8px; cursor: pointer;
}
.ed-toast-x:hover { background: rgba(0, 0, 0, 0.08); }
@keyframes ed-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

.ed-spinner {
  flex: none; width: 32px; height: 32px; border-radius: 50%;
  border: 4px solid var(--ed-grape-soft); border-top-color: var(--ed-grape);
  animation: ed-spin 0.8s linear infinite;
}
.ed-spinner-sm { width: 18px; height: 18px; border-width: 3px; }
@keyframes ed-spin { to { transform: rotate(360deg); } }

.ed-loader { position: fixed; inset: 0; z-index: 900; display: grid; place-items: center; background: transparent; }
.ed-loader-card, .ed-loading-card {
  display: flex; align-items: center; gap: 14px; padding: 16px 22px;
  background: #fff; border: 2px solid var(--ed-line); border-radius: 18px;
  font-weight: 800; box-shadow: 0 10px 28px rgba(37, 33, 74, 0.14);
}
.ed-loading-card { align-self: flex-start; }

/* Add-scene buttons */
.ed-add { border-top: 2px dashed var(--ed-line); padding-top: 14px; }
.ed-add-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.ed-add-btn {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px; min-height: 42px;
  border: 2px solid var(--ed-line); border-radius: 12px; background: #fff;
  font: inherit; font-weight: 800; font-size: 0.86rem; color: var(--ed-ink); cursor: pointer;
}
.ed-add-btn > span {
  display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: #fff; flex: none;
}
.ed-add-btn:hover:not(:disabled) { transform: translateY(-1px); }
.ed-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ed-add-btn.ed-t-start > span { background: var(--ed-start); }
.ed-add-btn.ed-t-narrative > span { background: var(--ed-narrative); }
.ed-add-btn.ed-t-decision > span { background: var(--ed-decision); }
.ed-add-btn.ed-t-failure > span { background: var(--ed-failure); }
.ed-add-btn.ed-t-ending > span { background: var(--ed-ending); }
.ed-add-btn.ed-t-start:hover:not(:disabled) { background: var(--ed-start-soft); border-color: var(--ed-start); }
.ed-add-btn.ed-t-narrative:hover:not(:disabled) { background: var(--ed-narrative-soft); border-color: var(--ed-narrative); }
.ed-add-btn.ed-t-decision:hover:not(:disabled) { background: var(--ed-decision-soft); border-color: var(--ed-decision); }
.ed-add-btn.ed-t-failure:hover:not(:disabled) { background: var(--ed-failure-soft); border-color: var(--ed-failure); }
.ed-add-btn.ed-t-ending:hover:not(:disabled) { background: var(--ed-ending-soft); border-color: var(--ed-ending); }

/* ---------- Scene editor ---------- */
.ed-scene-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
.ed-scene-head > div { flex: 1; min-width: 200px; }

.ed-block { border-top: 2px dashed var(--ed-line); padding-top: 18px; margin-top: 18px; }
.ed-block > h3 { margin-bottom: 12px; }
.ed-scene-head + .ed-block { border-top: 0; padding-top: 0; margin-top: 0; }

.ed-type-row { display: flex; flex-wrap: wrap; gap: 8px; }
.ed-type-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px 6px 8px; min-height: 40px;
  border: 2px solid var(--ed-line); border-radius: 999px; background: #fff;
  font: inherit; font-weight: 800; font-size: 0.9rem; color: var(--ed-ink); cursor: pointer;
}
.ed-type-chip .ed-chip-ico {
  display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; color: #fff; background: var(--ed-muted);
}
.ed-type-chip.ed-t-start .ed-chip-ico { background: var(--ed-start); }
.ed-type-chip.ed-t-narrative .ed-chip-ico { background: var(--ed-narrative); }
.ed-type-chip.ed-t-decision .ed-chip-ico { background: var(--ed-decision); }
.ed-type-chip.ed-t-failure .ed-chip-ico { background: var(--ed-failure); }
.ed-type-chip.ed-t-ending .ed-chip-ico { background: var(--ed-ending); }
.ed-type-chip:hover { border-color: #b9b4dc; }
.ed-type-chip-on.ed-t-start { background: var(--ed-start-soft); border-color: var(--ed-start); }
.ed-type-chip-on.ed-t-narrative { background: var(--ed-narrative-soft); border-color: var(--ed-narrative); }
.ed-type-chip-on.ed-t-decision { background: var(--ed-decision-soft); border-color: var(--ed-decision); }
.ed-type-chip-on.ed-t-failure { background: var(--ed-failure-soft); border-color: var(--ed-failure); }
.ed-type-chip-on.ed-t-ending { background: var(--ed-ending-soft); border-color: var(--ed-ending); }

/* Pictures */
.ed-media { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.ed-media-preview {
  width: 100%; max-width: 420px; max-height: 200px; object-fit: cover;
  border-radius: 14px; border: 2px solid var(--ed-line);
}
.ed-media-empty {
  width: 100%; max-width: 420px; padding: 28px 16px; text-align: center;
  color: var(--ed-muted); font-weight: 700;
  border: 2px dashed var(--ed-line); border-radius: 14px; background: var(--ed-bg);
}

/* Choices */
.ed-choice {
  border: 2px solid var(--ed-line); border-left-width: 8px;
  border-radius: 16px; padding: 14px; margin-bottom: 12px; background: #fff;
}
.ed-choice-right { border-color: #b5ebd2; border-left-color: var(--ed-start); background: #fbfffd; }
.ed-choice-wrong { border-color: #ffc4c4; border-left-color: var(--ed-failure); background: #fffcfc; }
.ed-choice-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.ed-choice-num {
  flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
  background: var(--ed-grape); color: #fff; font-weight: 800; font-size: 0.82rem;
}
.ed-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 14px; }
.ed-seg-btn {
  padding: 8px 10px; min-height: 40px;
  border: 2px solid var(--ed-line); border-radius: 12px; background: #fff;
  font: inherit; font-weight: 800; font-size: 0.9rem; color: var(--ed-muted); cursor: pointer;
}
.ed-seg-btn:hover:not(:disabled) { border-color: var(--ed-grape); }
.ed-seg-btn:disabled { cursor: default; }
.ed-seg-right { background: var(--ed-start-soft); border-color: var(--ed-start); color: var(--ed-start-ink); }
.ed-seg-wrong { background: var(--ed-failure-soft); border-color: var(--ed-failure); color: var(--ed-failure-ink); }
.ed-flow { margin: 2px 0 0; font-size: 0.85rem; font-weight: 700; color: var(--ed-grape); }
.ed-choice-tools { justify-content: flex-end; gap: 4px; }

.ed-savebar {
  position: sticky; bottom: 0; display: flex; gap: 10px; flex-wrap: wrap;
  margin: 20px -20px -20px; padding: 12px 20px;
  background: var(--ed-paper); border-top: 2px solid var(--ed-line); border-radius: 0 0 16px 16px;
}

/* Empty states */
.ed-empty { text-align: center; color: var(--ed-muted); padding: 28px 12px; font-weight: 700; }
.ed-empty p { margin: 0; }
.ed-empty-small { padding: 12px; background: var(--ed-bg); border-radius: 12px; margin-bottom: 12px; }

/* Checklist */
.ed-checklist { list-style: none; margin: 16px 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ed-check { display: flex; gap: 10px; align-items: baseline; padding: 10px 12px; border-radius: 12px; font-weight: 700; }
.ed-check > span:first-child { font-weight: 800; }
.ed-check-ok { background: var(--ed-start-soft); color: var(--ed-start-ink); }
.ed-check-todo { background: var(--ed-ending-soft); color: var(--ed-ending-ink); }

.ed-scene-preview-scrim {
  position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center;
  padding: 20px; background: rgba(22, 17, 37, 0.78);
}
.ed-scene-preview-dialog {
  width: min(1100px, 96vw); max-height: 94dvh; overflow: hidden; padding: 14px;
  border: 1px solid rgba(255,255,255,0.24); border-radius: 18px;
  background: #201b2b; box-shadow: 0 24px 80px rgba(0,0,0,0.45); color: #fff;
}
.ed-scene-preview-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.ed-scene-preview-head h2 { margin: 0; font-size: 1.05rem; }
.ed-scene-preview-stage {
  position: relative; width: min(100%, calc((94dvh - 100px) * 16 / 9)); max-height: calc(94dvh - 100px);
  aspect-ratio: 16 / 9; margin: 0 auto; overflow: hidden;
  background: #46372f center / cover no-repeat; border-radius: 12px;
}
.ed-scene-preview-art { position: absolute; inset: 0; pointer-events: none; }
.ed-scene-preview-art img { position: absolute; max-width: none; user-select: none; -webkit-user-drag: none; }
.ed-scene-preview-panel {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 1; max-height: 58%; overflow: auto;
  padding: clamp(12px, 2.5vw, 24px) clamp(14px, 5vw, 58px);
  color: #fff7e8; background: rgba(65, 40, 26, 0.82);
}
.ed-scene-preview-title { display: inline-block; margin-bottom: 8px; padding: 4px 10px; border-radius: 6px; background: rgba(110, 67, 35, 0.95); font-weight: 800; }
.ed-scene-preview-narration { margin: 0 0 8px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.4; }
.ed-scene-preview-dialogue { margin: 0 0 8px; font-style: italic; }
.ed-scene-preview-choices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.ed-scene-preview-choice { display: grid; place-items: center; min-height: 42px; padding: 8px 10px; border-radius: 10px; background: #fff4d7; color: #432d1d; text-align: center; font-weight: 800; overflow-wrap: anywhere; }
.ed-scene-preview-empty { position: absolute; inset: 0; display: grid; place-items: center; padding: 20px; color: rgba(255,255,255,0.85); text-align: center; text-shadow: 0 1px 4px #000; }
.ed-preview-animations {
  position: absolute; top: 10px; right: 10px; z-index: 2; width: min(34%, 290px); max-height: 46%;
  overflow: hidden; padding: 8px 10px; border: 1px solid rgba(255,255,255,0.24); border-radius: 10px;
  background: rgba(24, 20, 19, 0.78); color: rgba(255,255,255,0.95);
  font-size: clamp(0.55rem, 1vw, 0.8rem); line-height: 1.25; pointer-events: none;
}
.ed-preview-animations strong { display: block; margin-bottom: 3px; }
.ed-preview-animations ul { margin: 4px 0 0; padding-left: 18px; }
.ed-preview-animations li + li { margin-top: 2px; }
@media (max-width: 600px) {
  .ed-scene-preview-scrim { padding: 8px; }
  .ed-scene-preview-dialog { width: 100%; max-height: 96dvh; padding: 10px; }
  .ed-scene-preview-stage { width: min(100%, calc((96dvh - 76px) * 16 / 9)); max-height: calc(96dvh - 76px); }
  .ed-scene-preview-choices { gap: 5px; }
  .ed-scene-preview-choice { min-height: 32px; padding: 5px; font-size: clamp(0.55rem, 2vw, 0.8rem); }
  .ed-scene-preview-panel { max-height: 68%; padding: 8px 12px; font-size: clamp(0.65rem, 2.2vw, 0.95rem); }
  .ed-scene-preview-title { margin-bottom: 4px; padding: 2px 7px; }
  .ed-scene-preview-narration, .ed-scene-preview-dialogue { margin-bottom: 4px; }
  .ed-preview-animations { top: 5px; right: 5px; width: min(43%, 210px); padding: 5px 7px; font-size: clamp(0.48rem, 1.8vw, 0.7rem); }
}

@media (prefers-reduced-motion: reduce) {
  .ed * { transition: none !important; }
  .ed-toast { animation: none; }
  .ed-spinner { animation-duration: 2.4s; }
}

`;

const BASE = '/admin/content';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

// Plain-language names for the scene types. The saved values stay the same.
const SCENE_TYPES = {
  start: {
    label: 'Simula',
    help: 'Dito nagsisimula ang kuwento. Ipinapakita nito ang unang bahagi at humahantong sa susunod na eksena.',
  },
  narrative: {
    label: 'Bahagi ng kuwento',
    help: 'Ipinapakita nito ang nangyayari, pagkatapos ay pipindot ang mag-aaral para magpatuloy.',
  },
  decision: {
    label: 'Tanong',
    help: 'Pipili ng sagot ang mag-aaral. May isang tamang sagot. Dadalhin sa eksenang “Naku!” ang mga maling sagot.',
  },
  failure: {
    label: 'Naku!',
    help: 'Lalabas ito kapag mali ang sagot. Pabalikin ang mag-aaral para sumubok muli.',
  },
  ending: {
    label: 'Wakas',
    help: 'Dito nagtatapos ang kuwento. Wala nang susunod na eksena.',
  },
};
const TYPE_ORDER = ['start', 'narrative', 'decision', 'failure', 'ending'];

// One consistent icon set (24x24 outline paths) instead of emoji.
const ICON_PATHS = {
  start: ['M6 21V4', 'M6 4h11l-2.5 4L17 12H6'],
  narrative: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
  decision: ['M9.2 9a3 3 0 1 1 4.6 2.5c-1.1.7-1.8 1.3-1.8 2.7', 'M12 18h.01'],
  failure: ['M7 7l10 10', 'M17 7L7 17'],
  ending: ['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z'],
};

function SceneIcon({ type, size = 18 }) {
  const paths = ICON_PATHS[type];
  if (!paths) return null;
  return (
    <svg
      className="ed-ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

async function uploadImage(storyId, kind, sceneId, file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG o WebP image.');
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error('That image is larger than 5 MB.');

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const qs = new URLSearchParams({ kind });
  if (sceneId) qs.set('sceneId', sceneId);

  const response = await fetch(`/api${BASE}/stories/${storyId}/images?${qs}`, {
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

async function uploadSceneAudio(storyId, sceneId, file) {
  if (file.type && !['audio/mpeg', 'audio/mp3', 'application/octet-stream'].includes(file.type)) {
    throw new Error('Pumili ng MP3 audio file.');
  }
  if (!file.name.toLowerCase().endsWith('.mp3')) throw new Error('Pumili ng MP3 audio file.');
  if (file.size > MAX_AUDIO_BYTES) throw new Error('That audio file is larger than 20 MB.');
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const qs = new URLSearchParams({ sceneId });
  const response = await fetch(`/api${BASE}/stories/${storyId}/audio?${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', Authorization: `Bearer ${token}` },
    body: file,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Upload failed (${response.status})`);
  return payload.url;
}

/* ------------------------------------------------------------------ */
/* Notifications (top-right cards)                                     */
/* ------------------------------------------------------------------ */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef({});

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (kind, text, ms) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((prev) => [...prev, { id, kind, text }]);
      if (ms) timers.current[id] = setTimeout(() => dismissToast(id), ms);
      return id;
    },
    [dismissToast]
  );

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  return { toasts, pushToast, dismissToast };
}

const TOAST_ICONS = { success: '✓', error: '!', warn: 'i' };

function Toasts({ toasts, onDismiss }) {
  return (
    <div className="ed-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`ed-toast ed-toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          {t.kind === 'working' ? (
            <span className="ed-spinner ed-spinner-sm" aria-hidden="true" />
          ) : (
            <span className="ed-toast-ico" aria-hidden="true">
              {TOAST_ICONS[t.kind]}
            </span>
          )}
          <span className="ed-toast-text">{t.text}</span>
          {t.kind !== 'working' && (
            <button type="button" className="ed-toast-x" aria-label="Dismiss" onClick={() => onDismiss(t.id)}>
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Story list                                                          */
/* ------------------------------------------------------------------ */
export default function StoryConfiguration() {
  const [stories, setStories] = useState([]);
  const [sequenceDraft, setSequenceDraft] = useState([]);
  const [sequenceSaving, setSequenceSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const { toasts, pushToast, dismissToast } = useToasts();

  const loadStories = useCallback(async () => {
    try {
      const { stories: list } = await apiFetch(`${BASE}/stories`);
      setStories(list);
      setSequenceDraft(list);
    } catch (err) {
      pushToast('error', err.message, 9000);
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  async function createStory() {
    try {
      const { story } = await apiFetch(`${BASE}/stories`, {
        method: 'POST',
        body: { title: newTitle },
      });
      setNewTitle('');
      await loadStories();
      setOpenId(story.id);
    } catch (err) {
      pushToast('error', err.message, 9000);
    }
  }

  function moveStory(index, offset) {
    const target = index + offset;
    if (target < 0 || target >= sequenceDraft.length) return;
    setSequenceDraft((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function saveSequence() {
    setSequenceSaving(true);
    try {
      await apiFetch(`${BASE}/stories/sequence`, {
        method: 'PATCH',
        body: {
          stories: sequenceDraft.map((story, sequence_order) => ({
            id: story.id,
            sequence_order,
            unlock_after_previous: story.unlock_after_previous,
          })),
        },
      });
      pushToast('success', 'Na-save ang pagkakasunod-sunod at mga setting ng pagbubukas ng kuwento.', 4000);
      await loadStories();
    } catch (err) {
      pushToast('error', err.message, 9000);
    } finally {
      setSequenceSaving(false);
    }
  }

  if (openId) {
    return (
      <StoryEditor
        storyId={openId}
        onClose={() => {
          setOpenId(null);
          loadStories();
        }}
      />
    );
  }

  return (
    <div className="ed">
      <style>{EDITOR_CSS}</style>
      <header className="ed-hero">
        <h1>Mga kuwento mo</h1>
        <p>Pumili ng kuwentong babaguhin o magsimula ng bago.</p>
      </header>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
      {loading && <p className="ed-muted">Naglo-load ng mga kuwento…</p>}

      {!loading && stories.length > 0 && (
        <div className="ed-story-sequence-bar">
          <span className="ed-muted">Laging bukas ang unang kuwento. Nilalaktawan ang mga burador.</span>
          <button
            type="button"
            className="ed-btn ed-btn-primary"
            disabled={sequenceSaving || JSON.stringify(sequenceDraft) === JSON.stringify(stories)}
            onClick={saveSequence}
          >
            {sequenceSaving ? 'Sine-save?' : 'I-save ang pagkakasunod-sunod'}
          </button>
        </div>
      )}

      <div className="ed-story-grid">
        {sequenceDraft.map((s, index) => (
          <article key={s.id} className="ed-story-tile">
            <div className="ed-story-thumb">
              {s.cover_image_path ? <img src={s.cover_image_path} alt="" /> : <span>Walang larawan sa pabalat</span>}
              <span className="ed-story-thumb-title">{s.title}</span>
              <div className="ed-story-thumb-controls">
                <span className={s.status === 'published' ? 'ed-pill ed-pill-live' : 'ed-pill'}>
                  {s.status === 'published' ? 'Live' : 'Draft'}
                </span>
                <div className="ed-story-sequence" aria-label={`Story sequence ${index + 1}`}>
                  <span>#{index + 1}</span>
                  <button type="button" aria-label={`Move ${s.title} up`} disabled={index === 0 || sequenceSaving} onClick={() => moveStory(index, -1)}>&#8593;</button>
                  <button type="button" aria-label={`Move ${s.title} down`} disabled={index === sequenceDraft.length - 1 || sequenceSaving} onClick={() => moveStory(index, 1)}>&#8595;</button>
                </div>
                <label className="ed-story-lock" title={index === 0 ? 'Laging bukas ang unang kuwento' : 'I-lock hanggang matapos ang naunang kuwento'}>
                  <input
                    type="checkbox"
                    checked={index > 0 && !!s.unlock_after_previous}
                    disabled={index === 0 || sequenceSaving}
                    onChange={(event) => setSequenceDraft((current) => current.map((item) => item.id === s.id
                      ? { ...item, unlock_after_previous: event.target.checked }
                      : item))}
                  />
                  <span>I-lock</span>
                </label>
              </div>
            </div>
            <div className="ed-story-info">
              {s.description && <p className="ed-muted">{s.description}</p>}
              <button type="button" className="ed-btn ed-story-open" onClick={() => setOpenId(s.id)}>
                Open and edit
              </button>
            </div>
          </article>
        ))}

        <div className="ed-story-tile ed-story-new">
          <div className="ed-story-thumb ed-story-thumb-new">
            <span>+</span>
          </div>
          <div className="ed-story-info">
            <strong>Magsimula ng bagong kuwento</strong>
            <label className="ed-label" htmlFor="new-story-title">
              Pamagat ng kuwento
            </label>
            <input
              id="new-story-title"
              className="ed-input"
              type="text"
              value={newTitle}
              placeholder="e.g. The Lost Puppy"
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && createStory()}
            />
            <button type="button" className="ed-btn ed-btn-primary" disabled={!newTitle.trim()} onClick={createStory}>
              Create story
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Story editor                                                        */
/* ------------------------------------------------------------------ */
function StoryEditor({ storyId, onClose }) {
  const [data, setData] = useState(null);
  const [storyForm, setStoryForm] = useState({ title: '', author: '', full_story_text: '', description: '', starting_scene_id: '' });
  const [sceneId, setSceneId] = useState(null);
  const [sceneForm, setSceneForm] = useState(null);
  const [choiceForms, setChoiceForms] = useState([]);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showLoader, setShowLoader] = useState(false);
  const { toasts, pushToast, dismissToast } = useToasts();
  const [tab, setTab] = useState('scenes');
  const [dirtyStory, setDirtyStory] = useState(false);
  const [dirtyScene, setDirtyScene] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [editingScene, setEditingScene] = useState(false);
  const [showScenePreview, setShowScenePreview] = useState(false);
  const dirty = dirtyStory || dirtyScene;

  const load = useCallback(
    async (resetStoryForm = false) => {
      const d = await apiFetch(`${BASE}/stories/${storyId}`);
      setData(d);
      if (resetStoryForm) {
        setStoryForm({
          title: d.story.title,
          author: d.story.author ?? '',
          full_story_text: d.story.full_story_text ?? '',
          description: d.story.description ?? '',
          starting_scene_id: d.story.starting_scene_id ?? '',
        });
        setDirtyStory(false);
      }
      return d;
    },
    [storyId]
  );

  useEffect(() => {
    load(true)
      .then((d) => setSceneId((cur) => cur ?? d.scenes[0]?.id ?? null))
      .catch((err) => setError(err.message));
  }, [load]);

  // Sync the scene and choice forms whenever the saved data or selection changes.
  useEffect(() => {
    if (!data) return;
    const scene = data.scenes.find((s) => s.id === sceneId);
    setDirtyScene(false);
    if (!scene) {
      setSceneForm(null);
      setChoiceForms([]);
      return;
    }
    setSceneForm({
      title: scene.title,
      scene_type: scene.scene_type,
      narration: scene.narration,
      dialogue: scene.dialogue ?? '',
    });
    setChoiceForms(
      data.choices
        .filter((c) => c.scene_id === sceneId)
        .map((c) => ({
          id: c.id,
          text: c.text,
          destination_scene_id: c.destination_scene_id ?? '',
          failure_scene_id: c.failure_scene_id ?? '',
          is_correct: c.is_correct,
          feedback: c.feedback ?? '',
        }))
    );
  }, [data, sceneId]);

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

  // Only show the full-screen loader if an action takes more than a moment.
  useEffect(() => {
    if (!busy) {
      setShowLoader(false);
      return undefined;
    }
    const t = setTimeout(() => setShowLoader(true), 250);
    return () => clearTimeout(t);
  }, [busy]);

  async function act(fn, ok, working = 'Working…') {
    setBusy(true);
    const workingId = pushToast('working', working);
    try {
      await fn();
      dismissToast(workingId);
      if (ok) pushToast('success', ok, 3500);
    } catch (err) {
      dismissToast(workingId);
      pushToast('error', err.message || 'Something went wrong.', 9000);
      if (err.details?.errors) setReport(err.details);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- persistence (same API calls as before) ---------- */
  async function persistStory() {
    await apiFetch(`${BASE}/stories/${storyId}`, {
      method: 'PATCH',
      body: {
        title: storyForm.title,
        author: storyForm.author,
        full_story_text: storyForm.full_story_text,
        description: storyForm.description,
        starting_scene_id: storyForm.starting_scene_id || null,
      },
    });
    setDirtyStory(false);
  }

  async function persistScene() {
    if (!sceneId || !sceneForm || !dirtyScene) return;
    await apiFetch(`${BASE}/scenes/${sceneId}`, {
      method: 'PATCH',
      body: {
        title: sceneForm.title,
        scene_type: sceneForm.scene_type,
        narration: sceneForm.narration,
        dialogue: sceneForm.dialogue,
      },
    });
    await Promise.all(
      choiceForms.map((c, i) =>
        apiFetch(`${BASE}/choices/${c.id}`, {
          method: 'PATCH',
          body: {
            text: c.text,
            destination_scene_id: c.destination_scene_id || null,
            failure_scene_id: c.failure_scene_id || null,
            is_correct: sceneForm.scene_type === 'decision' && !!c.is_correct,
            feedback: c.feedback,
            display_order: i,
          },
        })
      )
    );
    setDirtyScene(false);
  }

  /* ---------- actions ---------- */
  const saveAll = () =>
    act(async () => {
      await persistStory();
      await persistScene();
      await load();
    }, 'All changes saved.', 'Saving…');

  const selectScene = (id) => {
    if (id === sceneId) return;
    // Save the scene being left so nothing is lost, then switch.
    act(async () => {
      await persistScene();
      await load();
      setSceneId(id);
    }, null, 'Opening scene…');
  };

  const addScene = (type = 'narrative') =>
    act(async () => {
      await persistScene();
      const { scene } = await apiFetch(`${BASE}/stories/${storyId}/scenes`, {
        method: 'POST',
        body: { title: 'New scene', scene_type: type },
      });
      await load();
      setSceneId(scene.id);
      setTab('scenes');
    }, 'Naidagdag ang eksena. Lagyan ito ng pangalan at isulat ang mangyayari.');

  const deleteScene = () => {
    if (!window.confirm('Burahin ang eksena at mga pagpipilian nito? Hindi na ito maibabalik.')) return;
    act(async () => {
      await apiFetch(`${BASE}/scenes/${sceneId}`, { method: 'DELETE' });
      const d = await load();
      setSceneId(d.scenes[0]?.id ?? null);
    }, 'Scene deleted.');
  };

  const reorderScenes = (from, to) => {
    if (from === to || from == null || to == null) return;
    return act(async () => {
      await persistScene();
      const ordered = [...data.scenes];
      if (to < 0 || to >= ordered.length) return;
      const [moved] = ordered.splice(from, 1);
      ordered.splice(to, 0, moved);
      await Promise.all(
        ordered.map((sc, i) =>
          sc.display_order !== i
            ? apiFetch(`${BASE}/scenes/${sc.id}`, { method: 'PATCH', body: { display_order: i } })
            : null
        )
      );
      await load();
    }, null, 'Moving scene…');
  };

  const moveScene = (index, dir) => reorderScenes(index, index + dir);

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const makeStart = () =>
    act(async () => {
      await persistScene();
      await apiFetch(`${BASE}/stories/${storyId}`, {
        method: 'PATCH',
        body: { starting_scene_id: sceneId },
      });
      await load();
      setStoryForm((p) => ({ ...p, starting_scene_id: sceneId }));
    }, 'Dito na nagsisimula ang kuwento.');

  const addChoice = () =>
    act(async () => {
      await persistScene();
      await apiFetch(`${BASE}/scenes/${sceneId}/choices`, {
        method: 'POST',
        body: { text: 'New choice' },
      });
      await load();
    }, 'Naidagdag ang pagpipilian.');

  const deleteChoice = (id) => {
    if (!window.confirm('Burahin ang pagpipiliang ito?')) return;
    act(async () => {
      await persistScene();
      await apiFetch(`${BASE}/choices/${id}`, { method: 'DELETE' });
      await load();
    }, 'Choice deleted.');
  };

  const updateStory = (patch) => {
    setStoryForm((p) => ({ ...p, ...patch }));
    setDirtyStory(true);
  };

  const updateScene = (patch) => {
    setSceneForm((p) => ({ ...p, ...patch }));
    setDirtyScene(true);
  };

  const updateChoice = (id, patch) => {
    setChoiceForms((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setDirtyScene(true);
  };

  const setCorrect = (id) => {
    setChoiceForms((prev) => prev.map((c) => ({ ...c, is_correct: c.id === id })));
    setDirtyScene(true);
  };

  const moveChoice = (i, dir) => {
    setChoiceForms((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirtyScene(true);
  };

  const validate = () =>
    act(async () => {
      await persistStory();
      await persistScene();
      setReport(await apiFetch(`${BASE}/stories/${storyId}/validate`, { method: 'POST' }));
      await load();
    }, 'Check finished.', 'Checking your story…');

  const publish = () =>
    act(async () => {
      await persistStory();
      await persistScene();
      const r = await apiFetch(`${BASE}/stories/${storyId}/publish`, { method: 'POST' });
      setReport({ errors: [], warnings: r.warnings ?? [] });
      await load();
    }, 'Nailathala na! Makikita na ng mga mag-aaral ang bersyong ito.', 'Publishing…');

  const unpublish = () =>
    act(async () => {
      await apiFetch(`${BASE}/stories/${storyId}/unpublish`, { method: 'POST' });
      await load();
    }, 'Inalis na sa pagkakalathala. Hindi na masisimulan ng mga mag-aaral ang kuwentong ito.');

  const uploadCover = (file) =>
    file &&
    act(async () => {
      await uploadImage(storyId, 'cover', null, file);
      await load();
    }, 'Cover picture updated.');

  const removeCover = () =>
    act(async () => {
      await apiFetch(`${BASE}/stories/${storyId}/images?kind=cover`, { method: 'DELETE' });
      await load();
    }, 'Cover picture removed.');

  const uploadBackground = (file) =>
    file &&
    act(async () => {
      await persistScene();
      await uploadImage(storyId, 'background', sceneId, file);
      await load();
    }, 'Na-update ang larawan sa likuran. Ilathala para makita ito ng mga mag-aaral.');

  const removeBackground = () =>
    act(async () => {
      await persistScene();
      await apiFetch(`${BASE}/stories/${storyId}/images?kind=background&sceneId=${sceneId}`, {
        method: 'DELETE',
      });
      await load();
    }, 'Inalis ang larawan sa likuran. Ilathala para mailapat ito.');

  const uploadSoundEffect = (file) =>
    file &&
    act(async () => {
      await persistScene();
      await uploadSceneAudio(storyId, sceneId, file);
      await load();
    }, 'Na-update ang tunog. Ilathala para mailapat ito.');

  const removeSoundEffect = () =>
    act(async () => {
      await persistScene();
      await apiFetch(`${BASE}/stories/${storyId}/audio?sceneId=${sceneId}`, { method: 'DELETE' });
      await load();
    }, 'Inalis ang tunog. Ilathala para mailapat ito.');

  /* ---------- derived values (hooks must run before any early return) ---------- */
  const scenes = data?.scenes;
  const choices = data?.choices;

  const choiceCounts = useMemo(() => {
    const m = {};
    (choices ?? []).forEach((c) => {
      m[c.scene_id] = (m[c.scene_id] || 0) + 1;
    });
    return m;
  }, [choices]);

  const checklist = useMemo(() => {
    if (!scenes) return [];
    const needsExit = scenes.filter((s) => s.scene_type !== 'ending' && !choiceCounts[s.id]);
    return [
      { ok: !!storyForm.title.trim(), text: 'The story has a title' },
      { ok: scenes.length > 0, text: 'The story has at least one scene' },
      { ok: !!storyForm.starting_scene_id, text: 'A starting scene is chosen' },
      { ok: scenes.some((s) => s.scene_type === 'ending'), text: 'There is at least one "The End" scene' },
      {
        ok: needsExit.length === 0,
        text:
          needsExit.length === 0
            ? 'May patutunguhan ang bawat eksena'
            : `Wala pang pagpipilian ang mga eksenang ito: ${needsExit.map((s) => s.title || 'Walang pamagat').join(', ')}`,
      },
    ];
  }, [scenes, choiceCounts, storyForm.title, storyForm.starting_scene_id]);

  if (!data) {
    return (
      <div className="ed">
        <style>{EDITOR_CSS}</style>
        {error ? (
          <div className="ed-alert ed-alert-error">{error}</div>
        ) : (
          <div className="ed-loading-card">
            <span className="ed-spinner" aria-hidden="true" />
            <span>Naglo-load ang kuwento…</span>
          </div>
        )}
        <button type="button" className="ed-btn" onClick={onClose}>
          ← Back to stories
        </button>
      </div>
    );
  }

  const { story } = data;
  const currentScene = scenes.find((s) => s.id === sceneId);
  const isLive = story.status === 'published';
  const type = sceneForm?.scene_type;
  const typeInfo = SCENE_TYPES[type];
  const previewObjects = Array.isArray(currentScene?.character_config?.objects)
    ? currentScene.character_config.objects
    : [];
    if (editingScene && currentScene) {
    return (
      <div className="ed">
        <style>{EDITOR_CSS}</style>
        <Toasts toasts={toasts} onDismiss={dismissToast} />
        <SceneEditor
          key={currentScene.id}
          storyId={storyId}
          scene={currentScene}
          notify={pushToast}
          onClose={() => {
            setEditingScene(false);
            load().catch(() => {});
          }}
        />
      </div>
    );
  }

  const sceneOptions = scenes.map((s) => (
    <option key={s.id} value={s.id}>
      {`${s.title || 'Walang pamagat'} (${SCENE_TYPES[s.scene_type]?.label ?? s.scene_type})`}
    </option>
  ));

  const sceneName = (id) => {
    const s = scenes.find((x) => x.id === id);
    return s ? s.title || 'Walang pamagat' : null;
  };

  return (
    <div className="ed" aria-busy={busy}>
      <style>{EDITOR_CSS}</style>
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      {showLoader && (
        <div className="ed-loader" role="status">
          <div className="ed-loader-card">
            <span className="ed-spinner" aria-hidden="true" />
            <span>Sandali…</span>
          </div>
        </div>
      )}
      {/* Top bar */}
      <div className="ed-topbar">
        <button type="button" className="ed-btn ed-btn-ghost" onClick={onClose}>
          ← All stories
        </button>
        <div className="ed-topbar-title">
          <h1>{storyForm.title || story.title}</h1>
          <span className={isLive ? 'ed-pill ed-pill-live' : 'ed-pill'}>{isLive ? 'Live' : 'Draft'}</span>
        </div>
        <div className="ed-topbar-actions">
          <span className={dirty ? 'ed-save-state ed-save-dirty' : 'ed-save-state'}>
            {busy ? 'Working…' : dirty ? 'May pagbabagong hindi pa nase-save' : '✓ All saved'}
          </span>
          <button type="button" className="ed-btn ed-btn-primary" disabled={busy || !dirty} onClick={saveAll}>
            Save
          </button>
        </div>
      </div>

      <p className="ed-muted ed-draft-note">
        Mananatiling pribado bilang burador ang mga pagbabago. Makikita lamang ito ng mga mag-aaral kapag pinindot ang <strong>Ilathala</strong> sa hakbang 3.
      </p>

      {/* Steps */}
      <div className="ed-tabs" role="tablist">
        {[
          ['info', '1', 'Impormasyon ng kuwento'],
          ['scenes', '2', 'Buuin ang mga eksena'],
          ['publish', '3', 'Suriin at ilathala'],
        ].map(([key, n, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'ed-tab ed-tab-active' : 'ed-tab'}
            onClick={() => setTab(key)}
          >
            <span className="ed-tab-num">{n}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ---------------- Step 1: Story info ---------------- */}
      {tab === 'info' && (
        <div className="ed-card ed-narrow">
          <h2>Ipakilala ang iyong kuwento</h2>
          <div className="ed-field">
            <label className="ed-label" htmlFor="story-title">
              Pamagat ng kuwento
            </label>
            <input
              id="story-title"
              className="ed-input"
              type="text"
              value={storyForm.title}
              onChange={(e) => updateStory({ title: e.target.value })}
            />
          </div>
          <div className="ed-field">
            <label className="ed-label" htmlFor="story-author">
              May-akda
            </label>
            <input
              id="story-author"
              className="ed-input"
              type="text"
              maxLength={160}
              value={storyForm.author}
              onChange={(e) => updateStory({ author: e.target.value })}
            />
          </div>
          <div className="ed-field">
            <label className="ed-label" htmlFor="story-full-text">
              Buong teksto ng kuwento
            </label>
            <textarea
              id="story-full-text"
              className="ed-input"
              rows={12}
              maxLength={50000}
              placeholder="Isulat ang buong kuwentong mababasa ng mga mag-aaral sa icon ng aklat."
              value={storyForm.full_story_text}
              onChange={(e) => updateStory({ full_story_text: e.target.value })}
            />
            <p className="ed-hint">Awtomatikong hahatiin ang tekstong ito sa mga pahina ng aklat para sa mga mag-aaral.</p>
          </div>
          <div className="ed-field">
            <label className="ed-label" htmlFor="story-desc">
              Maikling paglalarawan
            </label>
            <textarea
              id="story-desc"
              className="ed-input"
              rows={3}
              placeholder="Tungkol saan ang kuwento? Makikita ito ng mga mag-aaral sa kard ng kuwento."
              value={storyForm.description}
              onChange={(e) => updateStory({ description: e.target.value })}
            />
          </div>
          <div className="ed-field">
            <label className="ed-label" htmlFor="story-start">
              Aling eksena ang simula ng kuwento?
            </label>
            <select
              id="story-start"
              className="ed-input"
              value={storyForm.starting_scene_id}
              onChange={(e) => updateStory({ starting_scene_id: e.target.value })}
            >
              <option value="">— pumili ng eksena —</option>
              {sceneOptions}
            </select>
            {scenes.length === 0 && <p className="ed-hint">Magdagdag muna ng eksena sa hakbang 2.</p>}
          </div>

          <div className="ed-field">
            <span className="ed-label">Larawan sa pabalat</span>
            <div className="ed-media">
              {story.cover_image_path ? (
                <img className="ed-media-preview" src={story.cover_image_path} alt="Silip sa pabalat" />
              ) : (
                <div className="ed-media-empty">Wala pang larawan sa pabalat</div>
              )}
              <div className="ed-row">
                <label className={busy ? 'ed-btn ed-file ed-disabled' : 'ed-btn ed-file'}>
                  {story.cover_image_path ? 'Palitan ang larawan' : 'Mag-upload ng larawan'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      uploadCover(file);
                    }}
                  />
                </label>
                {story.cover_image_path && (
                  <button type="button" className="ed-btn ed-btn-ghost" disabled={busy} onClick={removeCover}>
                    Alisin
                  </button>
                )}
              </div>
              <p className="ed-hint">PNG, JPEG o WebP, hanggang 5 MB. Makikita agad ng mga mag-aaral ang pabalat.</p>
            </div>
          </div>

          <div className="ed-row">
            <button type="button" className="ed-btn ed-btn-primary" disabled={busy} onClick={() => setTab('scenes')}>
              Susunod: buuin ang mga eksena
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Step 2: Scenes ---------------- */}
      {tab === 'scenes' && (
        <div className="ed-grid">
          {/* Scene list */}
          <div className="ed-left">
          <StoryMap
            scenes={scenes}
            choices={choices}
            startId={storyForm.starting_scene_id}
            activeId={sceneId}
            busy={busy}
            onPick={selectScene}
          />
          <aside className="ed-card ed-sidebar">
            <h2>Mga eksena mo</h2>
            <p className="ed-hint">Ang eksena ay isang bahagi ng kuwento. Pindutin ito para baguhin at i-drag ang ⋮⋮ para ayusin ang pagkakasunod-sunod.</p>

            {scenes.length === 0 && (
              <div className="ed-empty">
                <p>Wala pang eksena. Idagdag ang una para makapagsimula.</p>
              </div>
            )}

            <ol className="ed-scene-list">
              {scenes.map((s, i) => {
                const info = SCENE_TYPES[s.scene_type] ?? { label: s.scene_type };
                const count = choiceCounts[s.id] || 0;
                const stuck = s.scene_type !== 'ending' && count === 0;
                const isStart = s.id === storyForm.starting_scene_id;
                return (
                  <li
                    key={s.id}
                    className={
                      'ed-scene' +
                      (s.id === sceneId ? ' ed-scene-active' : '') +
                      (dragIndex === i ? ' ed-scene-dragging' : '') +
                      (dragIndex !== null && overIndex === i && dragIndex !== i
                        ? dragIndex < i
                          ? ' ed-drop-after'
                          : ' ed-drop-before'
                        : '')
                    }
                    onDragOver={(e) => {
                      if (dragIndex === null) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (overIndex !== i) setOverIndex(i);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = dragIndex;
                      endDrag();
                      reorderScenes(from, i);
                    }}
                  >
                    <span
                      className="ed-handle"
                      draggable={!busy}
                      title="Drag to reorder"
                      aria-hidden="true"
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(i));
                        const row = e.currentTarget.closest('li');
                        if (row) e.dataTransfer.setDragImage(row, 20, 20);
                        setDragIndex(i);
                      }}
                      onDragEnd={endDrag}
                    >
                      ⋮⋮
                    </span>
                    <button
                      type="button"
                      className="ed-scene-pick"
                      disabled={busy}
                      onClick={() => selectScene(s.id)}
                    >
                      <span className={`ed-scene-icon ed-t-${s.scene_type}`}>
                        <SceneIcon type={s.scene_type} size={18} />
                      </span>
                      <span className="ed-scene-text">
                        <strong>{s.title || 'Walang pamagat'}</strong>
                        <small>
                          {info.label}
                          {isStart ? ' · starts here' : ''}
                          {stuck ? ' · needs a choice' : ''}
                        </small>
                      </span>
                    </button>
                    <span className="ed-order">
                      <button
                        type="button"
                        className="ed-icon-btn"
                        aria-label="Move up"
                        disabled={busy || i === 0}
                        onClick={() => moveScene(i, -1)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="ed-icon-btn"
                        aria-label="Move down"
                        disabled={busy || i === scenes.length - 1}
                        onClick={() => moveScene(i, 1)}
                      >
                        ▼
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="ed-add">
              <span className="ed-label">Magdagdag ng eksena</span>
              <div className="ed-add-grid">
                {TYPE_ORDER.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`ed-add-btn ed-t-${t}`}
                    disabled={busy}
                    title={SCENE_TYPES[t].help}
                    onClick={() => addScene(t)}
                  >
                    <span>
                      <SceneIcon type={t} size={15} />
                    </span>
                    {SCENE_TYPES[t].label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

          {/* Scene editor */}
          <section className="ed-card ed-main">
            {!sceneForm ? (
              <div className="ed-empty">
                <p>Pumili ng eksena sa kaliwa o magdagdag ng bago.</p>
              </div>
            ) : (
              <>
                <div className="ed-scene-head">
                  <span className={`ed-scene-icon ed-scene-icon-lg ed-t-${type}`}>
                    <SceneIcon type={type} size={24} />
                  </span>
                  <div>
                    <h2>Baguhin ang eksena</h2>
                    <p className="ed-hint">{typeInfo?.help}</p>
                  </div>
                                    <button
                    type="button"
                    className="ed-btn ed-btn-primary ed-btn-small"
                    disabled={busy}
                    onClick={() =>
                      act(
                        async () => {
                          await persistScene(); // save any text edits first
                          await load();
                          setEditingScene(true);
                        },
                        null,
                        'Opening scene editor…'
                      )
                    }
                  >
                    Edit Scene
                  </button>
                  {currentScene && currentScene.id === storyForm.starting_scene_id ? (
                    <span className="ed-pill ed-pill-live">Dito nagsisimula ang kuwento</span>
                  ) : (
                    <button type="button" className="ed-btn ed-btn-small" disabled={busy} onClick={makeStart}>
                      Make this the start
                    </button>
                  )}
                </div>

                <div className="ed-block">
                  <h3>Ano ang nangyayari</h3>
                  <div className="ed-field">
                    <label className="ed-label" htmlFor="scene-title">
                      Scene name
                    </label>
                    <input
                      id="scene-title"
                      className="ed-input"
                      type="text"
                      value={sceneForm.title}
                      onChange={(e) => updateScene({ title: e.target.value })}
                    />
                  </div>
                  <div className="ed-field">
                    <label className="ed-label" htmlFor="scene-type">
                      What kind of scene is it?
                    </label>
                    <div className="ed-type-row" id="scene-type">
                      {TYPE_ORDER.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={
                            type === t ? `ed-type-chip ed-type-chip-on ed-t-${t}` : `ed-type-chip ed-t-${t}`
                          }
                          onClick={() => updateScene({ scene_type: t })}
                        >
                          <span className="ed-chip-ico">
                            <SceneIcon type={t} size={14} />
                          </span>
                          {SCENE_TYPES[t].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="ed-field">
                    <label className="ed-label" htmlFor="scene-narration">
                      Story text
                    </label>
                    <textarea
                      id="scene-narration"
                      className="ed-input"
                      rows={5}
                      placeholder="Write what the narrator says on this screen."
                      value={sceneForm.narration}
                      onChange={(e) => updateScene({ narration: e.target.value })}
                    />
                  </div>
                  <div className="ed-field">
                    <label className="ed-label" htmlFor="scene-dialogue">
                      Sinasabi ng tauhan <span className="ed-opt">(opsyonal)</span>
                    </label>
                    <input
                      id="scene-dialogue"
                      className="ed-input"
                      type="text"
                      value={sceneForm.dialogue}
                      onChange={(e) => updateScene({ dialogue: e.target.value })}
                    />
                  </div>
                </div>

                <div className="ed-block">
                  <h3>Larawan sa likuran</h3>
                  <div className="ed-media">
                    {currentScene?.background_image_path ? (
                      <img
                        className="ed-media-preview"
                        src={currentScene.background_image_path}
                        alt="Background preview"
                      />
                    ) : (
                      <div className="ed-media-empty">Walang larawan sa likuran</div>
                    )}
                    <div className="ed-row">
                      <label className={busy ? 'ed-btn ed-file ed-disabled' : 'ed-btn ed-file'}>
                        {currentScene?.background_image_path ? 'Palitan ang larawan' : 'Mag-upload ng larawan'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            uploadBackground(file);
                          }}
                        />
                      </label>
                      {currentScene?.background_image_path && (
                        <button type="button" className="ed-btn ed-btn-ghost" disabled={busy} onClick={removeBackground}>
                          Alisin
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className="ed-btn ed-btn-primary ed-btn-small"
                      disabled={busy}
                      style={{ marginTop: 8 }}
                      onClick={() => act(async () => {
                        await persistScene();
                        await load();
                        setEditingScene(true);
                      }, null, 'Opening character editor…')}
                    >
                      + Add Characters / Edit Layout
                    </button>
                    <button
                      type="button"
                      className="ed-btn ed-btn-small"
                      style={{ marginTop: 8, marginLeft: 8 }}
                      disabled={!currentScene}
                      onClick={() => setShowScenePreview(true)}
                    >
                      Silipin ang eksena
                    </button>
                    <p className="ed-hint">PNG, JPEG o WebP, hanggang 5 MB. Ilathala para makita ng mga mag-aaral.</p>
                  </div>
                </div>

                <div className="ed-block">
                  <h3>Mga tunog</h3>
                  <div className="ed-media">
                    {currentScene?.sound_effect_path ? (
                      <audio controls preload="none" src={currentScene.sound_effect_path} style={{ width: '100%' }}>
                        Your browser does not support audio playback.
                      </audio>
                    ) : (
                      <div className="ed-media-empty">Walang tunog ang eksenang ito</div>
                    )}
                    <div className="ed-row">
                      <label className={busy ? 'ed-btn ed-file ed-disabled' : 'ed-btn ed-file'}>
                        {currentScene?.sound_effect_path ? 'Palitan ang tunog' : 'Mag-upload ng MP3'}
                        <input
                          type="file"
                          accept=".mp3,audio/mpeg,audio/mp3"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            uploadSoundEffect(file);
                          }}
                        />
                      </label>
                      {currentScene?.sound_effect_path && (
                        <button type="button" className="ed-btn ed-btn-ghost" disabled={busy} onClick={removeSoundEffect}>
                          Alisin
                        </button>
                      )}
                    </div>
                    <p className="ed-hint">MP3, hanggang 20 MB. Tutunog ito kapag lumabas ang eksena. Ilathala para marinig ng mga mag-aaral.</p>
                  </div>
                </div>

                <div className="ed-block">
                  <h3>{type === 'decision' ? 'Answers the player can pick' : 'Ano ang nangyayari next'}</h3>

                  {type === 'ending' && (
                    <p className="ed-note">Wakas ito kaya dito nagtatapos ang kuwento. Hindi na kailangan ng mga pagpipilian.</p>
                  )}

                  {type !== 'ending' && choiceForms.length === 0 && (
                    <div className="ed-empty ed-empty-small">
                      <p>
                        {type === 'decision'
                          ? 'Add at least two answers, and mark one as the right one.'
                          : 'Add a button the player taps to continue.'}
                      </p>
                    </div>
                  )}

                  {type !== 'ending' &&
                    choiceForms.map((c, i) => {
                      const isDecision = type === 'decision';
                      const right = isDecision && c.is_correct;
                      const wrong = isDecision && !c.is_correct;
                      const target = right || !isDecision ? c.destination_scene_id : c.failure_scene_id;
                      const targetName = target ? sceneName(target) : null;
                      return (
                        <div
                          key={c.id}
                          className={
                            right ? 'ed-choice ed-choice-right' : wrong ? 'ed-choice ed-choice-wrong' : 'ed-choice'
                          }
                        >
                          <div className="ed-choice-top">
                            <span className="ed-choice-num">{i + 1}</span>
                            <input
                              className="ed-input"
                              type="text"
                              aria-label={`Button text for choice ${i + 1}`}
                              value={c.text}
                              placeholder={isDecision ? 'Answer text' : 'Button text'}
                              onChange={(e) => updateChoice(c.id, { text: e.target.value })}
                            />
                          </div>

                          {isDecision && (
                            <div className="ed-seg" role="group" aria-label="Is this answer right or wrong?">
                              <button
                                type="button"
                                className={right ? 'ed-seg-btn ed-seg-right' : 'ed-seg-btn'}
                                onClick={() => setCorrect(c.id)}
                              >
                                {right ? '✓ Right answer' : 'Right answer'}
                              </button>
                              <button
                                type="button"
                                className={wrong ? 'ed-seg-btn ed-seg-wrong' : 'ed-seg-btn'}
                                disabled={right}
                                title={right ? 'Mark another answer as right to change this one' : ''}
                                onClick={() => updateChoice(c.id, { is_correct: false })}
                              >
                                {wrong ? '✕ Wrong answer' : 'Wrong answer'}
                              </button>
                            </div>
                          )}

                          <div className="ed-field">
                            <label className="ed-label">
                              {!isDecision
                                ? 'Then go to…'
                                : right
                                  ? 'If they pick this, go to…'
                                  : 'If they pick this, show this Oops scene…'}
                            </label>
                            <select
                              className="ed-input"
                              value={target}
                              onChange={(e) =>
                                updateChoice(
                                  c.id,
                                  wrong ? { failure_scene_id: e.target.value } : { destination_scene_id: e.target.value }
                                )
                              }
                            >
                              <option value="">— pumili ng eksena —</option>
                              {sceneOptions}
                            </select>
                            {targetName && <p className="ed-flow">→ {targetName}</p>}
                          </div>

                          {isDecision && (
                            <div className="ed-field">
                              <label className="ed-label">
                                Pahiwatig o mensahe para sa mag-aaral <span className="ed-opt">(opsyonal)</span>
                              </label>
                              <input
                                className="ed-input"
                                type="text"
                                value={c.feedback}
                                placeholder="e.g. Great job! Dogs love bones."
                                onChange={(e) => updateChoice(c.id, { feedback: e.target.value })}
                              />
                            </div>
                          )}

                          <div className="ed-row ed-choice-tools">
                            <button
                              type="button"
                              className="ed-icon-btn"
                              aria-label="Move choice up"
                              disabled={i === 0}
                              onClick={() => moveChoice(i, -1)}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              className="ed-icon-btn"
                              aria-label="Move choice down"
                              disabled={i === choiceForms.length - 1}
                              onClick={() => moveChoice(i, 1)}
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              className="ed-btn ed-btn-ghost ed-btn-danger-text"
                              disabled={busy}
                              onClick={() => deleteChoice(c.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {type !== 'ending' && (
                    <button type="button" className="ed-btn" disabled={busy} onClick={addChoice}>
                      {type === 'decision' ? '+ Add an answer' : '+ Add a button'}
                    </button>
                  )}
                </div>

                <div className="ed-savebar">
                  <button type="button" className="ed-btn ed-btn-primary" disabled={busy} onClick={saveAll}>
                    I-save ang eksena
                  </button>
                  <button type="button" className="ed-btn ed-btn-ghost ed-btn-danger-text" disabled={busy} onClick={deleteScene}>
                    Burahin ang eksena
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* ---------------- Step 3: Check & publish ---------------- */}
      {tab === 'publish' && (
        <div className="ed-card ed-narrow">
          <h2>Handa na bang ilathala?</h2>
          <p className="ed-muted">Suriin muna kung may kailangang ayusin para gumana nang maayos ang kuwento.</p>

          <ul className="ed-checklist">
            {checklist.map((item) => (
              <li key={item.text} className={item.ok ? 'ed-check ed-check-ok' : 'ed-check ed-check-todo'}>
                <span aria-hidden="true">{item.ok ? '✓' : '○'}</span> {item.text}
              </li>
            ))}
          </ul>

          <div className="ed-row">
            <button type="button" className="ed-btn" disabled={busy} onClick={validate}>
              Check my story
            </button>
            <button type="button" className="ed-btn ed-btn-primary" disabled={busy} onClick={publish}>
              Publish
            </button>
            {isLive && (
              <button type="button" className="ed-btn ed-btn-ghost" disabled={busy} onClick={unpublish}>
                Take offline
              </button>
            )}
          </div>

          {report && (
            <div className="ed-report">
              {report.errors?.length > 0 && (
                <div className="ed-alert ed-alert-error">
                  <strong>Ayusin muna ang mga ito bago ilathala:</strong>
                  <ul>
                    {report.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.warnings?.length > 0 && (
                <div className="ed-alert ed-alert-warn">
                  <strong>Mainam na suriin:</strong>
                  <ul>
                    {report.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!report.errors?.length && !report.warnings?.length && (
                <div className="ed-alert ed-alert-ok">Walang nakitang problema. Handa na ang kuwento.</div>
              )}
            </div>
          )}
        </div>
      )}

      {showScenePreview && tab === 'scenes' && currentScene && (
        <div
          className="ed-scene-preview-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowScenePreview(false);
          }}
        >
          <section
            className="ed-scene-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scene-preview-heading"
          >
            <div className="ed-scene-preview-head">
              <h2 id="scene-preview-heading">Silipin ang eksena</h2>
              <button type="button" className="ed-btn ed-btn-small" onClick={() => setShowScenePreview(false)}>
                Close preview
              </button>
            </div>
            <div
              className="ed-scene-preview-stage"
              style={currentScene.background_image_path
                ? { backgroundImage: `url("${currentScene.background_image_path}")` }
                : undefined}
            >
              {previewObjects.length > 0 ? (
                <div className="ed-scene-preview-art" aria-hidden="true">
                  {previewObjects.map((object) => (
                    <img
                      key={object.id}
                      src={object.src}
                      alt=""
                      draggable={false}
                      style={{
                        left: `${(Number(object.x) || 0) * 100}%`,
                        top: `${(Number(object.y) || 0) * 100}%`,
                        width: `${(Number(object.w) || 0.2) * 100}%`,
                        height: `${(Number(object.h) || 0.3) * 100}%`,
                        opacity: Number.isFinite(Number(object.opacity)) ? Number(object.opacity) : 1,
                        transform: `translate(-50%, -50%) rotate(${Number(object.rotation) || 0}deg) scale(${object.flipX ? -1 : 1}, ${object.flipY ? -1 : 1})`,
                      }}
                    />
                  ))}
                </div>
              ) : !currentScene.background_image_path ? (
                <div className="ed-scene-preview-empty">Magdagdag ng larawan sa likuran o mga tauhan para makita ang itsura ng eksena.</div>
              ) : null}
              <div className="ed-preview-animations">
                <strong>Galaw sa pagpapakilala ng mga tauhan</strong>
                <ul aria-label="Galaw sa pagpapakilala ng mga tauhan">
                  {previewObjects.length > 0 ? previewObjects.map((object, index) => {
                    const animation = typeof object.intro === 'string' && object.intro !== 'none'
                      ? object.intro[0].toUpperCase() + object.intro.slice(1)
                      : 'Wala';
                    return <li key={object.id || index}>Tauhan {index + 1}: {animation}</li>;
                  }) : <li>Wala</li>}
                </ul>
              </div>
              <div className="ed-scene-preview-panel">
                <div className="ed-scene-preview-title">{sceneForm?.title || 'Eksena na walang pamagat'}</div>
                <p className="ed-scene-preview-narration">{sceneForm?.narration || 'Dito lalabas ang pagsasalaysay sa eksena.'}</p>
                {sceneForm?.dialogue && <p className="ed-scene-preview-dialogue">“{sceneForm.dialogue}”</p>}
                {sceneForm?.scene_type !== 'ending' && choiceForms.length > 0 && (
                  <div className="ed-scene-preview-choices" aria-label="Mga pagpipilian sa eksena">
                    {choiceForms.map((choice) => (
                      <div className="ed-scene-preview-choice" key={choice.id}>{choice.text || 'Pagpipilian'}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mapa ng kuwento (branching tree, like a git graph)                        */
/* ------------------------------------------------------------------ */
const NODE_COLORS = {
  start: '#17a673',
  narrative: '#2f8bf0',
  decision: '#6d45f0',
  failure: '#ee5a5a',
  ending: '#f2a300',
};
const EDGE_COLORS = { right: '#17a673', wrong: '#ee5a5a', next: '#8d86c9', back: '#b9b4dc' };
const MAP_ROW = 52;
const MAP_LANE = 26;
const MAP_PAD = 18;

function buildMap(scenes, choices, startId) {
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const out = {};
  scenes.forEach((s) => {
    out[s.id] = [];
  });

  choices.forEach((c) => {
    const from = byId.get(c.scene_id);
    if (!from) return;
    const isDecision = from.scene_type === 'decision';
    const wrong = isDecision && !c.is_correct;
    const to = wrong ? c.failure_scene_id : c.destination_scene_id;
    const kind = wrong ? 'wrong' : isDecision ? 'right' : 'next';
    if (to && byId.has(to) && !out[from.id].some((e) => e.to === to && e.kind === kind)) {
      out[from.id].push({ to, kind });
    }
  });

  // Who links to each scene (from every saved choice, reachable or not).
  const incoming = {};
  scenes.forEach((sc) => {
    out[sc.id].forEach((e) => {
      (incoming[e.to] = incoming[e.to] || []).push(sc.id);
    });
  });

  // Spot the exact reason a scene does not lead anywhere.
  const problems = {};
  scenes.forEach((sc) => {
    if (sc.scene_type === 'ending') return;
    const mine = choices.filter((c) => c.scene_id === sc.id);
    if (mine.length === 0) {
      problems[sc.id] = 'Wala pang pagpipilian';
    } else if (sc.scene_type === 'decision') {
      const right = mine.find((c) => c.is_correct);
      if (!right) problems[sc.id] = 'Wala pang napipiling tamang sagot';
      else if (!right.destination_scene_id) problems[sc.id] = 'Right answer goes nowhere';
      else if (mine.some((c) => !c.is_correct && !c.failure_scene_id)) problems[sc.id] = 'Walang eksenang ?Naku!? para sa maling sagot';
    } else if (mine.every((c) => !c.destination_scene_id)) {
      problems[sc.id] = 'Button goes nowhere';
    }
  });

  if (!startId || !byId.has(startId)) return { rows: [], edges: [], lanes: 1, loose: eksena, problems, incoming, byId };

  const rows = [];
  const lane = {};
  const rowOf = {};
  let maxLane = 0;

  const visit = (id, ln) => {
    lane[id] = ln;
    maxLane = Math.max(maxLane, ln);
    rowOf[id] = rows.length;
    rows.push(byId.get(id));
    // Side branches (wrong answers) first, then the main path continues straight down.
    const kids = [...out[id].filter((e) => e.kind === 'wrong'), ...out[id].filter((e) => e.kind !== 'wrong')];
    // Main path stays in this lane. Side branches always sit just beside it (+1, +2),
    // so every question looks the same and the map never drifts to the right.
    let inherited = false;
    let side = 0;
    kids.forEach((e) => {
      if (e.to in lane) return;
      if (e.kind !== 'wrong' && !inherited) {
        inherited = true;
        visit(e.to, ln);
      } else {
        side += 1;
        visit(e.to, ln + side);
      }
    });
  };
  visit(startId, 0);

  const edges = [];
  rows.forEach((from) => {
    out[from.id].forEach((e) => {
      if (e.to in lane) edges.push({ from: from.id, to: e.to, kind: rowOf[e.to] <= rowOf[from.id] ? 'back' : e.kind });
    });
  });

  return { rows, edges, lane, rowOf, lanes: maxLane + 1, loose: scenes.filter((s) => !(s.id in lane)), problems, incoming, byId };
}

function StoryMap({ eksena, choices, startId, activeId, busy, onPick }) {
  const map = useMemo(() => buildMap(scenes, choices, startId), [scenes, choices, startId]);
  const x = (l) => MAP_PAD + l * MAP_LANE;
  const y = (i) => i * MAP_ROW + MAP_ROW / 2;
  const svgW = MAP_PAD * 2 + (map.lanes - 1) * MAP_LANE;
  const svgH = map.rows.length * MAP_ROW;

  return (
    <div className="ed-card ed-map">
      <h2>Mapa ng kuwento</h2>
      <p className="ed-hint">Tingnan kung paano nahahati ang kuwento. Pindutin ang tuldok para baguhin ang eksena.</p>
      {map.byId.get(startId) && (
        <p className="ed-hint">
          <strong>Nagsisimula sa:</strong> {map.byId.get(startId).title || 'Walang pamagat'} · {scenes.length} eksena,{' '}
          {choices.length} choices saved
        </p>
      )}

      {map.rows.length === 0 ? (
        <div className="ed-empty ed-empty-small">
          <p>
            {scenes.length === 0
              ? 'Add scenes and the map will appear here.'
              : 'Pumili ng panimulang eksena (gamitin ang ?Gawing simula ito?) para makita ang mapa.'}
          </p>
        </div>
      ) : (
        <div className="ed-map-scroll">
          <div className="ed-map-body" style={{ height: svgH }}>
            <svg className="ed-map-svg" width={svgW} height={svgH} aria-hidden="true">
              {map.edges.map((e, i) => {
                const x1 = x(map.lane[e.from]);
                const y1 = y(map.rowOf[e.from]);
                const x2 = x(map.lane[e.to]);
                const y2 = y(map.rowOf[e.to]);
                let d;
                if (e.kind === 'back') {
                  const bend = x(Math.max(map.lane[e.from], map.lane[e.to])) + MAP_LANE * 0.9;
                  d = `M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${x2} ${y2}`;
                } else if (x1 === x2) {
                  d = `M ${x1} ${y1} L ${x2} ${y2}`;
                } else {
                  const ym = (y1 + y2) / 2;
                  d = `M ${x1} ${y1} C ${x1} ${ym}, ${x2} ${ym}, ${x2} ${y2}`;
                }
                return (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={EDGE_COLORS[e.kind]}
                    strokeWidth={e.kind === 'back' ? 2 : 3}
                    strokeDasharray={e.kind === 'wrong' || e.kind === 'back' ? '5 4' : undefined}
                    strokeLinecap="round"
                  />
                );
              })}
              {map.rows.map((s, i) => (
                <g key={s.id}>
                  {s.id === activeId && (
                    <circle cx={x(map.lane[s.id])} cy={y(i)} r={17} fill="none" stroke="#6d45f0" strokeWidth={3} />
                  )}
                  <circle cx={x(map.lane[s.id])} cy={y(i)} r={12} fill={NODE_COLORS[s.scene_type] ?? '#8d86c9'} stroke="#fff" strokeWidth={2} />
                  <svg
                    x={x(map.lane[s.id]) - 7}
                    y={y(i) - 7}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {(ICON_PATHS[s.scene_type] || []).map((d) => (
                      <path key={d} d={d} />
                    ))}
                  </svg>
                </g>
              ))}
            </svg>
            {map.rows.map((s, i) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                className={s.id === activeId ? 'ed-map-row ed-map-row-active' : 'ed-map-row'}
                style={{ top: i * MAP_ROW, height: MAP_ROW, paddingLeft: svgW + 10 }}
                onClick={() => onPick(s.id)}
              >
                <strong>{s.title || 'Walang pamagat'}</strong>
                {map.problems[s.id] ? (
                  <small className="ed-map-problem">Kailangang ayusin: {map.problems[s.id]}</small>
                ) : (
                  <small>{SCENE_TYPES[s.scene_type]?.label}</small>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {map.rows.length > 0 && (
        <p className="ed-map-legend">
          <span className="ed-key ed-key-right" /> right answer / next
          <span className="ed-key ed-key-wrong" /> wrong answer
          <span className="ed-key ed-key-back" /> goes back
        </p>
      )}

      {map.loose.length > 0 && map.rows.length > 0 && (
        <div className="ed-loose">
          <strong>Hindi pa konektado</strong>
          <p className="ed-hint">
            Nothing leads to these scenes yet. Look for a red "Needs attention" note in the map above: the first one in
            the chain is where the link is missing.
          </p>
          {map.loose.map((s) => {
            const from = (map.incoming[s.id] || []).map((id) => {
              const sc = map.byId.get(id);
              const name = sc?.title || 'Walang pamagat';
              return id in (map.lane || {}) ? name : `${name} (also not connected)`;
            });
            return (
              <div key={s.id} className="ed-loose-item">
                <button type="button" className="ed-loose-btn" disabled={busy} onClick={() => onPick(s.id)}>
                  <SceneIcon type={s.scene_type} size={14} />
                  {s.title || 'Walang pamagat'}
                  {map.problems[s.id] ? ' (needs attention)' : ''}
                </button>
                <small className="ed-loose-from">
                  {from.length === 0 ? '← nothing links here' : `← linked from: ${[...new Set(from)].join(', ')}`}
                </small>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
