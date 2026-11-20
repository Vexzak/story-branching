import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { playHoverSound, stopHoverSound } from '../lib/hoverSound';

const BOOK_THEMES = ['blue', 'purple', 'orange', 'teal'];

export default function StudentHome() {
  const navigate = useNavigate();

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => () => stopHoverSound(), []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { stories: list } = await apiFetch('/stories');
        if (active) setStories(list);
      } catch (err) {
        if (active) setError(err.message || 'Hindi ma-load ang mga kuwento.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="kids-home">
      <div className="kids-title-banner-wrap">
        <img className="kids-title-banner" src="/images/title_banner.png" alt="Pumili ng Kuwento" />
      </div>
      {loading && <p className="kids-status">Naglo-load ng mga kuwento…</p>}
      {error && <div className="alert alert-error">{error}</div>}
      {!loading && !error && stories.length === 0 && (
        <p className="kids-status">Wala pang kuwentong mababasa. Bumalik muli sa susunod.</p>
      )}

      <div className="kids-shelf">
        {stories.map((story, index) => {
          const theme = BOOK_THEMES[index % BOOK_THEMES.length];
          const locked = story.is_private || !story.unlocked;

          return (
            <div
              key={story.id}
              className={`kids-story kids-${theme}${locked ? ' is-locked' : ''}`}
              onPointerEnter={playHoverSound}
            >
              <button
                type="button"
                className="kids-book"
                disabled={locked}
                onClick={() => navigate(`/play/${story.id}`)}
                aria-label={story.is_private ? `${story.title} (private)` : locked ? `${story.title} (locked)` : `Play ${story.title}`}
              >
                <span className="kids-cover">
                  {story.cover_image_path ? (
                    <img src={story.cover_image_path} alt="" loading="lazy" />
                  ) : (
                    <span className="kids-cover-fallback">📖</span>
                  )}
                  {story.completed && <span className="kids-badge kids-star">⭐</span>}
                  {locked && <span className="kids-badge kids-lock">🔒</span>}
                </span>
                <span className="kids-label">{story.title}</span>
                <span className="kids-ribbon" aria-hidden="true" />
              </button>

              <p className="kids-bubble">
                {story.is_private ? 'Hindi pa pinahihintulutan ng guro ang kuwentong ito.' : locked ? 'Tapusin ang naunang kuwento para mabuksan ito!' : story.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
