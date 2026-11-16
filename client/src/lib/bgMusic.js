const audio = new Audio('/home_bgmusic.mp3');
audio.loop = true;
audio.preload = 'auto';

const interactionEvents = ['pointerdown', 'click', 'keydown', 'touchstart'];
let userInteracted = false;
let musicEnabled = false;
let listenersAttached = false;

function removeInteractionListeners() {
  if (!listenersAttached) return;
  interactionEvents.forEach((eventName) => {
    document.removeEventListener(eventName, handleInteraction);
  });
  listenersAttached = false;
}

function attachInteractionListeners() {
  if (listenersAttached) return;
  interactionEvents.forEach((eventName) => {
    document.addEventListener(eventName, handleInteraction, { passive: true });
  });
  listenersAttached = true;
}

function handleInteraction() {
  userInteracted = true;
  if (!musicEnabled) {
    removeInteractionListeners();
    return;
  }
  play();
}

export function initializeBackgroundMusic() {
  if (!userInteracted) attachInteractionListeners();
}

export function hasUserInteracted() {
  return userInteracted;
}

export function play() {
  if (!userInteracted || !musicEnabled) return Promise.resolve(false);
  if (!audio.paused) {
    removeInteractionListeners();
    return Promise.resolve(true);
  }

  try {
    return Promise.resolve(audio.play()).then(
      () => {
        removeInteractionListeners();
        return true;
      },
      () => {
        attachInteractionListeners();
        return false;
      }
    );
  } catch {
    attachInteractionListeners();
    return Promise.resolve(false);
  }
}

export function stop() {
  audio.pause();
  audio.currentTime = 0;
}

export function setBackgroundMusicEnabled(enabled) {
  musicEnabled = enabled;
  if (!enabled) {
    stop();
    return;
  }

  if (userInteracted) play();
  else attachInteractionListeners();
}
