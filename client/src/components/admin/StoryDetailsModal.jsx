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
      </> : <small>There is not enough play data yet.</small>}
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
            <p className="story-modal-eyebrow">Story report</p>
            <h2 id="story-modal-title">{story.title}</h2>
          </div>
          <button type="button" className="story-modal-close" aria-label="Close story report" onClick={onClose}>×</button>
        </header>

        <div className="story-modal-body">
          <div className="story-detail-tiles">
            <DetailTile label="Success rate" value={`${story.successRate}%`} hint="students who finished" color={story.color} />
            <DetailTile label="Students started" value={story.startedStudents} color={story.color} />
            <DetailTile label="Students finished" value={story.finishedStudents} color={story.color} />
            <DetailTile label="Average attempts per scene" value={story.averageAttemptsPerScene ?? '—'} hint={story.averageAttemptsPerScene === null ? 'No passes recorded' : 'among students who passed'} color={story.color} />
          </div>

          {!story.hasData ? (
            <div className="analytics-empty-state">
              <span aria-hidden="true">📖</span>
              <h3>No play data yet</h3>
              <p>When students start this story, their scene progress and attempts will appear here.</p>
            </div>
          ) : <>
            <div className="story-highlights">
              <Highlight
                title="Hardest scene"
                scene={story.hardestScene}
                detail={(scene) => `Students needed ${scene.avgAttempts} attempts on average to pass.`}
                color={story.color}
              />
              <Highlight
                title="Most students not passed yet"
                scene={story.dropoffScene}
                detail={(scene) => `${scene.droppedOff} of ${scene.reachedStudents} students who reached this scene have no correct answer recorded yet.`}
                color={story.color}
              />
            </div>

            <section className="analytics-panel story-detail-chart-panel">
              <div className="analytics-panel-heading"><div><h3>Students reaching each scene</h3><p>Compare how many reached a scene with how many passed it.</p></div></div>
              {scenesWithData.length ? <SceneReachChart scenes={scenesWithData} color={story.color} /> : <p className="analytics-empty-chart">No scene choices have been recorded yet.</p>}
            </section>

            <section className="analytics-panel story-detail-chart-panel">
              <div className="analytics-panel-heading"><div><h3>Attempts needed to pass</h3><p>Each student is counted once per scene, using their first successful run.</p></div></div>
              {hasSceneAttempts ? <SceneAttemptsChart scenes={story.scenes} color={story.color} /> : <p className="analytics-empty-chart">Attempt counts will appear after students pass scenes.</p>}
            </section>

            <section className="analytics-panel story-scene-list-panel">
              <div className="analytics-panel-heading"><div><h3>Scene-by-scene notes</h3><p>Simple summaries of student progress.</p></div></div>
              <ol className="story-scene-list">
                {story.scenes.map((scene, index) => (
                  <li key={scene.id}>
                    <span className="story-scene-number" style={{ '--story-accent': story.color }}>Scene {index + 1}</span>
                    <div><strong>{scene.title}</strong><p>{scene.insight}</p></div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="analytics-panel story-scene-list-panel">
              <div className="analytics-panel-heading"><div><h3>Wrong answers chosen most</h3><p>These are the wrong choices students selected most often.</p></div></div>
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
              ) : <p className="analytics-empty-chart">No wrong answer choices have been recorded.</p>}
            </section>
          </>}
        </div>
      </section>
    </div>
  );
}
