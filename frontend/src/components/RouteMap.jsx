import React, { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import { GoogleMap, Polyline, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { hrsMin } from '../utils/adapter';

// Project a lat/lng onto the closest point of the route polyline so a marker sits
// EXACTLY on the drawn line. A geocoded fuel/rest stop lands a few meters off the
// highway centerline, so without this the line visibly misses the dot when you
// zoom in. Snapping each stop to its nearest point on the path makes the route
// run straight through every point and continue from there — a precise track.
function snapToPath(lat, lng, path) {
  if (!path || path.length < 2) return [lat, lng];
  // Local equirectangular projection — lng is squeezed toward the pole so the
  // nearest-segment math is accurate over the short stop-to-route distances.
  const kx = Math.cos((lat * Math.PI) / 180);
  const px = lng * kx, py = lat;

  let best = [lat, lng], bestD = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i][1] * kx,     ay = path[i][0];
    const bx = path[i + 1][1] * kx, by = path[i + 1][0];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t; // clamp onto the segment
    const cx = ax + t * dx, cy = ay + t * dy;
    const d = (px - cx) ** 2 + (py - cy) ** 2;
    if (d < bestD) { bestD = d; best = [cy, cx / kx]; }
  }
  return best;
}

const LIBRARIES = ['places'];
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f0f0ef' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d4e4f0' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f4' }] },
  ],
};

const MARKER_COLORS = {
  start:   '#2d5a3d',
  pickup:  '#2563eb',
  dropoff: '#dc2626',
  fuel:    '#d97706',
  rest:    '#7c3aed',
  remark:  '#f59e0b',
};
const MARKER_LABELS = {
  start: 'Start', pickup: 'Pickup', dropoff: 'Drop-off',
  fuel: 'Fuel stop', rest: 'Rest stop', remark: 'Remark location',
};

function markerIcon(color, scale = 10) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2.5,
    scale,
  };
}

// Details shown in the popup when a pin is clicked. Handles both planned stops
// (start/pickup/dropoff/fuel/rest) and the amber remark pins.
function DetailRow({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 5, fontSize: 12, lineHeight: 1.4 }}>
      <span style={{ color: '#9ca3af', minWidth: 42, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#374151', minWidth: 0 }}>{children}</span>
    </div>
  );
}

function MarkerDetails({ m, place }) {
  const color = MARKER_COLORS[m.kind] || MARKER_COLORS.start;
  const isRemark = m.kind === 'remark';
  const kindLabel = isRemark ? 'Remark' : (MARKER_LABELS[m.kind] || 'Stop');

  const title = isRemark ? (m.text || m.label) : (m.name || m.label || kindLabel);
  // Don't repeat the place text if it's already the title.
  const showPlace = place && place.trim().toLowerCase() !== (title || '').trim().toLowerCase();
  const whenLabel = m.kind === 'start' ? 'Departs' : 'When';

  // A small Street View photo of the actual spot fills the empty band at the top
  // of the popup. If Google has no imagery there, onError hides the <img> so the
  // popup falls back cleanly to the text-only layout. Hidden until it loads so a
  // broken/grey tile never flashes.
  const [imgOk, setImgOk] = useState(false);
  const lat = m.pos?.[0], lng = m.pos?.[1];
  const streetUrl = API_KEY && lat != null && lng != null
    ? `https://maps.googleapis.com/maps/api/streetview?size=280x110&location=${lat},${lng}&fov=80&pitch=0&source=outdoor&key=${API_KEY}`
    : null;

  return (
    <div style={{ minWidth: 170, maxWidth: 250, padding: '1px 2px 3px' }}>
      {streetUrl && (
        <img
          src={streetUrl}
          alt=""
          onLoad={() => setImgOk(true)}
          onError={() => setImgOk(false)}
          style={{
            display: imgOk ? 'block' : 'none',
            width: '100%', height: 92, objectFit: 'cover',
            borderRadius: 10, marginBottom: 9,
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        />
      )}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color }}>
          {kindLabel}
        </span>
      </div>

      {title && (
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>{title}</div>
      )}

      {m.when    && <DetailRow label={whenLabel}>{m.when}</DetailRow>}
      {showPlace && <DetailRow label="Place">{place}</DetailRow>}
      {!isRemark && m.mile != null && m.mile > 0 && (
        <DetailRow label="Mile">{Number(m.mile).toLocaleString()}</DetailRow>
      )}
    </div>
  );
}

