import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const shortLabel = (value, max = 13) => value?.length > max ? `${value.slice(0, max - 1)}…` : value;

function ChartTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="analytics-tooltip">
      <strong>{row.title || row.name}</strong>
      {mode === 'completion' ? <>
        <span>Completion: {row.successRate}%</span>
        <span>Students finished: {row.finishedStudents} of {row.startedStudents}</span>
      </> : <>
        <span>Average attempts per scene: {row.averageAttemptsPerScene ?? 'No passes recorded'}</span>
        <span>Students who passed a scene: {row.successfulScenePasses}</span>
      </>}
    </div>
  );
}

export function StoryOverviewCharts({ stories }) {
  const hasAttempts = stories.some((story) => story.averageAttemptsPerScene !== null);
  return (
    <div className="analytics-chart-grid">
      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <div><h2>Story completion</h2><p>Which stories are students finishing?</p></div>
        </div>
        {stories.some((story) => story.hasData) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stories} margin={{ top: 12, right: 12, left: -14, bottom: 18 }}>
              <CartesianGrid stroke="#e8dfcc" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="title" tickFormatter={(value) => shortLabel(value, 16)} interval={0} angle={-12} textAnchor="end" height={52} tick={{ fill: '#654b32', fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#765a39', fontSize: 12 }} />
              <Tooltip content={<ChartTooltip mode="completion" />} />
              <Bar dataKey="successRate" name="Completion rate" radius={[8, 8, 0, 0]}>
                {stories.map((story) => <Cell key={story.id} fill={story.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="analytics-empty-chart">Charts will fill in after students start playing stories.</p>}
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <div><h2>Story difficulty</h2><p>More attempts usually means a harder story.</p></div>
        </div>
        {hasAttempts ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stories} margin={{ top: 12, right: 12, left: -14, bottom: 18 }}>
              <CartesianGrid stroke="#e8dfcc" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="title" tickFormatter={(value) => shortLabel(value, 16)} interval={0} angle={-12} textAnchor="end" height={52} tick={{ fill: '#654b32', fontSize: 12 }} />
              <YAxis allowDecimals tick={{ fill: '#765a39', fontSize: 12 }} />
              <Tooltip content={<ChartTooltip mode="difficulty" />} />
              <Bar dataKey="averageAttemptsPerScene" name="Average attempts" radius={[8, 8, 0, 0]}>
                {stories.map((story) => <Cell key={story.id} fill={story.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="analytics-empty-chart">Difficulty will show after students pass some scenes.</p>}
      </section>
    </div>
  );
}

function SceneTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="analytics-tooltip">
      <strong>{row.title}</strong>
      {mode === 'reach' ? <>
        <span>Reached: {row.reachedStudents} students</span>
        <span>Passed: {row.passedStudents} students</span>
      </> : <>
        {payload.map((item) => <span key={item.dataKey}>{item.name}: {item.value} students</span>)}
        <span>Average attempts to pass: {row.avgAttempts ?? 'No passes yet'}</span>
      </>}
    </div>
  );
}

export function SceneReachChart({ scenes, color }) {
  const reachedColor = shade(color, 0.68);
  return (
    <div className="analytics-scene-chart">
      <ResponsiveContainer width="100%" height={310}>
        <BarChart data={scenes} margin={{ top: 12, right: 12, left: -16, bottom: 52 }}>
          <CartesianGrid stroke="#e8dfcc" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="title" tickFormatter={(value) => shortLabel(value, 12)} interval={0} angle={-24} textAnchor="end" height={68} tick={{ fill: '#654b32', fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: '#765a39', fontSize: 12 }} />
          <Tooltip content={<SceneTooltip mode="reach" />} />
          <Legend />
          <Bar dataKey="reachedStudents" name="Reached" fill={reachedColor} radius={[5, 5, 0, 0]} />
          <Bar dataKey="passedStudents" name="Passed" fill={color} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SceneAttemptsChart({ scenes, color }) {
  const shades = [color, shade(color, 0.22), shade(color, 0.42), shade(color, 0.62)];
  return (
    <div className="analytics-scene-chart">
      <ResponsiveContainer width="100%" height={310}>
        <BarChart data={scenes} margin={{ top: 12, right: 12, left: -16, bottom: 52 }}>
          <CartesianGrid stroke="#e8dfcc" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="title" tickFormatter={(value) => shortLabel(value, 12)} interval={0} angle={-24} textAnchor="end" height={68} tick={{ fill: '#654b32', fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: '#765a39', fontSize: 12 }} />
          <Tooltip content={<SceneTooltip mode="attempts" />} />
          <Legend />
          <Bar dataKey="attempts.first" name="1st try" stackId="attempts" fill={shades[0]} />
          <Bar dataKey="attempts.second" name="2nd try" stackId="attempts" fill={shades[1]} />
          <Bar dataKey="attempts.third" name="3rd try" stackId="attempts" fill={shades[2]} />
          <Bar dataKey="attempts.fourPlus" name="4+ tries" stackId="attempts" fill={shades[3]} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function shade(hex, amount) {
  const clean = hex.replace('#', '');
  const parts = clean.length === 3
    ? clean.split('').map((char) => parseInt(char + char, 16))
    : [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
  return `#${parts.map((part) => Math.round(part + (255 - part) * amount).toString(16).padStart(2, '0')).join('')}`;
}
