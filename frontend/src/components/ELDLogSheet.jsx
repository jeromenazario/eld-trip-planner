import React from 'react';
import { Card } from './ui';
import { hrsMin, fmtClock } from '../utils/adapter';
import { Clock, MapPin } from 'lucide-react';

const G = {
  VW: 1100, VH: 243,
  x0: 128, x1: 1036,
  yTop: 30, rowH: 34,
  remarksY: 210,
};
G.gridW = G.x1 - G.x0;

const ROWS = [
  { key: 'off',     n: 1, label: 'Off Duty',              tint: 'var(--row-off)' },
  { key: 'sleeper', n: 2, label: 'Sleeper Berth',         tint: 'var(--row-sleeper)' },
  { key: 'driving', n: 3, label: 'Driving',               tint: 'var(--row-driving)' },
  { key: 'onduty',  n: 4, label: 'On Duty (Not Driving)', tint: 'var(--row-onduty)' },
];
const ROW_IDX = { off: 0, sleeper: 1, driving: 2, onduty: 3 };

const STATUS_LABEL = { off: 'Off Duty', sleeper: 'Sleeper Berth', driving: 'Driving', onduty: 'On Duty' };

function hourLabel(h) {
  if (h === 0 || h === 24) return 'M';
  if (h === 12) return 'N';
  return String(h % 12 === 0 ? 12 : h % 12);
}

function xAt(min) { return G.x0 + (min / 1440) * (G.x1 - G.x0); }
function yOf(status) { return G.yTop + (ROW_IDX[status] ?? 0) * G.rowH + G.rowH / 2; }

// Compute transition annotations once; shared between SVG and HTML sections.
function buildTransitions(day) {
  const MIN_X_GAP = 44;
  let lastLabelX = G.x0 - MIN_X_GAP - 1;

  const sorted = [...day.remarks].sort((a, b) => a.time - b.time);

  return day.changes.slice(1).map((c, i) => {
    const prev = day.changes[i];
    const x = xAt(c.start);
    const tier = i % 2;
    const showTime = (x - lastLabelX) >= MIN_X_GAP;
    if (showTime) lastLabelX = x;

    const direct = sorted.find(r => Math.abs(r.time - c.start) <= 15);

    if (direct) {
      return {
        time: c.start, from: prev.status, to: c.status,
        location: direct.place || direct.text,
        action: direct.text,
        estimated: false,
        x, tier, showTime,
      };
    }

    let prior = null;
    for (let k = sorted.length - 1; k >= 0; k--) {
      if (sorted[k].time < c.start) { prior = sorted[k]; break; }
    }

    // If no remark exists yet in this day, fall back to the last known place
    // from the previous day (e.g. driver is still near the overnight rest stop).
    const fallbackPlace = prior
      ? (prior.place || prior.text)
      : (day.carryPlace || null);

    return {
      time: c.start, from: prev.status, to: c.status,
      location: fallbackPlace,
      action: null,
      estimated: true,
      x, tier, showTime,
    };
  });
}

