import React, { useState } from 'react';
import { MapPin, Package, Flag, Route, Clock, Loader2, Check } from 'lucide-react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { Card, Btn, Field, Input } from './ui';

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3);
}

const LIBRARIES = ['places'];
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const DEFAULT = {
  current: '', pickup: '', dropoff: '',
  cycleUsed: '',
  driver: '', coDriver: '', carrier: '', truck: '',
  departureTime: '',
};

const FEATURES = [
  ['Route map',      'Stops, fuel & rest points'],
  ['Daily ELD logs', 'One sheet per day, FMCSA grid'],
  ['HOS compliance', '11h drive · 14h window · 30m break'],
  ['Trip summary',   'Days, hours, cycle remaining'],
];

function PlacesInput({ value, onChange, onCoords, placeholder, icon, error }) {
  const [ac, setAc] = useState(null);

  const onPlaceChanged = () => {
    if (ac) {
      const place = ac.getPlace();
      onChange(place.formatted_address || place.name || '');
      const loc = place.geometry?.location;
      if (loc && onCoords) onCoords({ lat: loc.lat(), lng: loc.lng() });
    }
  };

  return (
    <Autocomplete
      onLoad={setAc}
      onPlaceChanged={onPlaceChanged}
      options={{ types: ['(cities)'] }}
    >
      <Input
        icon={icon}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        error={error}
      />
    </Autocomplete>
  );
}

