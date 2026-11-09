import { useState } from 'react';
import StoryDetailsModal from './StoryDetailsModal';
import { StoryOverviewCharts } from './StoryAnalyticsCharts';

const STORY_COLORS = ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

function SummaryCard({ label, value, hint, accent }) {
  return (
    <article className="analytics-summary-card" style={{ '--summary-accent': accent }}>
      <span className="analytics-summary-label">{label}</span>
      <strong className="analytics-summary-value">{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

function StoryCard({ story, onClick }) {
  return (
    <button type="button" className="analytics-story-card" style={{ '--story-accent': story.color }} onClick={onClick}>
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

export default function StoryAnalyticsDashboard({ analytics }) {
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const stories = analytics.stories.map((story, index) => ({ ...story, color: STORY_COLORS[index % STORY_COLORS.length] }));
  const selectedStory = stories.find((story) => story.id === selectedStoryId);
  const { summary } = analytics;

  return (
    <div className="story-analytics stack">
      <section className="analytics-summary-grid" aria-label="Overall story statistics">
        <SummaryCard label="Kabuuang mag-aaral" value={summary.totalStudents} hint="mga account ng mag-aaral na nakarehistro" accent="#1e3a8a" />
        <SummaryCard label="Kabuuang pagkumpleto" value={`${summary.completionRate}%`} hint="mga pares ng mag-aaral at kuwentong nasimulan at natapos" accent="#1d4ed8" />
        <SummaryCard label="Karaniwang pagsubok bawat eksena" value={summary.averageAttemptsPerScene ?? '—'} hint={summary.averageAttemptsPerScene === null ? 'Wala pang naitalang nakapasa' : 'sa mga mag-aaral na nakapasa'} accent="#2563eb" />
        <SummaryCard label="Pinakamadaling kuwento" value={summary.easiestStory?.title || 'Kulang ang datos'} hint={summary.easiestStory ? `${summary.easiestStory.averageAttemptsPerScene} pagsubok bawat napagtagumpayang eksena` : 'Kailangang may mag-aaral munang makapasa sa mga eksena'} accent={summary.easiestStory ? stories.find((s) => s.id === summary.easiestStory.id)?.color : '#3b82f6'} />
        <SummaryCard label="Pinakamahirap na kuwento" value={summary.hardestStory?.title || 'Kulang ang datos'} hint={summary.hardestStory ? `${summary.hardestStory.averageAttemptsPerScene} pagsubok bawat napagtagumpayang eksena` : 'Kailangang may mag-aaral munang makapasa sa mga eksena'} accent={summary.hardestStory ? stories.find((s) => s.id === summary.hardestStory.id)?.color : '#60a5fa'} />
      </section>

      {stories.length === 0 ? <EmptyStories /> : <>
        <StoryOverviewCharts stories={stories} />
        <section className="analytics-story-section">
          <div className="analytics-section-heading">
            <div><h2>Progreso ng kuwento</h2><p>Pumili ng kuwento para makita ang progreso ng mga mag-aaral sa bawat eksena.</p></div>
            <span>{stories.length} {stories.length === 1 ? 'kuwento' : 'kuwento'}</span>
          </div>
          <div className="analytics-story-grid">
            {stories.map((story) => <StoryCard key={story.id} story={story} onClick={() => setSelectedStoryId(story.id)} />)}
          </div>
        </section>
      </>}

      {selectedStory && <StoryDetailsModal story={selectedStory} onClose={() => setSelectedStoryId(null)} />}
    </div>
  );
}
