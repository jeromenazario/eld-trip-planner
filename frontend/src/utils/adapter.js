export function hrsMin(min) {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.round(Math.abs(min) % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function fmtClock(min) {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const ap = h < 12 ? 'AM' : 'PM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

// "Sun, May 31" — short day label for the marker "when does this happen" line.
export function fmtDay(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function toDesignDay(log, totalDays, startOffsetMins = 0) {
  let cursor = startOffsetMins;
  const changes = startOffsetMins > 0
    ? [{ status: 'off', start: 0, dur: startOffsetMins }]
    : [];
  const totals = { off: startOffsetMins > 0 ? startOffsetMins : 0, sleeper: 0, driving: 0, onduty: 0 };
  const remarks = [];

  for (const entry of log.entries) {
    const durMin = entry.hours * 60;
    // start_min from backend = real clock position on the 24-hr grid; fall back to cursor (offset-aware)
    const startMin = entry.start_min != null ? entry.start_min : cursor;
    const lbl = (entry.label || '').toLowerCase();

    let status;
    if (entry.status === 'SB') {
      status = 'sleeper';
    } else if (entry.status === 'OFF') {
      status = 'off';
    } else if (entry.status === 'D') {
      status = 'driving';
    } else if (entry.status === 'ON') {
      status = 'onduty';
    } else {
      status = 'off';
    }

    const last = changes[changes.length - 1];
    if (last && last.status === status && Math.abs(last.start + last.dur - startMin) < 1) {
      last.dur += durMin;
    } else {
      changes.push({ status, start: startMin, dur: durMin });
    }
    totals[status] = (totals[status] || 0) + durMin;

    // Keep generic idle/driving off the remarks strip, but DO surface the
    // mandatory 30-min break and the sleeper-berth rest — these are real,
    // logged remarks a driver writes on a paper sheet ("30 min break", "sleep").
    const skip = ['off duty', 'drive segment'];
    const shouldSkip = skip.some(s => lbl.includes(s));
    if (entry.label && !shouldSkip) {
      const r = { time: startMin, text: entry.label };
      if (entry.lat != null) r.lat = entry.lat;
      if (entry.lng != null) r.lng = entry.lng;
      remarks.push(r);
    }
    cursor = startMin + durMin;
  }

  return {
    index: log.day,
    date: new Date(log.date + 'T00:00:00'),
    changes,
    totals,
    remarks,
    miles: log.miles || 0,
    driver: log.driver || '',
    co_driver: log.co_driver || '',
    carrier: log.carrier || '',
    truck_number: log.truck_number || '',
    startOffset: startOffsetMins,
    _numDays: totalDays,
  };
}

// Match a remark label (e.g. "Pickup", "Fuel Stop 2") to its geocoded stop.
function resolveStopFor(text, stops) {
  const t = (text || '').trim().toLowerCase();
  if (!t) return null;

  // 1. Exact label match (remark "Fuel Stop 1" === stop label "Fuel Stop 1")
  let stop = stops.find(s => (s.label || '').toLowerCase() === t);
  if (stop) return stop;

  // 2. Type / keyword match
  if (t.includes('pickup') || t.includes('pick up')) {
    stop = stops.find(s => s.type === 'pickup');
  } else if (t.includes('dropoff') || t.includes('drop off') || t.includes('delivery')) {
    stop = stops.find(s => s.type === 'dropoff');
  } else if (t.includes('fuel') || t.includes('gas')) {
    const fuels = stops.filter(s => s.type === 'fuel');
    const m = t.match(/(\d+)/);
    stop = m ? fuels[Number(m[1]) - 1] : fuels[0];
  } else if (t.includes('rest') || t.includes('sleep') || t.includes('break')) {
    stop = stops.find(s => s.type === 'rest');
  }
  return stop || null;
}

// Pull a human-readable city out of a Google "vicinity" / formatted address.
// e.g. "1234 W Madison St, Chicago" → "Chicago"; "Chicago, IL 60601" → "Chicago".
function cityFromAddress(address) {
  if (!address) return '';
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  // Single-segment addresses are usually just the city/area already.
  if (parts.length === 1) return parts[0];
  // Otherwise the city is the segment right after the street line. Strip a
  // trailing "ST 60601" style state+zip if it got merged into that segment.
  const city = parts[1] || parts[0];
  return city.replace(/\s+[A-Z]{2}\s*\d{0,5}$/, '').trim() || city;
}

// Build the label shown in the REMARKS section, e.g. "Chicago - Conoco" so the
// driver can see both the city and the specific stop/business at a glance.
function formatPlace(stop) {
  const name = (stop.name || stop.label || '').trim();
  const city = cityFromAddress(stop.address);
  if (city && name && !name.toLowerCase().includes(city.toLowerCase())) {
    return `${city} - ${name}`;
  }
  return name || stop.address || '';
}

// Enrich each remark in-place with a resolved geographic place + coordinates,
// pulled from the geocoded stops array. Mutates day.remarks.
export function enrichRemarks(days, stops = []) {
  for (const day of days) {
    for (const r of day.remarks) {
      if (r.lat != null && r.lng != null) {
        r.place = r.place || r.text;
        continue;
      }
      const stop = resolveStopFor(r.text, stops);
      if (stop) {
        if (stop.lat != null && stop.lng != null) {
          r.lat = stop.lat;
          r.lng = stop.lng;
        }
        // "City - Business" when we have both, else the best single value.
        r.place = formatPlace(stop) || r.text;
      }
    }
  }
  return days;
}

// Build de-duplicated map markers from the already-enriched remarks.
export function buildRemarkMarkers(days) {
  const seen = new Set();
  const markers = [];
  for (const day of days) {
    for (const r of day.remarks) {
      if (r.lat == null || r.lng == null) continue;
      const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      markers.push({
        kind: 'remark',
        pos: [r.lat, r.lng],
        label: r.place || r.text,
        text: r.text,
        place: r.place || '',
        time: fmtClock(r.time),
        when: `${fmtDay(day.date)} · ${fmtClock(r.time)}`,
      });
    }
  }
  return markers;
}

export function toDesignRoute(orsRoute, stops) {
  const path = orsRoute?.features?.[0]?.geometry?.coordinates
    ?.map(([lng, lat]) => [lat, lng]) || [];
  const markers = stops
    .filter(s => s.lat != null && s.lng != null)
    .map(s => ({
      kind: s.type,
      pos: [s.lat, s.lng],
      label: s.label || s.name || '',
      name: s.name || '',
      address: s.address || '',
      mile: s.mile != null ? s.mile : null,
      when: s.when || null,
    }));
  return { path, markers };
}

export function toDesignStats(summary) {
  return {
    days: summary.total_days,
    drivingHrs: summary.total_driving_hrs,
    offHrs: summary.total_off_duty_hrs,
    fuelStops: summary.fuel_stops,
    cycleRemain: summary.cycle_remaining,
  };
}

export function buildSchedule(days) {
  return days.map(day => ({
    day: day.index,
    date: day.date,
    drive: day.totals.driving || 0,
    onduty: day.totals.onduty || 0,
    // Split rest into its two duty-status rows so a day's idle time isn't shown
    // as one giant "Rest" block (which reads as wasted time when most of it is
    // really the sleeper-berth reset or post-delivery off-duty at trip's end).
    sleeper: day.totals.sleeper || 0,
    off: day.totals.off || 0,
    rest: (day.totals.off || 0) + (day.totals.sleeper || 0),
    startOffset: day.startOffset || 0,
    items: day.remarks.length
      ? day.remarks.map(r => ({ time: fmtClock(r.time), text: r.text, loc: r.place || null }))
      : [{ time: fmtClock(day.startOffset || 0), text: day.index === 1 ? 'Departure' : 'Start of day', loc: null }],
  }));
}

export function adaptBackendResponse(data, formInput) {
  const { logs, route, stops, summary } = data;
  const totalDays = logs.length;
  const [depH, depM] = (formInput.departure_time || '00:00').split(':').map(Number);
  const departureMinutes = (depH || 0) * 60 + (depM || 0);
  const days = logs.map((log, i) => toDesignDay(log, totalDays, i === 0 ? departureMinutes : 0));

  // When geocoding wasn't available (no API key), stops have no name.
  // Inject the user-entered strings so enrichRemarks has something meaningful to show.
  const FORM_NAMES = {
    start:   formInput.current_location  || '',
    pickup:  formInput.pickup_location   || '',
    dropoff: formInput.dropoff_location  || '',
  };
  for (const s of stops) {
    if (!s.name && FORM_NAMES[s.type]) s.name = FORM_NAMES[s.type];
  }

  enrichRemarks(days, stops);

  // Attach an arrival date+time to each stop so the map popup can answer "when
  // does the driver get here". The enriched remarks already carry the clock time
  // and belong to a dated day; index them by rounded coordinate and copy the
  // first match onto the matching stop. The start has no remark — it's the
  // departure — so label it from the day-1 departure time.
  const whenByCoord = {};
  for (const day of days) {
    for (const r of day.remarks) {
      if (r.lat == null || r.lng == null) continue;
      const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
      if (!whenByCoord[key]) whenByCoord[key] = `${fmtDay(day.date)} · ${fmtClock(r.time)}`;
    }
  }
  for (const s of stops) {
    if (s.lat == null || s.lng == null) continue;
    const key = `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
    if (whenByCoord[key]) s.when = whenByCoord[key];
  }
  const startStop = stops.find(s => s.type === 'start');
  if (startStop && days[0]) startStop.when = `${fmtDay(days[0].date)} · ${fmtClock(departureMinutes)}`;

  // Pass the last known place across day boundaries so Day 2 transitions that
  // happen before the first named stop don't silently show "En route".
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1].remarks;
    if (prev.length > 0) {
      const last = prev[prev.length - 1];
      days[i].carryPlace = last.place || last.text || null;
    }
  }

  return {
    days,
    route: toDesignRoute(route, stops),
    remarkMarkers: buildRemarkMarkers(days),
    stops,
    stats: toDesignStats(summary),
    schedule: buildSchedule(days),
    input: {
      curLoc: formInput.current_location,
      pickLoc: formInput.pickup_location,
      dropLoc: formInput.dropoff_location,
      miles: formInput.estimated_miles,
      driver: formInput.driver_name || '',
      coDriver: formInput.co_driver || '',
      carrier: formInput.carrier || '',
      truck: formInput.truck_number || '',
      departureTime: formInput.departure_time || '00:00',
      departureMinutes,
    },
  };
}