function Mini({ label, val, dot }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>{val}</span>
    </span>
  );
}

function RemarksStrip({ schedule }) {
  // Collapsed by default on phones (this list gets long); always open on wider
  // screens where the grid lays it out compactly across columns.
  const isMobile = typeof window !== 'undefined'
    && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  const [open, setOpen] = useState(!isMobile);

  if (!schedule?.length) return null;

  // Flatten every day's items into one inline flow.
  const items = schedule.flatMap(d => d.items || []);
  if (!items.length) return null;

  return (
    <div style={{ padding: '6px 22px 4px', borderTop: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="remarks-strip-toggle"
        aria-expanded={open}
        style={{
          all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', cursor: 'pointer', margin: '14px 0 11px', boxSizing: 'border-box',
        }}
      >
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: '#374151',
          letterSpacing: '.06em', textTransform: 'uppercase',
        }}>
          Remarks
          <span className="remarks-strip-count" style={{ marginLeft: 8, color: 'var(--label)', fontWeight: 600 }}>
            {items.length}
          </span>
        </span>
        <svg
          className="remarks-strip-chev"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform .2s ease', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(430px, 100%), 1fr))',
          columnGap: 36, rowGap: 12, paddingBottom: 4,
        }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 600,
                color: 'var(--accent)', whiteSpace: 'nowrap',
                minWidth: 64, textAlign: 'right', flexShrink: 0,
              }}>
                {it.time}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', minWidth: 0 }}>
                {it.text}
                {it.loc && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {it.loc}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StopSchedule({ schedule }) {
  if (!schedule?.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {schedule.map((d, i) => (
        <div key={i} style={{ borderTop: i ? '1px solid var(--border)' : 'none', padding: '18px 0 18px' }}>
          {/* Day header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'var(--accent-soft)', color: 'var(--accent)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '.04em', lineHeight: 1, opacity: .7 }}>DAY</div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>{d.day}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                {d.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                <Mini label="Drive"   val={hrsMin(d.drive)}  dot="#2563eb" />
                <Mini label="On duty" val={hrsMin(d.onduty)} dot="#d97706" />
                {d.sleeper > 0 && <Mini label="Sleeper" val={hrsMin(d.sleeper)} dot="#7c3aed" />}
                {(d.off > 0 || d.sleeper === 0) && <Mini label="Off duty" val={hrsMin(d.off)} dot="#64748b" />}
              </div>
            </div>
          </div>

          {/* Items */}
          <div style={{ paddingLeft: 52 }}>
            {d.items.map((it, j) => {
              const last = j === d.items.length - 1;
              return (
              <div key={j} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: '0 10px' }}>
                {/* Dot + continuous connector rail */}
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  {!last && <div style={{ position: 'absolute', left: '50%', top: 8, bottom: -1, width: 1.5, transform: 'translateX(-50%)', background: 'var(--border)' }} />}
                  <div style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-tint)', marginTop: 4, flexShrink: 0 }} />
                </div>
                {/* Text */}
                <div style={{ paddingBottom: last ? 0 : 16 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {it.time}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{it.text}</span>
                  </div>
                  {it.loc && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 11.5, color: 'var(--label)' }}>
                      <span style={{ width: 10, height: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                      </span>
                      {it.loc}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MapInner({ route, stops, remarkMarkers = [] }) {
  const mapRef = useRef(null);
  const [active, setActive] = useState(null);   // pin whose details popup is open
  const [activePlace, setActivePlace] = useState('');  // human-readable place for the popup
  const { path = [], markers = [] } = route || {};

  // Resolve a readable place for the open pin. Use the address/place it already
  // carries; if it only has coordinates, reverse-geocode them to a street
  // address so the popup always shows a location, never raw lat/lng numbers.
  useEffect(() => {
    if (!active) { setActivePlace(''); return; }
    const existing = active.kind === 'remark' ? active.place : active.address;
    if (existing) { setActivePlace(existing); return; }
    setActivePlace('');
    if (!window.google?.maps) return;
    let cancelled = false;
    new window.google.maps.Geocoder().geocode(
      { location: { lat: active.pos[0], lng: active.pos[1] } },
      (res, status) => {
        if (!cancelled && status === 'OK' && res[0]) setActivePlace(res[0].formatted_address);
      }
    );
    return () => { cancelled = true; };
  }, [active]);

  const fallbackPath = useMemo(
    () => stops
      .filter(s => s.lat != null && s.lng != null)
      .map(s => ({ lat: s.lat, lng: s.lng })),
    [stops]
  );

  const positions = useMemo(
    () => (path.length > 1 ? path.map(([lat, lng]) => ({ lat, lng })) : fallbackPath),
    [path, fallbackPath]
  );

  // Keep a STABLE center reference. <GoogleMap center> is a controlled prop, so
  // if this object is recreated on every render, react-google-maps re-applies it
  // and snaps the map back to the start dot — undoing the panTo from a pin click
  // (which is what caused "first click jumps to the green dot, only the second
  // click centers"). Memoizing it means re-renders no longer move the map.
  const center = useMemo(
    () => positions[0] || { lat: 39.5, lng: -98.35 },
    [positions]
  );

  // Snap only the route-DEFINING points (start/pickup/dropoff) onto the line so
  // it runs cleanly through them. Fuel and rest stops are real roadside
  // facilities (a gas station / truck stop / rest area the backend looked up) —
  // they genuinely sit a bit off the centerline, so snapping them would drop the
  // pin in the middle of the highway instead of on a spot where a driver can
  // actually fuel or sleep. Same for remark pins, which mark those facilities.
  const SNAP_KINDS = new Set(['start', 'pickup', 'dropoff']);
  const snappedMarkers = useMemo(
    () => markers.map(m =>
      SNAP_KINDS.has(m.kind) ? { ...m, pos: snapToPath(m.pos[0], m.pos[1], path) } : m
    ),
    [markers, path]
  );
  const snappedRemarks = remarkMarkers;

  const fitWholeRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || positions.length < 2) return;
    const bounds = new window.google.maps.LatLngBounds();
    positions.forEach(p => bounds.extend(p));
    map.fitBounds(bounds, { padding: 50 });
  }, [positions]);

  const onLoad = useCallback((map) => {
    mapRef.current = map;
    fitWholeRoute();
  }, [fitWholeRoute]);

  // Re-frame the whole route line whenever the route changes (e.g. right after
  // generating a plan), so the dashboard always opens on the full route — not a
  // leftover zoom from a previous trip or a pin the user had clicked.
  useEffect(() => {
    fitWholeRoute();
    setActive(null);
  }, [path]);

  // Open a pin's popup and center the POPUP (not the pin) in the viewport. The
  // InfoWindow opens UPWARD from the pin, so to put the bubble in the middle we
  // pan to a point BELOW the pin by ~half the popup's height. We do that in pixel
  // space (project the pin → shift down → unproject) so it's exact at any zoom.
  // InfoWindow auto-pan stays disabled (below) so it can't fight this.
  const POPUP_HALF_PX = 150; // ≈ half the popup's on-screen height incl. image
  const openMarker = useCallback((m) => {
    setActive(m);
    const map = mapRef.current;
    if (!map) return;
    const latLng = new window.google.maps.LatLng(m.pos[0], m.pos[1]);
    const proj = map.getProjection();
    if (!proj) { map.panTo(latLng); return; }
    const scale = 2 ** map.getZoom();
    const pt = proj.fromLatLngToPoint(latLng);
    // Pan the map CENTER to a point north of the pin. +y in world-point space is
    // south, so subtracting moves the center north → the pin ends up BELOW center
    // on screen, leaving the upward-opening popup centered in the viewport.
    const shifted = new window.google.maps.Point(pt.x, pt.y - POPUP_HALF_PX / scale);
    map.panTo(proj.fromPointToLatLng(shifted));
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <GoogleMap
        mapContainerStyle={{ height: 380, width: '100%', borderRadius: 'calc(var(--radius) - 4px)' }}
        center={center}
        zoom={5}
        options={MAP_OPTIONS}
        onLoad={onLoad}
        onClick={() => setActive(null)}
      >
        {positions.length > 1 && (
          <>
            <Polyline path={positions} options={{ strokeColor: '#ffffff', strokeWeight: 11, strokeOpacity: 0.6 }} />
            <Polyline path={positions} options={{ strokeColor: '#2d5a3d', strokeWeight: 5, strokeOpacity: 0.95 }} />
          </>
        )}
        {snappedMarkers.map((m, i) => (
          <Marker
            key={i}
            position={{ lat: m.pos[0], lng: m.pos[1] }}
            icon={markerIcon(MARKER_COLORS[m.kind] || MARKER_COLORS.start)}
            title={`${MARKER_LABELS[m.kind] || m.kind}: ${m.label}`}
            onClick={() => openMarker(m)}
          />
        ))}
        {snappedRemarks.map((m, i) => (
          <Marker
            key={'rm' + i}
            position={{ lat: m.pos[0], lng: m.pos[1] }}
            icon={markerIcon(MARKER_COLORS.remark, 8)}
            title={m.label}
            zIndex={5}
            onClick={() => openMarker(m)}
          />
        ))}
        {active && (
          <InfoWindow
            position={{ lat: active.pos[0], lng: active.pos[1] }}
            onCloseClick={() => setActive(null)}
            options={{ pixelOffset: new window.google.maps.Size(0, -8), disableAutoPan: true }}
          >
            <MarkerDetails m={active} place={activePlace} />
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Legend — 2-col card on desktop; one compressed scrollable row pinned to
          the bottom of the map on phones (see .map-legend in index.css). */}
      <div className="map-legend" style={{ position: 'absolute', left: 14, bottom: 14, zIndex: 5, background: 'rgba(255,255,255,.95)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', boxShadow: 'var(--shadow-md)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 16px' }}>
        {Object.entries(MARKER_LABELS).map(([k, label]) => (
          <div key={k} className="map-legend-item" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--text)', fontWeight: 500 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: MARKER_COLORS[k], flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RouteMap({ route, stops = [], schedule, remarkMarkers = [] }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  });

  return (
    <div style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(20,22,26,0.06)' }}>
      <div style={{ padding: 6 }}>
        {!isLoaded && !loadError && (
          <div style={{ height: 380, display: 'grid', placeItems: 'center', background: '#f9fafb', borderRadius: 'calc(var(--radius) - 4px)' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Loading map…</span>
          </div>
        )}
        {loadError && (
          <div style={{ height: 380, display: 'grid', placeItems: 'center', background: '#fef2f2', borderRadius: 'calc(var(--radius) - 4px)' }}>
            <span style={{ fontSize: 13, color: '#dc2626' }}>Map failed to load — check your Google Maps API key.</span>
          </div>
        )}
        {isLoaded && <MapInner route={route} stops={stops} remarkMarkers={remarkMarkers} />}
      </div>

      <RemarksStrip schedule={schedule} />

      {schedule?.length > 0 && (
        <div style={{ padding: '6px 22px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#374151', letterSpacing: '.06em', textTransform: 'uppercase', margin: '14px 0 0' }}>
            Daily Schedule
          </div>
          <StopSchedule schedule={schedule} />
        </div>
      )}
    </div>
  );
}
