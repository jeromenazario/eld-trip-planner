import React, { useState } from 'react';
import { Card } from './ui';
import { hrsMin, fmtClock } from '../utils/adapter';
import { Clock, MapPin, ChevronDown } from 'lucide-react';

const G = {
  VW: 1100, VH: 188,
  x0: 128, x1: 1036,
  yTop: 30, rowH: 34,
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

    // A remark counts as geocoded only when it carries a real place name that
    // differs from its own label (breaks/sleep usually don't have one).
    const hasPlace = (r) => r && r.place && r.place !== r.text;

    // Last known geocoded place strictly before this transition.
    const priorPlace = () => {
      for (let k = sorted.length - 1; k >= 0; k--) {
        if (sorted[k].time < c.start && hasPlace(sorted[k])) return sorted[k].place;
      }
      return day.carryPlace || null;
    };

    const direct = sorted.find(r => Math.abs(r.time - c.start) <= 15);

    if (direct) {
      // Named stops show their exact place; breaks/sleep are located at the
      // last known place (estimated) so e.g. "30-Min Break" reads with a city.
      const exact = hasPlace(direct);
      return {
        time: c.start, from: prev.status, to: c.status,
        location: exact ? direct.place : priorPlace(),
        action: direct.text,
        estimated: !exact,
        x, tier, showTime,
      };
    }

    // No remark at all — fall back to the last known place (e.g. driver is
    // still near the overnight rest stop on a new day).
    return {
      time: c.start, from: prev.status, to: c.status,
      location: priorPlace(),
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
    </svg>
  );
}

