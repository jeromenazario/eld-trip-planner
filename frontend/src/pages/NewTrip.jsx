import React from 'react';
import TripForm from '../components/TripForm';
import RouteMap from '../components/RouteMap';
import ELDLogSheet from '../components/ELDLogSheet';
import StatsBar from '../components/StatsBar';
import { Card, Btn, Badge } from '../components/ui';
import { MapPin, Package, Flag, ArrowRight, Printer, Download, Grid, Route, AlertCircle } from 'lucide-react';

function RoutePill({ color, Icon, text }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, background: color + '1a', color, display: 'grid', placeItems: 'center' }}>
        <Icon size={15} strokeWidth={2} />
      </span>
      {text}
    </span>
  );
}

function SectionTitle({ icon: Icon, title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {Icon && <span style={{ color: 'var(--accent)' }}><Icon size={19} strokeWidth={1.8} /></span>}
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' }}>{title}</h2>
          {sub && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

export default function NewTrip({ trip, loading, error }) {
  if (!trip) return null;

  const { input, days, route, stops, stats, schedule, remarkMarkers = [] } = trip;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '16px 20px', display: 'flex', gap: 12 }}>
          <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <pre style={{ margin: 0, fontSize: 13, color: '#dc2626', whiteSpace: 'pre-wrap' }}>{error}</pre>
        </div>
      )}

      {/* Route banner */}
      <Card style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <RoutePill color="var(--accent)" Icon={MapPin} text={input.curLoc} />
          <ArrowRight size={16} color="var(--label)" />
          <RoutePill color="#2563eb" Icon={Package} text={input.pickLoc} />
          <ArrowRight size={16} color="var(--label)" />
          <RoutePill color="#dc2626" Icon={Flag} text={input.dropLoc} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Badge tone="green">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            HOS compliant
          </Badge>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            {Number(input.miles).toLocaleString()} mi
          </span>
        </div>
      </Card>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Map */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.52)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255, 255, 255, 0.72)',
        borderRadius: 20,
        boxShadow: '0 8px 32px rgba(20, 22, 26, 0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
        padding: '18px 18px 18px',
      }}>
        <SectionTitle icon={Route} title="Route & stops" sub="Planned stops, fueling, and required rest periods" />
        <RouteMap route={route} stops={stops} schedule={schedule} remarkMarkers={remarkMarkers} />
      </div>

      {/* Log sheets */}
      <div id="eld-log-section">
        <SectionTitle
          icon={Grid}
          title="Daily ELD log sheets"
          sub={`${days.length} ${days.length > 1 ? 'days' : 'day'} · FMCSA record of duty status`}
          right={
            <div style={{ display: 'flex', gap: 10 }} className="no-print">
              <Btn variant="ghost" size="sm" icon={<Printer />} onClick={() => window.print()}>Print</Btn>
              <Btn variant="ghost" size="sm" icon={<Download />} onClick={() => window.print()}>Export PDF</Btn>
            </div>
          }
        />
        <ELDLogSheet logs={days} />
      </div>
    </div>
  );
}
