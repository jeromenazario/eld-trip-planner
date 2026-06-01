import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TripForm from './components/TripForm';
import TripResult from './pages/NewTrip';
import RouteSelect from './pages/RouteSelect';
import ELDLogSheet from './components/ELDLogSheet';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import { DashedLine, Btn, DottedBtn } from './components/ui';
import { Plus, Printer, Download, Menu, AlertTriangle } from 'lucide-react';
import { planTrip } from './api/tripApi';
import { adaptBackendResponse } from './utils/adapter';
import useIsMobile from './hooks/useIsMobile';

// ---- Topographic contour background -----------------------------------------
// A subtle "elevation map" watermark: clusters of nested, organically-warped
// rings (like topographic contour lines), some solid and some dashed.

// Small deterministic PRNG so the pattern is identical on every render.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth closed SVG path through a loop of points (Catmull-Rom → cubic Bézier).
function smoothClosedPath(pts) {
  const n = pts.length;
  const f = (v) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i];
    const p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

// One contour ring: a circle of given radius warped by a few sine harmonics so
// every ring of a cluster shares the same organic silhouette.
function contourRing(cx, cy, radius, harmonics) {
  const N = 60, pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    let r = radius;
    for (const h of harmonics) r += h.amp * radius * Math.sin(h.k * a + h.phase);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82]); // gentle vertical squash
  }
  return smoothClosedPath(pts);
}

// "Peaks" scattered across the 1440×810 canvas; their outer rings overlap to
// give the interwoven, flowing look of a real topographic map.
const CONTOUR_PEAKS = [
  { cx: 230,  cy: 170, base: 26, step: 30, rings: 7 },
  { cx: 1170, cy: 230, base: 30, step: 34, rings: 8 },
  { cx: 690,  cy: 540, base: 24, step: 29, rings: 9 },
  { cx: 1300, cy: 640, base: 20, step: 27, rings: 6 },
  { cx: 110,  cy: 640, base: 22, step: 31, rings: 6 },
  { cx: 840,  cy: 80,  base: 18, step: 25, rings: 5 },
  { cx: 480,  cy: 330, base: 16, step: 23, rings: 5 },
];

const CONTOURS = CONTOUR_PEAKS.flatMap((p, pi) => {
  const rnd = mulberry32(pi * 1337 + 7);
  const harmonics = [2, 3, 5].map((k) => ({ k, amp: 0.05 + rnd() * 0.10, phase: rnd() * Math.PI * 2 }));
  return Array.from({ length: p.rings }, (_, r) => ({
    d: contourRing(p.cx, p.cy, p.base + r * p.step, harmonics),
    dashed: r % 3 === 1, // every third ring is dashed, like the reference
  }));
});

const TITLES = {
  dashboard:   { t: 'Trip Plan',     s: null },
  routeselect: { t: 'Select Route',  s: 'Choose the best route for your trip' },
  newtrip:     { t: 'New Trip',      s: 'Generate a compliant Hours-of-Service plan' },
  history:     { t: 'Trip History',  s: 'Past trips and generated log books' },
  logs:        { t: 'Log Sheets',    s: 'Daily FMCSA record of duty status' },
  settings:    { t: 'Settings',      s: 'Carrier, HOS ruleset and vehicle configuration' },
  profile:     { t: 'My Profile',    s: 'Driver credentials and personal information' },
};