function LogGrid({ day, transitions }) {
  const gridBottom = G.yTop + G.rowH * 4;

  const pts = [];
  day.changes.forEach(c => {
    const y = yOf(c.status);
    pts.push([xAt(c.start), y]);
    pts.push([xAt(c.start + c.dur), y]);
  });
  const polyPts = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  const vlines = [];
  for (let q = 0; q <= 96; q++) {
    const min = q * 15;
    const x = xAt(min);
    const isHour = q % 4 === 0;
    const isMajor = q % 48 === 0;
    vlines.push(
      <line key={'v' + q} x1={x} x2={x} y1={G.yTop} y2={gridBottom}
        stroke={isMajor ? '#374151' : isHour ? '#9ca3af' : '#e3e6ea'}
        strokeWidth={isMajor ? 1.6 : isHour ? 1 : 0.6} />
    );
  }

  return (
    <svg viewBox={`0 0 ${G.VW} ${G.VH}`} width="100%" style={{ display: 'block' }}>
      {/* Row backgrounds + labels + totals */}
      {ROWS.map((r, i) => {
        const y = G.yTop + i * G.rowH;
        const total = day.totals[r.key] || 0;
        return (
          <g key={r.key}>
            <rect x={G.x0} y={y} width={G.x1 - G.x0} height={G.rowH} fill={r.tint} />
            <text x={16} y={y + G.rowH / 2} fontSize="9.5" fontWeight="700" fill="#374151"
              style={{ fontFamily: 'var(--mono)' }} dominantBaseline="middle">{r.n}:</text>
            <text x={28} y={y + G.rowH / 2 - (r.label.includes('(') ? 3 : 0)} fontSize="10" fontWeight="600" fill="#374151"
              dominantBaseline="middle">{r.label.split('(')[0].trim()}</text>
            {r.label.includes('(') &&
              <text x={28} y={y + G.rowH / 2 + 9} fontSize="7.5" fill="var(--muted)" dominantBaseline="middle">(Not Driving)</text>}
            <text x={(G.x1 + G.VW) / 2 + 14} y={y + G.rowH / 2} fontSize="11" fontWeight="600" fill="#111827"
              style={{ fontFamily: 'var(--mono)' }} textAnchor="middle" dominantBaseline="middle">
              {hrsMin(total)}
            </text>
          </g>
        );
      })}

      {[0, 1, 2, 3, 4].map(i => (
        <line key={'h' + i} x1={G.x0} x2={G.x1} y1={G.yTop + i * G.rowH} y2={G.yTop + i * G.rowH}
          stroke="#374151" strokeWidth={i === 0 || i === 4 ? 1.3 : 0.9} />
      ))}

      {vlines}

      {Array.from({ length: 25 }).map((_, h) => {
        const x = xAt(h * 60);
        const lbl = hourLabel(h);
        return (
          <g key={'lab' + h}>
            <text x={x} y={G.yTop - 8} fontSize="9" fill="var(--muted)" textAnchor="middle"
              style={{ fontFamily: 'var(--mono)' }}>{lbl}</text>
            <text x={x} y={gridBottom + 13} fontSize="9" fill="var(--muted)" textAnchor="middle"
              style={{ fontFamily: 'var(--mono)' }}>{lbl}</text>
          </g>
        );
      })}

      <text x={G.x0} y={G.yTop - 19} fontSize="8" fill="var(--label)" textAnchor="middle">Midnight</text>
      <text x={xAt(720)} y={G.yTop - 19} fontSize="8" fill="var(--label)" textAnchor="middle">Noon</text>
      <text x={G.x1} y={G.yTop - 19} fontSize="8" fill="var(--label)" textAnchor="middle">Midnight</text>
      <text x={(G.x1 + G.VW) / 2 + 14} y={G.yTop - 8} fontSize="7.5" fill="var(--label)" textAnchor="middle">TOTAL</text>

      {pts.length > 0 && (
        <polyline points={polyPts} fill="none" stroke="var(--line)" strokeWidth="2.6"
          strokeLinejoin="round" strokeLinecap="round" />
      )}
      {day.changes.slice(1).map((c, i) => (
        <circle key={'d' + i} cx={xAt(c.start)} cy={yOf(c.status)} r="2.1" fill="var(--line)" />
      ))}

      {/* ── REMARKS timeline markers ── */}
      <text x={G.x0 - 6} y={G.remarksY} fontSize="8.5" fontWeight="700" fill="#374151"
        textAnchor="end" dominantBaseline="middle"
        style={{ fontFamily: 'var(--mono)', letterSpacing: '.04em' }}>REMARKS</text>

      <line x1={G.x0} x2={G.x1} y1={G.remarksY} y2={G.remarksY} stroke="#374151" strokeWidth={1.2} />

      {transitions.map((t) => {
        const tickLen  = t.tier === 0 ? 14 : 26;
        const timeY    = G.remarksY - (t.tier === 0 ? 9 : 21);

        return (
          <g key={'rm' + t.time}>
            {t.showTime && (
              <text x={t.x} y={timeY} fontSize="8" textAnchor="middle"
                fill="#2d5a3d" fontWeight="700" style={{ fontFamily: 'var(--mono)' }}>
                {fmtClock(t.time)}
              </text>
            )}
            <line x1={t.x} x2={t.x} y1={G.remarksY} y2={G.remarksY + tickLen}
              stroke="#2d5a3d" strokeWidth={1.4} strokeDasharray="3 3" />
            <circle cx={t.x} cy={G.remarksY} r={2.2} fill="#2d5a3d" />
          </g>
        );
      })}
    </svg>
  );
}

