import { useEffect } from 'react';
import { SceneAttemptsChart, SceneReachChart } from './StoryAnalyticsCharts';

function DetailTile({ label, value, hint, color }) {
  return (
    <div className="story-detail-tile" style={{ '--story-accent': color }}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function Highlight({ title, scene, detail, color }) {
  return (
    <div className="story-highlight" style={{ '--story-accent': color }}>
      <span>{title}</span>
      {scene ? <>
        <strong>{scene.title}</strong>
        <small>{detail(scene)}</small>
      </> : <small>Kulang pa ang datos ng paglalaro.</small>}
    </div>
  );
}

export default function StoryDetailsModal({ story, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const scenesWithData = story.scenes.filter((scene) => scene.reachedStudents > 0);
  const hasSceneAttempts = story.scenes.some((scene) => scene.passedStudents > 0);

  return (
    <div className="story-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="story-modal" role="dialog" aria-modal="true" aria-labelledby="story-modal-title">
        <header className="story-modal-header" style={{ '--story-accent': story.color }}>
          <div>
            <p className="story-modal-eyebrow">Ulat ng kuwento</p>
            <h2 id="story-modal-title">{story.title}</h2>
          </div>
          <button type="button" className="story-modal-close" aria-label="Close story report" onClick={onClose}>×</button>
        </header>

        <div className="story-modal-body">
          <div className="story-detail-tiles">
            <DetailTile label="Antas ng tagumpay" value={`${story.successRate}%`} hint="mga mag-aaral na nakatapos" color={story.color} />
            <DetailTile label="Mga mag-aaral na nagsimula" value={story.startedStudents} color={story.color} />
            <DetailTile label="Mga mag-aaral na nakatapos" value={story.finishedStudents} color={story.color} />
            <DetailTile label="Karaniwang pagsubok bawat eksena" value={story.averageAttemptsPerScene ?? '—'} hint={story.averageAttemptsPerScene === null ? 'Wala pang naitalang nakapasa' : 'sa mga mag-aaral na nakapasa'} color={story.color} />
          </div>

          {!story.hasData ? (
            <div className="analytics-empty-state">
              <span aria-hidden="true">📖</span>
              <h3>Wala pang datos ng paglalaro</h3>
              <p>Lalabas dito ang progreso at mga pagsubok ng mag-aaral kapag sinimulan na nila ang kuwento.</p>
            </div>
          ) : <>
            <div className="story-highlights">
              <Highlight
                title="Pinakamahirap na eksena"
                scene={story.hardestScene}
                detail={(scene) => `Kinailangan ng mga mag-aaral ng ${scene.avgAttempts} pagsubok sa karaniwan bago makapasa.`}
                color={story.color}
              />
              <Highlight
                title="Pinakamaraming hindi pa nakapasa"
                scene={story.dropoffScene}
                detail={(scene) => `${scene.droppedOff} sa ${scene.reachedStudents} mag-aaral na nakarating sa eksenang ito ang wala pang naitatalang tamang sagot.`}
                color={story.color}
              />
            </div>

            <section className="analytics-panel story-detail-chart-panel">
              <div className="analytics-panel-heading"><div><h3>Mga mag-aaral na nakarating sa bawat eksena</h3><p>Ihambing ang bilang ng mga nakarating at nakapasa sa isang eksena.</p></div></div>
              {scenesWithData.length ? <SceneReachChart scenes={scenesWithData} color={story.color} /> : <p className="analytics-empty-chart">Wala pang naitalang pagpili sa mga eksena.</p>}
            </section>

            <section className="analytics-panel story-detail-chart-panel">
              <div className="analytics-panel-heading"><div><h3>Mga pagsubok bago makapasa</h3><p>Isang beses binibilang ang bawat mag-aaral sa bawat eksena, batay sa una niyang matagumpay na paglalaro.</p></div></div>
              {hasSceneAttempts ? <SceneAttemptsChart scenes={story.scenes} color={story.color} /> : <p className="analytics-empty-chart">Lalabas ang bilang ng mga pagsubok kapag may mga mag-aaral nang nakapasa sa mga eksena.</p>}
            </section>

            <section className="analytics-panel story-scene-list-panel">
              <div className="analytics-panel-heading"><div><h3>Mga tala sa bawat eksena</h3><p>Maiikling buod ng progreso ng mga mag-aaral.</p></div></div>
              <ol className="story-scene-list">
                {story.scenes.map((scene, index) => (
                  <li key={scene.id}>
                    <span className="story-scene-number" style={{ '--story-accent': story.color }}>Eksena {index + 1}</span>
                    <div><strong>{scene.title}</strong><p>{scene.insight}</p></div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="analytics-panel story-scene-list-panel">
              <div className="analytics-panel-heading"><div><h3>Pinakamadalas na napiling maling sagot</h3><p>Ito ang mga maling sagot na pinakamadalas piliin ng mga mag-aaral.</p></div></div>
              {story.mostWrongAnswers.length ? (
                <ol className="wrong-answer-list">
                  {story.mostWrongAnswers.map((answer, index) => (
                    <li key={`${answer.sceneTitle}-${answer.choiceText}-${index}`}>
                      <span className="wrong-answer-rank">{index + 1}</span>
                      <div><strong>{answer.choiceText}</strong><small>{answer.sceneTitle}{answer.branchTitle ? ` → ${answer.branchTitle}` : ''}</small></div>
                      <b>{answer.selections} {answer.selections === 1 ? 'selection' : 'selections'}</b>
                    </li>
                  ))}
                </ol>
              ) : <p className="analytics-empty-chart">Wala pang naitalang maling sagot.</p>}
            </section>
          </>}
        </div>
      </section>
    </div>
  );
}
