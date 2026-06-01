import React from 'react';
import { History, Route, BedDouble, Fuel, Clock } from 'lucide-react';
import { Card } from './ui';

const CARDS = [
  { key: 'days',         label: 'Total Trip Days',      unit: 'days',   Icon: History },
  { key: 'drivingHrs',   label: 'Total Driving Hrs',    unit: 'hrs',    Icon: Route },
  { key: 'offHrs',       label: 'Total Off-Duty Hrs',   unit: 'hrs',    Icon: BedDouble },
  { key: 'fuelStops',    label: 'Fuel Stops',           unit: 'stops',  Icon: Fuel },
  { key: 'cycleRemain',  label: 'Cycle Hrs Remaining',  unit: 'of 70',  Icon: Clock },
];

export default function StatsBar({ stats }) {
  if (!stats) return null;
  return (
    <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
      {CARDS.map(({ key, label, unit, Icon }) => {
        const warn = key === 'cycleRemain' && stats[key] < 10;
        const val = typeof stats[key] === 'number' && !Number.isInteger(stats[key])
          ? stats[key].toFixed(1)
          : stats[key];
        return (
          <Card key={key} className="kpi-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="kpi-label" style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, maxWidth: '80%' }}>{label}</div>
              <span className="kpi-icon" style={{ color: warn ? 'var(--amber)' : 'var(--accent)', opacity: .85 }}>
                <Icon size={17} strokeWidth={1.8} />
              </span>
            </div>
            <div className="kpi-figure" style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="kpi-value" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.02em', color: warn ? 'var(--amber)' : 'var(--text)' }}>
                {val ?? '—'}
              </span>
              <span className="kpi-unit" style={{ fontSize: 12.5, color: 'var(--label)' }}>{unit}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