function TopBar({ title, subtitle, action, isMobile, onMenu }) {
  const pad = isMobile ? '0 14px' : '0 32px';
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 4 }}>
      <div style={{ height: isMobile ? 60 : 74, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: pad, background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {isMobile && (
            <button
              onClick={onMenu}
              aria-label="Open menu"
              style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', display: 'grid', placeItems: 'center', color: 'var(--text)', cursor: 'pointer' }}
            >
              <Menu size={20} strokeWidth={1.9} />
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 25, fontWeight: 500, letterSpacing: '-.025em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
            {subtitle && !isMobile && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{subtitle}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexShrink: 0 }}>
          {action}
        </div>
      </div>
      <div style={{ padding: pad, background: 'var(--bg)' }}>
        <DashedLine color="var(--border-strong)" dash={6} gap={6} />
      </div>
    </header>
  );
}

// The backend only needs the route geometry to place stops and find nearby gas
// stations — Google's full step-by-step resolution (tens of thousands of points
// on a long trip) is overkill and can blow past request-size limits. Downsample
// to a cap that keeps interpolation accurate (a point every mile or two) while
// keeping the payload small. The full-resolution path is still used locally to
// draw the line on the map.
function downsampleRoute(path, max = 2000) {
  if (!Array.isArray(path) || path.length <= max) return path || [];
  const step = Math.ceil(path.length / max);
  const out = [];
  for (let i = 0; i < path.length; i += step) out.push(path[i]);
  const last = path[path.length - 1];
  if (out.length === 0 || out[out.length - 1] !== last) out.push(last);
  return out;
}

export default function App() {
  const [activePage, setActivePage] = useState('newtrip'); // start on form
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trip, setTrip] = useState(null);
  const [lastPayload, setLastPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // When the user opens the New Trip form while a plan already exists, we frost
  // the form and require an explicit "remove current & start new" confirm before
  // they can fill it out — so a fresh plan can't quietly clobber the old one.
  const [confirmNew, setConfirmNew] = useState(false);
  const isMobile = useIsMobile();

  // Open the New Trip form. If a plan already exists, gate it behind the frosted
  // "remove current & start new" confirmation instead of going straight in.
  const openNewTrip = () => {
    setConfirmNew(!!trip);
    setActivePage('newtrip');
    setDrawerOpen(false);
  };

  // All navigation funnels through here so the "New Trip" entry — from the
  // sidebar, drawer or any button — always hits the replace-confirm gate.
  const navigate = (key) => {
    if (key === 'newtrip') return openNewTrip();
    setActivePage(key);
    setDrawerOpen(false);
  };

  // Confirmed: wipe the existing plan and all derived state, then reveal the form.
  const clearAndStartNew = () => {
    setTrip(null);
    setLastPayload(null);
    setError(null);
    setConfirmNew(false);
  };

  const driverName = trip?.input?.driver || 'John Doe';

  // Warn before a browser reload or tab close while a plan is in memory. The
  // trip lives only in component state (no DB), so leaving would discard it —
  // this mirrors the in-app "replace current trip?" guard at the browser level.
  useEffect(() => {
    if (!trip) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';   // Chrome requires returnValue to be set to prompt
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [trip]);

  // Turn an API/network failure into a single readable sentence. The backend
  // sends HOS problems as { "error": "…" } and validation as { field: ["…"] };
  // we pull those out so the user sees plain text, never a raw JSON blob.
  const formatError = (err) => {
    if (err?.response?.status === 429)
      return 'Too many requests — please wait a moment and try again.';
    const data = err?.response?.data;
    if (data) {
      if (typeof data === 'string') return data;
      if (data.error)  return data.error;
      if (data.detail) return data.detail;
      // Field validation errors: "Field name: first message".
      const firstKey = Object.keys(data)[0];
      if (firstKey) {
        const val = data[firstKey];
        const msg = Array.isArray(val) ? val[0] : val;
        return `${firstKey.replace(/_/g, ' ')}: ${msg}`;
      }
    }
    return err?.message || 'Something went wrong while planning the trip. Please try again.';
  };

  const handleGenerate = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await planTrip(payload);
      const designData = adaptBackendResponse(data, payload);
      setTrip(designData);
      setLastPayload(payload);     // keep it so a route choice can re-plan
      setActivePage('routeselect');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  // The driver picked a specific route on the map. Re-plan the HOS schedule for
  // that route's real distance, then overlay its exact geometry on the dashboard
  // map so what's generated matches what was selected.
  const handleRouteConfirm = async (selectedRoute) => {
    setActivePage('dashboard');
    if (!lastPayload || !selectedRoute) return;
    setLoading(true);
    setError(null);
    try {
      // Send the chosen route's exact geometry so the backend places fuel/rest
      // stops and looks up gas stations along the SAME path that gets drawn —
      // otherwise the markers sit on the backend's own (waypointed) route and
      // drift off the line the driver actually selected.
      const payload = {
        ...lastPayload,
        estimated_miles: selectedRoute.miles,
        drive_hours: selectedRoute.driveHours || 0,
        route_geometry: downsampleRoute(selectedRoute.path),
      };
      const { data } = await planTrip(payload);
      const designData = adaptBackendResponse(data, payload);
      // Keep the drawn line exactly as selected (backend echoes the same path).
      if (selectedRoute.path?.length) designData.route.path = selectedRoute.path;
      setTrip(designData);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const meta = TITLES[activePage] || TITLES.dashboard;
  // Include the pickup in the route title so a load that's far from the start
  // (e.g. a pickup in another state) reads as the real detour it is, instead of
  // looking like a short current → dropoff hop.
  const title = (activePage === 'dashboard' || activePage === 'routeselect') && trip
    ? [trip.input.curLoc, trip.input.pickLoc, trip.input.dropLoc].filter(Boolean).join(' → ')
    : meta.t;

  const showGenBtn = activePage === 'dashboard' || activePage === 'routeselect' || activePage === 'history' || activePage === 'logs';
  const action = showGenBtn
    ? <Btn icon={<Plus />} onClick={openNewTrip}>Generate Plan</Btn>
    : null;

  let body;
  if (activePage === 'newtrip') {
    body = (
      <div style={{ maxWidth: 1080, margin: '0 auto', width: '100%', position: 'relative' }}>
        {error && (
          <div style={{ marginBottom: 20, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '14px 20px', fontSize: 13, color: '#dc2626' }}>
            {error}
          </div>
        )}
        {/* Frost + block the form until the user confirms replacing the plan. */}
        <div style={{ filter: confirmNew ? 'blur(3px)' : 'none', pointerEvents: confirmNew ? 'none' : 'auto', userSelect: confirmNew ? 'none' : 'auto', transition: 'filter .25s ease' }}>
          <TripForm onSubmit={handleGenerate} loading={loading} />
        </div>

        {confirmNew && (
          <div className="confirm-new-overlay" onClick={() => navigate('dashboard')}>
            <div className="confirm-new-card" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-new-icon">
                <AlertTriangle size={24} strokeWidth={2} />
              </div>
              <h3 className="confirm-new-title">Replace current trip?</h3>
              <p className="confirm-new-text">
                You already have a generated plan and ELD log sheets. Starting a new
                trip will permanently remove the current one.
              </p>
              <div className="confirm-new-actions">
                <Btn variant="ghost" onClick={() => navigate('dashboard')}>Keep current</Btn>
                <Btn onClick={clearAndStartNew}>Remove current &amp; start new</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  } else if (activePage === 'routeselect') {
    body = trip
      ? <RouteSelect trip={trip} onConfirm={handleRouteConfirm} />
      : null;
  } else if (activePage === 'dashboard') {
    body = trip
      ? <TripResult trip={trip} loading={loading} error={error} />
      : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0f0f0', display: 'grid', placeItems: 'center' }}>
            <Plus size={24} color="#1a1a1a" strokeWidth={1.5} />
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>No trip planned yet</p>
          <DottedBtn onClick={openNewTrip}>Generate Trip Plan</DottedBtn>
        </div>
      );
  } else if (activePage === 'logs') {
    body = trip ? (
      <div id="eld-log-section">
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
          <Btn variant="ghost" size="sm" icon={<Printer />} onClick={() => window.print()}>Print</Btn>
          <Btn variant="ghost" size="sm" icon={<Download />} onClick={() => window.print()}>Export PDF</Btn>
        </div>
        <ELDLogSheet logs={trip.days} />
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>No trip planned yet</p>
        <DottedBtn onClick={openNewTrip}>Generate Trip Plan</DottedBtn>
      </div>
    );
  } else if (activePage === 'history') {
    const cols = '1fr 160px 100px 80px 140px';
    const hosBadge = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 20 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />HOS compliant
      </span>
    );
    body = trip ? (
      isMobile ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
            {trip.input.curLoc}<span style={{ color: 'var(--label)' }}>→</span>{trip.input.dropLoc}
          </div>
          {[['Driver', trip.input.driver || '—'], ['Miles', Number(trip.input.miles).toLocaleString()], ['Days', trip.days.length]].map(([k, val]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13.5 }}>
              <span style={{ color: 'var(--label)' }}>{k}</span>
              <span style={{ fontWeight: 500 }}>{val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 2px', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--label)', fontSize: 13.5 }}>Status</span>{hosBadge}
          </div>
        </div>
      ) : (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 16, padding: '13px 24px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--label)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          <div>Route</div><div>Driver</div><div>Miles</div><div>Days</div><div>Status</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 16, padding: '16px 24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
            {trip.input.curLoc}
            <span style={{ color: 'var(--label)', fontSize: 13 }}>→</span>
            {trip.input.dropLoc}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{trip.input.driver || '—'}</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{Number(trip.input.miles).toLocaleString()}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{trip.days.length}</div>
          <div>{hosBadge}</div>
        </div>
      </div>
      )
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>No trips yet</p>
        <DottedBtn onClick={openNewTrip}>Generate Trip Plan</DottedBtn>
      </div>
    );
  } else if (activePage === 'settings') {
    body = <Settings />;
  } else if (activePage === 'profile') {
    body = <Profile />;
  } else {
    body = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0f0f0', display: 'grid', placeItems: 'center' }}>
          <Plus size={24} color="#1a1a1a" strokeWidth={1.5} />
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>No trip planned yet</p>
        <DottedBtn onClick={openNewTrip}>Generate Trip Plan</DottedBtn>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: isMobile ? 'auto' : '100vh',
      minHeight: isMobile ? '100vh' : undefined,
      overflow: isMobile ? 'visible' : 'hidden',
      background: 'var(--bg)', position: 'relative',
    }}>

      {/* Topographic contour background */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 810"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.13 }}
      >
        <g fill="none" stroke="#2d5a3d" strokeWidth="1.5" strokeLinejoin="round">
          {CONTOURS.map((c, i) => (
            <path key={i} d={c.d} strokeDasharray={c.dashed ? '7 7' : undefined} />
          ))}
        </g>
      </svg>

      {isMobile ? (
        <>
          {/* Dimmed backdrop behind the drawer */}
          <div
            onClick={() => setDrawerOpen(false)}
            aria-hidden={!drawerOpen}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(20,22,26,.42)',
              opacity: drawerOpen ? 1 : 0,
              pointerEvents: drawerOpen ? 'auto' : 'none',
              transition: 'opacity .25s ease',
            }}
          />
          {/* Off-canvas drawer */}
          <div style={{
            position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 50,
            transform: drawerOpen ? 'translateX(0)' : 'translateX(-112%)',
            transition: 'transform .26s cubic-bezier(.4,0,.2,1)',
          }}>
            <Sidebar
              activePage={activePage} onNavigate={navigate}
              driver={driverName} collapsed={false} setCollapsed={setCollapsed}
              mobile onClose={() => setDrawerOpen(false)}
            />
          </div>
        </>
      ) : (
        <Sidebar
          activePage={activePage} onNavigate={navigate}
          driver={driverName} collapsed={collapsed} setCollapsed={setCollapsed}
        />
      )}

      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        overflow: isMobile ? 'visible' : 'hidden',
        height: isMobile ? 'auto' : '100vh',
        position: 'relative', zIndex: 1,
      }}>
        <TopBar title={title} subtitle={meta.s} action={action} isMobile={isMobile} onMenu={() => setDrawerOpen(true)} />
        <div style={{ flex: 1, overflow: isMobile ? 'visible' : 'auto', padding: isMobile ? '18px 14px 48px' : '26px 32px 60px' }}>
          {body}
        </div>
      </main>
    </div>
  );
}
