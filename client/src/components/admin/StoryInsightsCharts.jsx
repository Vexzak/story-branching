import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Sector,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const STATUS_META = {
  completed: { label: 'Natapos', color: '#2563eb' },
  in_progress: { label: 'Kasalukuyang naglalaro', color: '#2563eb' },
  abandoned: { label: 'Hindi tinapos', color: '#93c5fd' },
};

const CHART_COLORS = ['#2563eb', '#10b981', '#7c3aed', '#eab308', '#ef4444', '#0ea5e9', '#f97316'];

const AXIS_TICK = { fill: '#64748b', fontSize: 12 };
const shortTitle = (t = '', n = 18) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

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

function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  const first = payload[0];
  return (
    <div className="analytics-tooltip">
      <strong>{first.payload.fullTitle || label || first.name}</strong>
      {payload.map((p) => (
        <span key={p.dataKey || p.name}>{p.name}: <b>{p.value}{suffix}</b></span>
      ))}
    </div>
  );
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

function HorizontalBars({ title, subtitle, data, dataKey, name, suffix = '', domain, emptyText, compact }) {
  return (
    <section className="analytics-panel">
      <div className="analytics-panel-heading">
        <div><h3>{title}</h3><p>{subtitle}</p></div>
      </div>
      {data.length === 0 ? <p className="analytics-empty-chart">{emptyText}</p> : (
        <ResponsiveContainer width="100%" height={Math.max(compact ? 170 : 220, data.length * (compact ? 38 : 46))}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: compact ? 8 : 24, left: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis type="number" domain={domain} tick={compact ? { ...AXIS_TICK, fontSize: 9 } : AXIS_TICK} tickFormatter={(v) => `${v}${suffix}`} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={compact ? 62 : 118} tick={compact ? { ...AXIS_TICK, fontSize: 9 } : AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip suffix={suffix} />} shared={false} isAnimationActive={false} cursor={false} />
            <Bar dataKey={dataKey} name={name} radius={[0, 8, 8, 0]} barSize={compact ? 14 : 20}>
              {data.map((d) => <Cell key={d.fullTitle} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export default function StoryInsightsCharts({ stories, sessions = [] }) {
  const compact = useCompactCharts();
  const started = stories.reduce((sum, s) => sum + (Number(s.startedStudents) || 0), 0);
  const finished = stories.reduce((sum, s) => sum + (Number(s.finishedStudents) || 0), 0);

  const completionData = [
    { name: 'Natapos', value: finished, color: '#2563eb' },
    { name: 'Hindi pa tapos', value: Math.max(started - finished, 0), color: '#dbeafe' },
  ];

  const statusData = Object.entries(STATUS_META).map(([key, meta]) => ({
    name: meta.label,
    value: sessions.filter((s) => s.status === key).length,
    color: meta.color,
  }));

  const completionBars = stories.map((s, index) => ({
    name: shortTitle(s.title),
    fullTitle: s.title,
    Pagkumpleto: s.hasData ? Number(s.successRate) || 0 : 0,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const attemptBars = stories
    .filter((s) => s.averageAttemptsPerScene !== null && s.averageAttemptsPerScene !== undefined)
    .map((s, index) => ({
      name: shortTitle(s.title),
      fullTitle: s.title,
      Pagsubok: Number(s.averageAttemptsPerScene) || 0,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));

  return (
    <div className="stack">
      <div className="insight-grid">
        <Donut
          title="Pagkumpleto ng mga kuwento"
          subtitle="Mga pares ng mag-aaral at kuwento: natapos laban sa nasimulan."
          data={completionData}
          centerValue={started ? `${Math.round((finished / started) * 100)}%` : '—'}
          centerLabel="natapos"
          emptyText="Wala pang nasimulang kuwento."
          compact={compact}
        />
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
      <div className="insight-grid">
        <HorizontalBars
          title="Pagkumpleto bawat kuwento"
          subtitle="Porsyento ng mga mag-aaral na nakatapos."
          data={completionBars}
          dataKey="Pagkumpleto"
          name="Pagkumpleto"
          suffix="%"
          domain={[0, 100]}
          emptyText="Wala pang datos."
          compact={compact}
        />
        <HorizontalBars
          title="Karaniwang pagsubok bawat eksena"
          subtitle="Mas mataas na numero, mas mahirap ang kuwento."
          data={attemptBars}
          dataKey="Pagsubok"
          name="Pagsubok"
          emptyText="Wala pang mag-aaral na nakapasa sa mga eksena."
          compact={compact}
        />
      </div>
    </div>
  );
}
