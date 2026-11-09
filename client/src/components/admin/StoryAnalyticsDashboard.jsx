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
        <span className="analytics-progress-label"><span>Completion</span><b>{story.hasData ? `${story.successRate}%` : 'No play data'}</b></span>
        <span className="analytics-progress-track" aria-label={story.hasData ? `${story.successRate}% completed` : 'No play data yet'}>
          <span style={{ width: `${story.successRate}%` }} />
        </span>
        <span className="analytics-story-facts">
          <span><small>Students finished</small><b>{story.finishedStudents} of {story.startedStudents}</b></span>
          <span><small>Avg. attempts per scene</small><b>{story.averageAttemptsPerScene ?? '—'}</b></span>
        </span>
        <span className="analytics-tricky-scene">
          <small>Trickiest scene</small>
          <b>{story.hardestScene?.title || (story.hasData ? 'Not enough data yet' : 'No play data yet')}</b>
        </span>
        <span className="analytics-story-open">View story report <span aria-hidden="true">→</span></span>
      </span>
    </button>
  );
}

function EmptyStories() {
  return (
    <div className="analytics-empty-state">
      <span aria-hidden="true">🗺️</span>
      <h2>No published stories yet</h2>
      <p>Publish a story to see its student progress and learning data here.</p>
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
        <SummaryCard label="Total students" value={summary.totalStudents} hint="registered student accounts" accent="#1e3a8a" />
        <SummaryCard label="Overall completion" value={`${summary.completionRate}%`} hint="started student-story pairs that finished" accent="#1d4ed8" />
        <SummaryCard label="Avg. attempts per scene" value={summary.averageAttemptsPerScene ?? '—'} hint={summary.averageAttemptsPerScene === null ? 'No passes recorded yet' : 'among students who passed'} accent="#2563eb" />
        <SummaryCard label="Easiest story" value={summary.easiestStory?.title || 'Not enough data'} hint={summary.easiestStory ? `${summary.easiestStory.averageAttemptsPerScene} attempts per passed scene` : 'Students need to pass scenes first'} accent={summary.easiestStory ? stories.find((s) => s.id === summary.easiestStory.id)?.color : '#3b82f6'} />
        <SummaryCard label="Hardest story" value={summary.hardestStory?.title || 'Not enough data'} hint={summary.hardestStory ? `${summary.hardestStory.averageAttemptsPerScene} attempts per passed scene` : 'Students need to pass scenes first'} accent={summary.hardestStory ? stories.find((s) => s.id === summary.hardestStory.id)?.color : '#60a5fa'} />
      </section>

      {stories.length === 0 ? <EmptyStories /> : <>
        <StoryOverviewCharts stories={stories} />
        <section className="analytics-story-section">
          <div className="analytics-section-heading">
            <div><h2>Story progress</h2><p>Choose a story to see scene-by-scene student progress.</p></div>
            <span>{stories.length} {stories.length === 1 ? 'story' : 'stories'}</span>
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
