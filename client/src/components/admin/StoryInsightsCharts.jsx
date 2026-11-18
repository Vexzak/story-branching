import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart, Sector,
  ResponsiveContainer, XAxis, YAxis,
} from 'recharts';

const STATUS_META = {
  completed: { label: 'Natapos', color: '#7c3aed' },
  in_progress: { label: 'Kasalukuyang naglalaro', color: '#1e3a8a' },
  abandoned: { label: 'Hindi tinapos', color: '#93c5fd' },
};

const DAILY_COLORS = ['#2563eb', '#10b981', '#7c3aed', '#eab308'];

const AXIS_TICK = { fill: '#64748b', fontSize: 12 };

function useCompactCharts() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 680px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 680px)');
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return compact;
}

function Donut({ title, subtitle, data, centerValue, centerLabel, emptyText, compact }) {
  const [hovered, setHovered] = useState(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const angle = -(hovered?.midAngle || 0) * Math.PI / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const arrowDirection = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'left' : 'right')
    : (dy > 0 ? 'top' : 'bottom');
  return (
    <section className="analytics-panel">
      <div className="analytics-panel-heading">
        <div><h3>{title}</h3><p>{subtitle}</p></div>
      </div>
      {total === 0 ? <p className="analytics-empty-chart">{emptyText}</p> : (
        <div className="donut-layout">
          <div className="donut-wrap" onMouseLeave={() => setHovered(null)}>
            <ResponsiveContainer width="100%" height={compact ? 150 : 200}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={compact ? 36 : 62}
                  outerRadius={compact ? 54 : 88}
                  paddingAngle={2}
                  stroke="none"
                  activeShape={(props) => <Sector {...props} outerRadius={props.outerRadius + (compact ? 4 : 6)} />}
                  onMouseEnter={(entry) => setHovered(entry)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {data.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center"><strong>{centerValue}</strong><span>{centerLabel}</span></div>
            {hovered && (
              <div
                className="analytics-tooltip analytics-tooltip--donut"
                role="status"
                data-arrow-direction={arrowDirection}
                style={{
                  left: `${(hovered.cx || 100) + dx * ((hovered.outerRadius || 88) + 34)}px`,
                  top: `${(hovered.cy || 100) + dy * ((hovered.outerRadius || 88) + 34)}px`,
                }}
              >
                {hovered.payload?.name || hovered.name}: {hovered.payload?.value ?? hovered.value} ({total ? `${Math.round(((hovered.payload?.value ?? hovered.value) / total) * 100)}%` : '0%'})
              </div>
            )}
          </div>
          <ul className="donut-legend">
            {data.map((d) => (
              <li key={d.name}>
                <i style={{ background: d.color }} />
                <span>{d.name}</span>
                <b>{d.value}</b>
                <small>{Math.round((d.value / total) * 100)}%</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StoryReach({ stories }) {
  const rankedStories = stories
    .map((story) => ({ ...story, studentReach: Number(story.startedStudents) || 0 }))
    .filter((story) => story.studentReach > 0)
    .sort((a, b) => b.studentReach - a.studentReach)
    .slice(0, 5);
  const maxReach = Math.max(...rankedStories.map((story) => story.studentReach), 0);

  return (
    <section className="analytics-panel story-reach-panel">
      <div className="analytics-panel-heading">
        <div>
          <h3>Abot ng bawat kuwento</h3>
          <p>Natatanging mag-aaral na nagsimula sa bawat kuwento; nangunguna ang may pinakamaraming nagsimula.</p>
        </div>
      </div>
      {rankedStories.length ? (
        <ol className="story-reach-list">
          {rankedStories.map((story) => (
            <li key={story.id}>
              <div className="story-reach-label">
                <span title={story.title}>{story.title}</span>
                <b>{story.studentReach} mag-aaral</b>
              </div>
              <div className="story-reach-track" aria-label={`${story.title}: ${story.studentReach} mag-aaral ang nagsimula`}>
                <span style={{ width: `${(story.studentReach / maxReach) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="analytics-empty-chart">Wala pang mag-aaral na nagsimula ng kuwento.</p>}
    </section>
  );
}

function DailyProgressTooltip({ point, stories, selectedStoryId, dailyProgress, left, top, width, arrowX }) {
  if (!point?.date) return null;
  const dateKey = point.date;
  const date = new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('fil-PH', { timeZone: 'UTC', dateStyle: 'full' });
  const visibleStories = selectedStoryId
    ? stories.filter((story) => story.id === selectedStoryId)
    : stories;
  if (!visibleStories.length) return null;
  return (
    <div className="analytics-tooltip daily-progress-tooltip" style={{ left, top, width, '--tooltip-arrow-x': `${arrowX}px` }}>
      <strong>{date}</strong>
      <small className="daily-progress-average-note">Average ang berde bawat mag-aaral; kabuuan ang pula sa araw na ito.</small>
      {visibleStories.map((story) => {
        const studentCount = point?.[story.id] ?? 0;
        const details = dailyProgress.find((entry) => entry.date === dateKey && entry.storyId === story.id);
        return (
          <div className="daily-progress-story-detail" key={story.id}>
            <span className="daily-progress-student-count"><i style={{ background: story.color }} />{story.title}: <b>{studentCount} mag-aaral na umusad</b></span>
            {details?.averageCorrectScenes !== null && details?.averageCorrectScenes !== undefined ? <>
              <span className="daily-progress-average is-correct"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" /></svg>{details.averageCorrectScenes} tamang eksena bawat mag-aaral</span>
              <span className="daily-progress-average is-mistake"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10m4.5-4.5L8 13l-4.5-4.5" /></svg>{details.totalAttempts} kabuuang pagsubok · {details.totalMistakes} mali</span>
            </> : <span className="daily-progress-no-detail">Walang naitalang tamang eksena sa araw na ito.</span>}
          </div>
        );
      })}
    </div>
  );
}

function DailyProgressDot({ cx, cy, payload, story, isDimmed, isHovered, onHover }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return (
    <g>
      {!isDimmed && <circle cx={cx} cy={cy} r={11} fill="transparent" onMouseEnter={() => onHover({ point: payload, x: cx, y: cy, storyId: story.id })} onMouseLeave={() => onHover(null)} />}
      <circle cx={cx} cy={cy} r={isHovered ? 5 : 2.5} fill={isDimmed ? '#cbd5e1' : story.color} pointerEvents="none" />
    </g>
  );
}

function DailyProgressChart({ stories, dailyProgress, compact }) {
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const chartContainerRef = useRef(null);
  const activeStories = stories.slice(0, 4).map((story, index) => ({ ...story, color: DAILY_COLORS[index] }));
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const firstDay = todayUtc - 27 * 86400000;
  const dailyLookup = new Map(dailyProgress.map((entry) => [`${entry.date}:${entry.storyId}`, entry.students]));
  const chartData = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(firstDay + index * 86400000).toISOString().slice(0, 10);
    return activeStories.reduce((point, story) => ({
      ...point,
      [story.id]: dailyLookup.get(`${date}:${story.id}`) || 0,
    }), { date });
  });
  const hasActivity = dailyProgress.some((entry) => entry.date >= chartData[0]?.date && entry.date <= chartData.at(-1)?.date);

  return (
    <section className="analytics-panel daily-progress-panel">
      <div className="analytics-panel-heading">
        <div><h3>Pag-unlad ng mga mag-aaral bawat araw</h3><p>Bilang ng mga mag-aaral na umusad sa bawat kuwento sa nakalipas na 28 araw.</p></div>
      </div>
      {!activeStories.length || !hasActivity ? <p className="analytics-empty-chart">Wala pang umusad na mag-aaral sa panahong ito.</p> : <>
        <div className="daily-progress-legend" aria-label="Pumili ng kuwento sa tsart">
          {activeStories.map((story) => {
            const isSelected = selectedStoryId === story.id;
            return <button type="button" key={story.id} className={selectedStoryId && !isSelected ? 'is-dimmed' : ''} aria-pressed={isSelected} onClick={() => setSelectedStoryId(isSelected ? null : story.id)}><i style={{ '--story-color': story.color }} />{story.title}</button>;
          })}
          {selectedStoryId && <button type="button" className="daily-progress-clear" onClick={() => setSelectedStoryId(null)}>Kanselahin</button>}
        </div>
        <div className="daily-progress-chart" ref={chartContainerRef} onMouseLeave={() => setHoveredPoint(null)}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 18, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#e6edf6" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="date" interval={compact ? 6 : 4} tickFormatter={(date) => String(Number(date.slice(8)))} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#d7e0ec' }} />
              <YAxis allowDecimals={false} width={compact ? 28 : 40} tick={compact ? { ...AXIS_TICK, fontSize: 10 } : AXIS_TICK} tickLine={false} axisLine={false} />
              {activeStories.map((story) => {
                const isDimmed = selectedStoryId && selectedStoryId !== story.id;
                const isHovered = hoveredPoint?.storyId === story.id;
                return <Line key={story.id} type="monotone" dataKey={story.id} name={story.title} stroke={isDimmed ? '#cbd5e1' : story.color} strokeWidth={selectedStoryId === story.id ? 4 : 3} dot={(dotProps) => <DailyProgressDot {...dotProps} story={story} isDimmed={isDimmed} isHovered={isHovered && hoveredPoint.point?.date === dotProps.payload?.date} onHover={setHoveredPoint} />} activeDot={false} connectNulls />;
              })}
            </LineChart>
          </ResponsiveContainer>
          {hoveredPoint && (() => {
            const width = chartContainerRef.current?.clientWidth || 0;
            const bubbleWidth = Math.min(360, Math.max(width - 24, 240));
            const left = Math.max(bubbleWidth / 2 + 8, Math.min(hoveredPoint.x, width - bubbleWidth / 2 - 8));
            const arrowX = Math.max(10, Math.min(hoveredPoint.x - left + bubbleWidth / 2, bubbleWidth - 10));
            return <DailyProgressTooltip point={hoveredPoint.point} stories={activeStories} selectedStoryId={selectedStoryId} dailyProgress={dailyProgress} left={left} top={Math.max(12, hoveredPoint.y - 9)} width={bubbleWidth} arrowX={arrowX} />;
          })()}
        </div>
      </>}
    </section>
  );
}

export default function StoryInsightsCharts({ stories, sessions = [], dailyProgress = [] }) {
  const compact = useCompactCharts();
  const statusData = Object.entries(STATUS_META).map(([key, meta]) => ({
    name: meta.label,
    value: sessions.filter((s) => s.status === key).length,
    color: meta.color,
  }));

  return (
    <div className="stack">
      <DailyProgressChart stories={stories} dailyProgress={dailyProgress} compact={compact} />
      <div className="insight-grid">
        <StoryReach stories={stories} />
        <Donut
          title="Estado ng mga kamakailang sesyon"
          subtitle="Mula sa pinakabagong mga sesyon na naitala."
          data={statusData}
          centerValue={sessions.length}
          centerLabel="sesyon"
          emptyText="Wala pang sesyon sa kuwento."
          compact={compact}
        />
      </div>
    </div>
  );
}