// FMCSA-style REMARKS timeline with a single, stable axis. The horizontal line —
// its REMARKS label and the green transition dots — is ALWAYS rendered and never
// moves. Collapsed, each transition shows a time label above + a short dashed
// prong below. Expanding fades in the hour ruler ticks + hour numbers, cross-
// fades the dashed prongs into the converging FMCSA prongs, and reveals the
// diagonal remark/location labels underneath — so the line stays put and the
// detail simply grows out of it.
function RemarksTimeline({ day, transitions, expanded }) {
  const HEAD = { VW: G.VW, VH: 78, axisY: 50, prongDrop: 8, prongH: 13 };
  const BODY = { VW: G.VW, VH: 170 };

  // Group transitions into STOPS so one physical stop becomes ONE mark with ONE
  // label, instead of a prong per duty change. A dropoff is often "drive in →
  // unload → go off duty" — three changes within an hour at the same place — and
  // drawing each separately makes the prongs collide into an "M" with the labels
  // stacked on top of each other. Clustering by place + time proximity fixes it.
  //
  // Each stop draws as a V spanning its start→end. A lone non-driving stop (a
  // standalone break) spans its own duration so it still gets two prongs; a long
  // rest (overnight sleeper) or a bare driving-resume collapses to one prong.
  const NON_DRIVING = new Set(['off', 'sleeper', 'onduty']);
  const CLUSTER_GAP_MIN = 90;   // changes within this gap at one place = one stop
  const MAX_V_MIN = 210;        // wider spans (overnight rests) → single prong

  const segDurAt = (time) => {
    const seg = day.changes.find(c => c.start === time);
    return seg ? seg.dur : 0;
  };

  // Candidate events: any transition carrying a place or an action note.
  const candidates = transitions.filter(t => t.location || t.action);

  // Merge consecutive candidates that belong to the same stop (close in time and
  // — when both are geocoded — at the same place).
  const clusters = [];
  for (const t of candidates) {
    const cur = clusters[clusters.length - 1];
    const gap = cur ? t.time - cur.lastTime : Infinity;
    const sameLoc = cur && cur.location && t.location ? cur.location === t.location : true;
    if (cur && gap <= CLUSTER_GAP_MIN && sameLoc) {
      cur.members.push(t);
      cur.lastTime = t.time;
      if (!cur.location && t.location) { cur.location = t.location; cur.estimated = t.estimated; }
      if (!cur.action && t.action) cur.action = t.action;
    } else {
      clusters.push({
        members: [t], lastTime: t.time,
        location: t.location, estimated: t.estimated, action: t.action,
      });
    }
  }

  const marks = clusters.map(cl => {
    const first = cl.members[0];
    const last  = cl.members[cl.members.length - 1];
    const start = first.time;
    // Multi-change stop spans first→last change; a lone non-driving stop spans
    // its own duration; a lone driving-resume is a single instant.
    let end;
    if (cl.members.length > 1) end = last.time;
    else if (NON_DRIVING.has(first.to)) end = first.time + segDurAt(first.time);
    else end = first.time;

    const spanMin = end - start;
    const single = spanMin < 2 || spanMin > MAX_V_MIN;
    const xa = xAt(start);
    const xb = single ? xa : Math.min(G.x1, xAt(end));
    const action = cl.action || (first.to === 'driving' ? 'Start driving' : null);
    return {
      time: start, location: cl.location, estimated: cl.estimated, action,
      xa, xb, single, xmid: single ? xa : (xa + xb) / 2,
    };
  });

  const { axisY } = HEAD;
  const prongTop = axisY + HEAD.prongDrop;
  const joinY    = prongTop + HEAD.prongH;

  // Each mark animates in as a left→right wave: its delay is proportional to how
  // far along the axis it sits, so on expand the ruler "unrolls" across the line.
  const SWEEP_MS = 320;
  const delayAt = (x) => `${Math.round(((x - G.x0) / G.gridW) * SWEEP_MS)}ms`;

  // Hour ruler ticks on the axis (expanded only) — grow up out of the line.
  const ticks = [];
  for (let q = 0; q <= 96; q++) {
    const x = xAt(q * 15);
    const isHour = q % 4 === 0;
    ticks.push(
      <line key={'t' + q} className="rx-tick" style={{ '--d': delayAt(x) }}
        x1={x} x2={x} y1={axisY - (isHour ? 9 : 5)} y2={axisY}
        stroke="#374151" strokeWidth={isHour ? 1 : 0.6} />
    );
  }

  return (
    <div className={`remarks-tl${expanded ? ' open' : ''}`}>
      {/* HEAD — fixed height; the axis here never moves */}
      <svg viewBox={`0 0 ${HEAD.VW} ${HEAD.VH}`} width="100%" style={{ display: 'block' }}>
        {/* Expanded-only: hour ruler ticks (sweep in) + numbers (slide down) */}
        {ticks}
        {Array.from({ length: 25 }).map((_, h) => (
          <text key={'hl' + h} className="rx-hour"
            style={{ '--d': delayAt(xAt(h * 60)), fontFamily: 'var(--mono)' }}
            x={xAt(h * 60)} y={axisY - 15} fontSize="9" fill="var(--muted)"
            textAnchor="middle">{hourLabel(h)}</text>
        ))}
        <g className="rx-on">
          <text x={G.x0} y={axisY - 29} fontSize="8" fill="var(--label)" textAnchor="middle">Midnight</text>
          <text x={xAt(720)} y={axisY - 29} fontSize="8" fill="var(--label)" textAnchor="middle">Noon</text>
          <text x={G.x1} y={axisY - 29} fontSize="8" fill="var(--label)" textAnchor="middle">Midnight</text>
        </g>

        {/* Collapsed-only: time labels above the axis */}
        <g className="rx-off">
          {transitions.map((t) => t.showTime && (
            <text key={'tm' + t.time} x={t.x} y={axisY - (t.tier === 0 ? 9 : 21)} fontSize="8"
              textAnchor="middle" fill="#2d5a3d" fontWeight="700" style={{ fontFamily: 'var(--mono)' }}>
              {fmtClock(t.time)}
            </text>
          ))}
        </g>

        {/* The constant axis + REMARKS label */}
        <text x={G.x0 - 6} y={axisY} fontSize="8.5" fontWeight="700" fill="#374151"
          textAnchor="end" dominantBaseline="middle"
          style={{ fontFamily: 'var(--mono)', letterSpacing: '.04em' }}>REMARKS</text>
        <line x1={G.x0} x2={G.x1} y1={axisY} y2={axisY} stroke="#374151" strokeWidth={1.2} />

        {/* Collapsed-only: short dashed prongs below the axis */}
        <g className="rx-off">
          {transitions.map((t) => (
            <line key={'dp' + t.time} x1={t.x} x2={t.x} y1={axisY} y2={axisY + (t.tier === 0 ? 14 : 26)}
              stroke="#2d5a3d" strokeWidth={1.4} strokeDasharray="3 3" />
          ))}
        </g>

        {/* Expanded-only: converging FMCSA prongs — drop into the wave */}
        {marks.map((b, i) => (
          <g key={'b' + i} className="rx-prong" style={{ '--d': delayAt(b.xa) }}>
            {b.single ? (
              <line x1={b.xa} x2={b.xa} y1={prongTop} y2={joinY}
                stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <path
                d={`M${b.xa.toFixed(1)},${prongTop} L${b.xmid.toFixed(1)},${joinY} L${b.xb.toFixed(1)},${prongTop}`}
                fill="none" stroke="var(--line)" strokeWidth="1.5"
                strokeLinejoin="round" strokeLinecap="round" />
            )}
            <circle cx={b.xa} cy={prongTop} r={1.5} fill="var(--line)" />
            {!b.single && <circle cx={b.xb} cy={prongTop} r={1.5} fill="var(--line)" />}
          </g>
        ))}

        {/* Constant green transition dots — anchored on the axis */}
        {transitions.map((t) => (
          <circle key={'dot' + t.time} cx={t.x} cy={axisY} r={2.2} fill="#2d5a3d" />
        ))}
      </svg>

      {/* BODY — diagonal remark/location labels, revealed on expand */}
      <div className="remarks-tl-body">
        <div className="remarks-tl-body-inner">
          <svg viewBox={`0 0 ${BODY.VW} ${BODY.VH}`} width="100%" style={{ display: 'block' }}>
            {marks.map((b, i) => {
              const locLabel = b.location ? (b.estimated ? `~ ${b.location}` : b.location) : null;
              const remarkLabel = b.action || null;
              return (
                <g key={'lb' + i} transform={`translate(${b.xmid.toFixed(1)} 6) rotate(60)`}>
                  {remarkLabel && (
                    <text x={5} y={0} fontSize="10.5" fontWeight="600" fill="#1f2937">{remarkLabel}</text>
                  )}
                  {locLabel && (
                    <text x={5} y={remarkLabel ? 12 : 0} fontSize="9.5" fontWeight="600"
                      fill={b.estimated ? 'var(--label)' : 'var(--accent)'}>{locLabel}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
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
  const [showTimeline, setShowTimeline] = useState(false);

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

      {/* Overview: duty grid */}
      <div style={{ padding: '20px 18px 4px', overflowX: 'auto' }}>
        <LogGrid day={day} transitions={transitions} />
      </div>

      {/* REMARKS strip: one timeline whose axis stays fixed — expanding grows the
          hour ruler, prongs and diagonal labels out of the same line. */}
      {transitions.length > 0 && (
        <>
          <div style={{ padding: '4px 18px 0', overflowX: 'auto' }}>
            <RemarksTimeline day={day} transitions={transitions} expanded={showTimeline} />
          </div>

          {/* Toggle drives the strip above */}
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowTimeline(o => !o)}
              className="no-print"
              aria-expanded={showTimeline}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 22px', background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', letterSpacing: '.01em',
              }}
            >
              {showTimeline ? 'Hide remarks timeline' : 'View remarks timeline'}
              <ChevronDown
                size={15} strokeWidth={2.4}
                style={{ transition: 'transform .2s ease', transform: showTimeline ? 'rotate(180deg)' : 'none' }}
              />
            </button>
          </div>
        </>
      )}

      {/* Readable remarks cards — always visible */}
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
