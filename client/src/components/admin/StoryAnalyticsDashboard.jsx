import { useState } from 'react';
import StoryDetailsModal from './StoryDetailsModal';
import StoryInsightsCharts from './StoryInsightsCharts';

const STORY_COLORS = ['#2563eb'];

const ICONS = {
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 4.5a3.2 3.2 0 0 1 0 6.2M21 20c0-2.6-1.6-4.5-4-5.2" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16 9.5" /></>,
  repeat: <><path d="M17 3l3 3-3 3" /><path d="M4 11V9a3 3 0 0 1 3-3h13" /><path d="M7 21l-3-3 3-3" /><path d="M20 13v2a3 3 0 0 1-3 3H4" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  book: <><path d="M12 7v14" /><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 23z" /><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5A2.5 2.5 0 0 1 21 23z" /></>,
  bars: <><path d="M4 20v-6" /><path d="M10 20V9" /><path d="M16 20V4" /><path d="M22 20v-9" /></>,
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function SummaryCard({ label, value, hint, accent, icon, text, trend }) {
  return (
    <article className="analytics-summary-card" style={{ '--summary-accent': accent }}>
      <span className="analytics-summary-icon"><Icon name={icon} /></span>
      <div className="analytics-summary-content">
        <span className="analytics-summary-label">{label}</span>
        <strong className={text ? 'analytics-summary-value analytics-summary-value-text' : 'analytics-summary-value'}>{value}</strong>
        {trend ? <div className="analytics-summary-foot">
          <span className={`analytics-summary-trend is-${trend.direction}`}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>{trend.value}</span>
          {hint && <small>{hint}</small>}
        </div> : hint && <small>{hint}</small>}
      </div>
    </article>
  );
}

function StoryCard({ story, onClick, disabled = false }) {
  return (
    <button type="button" className="analytics-story-card" style={{ '--story-accent': story.color }} onClick={onClick} disabled={disabled}>
      {story.coverImage ? <img src={story.coverImage} alt="" className="analytics-story-cover" /> : <span className="analytics-story-cover-fallback" aria-hidden="true">📖</span>}
      <span className="analytics-story-card-body">
        <strong className="analytics-story-title">{story.title}</strong>
        <span className="analytics-progress-label"><span>Pagkumpleto</span><b>{story.hasData ? `${story.successRate}%` : 'Wala pang datos ng paglalaro'}</b></span>
        <span className="analytics-progress-track" aria-label={story.hasData ? `${story.successRate}% kumpleto` : 'Wala pang datos ng paglalaro'}>
          <span style={{ width: `${story.successRate}%` }} />
        </span>
        <span className="analytics-story-facts">
          <span><small>Mga mag-aaral na tumapos</small><b>{story.finishedStudents} sa {story.startedStudents}</b></span>
          <span><small>Karaniwang pagsubok bawat eksena</small><b>{story.averageAttemptsPerScene ?? '—'}</b></span>
        </span>
        <span className="analytics-tricky-scene">
          <small>Pinakamahirap na eksena</small>
          <b>{story.hardestScene?.title || (story.hasData ? 'Kulang pa ang datos' : 'Wala pang datos ng paglalaro')}</b>
        </span>
        <span className="analytics-story-open">Tingnan ang ulat ng kuwento <span aria-hidden="true">→</span></span>
      </span>
    </button>
  );
}

function EmptyStories() {
  return (
    <div className="analytics-empty-state">
      <span aria-hidden="true">🗺️</span>
      <h2>Wala pang nailathalang kuwento</h2>
      <p>Maglathala ng kuwento para makita rito ang progreso at datos ng pagkatuto ng mga mag-aaral.</p>
    </div>
  );
}

export default function StoryAnalyticsDashboard({ analytics, sessions = [], weeklyStats }) {
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const stories = analytics.stories.map((story, index) => ({ ...story, color: STORY_COLORS[index % STORY_COLORS.length] }));
  const selectedStory = stories.find((story) => story.id === selectedStoryId);
  const { summary } = analytics;

  return (
    <div className="story-analytics stack">
      <section className="analytics-summary-grid" aria-label="Overall story statistics">
        <SummaryCard icon="users" label="Kabuuang mag-aaral" value={summary.totalStudents} hint="kumpara sa nakaraang linggo" trend={{ value: weeklyStats?.studentsAddedThisWeek ?? 0, direction: weeklyStats?.studentsAddedThisWeek > 0 ? 'up' : 'flat' }} accent="#2563eb" />
        <SummaryCard icon="check" label="Pagkumpleto" value={`${weeklyStats?.currentWeekCompletionRate ?? summary.completionRate}%`} hint="kumpara sa nakaraang linggo" trend={weeklyStats?.completionRateChange === null || weeklyStats?.completionRateChange === undefined ? null : { value: `${Math.abs(weeklyStats.completionRateChange)}%`, direction: weeklyStats.completionRateChange > 0 ? 'up' : weeklyStats.completionRateChange < 0 ? 'down' : 'flat' }} accent="#2563eb" />
        <SummaryCard text icon="smile" label="Pinakamadaling kuwento" value={summary.easiestStory?.title || 'Kulang ang datos'} hint={summary.easiestStory ? `${summary.easiestStory.averageAttemptsPerScene} karaniwang pagsubok bawat eksena` : 'Wala pang sapat na datos ng pagsubok'} accent="#2563eb" />
        <SummaryCard text icon="flag" label="Pinakamahirap na kuwento" value={summary.hardestStory?.title || 'Kulang ang datos'} hint={summary.hardestStory ? `${summary.hardestStory.averageAttemptsPerScene} karaniwang pagsubok bawat eksena` : 'Wala pang sapat na datos ng pagsubok'} accent="#2563eb" />
      </section>

      {stories.length === 0 ? <EmptyStories /> : <>
        <section className={`analytics-flip-shell${showAnalysis ? ' is-analysis' : ''}`}>
          <div className="analytics-flip-tabs" role="tablist" aria-label="Mga view ng ulat ng kuwento">
            <button
              type="button"
              role="tab"
              aria-selected={!showAnalysis}
              className={!showAnalysis ? 'is-active' : ''}
              onClick={() => setShowAnalysis(false)}
            >Estadistika ng mga Kuwento</button>
            <button
              type="button"
              role="tab"
              aria-selected={showAnalysis}
              className={showAnalysis ? 'is-active' : ''}
              onClick={() => setShowAnalysis(true)}
            >Pagsusuri ng mga Kuwento</button>
          </div>
          <div className="analytics-flip-stage">
            <div className="analytics-flip-card">
              <div className="analytics-flip-face analytics-flip-front" aria-hidden={showAnalysis}>
                <StoryInsightsCharts stories={stories} sessions={sessions} dailyProgress={analytics.dailyProgress || []} />
              </div>
              <div className="analytics-flip-face analytics-flip-back" aria-hidden={!showAnalysis}>
                <div className="analytics-section-heading">
                  <div><h2>Pagsusuri ng mga Kuwento</h2><p>Pumili ng kuwento para buksan ang detalyadong ulat at mga tsart ng bawat eksena.</p></div>
                  <span>{stories.length} kuwento</span>
                </div>
                <div className="analytics-story-grid">
                  {stories.map((story) => (
                    <StoryCard key={story.id} story={story} disabled={!showAnalysis} onClick={() => setSelectedStoryId(story.id)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </>}

      {selectedStory && <StoryDetailsModal story={selectedStory} onClose={() => setSelectedStoryId(null)} />}
    </div>
  );
}