export default function TripForm({ onSubmit, loading }) {
  const [v, setV] = useState(() => ({
    ...DEFAULT,
    departureTime: new Date().toTimeString().slice(0, 5),
  }));
  const [coords, setCoords] = useState({ current: null, dropoff: null });
  const [attempted, setAttempted] = useState(false);
  const set = k => val => setV(s => ({ ...s, [k]: val }));
  const setE = k => e => setV(s => ({ ...s, [k]: e.target.value }));
  const setCoord = k => c => setCoords(s => ({ ...s, [k]: c }));

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: API_KEY, libraries: LIBRARIES });

  const estimatedMiles = coords.current && coords.dropoff
    ? haversine(coords.current.lat, coords.current.lng, coords.dropoff.lat, coords.dropoff.lng)
    : null;

  const cycleNum = Number(v.cycleUsed) || 0;
  const cycleExhausted = cycleNum >= 70;
  const valid = v.current && v.pickup && v.dropoff && estimatedMiles > 0 && v.cycleUsed !== '' && !cycleExhausted && v.driver && v.carrier && v.truck;
  const cyclePct = Math.min(100, (Number(v.cycleUsed) || 0) / 70 * 100);

  const LocationInput = isLoaded ? PlacesInput : ({ value, onChange, placeholder, icon }) => (
    <Input icon={icon} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  );

  const handleSubmit = e => {
    e.preventDefault();
    if (!valid) { setAttempted(true); return; }
    if (loading) return;
    onSubmit({
      current_location: v.current,
      pickup_location:  v.pickup,
      dropoff_location: v.dropoff,
      estimated_miles:  estimatedMiles,
      cycle_used:       Number(v.cycleUsed) || 0,
      driver_name:      v.driver,
      co_driver:        v.coDriver,
      carrier:          v.carrier,
      truck_number:     v.truck,
      departure_time:   v.departureTime || new Date().toTimeString().slice(0, 5),
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 1080, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 22, alignItems: 'start' }}>

        {/* Main inputs */}
        <Card style={{ padding: 28 }}>
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Trip details</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Enter the route and your current cycle usage — we'll calculate a compliant HOS plan.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Current location" error={attempted && !v.current}>
              <LocationInput icon={<MapPin />} value={v.current} onChange={set('current')} onCoords={setCoord('current')} placeholder="City, State" error={attempted && !v.current} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Pickup location" error={attempted && !v.pickup}>
                <LocationInput icon={<Package />} value={v.pickup} onChange={set('pickup')} placeholder="City, State" error={attempted && !v.pickup} />
              </Field>
              <Field label="Drop-off location" error={attempted && !v.dropoff}>
                <LocationInput icon={<Flag />} value={v.dropoff} onChange={set('dropoff')} onCoords={setCoord('dropoff')} placeholder="City, State" error={attempted && !v.dropoff} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <Field label="Estimated miles" error={attempted && !estimatedMiles}>
                <div style={{ height: 42, padding: '0 14px 0 38px', borderRadius: 10, position: 'relative',
                  border: `1px solid ${attempted && !estimatedMiles ? '#fca5a5' : 'var(--border)'}`,
                  background: attempted && !estimatedMiles ? '#fff8f8' : '#f9f9f8',
                  boxShadow: attempted && !estimatedMiles ? '0 0 0 3px #fee2e2' : 'none',
                  display: 'flex', alignItems: 'center', gap: 10, transition: 'all .15s ease' }}>
                  <span style={{ position: 'absolute', left: 13, color: attempted && !estimatedMiles ? '#f87171' : 'var(--label)', display: 'flex' }}>
                    <Route size={17} />
                  </span>
                  <span style={{ fontSize: 14, color: estimatedMiles ? 'var(--text)' : 'var(--label)', fontWeight: estimatedMiles ? 500 : 400 }}>
                    {estimatedMiles ? `~${estimatedMiles.toLocaleString()} mi` : 'Auto-calculated from route'}
                  </span>
                </div>
              </Field>
              <Field
                label="Current cycle used (hrs)"
                error={attempted && v.cycleUsed === ''}
                hint={cycleExhausted ? '⚠ Cycle exhausted — 34-hr restart required before new trip' : v.cycleUsed !== '' ? `${cycleNum.toFixed(0)} of 70 hrs · ${(70 - cycleNum).toFixed(0)} hrs available` : null}
              >
                <Input icon={<Clock />} type="number" min="0" max="70" step="0.5" value={v.cycleUsed} onChange={setE('cycleUsed')} placeholder="0–70" error={attempted && v.cycleUsed === ''} />
              </Field>
              <Field label="Departure time" hint="Local time when trip begins">
                <Input icon={<Clock />} type="time" value={v.departureTime} onChange={setE('departureTime')} />
              </Field>
            </div>

            {/* Cycle meter */}
            <div style={{ height: 6, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: cyclePct + '%', height: '100%', background: cyclePct > 85 ? 'var(--amber)' : 'var(--accent)', transition: 'width .3s ease' }} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginTop: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--label)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>
                Driver &amp; vehicle
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
                <Field label="Driver name" error={attempted && !v.driver}>
                  <Input value={v.driver} onChange={setE('driver')} placeholder="Full name" error={attempted && !v.driver} />
                </Field>
                <Field label="Co-driver (optional)">
                  <Input value={v.coDriver} onChange={setE('coDriver')} placeholder="Full name" />
                </Field>
                <Field label="Carrier name" error={attempted && !v.carrier}>
                  <Input value={v.carrier} onChange={setE('carrier')} placeholder="Company" error={attempted && !v.carrier} />
                </Field>
                <Field label="Truck number" error={attempted && !v.truck}>
                  <Input value={v.truck} onChange={setE('truck')} placeholder="Unit #" error={attempted && !v.truck} />
                </Field>
              </div>
            </div>
          </div>
        </Card>

        {/* Side rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 90 }}>
          <Card style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <span style={{ color: 'var(--accent)' }}><Route size={19} strokeWidth={1.8} /></span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>What we'll generate</h3>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {FEATURES.map(([t, s]) => (
                <li key={t} style={{ display: 'flex', gap: 11 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                    <Check size={13} strokeWidth={2.4} />
                  </span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Btn
            type="submit"
            disabled={!valid || loading}
            icon={loading ? null : <Route />}
            style={{ width: '100%', justifyContent: 'center', height: 48, fontSize: 15, opacity: valid ? 1 : .55 }}
          >
            {loading
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Calculating plan…</>
              : 'Choose a Route'}
          </Btn>

          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--label)', textAlign: 'center', lineHeight: 1.5 }}>
            Plans assume 55 mph average and a property-carrying driver under the 70-hour / 8-day cycle.
          </p>
        </div>
      </div>
    </form>
  );
}
