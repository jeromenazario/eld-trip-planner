import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleMap, Polyline, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Clock, Calendar, AlertTriangle, Fuel, BedDouble, Check, ArrowRight, Navigation } from 'lucide-react';
import { Card } from '../components/ui';

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

function markerIcon(color) {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2.5,
    scale: 10,
  };
}

const ROUTE_META = [
  { id: 'fastest', n: 1, badge: 'Fastest',   color: '#2d5a3d', tolls: 'Yes' },
  { id: 'notolls', n: 2, badge: 'No Tolls',  color: '#3b82f6', tolls: 'No'  },
  { id: 'alt',     n: 3, badge: 'Alternate', color: '#f59e0b', tolls: 'No'  },
];

function fmtDur(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function gmRouteToData(gmRoute, meta) {
  const totalMeters = gmRoute.legs.reduce((s, l) => s + l.distance.value, 0);
  const totalSecs   = gmRoute.legs.reduce((s, l) => s + l.duration.value, 0);
  const distMi = Math.round(totalMeters * 0.000621371);
  // Build FULL-resolution geometry from each step's detailed path.
  // overview_path is simplified by Google — it cuts corners, misses roads,
  // and on long legs draws straight "skips" across the map. step.path keeps
  // the line glued to the actual roads.
  const path = [];
  for (const leg of gmRoute.legs) {
    for (const step of leg.steps || []) {
      for (const pt of step.path || []) {
        const last = path[path.length - 1];
        const lat = pt.lat(), lng = pt.lng();
        if (!last || last[0] !== lat || last[1] !== lng) path.push([lat, lng]);
      }
    }
  }
  if (!path.length) gmRoute.overview_path.forEach(p => path.push([p.lat(), p.lng()]));
  return {
    ...meta,
    path,
    miles: distMi,                       // numeric distance — used to re-plan the HOS schedule
    dist:  `${distMi.toLocaleString()} mi`,
    drive: fmtDur(totalSecs),
    days:  `${Math.ceil(totalSecs / (11 * 3600))} days`,
  };
}

// Stable reference — prevents @react-google-maps from calling setCenter() on every render
const DEFAULT_CENTER = { lat: 39.5, lng: -95 };

function RouteSelectMap({ routes, markers, hovered, selected, onHover, onSelect }) {
  const mapRef = useRef(null);

  const toGmPath = (path) => path.map(([lat, lng]) => ({ lat, lng }));

  const onLoad = useCallback((map) => {
    mapRef.current = map;
    // rAF ensures fitBounds runs after React's initial paint so center prop can't fight it
    requestAnimationFrame(() => {
      const allPoints = routes.flatMap(r => r.path);
      if (allPoints.length > 1) {
        const bounds = new window.google.maps.LatLngBounds();
        allPoints.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
        map.fitBounds(bounds, 80);
      }
    });
  }, []); // routes is stable at mount (derived from unchanging trip prop)

  const getWeight = (id) => {
    if (selected) return id === selected ? 7 : 4;
    if (hovered) return id === hovered ? 8 : 4;
    return 5;
  };
  const getOpacity = (id) => {
    if (selected) return id === selected ? 1 : 0.18;
    if (hovered) return id === hovered ? 1 : 0.45;
    return 0.9;
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <GoogleMap
        mapContainerStyle={{ height: '100%', width: '100%', borderRadius: 'calc(var(--radius) - 4px)' }}
        center={DEFAULT_CENTER}
        zoom={5}
        options={MAP_OPTIONS}
        onLoad={onLoad}
      >
        {routes.map((r) => (
          <React.Fragment key={r.id}>
            <Polyline
              path={toGmPath(r.path)}
              options={{ strokeColor: '#fff', strokeWeight: getWeight(r.id) + 6, strokeOpacity: getOpacity(r.id) * 0.55 }}
              onClick={() => onSelect(r.id)}
              onMouseOver={() => onHover(r.id)}
              onMouseOut={() => onHover(null)}
            />
            <Polyline
              path={toGmPath(r.path)}
              options={{ strokeColor: r.color, strokeWeight: getWeight(r.id), strokeOpacity: getOpacity(r.id) }}
              onClick={() => onSelect(r.id)}
              onMouseOver={() => onHover(r.id)}
              onMouseOut={() => onHover(null)}
            />
          </React.Fragment>
        ))}
        {markers.map((m, i) => (
          <Marker
            key={i}
            position={{ lat: m.pos[0], lng: m.pos[1] }}
            icon={markerIcon(m.color)}
            title={m.label}
            opacity={selected ? 1.0 : 0.35}
          />
        ))}
      </GoogleMap>

      {/* Route legend */}
      <div style={{
        position: 'absolute', left: 14, bottom: 14, zIndex: 500,
        background: 'rgba(255,255,255,.97)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '12px 14px', boxShadow: 'var(--shadow-md)',
        display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--label)', letterSpacing: '.07em', textTransform: 'uppercase' }}>Routes</div>
        {routes.map((r) => {
          const dim = selected && selected !== r.id;
          return (
            <div key={r.id} onClick={() => onSelect(r.id)}
              onMouseEnter={() => onHover(r.id)} onMouseLeave={() => onHover(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', opacity: dim ? 0.4 : 1, transition: 'opacity .2s' }}>
              <span style={{ width: 20, height: 0, borderTop: `3px solid ${r.color}`, borderRadius: 3, flexShrink: 0 }} />
              <span style={{ color: 'var(--text)' }}>{r.badge}</span>
            </div>
          );
        })}
        <div style={{ height: 1, background: 'var(--border)', margin: '1px 0' }} />
        {markers.map((m) => (
          <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'var(--muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
            <span>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricPill({ icon: Icon, label, value, accent }) {
  return (
    <div style={{ background: '#f4f4f3', border: '1px solid #ececeb', borderRadius: 10, padding: '9px 10px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--label)', marginBottom: 5 }}>
        <Icon size={13} strokeWidth={1.8} />
        <span style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '.01em', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', whiteSpace: 'nowrap',
        color: accent || 'var(--text)', lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function SelectBtn({ selected, color }) {
  const [h, setH] = useState(false);
  if (selected) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: color, color: '#fff',
        fontSize: 13, fontWeight: 600, padding: '9px 15px', borderRadius: 10, lineHeight: 1,
        whiteSpace: 'nowrap', boxShadow: `0 4px 12px ${color}40` }}>
        <Check size={15} strokeWidth={2.4} /> Selected
      </span>
    );
  }
  return (
    <button
      tabIndex={-1}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
        background: h ? color : 'transparent', color: h ? '#fff' : color,
        border: `1.5px solid ${color}`, fontSize: 13, fontWeight: 600,
        padding: '8px 15px', borderRadius: 10, lineHeight: 1,
        whiteSpace: 'nowrap', transition: 'all .18s ease', pointerEvents: 'none', cursor: 'pointer' }}>
      Select Route
    </button>
  );
}

function RouteCard({ r, selected, hovered, onHover, onSelect }) {
  const [h, setH] = useState(false);
  const [planReady, setPlanReady] = useState(false);

  useEffect(() => {
    if (!selected) { setPlanReady(false); return; }
    const t = setTimeout(() => setPlanReady(true), 1300);
    return () => clearTimeout(t);
  }, [selected]);

  const active = hovered || h;

  return (
    <div onMouseEnter={() => { setH(true); onHover(r.id); }} onMouseLeave={() => { setH(false); onHover(null); }}>
      <div onClick={() => onSelect(r.id)} style={{
        background: selected ? '#f0fdf4' : 'var(--card)',
        border: selected ? `2px solid ${r.color}` : `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 14, padding: selected ? '19px' : '20px',
        boxShadow: selected ? `0 8px 22px ${r.color}26` : (active ? '0 6px 18px rgba(20,22,26,.08)' : 'var(--shadow)'),
        cursor: 'pointer', transition: 'all .2s ease',
        transform: active && !selected ? 'translateY(-1px)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
            background: r.color + '18', color: r.color,
            fontSize: 12.5, fontWeight: 700, padding: '5px 11px', borderRadius: 20, lineHeight: 1 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color }} />
            {r.badge}
          </span>
          <span style={{ fontSize: 12, color: 'var(--label)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Route {r.n}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <MetricPill icon={Navigation} label="Distance" value={r.dist} />
          <MetricPill icon={Clock}      label="Drive"    value={r.drive} />
          <MetricPill icon={Calendar}   label="HOS Days" value={r.days} />
          <MetricPill icon={AlertTriangle} label="Tolls" value={r.tolls}
            accent={r.tolls === 'Yes' ? 'var(--amber)' : 'var(--accent)'} />
        </div>

        <div style={{ height: 1, background: selected ? r.color + '2e' : 'var(--border)', margin: '15px 0 13px' }} />

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Fuel size={13} style={{ color: 'var(--label)', flexShrink: 0 }} />
              Fuel stops: <b style={{ color: 'var(--text)', fontWeight: 600 }}>{r.fuel}</b>
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <BedDouble size={13} style={{ color: 'var(--label)', flexShrink: 0 }} />
              Rest stops: <b style={{ color: 'var(--text)', fontWeight: 600 }}>{r.rest}</b>
            </span>
          </div>
          <SelectBtn selected={selected} color={r.color} />
        </div>
      </div>

      {selected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 4px 2px', fontSize: 12.5 }}>
          {!planReady ? (
            <>
              <span style={{ width: 13, height: 13, borderRadius: '50%',
                border: `2px solid ${r.color}40`, borderTopColor: r.color,
                display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ color: 'var(--muted)' }}>Generating your HOS plan…</span>
            </>
          ) : (
            <>
              <span style={{ width: 15, height: 15, borderRadius: '50%', background: r.color, color: '#fff',
                display: 'grid', placeItems: 'center' }}>
                <Check size={10} strokeWidth={2.6} />
              </span>
              <span style={{ color: r.color, fontWeight: 600 }}>HOS plan ready — review &amp; confirm below</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RouteSelectInner({ trip, onConfirm }) {
  const [hovered, setHovered]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [gmRoutes, setGmRoutes] = useState(null);
  const [fetching, setFetching] = useState(true);

  // Fetch real alternative routes from Google Directions API
  useEffect(() => {
    if (!window.google?.maps) return;
    const svc = new window.google.maps.DirectionsService();
    // Every route MUST pass through the pickup — route the driver via
    // current → pickup → dropoff. (Forcing a waypoint means Google usually
    // returns a single route rather than alternatives; correctness wins here:
    // a route that skips the pickup is wrong no matter how many we show.)
    svc.route({
      origin:                  trip.input.curLoc,
      destination:             trip.input.dropLoc,
      waypoints:               trip.input.pickLoc
        ? [{ location: trip.input.pickLoc, stopover: true }]
        : [],
      travelMode:              window.google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true,
    }, (result, status) => {
      setFetching(false);
      if (status === 'OK') setGmRoutes(result.routes.slice(0, 3));
    });
  }, []);

  const fuelStops = trip.stats?.fuelStops ?? 0;
  const restStops = Math.max(0, (trip.stats?.days ?? 1) - 1);

  const routes = useMemo(() => {
    if (gmRoutes?.length) {
      return gmRoutes.map((r, i) => ({
        ...gmRouteToData(r, ROUTE_META[i] || ROUTE_META[2]),
        fuel: fuelStops,
        rest: restStops,
      }));
    }
    return null;
  }, [gmRoutes, fuelStops, restStops]);

  const mapMarkers = useMemo(() => {
    const startStop  = trip.stops?.find(s => s.type === 'start');
    const pickStop   = trip.stops?.find(s => s.type === 'pickup');
    const dropStop   = trip.stops?.find(s => s.type === 'dropoff');
    return [
      startStop?.lat != null && { label: trip.input.curLoc,  color: '#2d5a3d', pos: [startStop.lat,  startStop.lng]  },
      pickStop?.lat  != null && { label: trip.input.pickLoc, color: '#2563eb', pos: [pickStop.lat,   pickStop.lng]   },
      dropStop?.lat  != null && { label: trip.input.dropLoc, color: '#dc2626', pos: [dropStop.lat,   dropStop.lng]   },
    ].filter(Boolean);
  }, [trip]);

  const handleGenerate = () => {
    if (!selected) return;
    // Hand the FULL chosen route up (geometry + distance), not just its id,
    // so the generated plan reflects the route the driver actually picked.
    const route = routes?.find(r => r.id === selected);
    if (route) onConfirm(route);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr minmax(360px, 1fr)', gap: 20,
      alignItems: 'start', height: 'calc(100vh - 160px)', minHeight: 560 }}>

      {/* Map */}
      <Card pad={false} style={{ overflow: 'hidden', height: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 6, borderRadius: 'calc(var(--radius) - 4px)', overflow: 'hidden' }}>
          {routes ? (
            <RouteSelectMap
              routes={routes} markers={mapMarkers}
              hovered={hovered} selected={selected}
              onHover={setHovered} onSelect={setSelected}
            />
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', background: '#f9fafb' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {fetching ? 'Finding routes…' : 'Could not load routes'}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Cards + CTA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto', paddingRight: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 1 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-.01em' }}>
            {routes ? `${routes.length} routes found` : 'Finding routes…'}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {[trip.input.curLoc, trip.input.pickLoc, trip.input.dropLoc].filter(Boolean).join(' → ')}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {routes ? routes.map((r) => (
            <RouteCard key={r.id} r={r}
              selected={selected === r.id} hovered={hovered === r.id}
              onHover={setHovered} onSelect={setSelected} />
          )) : [1, 2, 3].map(i => (
            <div key={i} style={{ height: 160, borderRadius: 14, background: '#f3f3f2', border: '1px solid var(--border)' }} />
          ))}

          {routes?.length === 1 && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--label)', textAlign: 'center', lineHeight: 1.5 }}>
              This is the recommended route through your pickup — no meaningful alternatives were found for this corridor.
            </p>
          )}
        </div>

        <button onClick={handleGenerate} disabled={!selected || !routes}
          style={{ marginTop: 4, width: '100%', height: 50, borderRadius: 12, border: 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            fontSize: 14.5, fontWeight: 600, letterSpacing: '-.01em',
            background: selected ? 'var(--accent)' : '#ededec',
            color: selected ? '#fff' : '#9b9b99',
            boxShadow: selected ? '0 8px 20px rgba(45,90,61,.32)' : 'none',
            cursor: selected ? 'pointer' : 'not-allowed',
            transition: 'all .2s ease' }}>
          Generate Trip Plan <ArrowRight size={18} />
        </button>

        {!selected && (
          <div style={{ fontSize: 11.5, color: 'var(--label)', textAlign: 'center', marginTop: -4 }}>
            Select a route to continue
          </div>
        )}
      </div>
    </div>
  );
}

export default function RouteSelect({ trip, onConfirm }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  });

  if (loadError) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 400 }}>
        <span style={{ fontSize: 13, color: '#dc2626' }}>Map failed to load — check your Google Maps API key.</span>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 400 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Loading map…</span>
      </div>
    );
  }

  return <RouteSelectInner trip={trip} onConfirm={onConfirm} />;
}
