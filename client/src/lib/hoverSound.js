const audio = new Audio('/ting.mp3');

export function playHoverSound(event) {
  if (event.pointerType !== 'mouse') return;

  audio.pause();
  audio.currentTime = 0;

  try {
    const playback = audio.play();
    if (playback) Promise.resolve(playback).catch(() => {});
  } catch {
    // Hover audio is optional when playback is blocked by the browser.
  }
}

export function stopHoverSound() {
  audio.pause();
  audio.currentTime = 0;
}
