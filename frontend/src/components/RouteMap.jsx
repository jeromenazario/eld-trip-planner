import React, { useCallback, useRef } from 'react';
import { GoogleMap, Polyline, Marker, useJsApiLoader } from '@react-google-maps/api';
import { hrsMin } from '../utils/adapter';

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

function Mini({ label, val, dot }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>{val}</span>
    </span>
  );
}

function StopSchedule({ schedule }) {
  if (!schedule?.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {schedule.map((d, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 20, padding: '18px 4px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Day {d.day}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <Mini label="Drive"   val={hrsMin(d.drive)}  dot="#2563eb" />
              <Mini label="On duty" val={hrsMin(d.onduty)} dot="#d97706" />
              <Mini label="Rest"    val={hrsMin(d.rest)}   dot="#7c3aed" />
            </div>
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
            {d.items.map((it, j) => (
              <li key={j} style={{ display: 'grid', gridTemplateColumns: '74px 1fr', gap: 14, position: 'relative', padding: '7px 0' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', textAlign: 'right', paddingTop: 1 }}>{it.time}</div>
                <div style={{ position: 'relative', paddingLeft: 18 }}>
                  <span style={{ position: 'absolute', left: 0, top: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-tint)' }} />
                  {j < d.items.length - 1 && <span style={{ position: 'absolute', left: 3.5, top: 13, bottom: -9, width: 1, background: 'var(--border)' }} />}
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{it.text}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function MapInner({ route, stops, remarkMarkers = [] }) {
  const mapRef = useRef(null);
  const { path = [], markers = [] } = route || {};

  const fallbackPath = stops
    .filter(s => s.lat != null && s.lng != null)
    .map(s => ({ lat: s.lat, lng: s.lng }));

  const positions = path.length > 1
    ? path.map(([lat, lng]) => ({ lat, lng }))
    : fallbackPath;

  const center = positions[0] || { lat: 39.5, lng: -98.35 };

  const onLoad = useCallback((map) => {
    mapRef.current = map;
    if (positions.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      positions.forEach(p => bounds.extend(p));
      map.fitBounds(bounds, { padding: 50 });
    }
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <GoogleMap
        mapContainerStyle={{ height: 380, width: '100%', borderRadius: 'calc(var(--radius) - 4px)' }}
        center={center}
        zoom={5}
        options={MAP_OPTIONS}
        onLoad={onLoad}
      >
        {positions.length > 1 && (
          <>
            <Polyline path={positions} options={{ strokeColor: '#ffffff', strokeWeight: 11, strokeOpacity: 0.6 }} />
            <Polyline path={positions} options={{ strokeColor: '#2d5a3d', strokeWeight: 5, strokeOpacity: 0.95 }} />
          </>
        )}
        {markers.map((m, i) => (
          <Marker
            key={i}
            position={{ lat: m.pos[0], lng: m.pos[1] }}
            icon={markerIcon(MARKER_COLORS[m.kind] || MARKER_COLORS.start)}
            title={`${MARKER_LABELS[m.kind] || m.kind}: ${m.label}`}
          />
        ))}
        {remarkMarkers.map((m, i) => (
          <Marker
            key={'rm' + i}
            position={{ lat: m.pos[0], lng: m.pos[1] }}
            icon={markerIcon(MARKER_COLORS.remark, 8)}
            title={m.label}
            zIndex={5}
          />
        ))}
      </GoogleMap>

      {/* Legend */}
      <div style={{ position: 'absolute', left: 14, bottom: 14, zIndex: 5, background: 'rgba(255,255,255,.95)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', boxShadow: 'var(--shadow-md)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 16px' }}>
        {Object.entries(MARKER_LABELS).map(([k, label]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--text)', fontWeight: 500 }}>
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

      {schedule?.length > 0 && (
        <div style={{ padding: '4px 22px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '.06em', textTransform: 'uppercase', margin: '12px 0 2px' }}>Stop schedule</div>
          <StopSchedule schedule={schedule} />
        </div>
      )}
    </div>
  );
}
