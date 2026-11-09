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
        <span>Pagkumpleto: {row.successRate}%</span>
        <span>Mga mag-aaral na tumapos: {row.finishedStudents} sa {row.startedStudents}</span>
      </> : <>
        <span>Karaniwang pagsubok bawat eksena: {row.averageAttemptsPerScene ?? 'Wala pang naitalang nakapasa'}</span>
        <span>Mga mag-aaral na nakapasa sa eksena: {row.successfulScenePasses}</span>
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
          <div><h2>Pagkumpleto ng kuwento</h2><p>Aling mga kuwento ang tinatapos ng mga mag-aaral?</p></div>
        </div>
        {stories.some((story) => story.hasData) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stories} margin={{ top: 12, right: 12, left: -14, bottom: 18 }}>
              <CartesianGrid stroke="#dbe4f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="title" tickFormatter={(value) => shortLabel(value, 16)} interval={0} angle={-12} textAnchor="end" height={52} tick={{ fill: '#475569', fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip content={<ChartTooltip mode="completion" />} />
              <Bar dataKey="successRate" name="Antas ng pagkumpleto" radius={[8, 8, 0, 0]}>
                {stories.map((story) => <Cell key={story.id} fill={story.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="analytics-empty-chart">Lalabas ang mga tsart kapag nagsimulang maglaro ng mga kuwento ang mga mag-aaral.</p>}
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-heading">
          <div><h2>Antas ng hirap ng kuwento</h2><p>Karaniwang mas mahirap ang kuwentong nangangailangan ng mas maraming pagsubok.</p></div>
        </div>
        {hasAttempts ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stories} margin={{ top: 12, right: 12, left: -14, bottom: 18 }}>
              <CartesianGrid stroke="#dbe4f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="title" tickFormatter={(value) => shortLabel(value, 16)} interval={0} angle={-12} textAnchor="end" height={52} tick={{ fill: '#475569', fontSize: 12 }} />
              <YAxis allowDecimals tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip content={<ChartTooltip mode="difficulty" />} />
              <Bar dataKey="averageAttemptsPerScene" name="Karaniwang bilang ng pagsubok" radius={[8, 8, 0, 0]}>
                {stories.map((story) => <Cell key={story.id} fill={story.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="analytics-empty-chart">Lalabas ang antas ng hirap kapag may mga eksenang napagtagumpayan na ang mga mag-aaral.</p>}
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
        <span>Nakarating: {row.reachedStudents} mag-aaral</span>
        <span>Nakapasa: {row.passedStudents} mag-aaral</span>
      </> : <>
        {payload.map((item) => <span key={item.dataKey}>{item.name}: {item.value} students</span>)}
        <span>Karaniwang pagsubok bago makapasa: {row.avgAttempts ?? 'Wala pang nakapasa'}</span>
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
          <CartesianGrid stroke="#dbe4f0" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="title" tickFormatter={(value) => shortLabel(value, 12)} interval={0} angle={-24} textAnchor="end" height={68} tick={{ fill: '#475569', fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
          <Tooltip content={<SceneTooltip mode="reach" />} />
          <Legend />
          <Bar dataKey="reachedStudents" name="Nakarating" fill={reachedColor} radius={[5, 5, 0, 0]} />
          <Bar dataKey="passedStudents" name="Nakapasa" fill={color} radius={[5, 5, 0, 0]} />
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
          <CartesianGrid stroke="#dbe4f0" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="title" tickFormatter={(value) => shortLabel(value, 12)} interval={0} angle={-24} textAnchor="end" height={68} tick={{ fill: '#475569', fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
          <Tooltip content={<SceneTooltip mode="attempts" />} />
          <Legend />
          <Bar dataKey="attempts.first" name="Unang pagsubok" stackId="attempts" fill={shades[0]} />
          <Bar dataKey="attempts.second" name="Ikalawang pagsubok" stackId="attempts" fill={shades[1]} />
          <Bar dataKey="attempts.third" name="Ikatlong pagsubok" stackId="attempts" fill={shades[2]} />
          <Bar dataKey="attempts.fourPlus" name="4 o higit pang pagsubok" stackId="attempts" fill={shades[3]} radius={[5, 5, 0, 0]} />
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
