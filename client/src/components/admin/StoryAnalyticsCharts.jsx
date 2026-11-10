import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const AXIS_TICK = { fill: '#64748b', fontSize: 12 };
const GRID = '#e2e8f0';
const CHART_COLORS = ['#2563eb', '#10b981', '#7c3aed', '#eab308', '#ef4444', '#0ea5e9', '#f97316'];

const shortLabel = (value, max = 13) => (value?.length > max ? `${value.slice(0, max - 1)}…` : value);

function shade(hex, amount) {
  const clean = hex.replace('#', '');
  const parts = clean.length === 3
    ? clean.split('').map((char) => parseInt(char + char, 16))
    : [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
  return `#${parts.map((part) => Math.round(part + (255 - part) * amount).toString(16).padStart(2, '0')).join('')}`;
}

/* ---------- Overview charts (kept for backward compatibility) ---------- */

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
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="title" tickFormatter={(v) => shortLabel(v, 12)} interval={0} angle={0} textAnchor="middle" height={38} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip mode="completion" />} shared={false} isAnimationActive={false} cursor={false} />
              <Bar dataKey="successRate" name="Antas ng pagkumpleto" radius={[8, 8, 0, 0]}>
                {stories.map((story, index) => <Cell key={story.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
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
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="title" tickFormatter={(v) => shortLabel(v, 12)} interval={0} angle={0} textAnchor="middle" height={38} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis allowDecimals tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip mode="difficulty" />} shared={false} isAnimationActive={false} cursor={false} />
              <Bar dataKey="averageAttemptsPerScene" name="Karaniwang bilang ng pagsubok" radius={[8, 8, 0, 0]}>
                {stories.map((story, index) => <Cell key={story.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="analytics-empty-chart">Lalabas ang antas ng hirap kapag may mga eksenang napagtagumpayan na ang mga mag-aaral.</p>}
      </section>
    </div>
  );
}

/* ---------- Scene-level charts (used in the story modal) ---------- */

function SceneTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="analytics-tooltip">
      <strong>{row.title}</strong>
      {mode === 'reach' ? <>
        <span>Nakarating: <b>{row.reachedStudents}</b> mag-aaral</span>
        <span>Nakapasa: <b>{row.passedStudents}</b> mag-aaral</span>
      </> : <>
        {payload.map((item) => <span key={item.dataKey}>{item.name}: <b>{item.value}</b> mag-aaral</span>)}
        <span>Karaniwang pagsubok bago makapasa: <b>{row.avgAttempts ?? 'Wala pang nakapasa'}</b></span>
      </>}
    </div>
  );
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="analytics-tooltip">
      <strong>{item.name}</strong>
      <span><b>{item.value}</b> mag-aaral</span>
    </div>
  );
}

function ModalDonut({ data, centerValue, centerLabel }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <p className="analytics-empty-chart">Wala pang datos.</p>;
  return (
    <div className="donut-layout">
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none">
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip content={<DonutTooltip />} isAnimationActive={false} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center"><strong>{centerValue}</strong><span>{centerLabel}</span></div>
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
  );
}

export function PassOutcomeDonut({ scenes, color }) {
  const reached = scenes.reduce((sum, s) => sum + (Number(s.reachedStudents) || 0), 0);
  const passed = scenes.reduce((sum, s) => sum + (Number(s.passedStudents) || 0), 0);
  const data = [
    { name: 'Nakapasa', value: passed, color },
    { name: 'Wala pang tamang sagot', value: Math.max(reached - passed, 0), color: shade(color, 0.8) },
  ];
  return (
    <ModalDonut
      data={data}
      centerValue={reached ? `${Math.round((passed / reached) * 100)}%` : '—'}
      centerLabel="nakapasa"
    />
  );
}

export function AttemptsDonut({ scenes, color }) {
  const sum = (key) => scenes.reduce((total, s) => total + (Number(s.attempts?.[key]) || 0), 0);
  const data = [
    { name: 'Unang pagsubok', value: sum('first'), color },
    { name: 'Ikalawang pagsubok', value: sum('second'), color: shade(color, 0.3) },
    { name: 'Ikatlong pagsubok', value: sum('third'), color: shade(color, 0.55) },
    { name: '4 o higit pa', value: sum('fourPlus'), color: shade(color, 0.78) },
  ];
  const total = data.reduce((acc, d) => acc + d.value, 0);
  return <ModalDonut data={data} centerValue={total} centerLabel="pagpasa" />;
}

export function SceneReachChart({ scenes, color }) {
  const reachedColor = '#10b981';
  return (
    <div className="analytics-scene-chart">
      <ResponsiveContainer width="100%" height={310}>
        <BarChart data={scenes} margin={{ top: 12, right: 12, left: -16, bottom: 52 }} barGap={4}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="title" tickFormatter={(v) => shortLabel(v, 16)} interval={0} angle={0} textAnchor="middle" height={36} tick={{ ...AXIS_TICK, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<SceneTooltip mode="reach" />} shared={false} isAnimationActive={false} cursor={false} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#475569' }} />
          <Bar dataKey="reachedStudents" name="Nakarating" fill={reachedColor} radius={[6, 6, 0, 0]} />
          <Bar dataKey="passedStudents" name="Nakapasa" fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SceneAttemptsChart({ scenes, color }) {
  const shades = [color, '#f59e0b', '#7c3aed', '#10b981'];
  return (
    <div className="analytics-scene-chart">
      <ResponsiveContainer width="100%" height={310}>
        <BarChart data={scenes} margin={{ top: 12, right: 12, left: -16, bottom: 52 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="title" tickFormatter={(v) => shortLabel(v, 16)} interval={0} angle={0} textAnchor="middle" height={36} tick={{ ...AXIS_TICK, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<SceneTooltip mode="attempts" />} shared={false} isAnimationActive={false} cursor={false} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#475569' }} />
          <Bar dataKey="attempts.first" name="Unang pagsubok" stackId="attempts" fill={shades[0]} />
          <Bar dataKey="attempts.second" name="Ikalawang pagsubok" stackId="attempts" fill={shades[1]} />
          <Bar dataKey="attempts.third" name="Ikatlong pagsubok" stackId="attempts" fill={shades[2]} />
          <Bar dataKey="attempts.fourPlus" name="4 o higit pang pagsubok" stackId="attempts" fill={shades[3]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}