function RemarksList({ transitions }) {
  if (!transitions.length) return null;

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '16px 22px 20px' }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: '#374151',
        letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12,
      }}>
        Remarks
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 8,
      }}>
        {transitions.map((t, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', gap: 3,
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--accent-tint)', border: '1px solid var(--accent-soft)',
          }}>
            {/* Time */}
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 11.5,
              fontWeight: 700, color: 'var(--accent)',
            }}>
              {fmtClock(t.time)}
            </span>

            {/* Status change */}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
              {STATUS_LABEL[t.from]} → {STATUS_LABEL[t.to]}
            </span>

            {/* Action label (e.g. Pickup, Fuel Stop 1) */}
            {t.action && (
              <span style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}>
                {t.action}
              </span>
            )}

            {/* Location (exact when at a stop, otherwise estimated) */}
            {t.location ? (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: t.estimated ? 'var(--label)' : 'var(--muted)', marginTop: 1,
              }}>
                <MapPin size={11} strokeWidth={2} color={t.estimated ? 'var(--label)' : 'var(--accent)'} />
                {t.estimated ? `~ ${t.location}` : t.location}
              </span>
            ) : (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11.5, color: 'var(--label)', fontStyle: 'italic', marginTop: 1,
              }}>
                <MapPin size={11} strokeWidth={2} color="var(--label)" />
                En route
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LogCard({ day }) {
  const transitions = buildTransitions(day);

  const head = [
    ['Driver',    day.driver || '—'],
    ['Co-driver', day.co_driver || 'None'],
    ['Carrier',   day.carrier || '—'],
    ['Truck #',   day.truck_number || '—'],
  ];

  return (
    <Card pad={false} style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 20, padding: '18px 22px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 11, background: 'var(--accent-soft)',
            color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, lineHeight: 1, opacity: .8, textAlign: 'center' }}>DAY</div>
            <div style={{ fontSize: 18, lineHeight: 1.1, fontWeight: 700 }}>{day.index}</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {day.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Daily log · 24-hour record of duty status</div>
              {day.index === 1 && day.startOffset > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 20 }}>
                  <Clock size={11} strokeWidth={2} />
                  Departs {fmtClock(day.startOffset)}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          {head.map(([k, val]) => (
            <div key={k}>
              <div style={{ fontSize: 10.5, color: 'var(--label)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{k}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap' }}>{val}</div>
            </div>
          ))}
          {day.miles > 0 && (
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--label)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em' }}>Miles</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2, fontFamily: 'var(--mono)' }}>{day.miles.toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>

      {/* SVG grid + REMARKS markers */}
      <div style={{ padding: '20px 18px 4px', overflowX: 'auto' }}>
        <LogGrid day={day} transitions={transitions} />
      </div>

      {/* Readable remarks cards */}
      <RemarksList transitions={transitions} />
    </Card>
  );
}

export default function ELDLogSheet({ logs }) {
  if (!logs?.length) return null;
  return (
    <div className="eld-log-list" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {logs.map((day, i) => <LogCard key={i} day={day} />)}
    </div>
  );
}
