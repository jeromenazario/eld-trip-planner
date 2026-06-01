import React, { useState } from 'react';
import { Card, Btn, Field, Input } from '../components/ui';
import { Building2, Hash, Truck, Lock } from 'lucide-react';
import useIsMobile from '../hooks/useIsMobile';

function SectionHeader({ title, sub, badge }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>{title}</h2>
        {badge && (
          <span style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase',
            color: 'var(--muted)', background: 'var(--border)', borderRadius: 20, padding: '2px 8px',
          }}>{badge}</span>
        )}
      </div>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{sub}</p>}
    </div>
  );
}

// Honest framing: the HOS ruleset is not user-configurable. The engine always
// applies the standard property-carrying limits (per the assessment), so this
// is shown as a locked, read-only reference rather than editable controls.
function LockNote({ children }) {
  return (
    <div style={{
      display: 'flex', gap: 9, alignItems: 'flex-start',
      background: 'var(--accent-tint)', border: '1px solid var(--accent-soft)',
      borderRadius: 8, padding: '10px 12px', marginBottom: 16,
    }}>
      <Lock size={14} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

// One read-only rule: a label + description on the left, a fixed value pill on
// the right. `status="off"` greys the pill for an assumption that's NOT applied.
function LockedRow({ label, desc, value, status = 'on' }) {
  const tone = status === 'off'
    ? { color: 'var(--muted)', bg: 'var(--border)' }
    : { color: 'var(--accent)', bg: 'var(--accent-soft)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '13px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: tone.color, background: tone.bg, borderRadius: 20, padding: '4px 11px', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}

export default function Settings() {
  const [carrier, setCarrier] = useState({ name: '', dot: '', mc: '', address: '' });
  const [vehicle, setVehicle] = useState({ truckNum: '', trailerNum: '', vin: '' });
  const [saved, setSaved] = useState(false);
  const isMobile = useIsMobile();
  const twoCol = isMobile ? '1fr' : '1fr 1fr';
  const threeCol = isMobile ? '1fr' : '1fr 1fr 1fr';

  const setC = key => e => { setCarrier(f => ({ ...f, [key]: e.target.value })); setSaved(false); };
  const setV = key => e => { setVehicle(f => ({ ...f, [key]: e.target.value })); setSaved(false); };

  return (
    <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Carrier info */}
      <Card>
        <SectionHeader title="Carrier information" sub="Your motor carrier details for log sheet headers" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: twoCol, gap: 14 }}>
            <Field label="Company name">
              <Input icon={<Building2 />} placeholder="Acme Freight LLC" value={carrier.name} onChange={setC('name')} />
            </Field>
            <Field label="Main office address" optional>
              <Input placeholder="123 Main St, Dallas TX" value={carrier.address} onChange={setC('address')} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: twoCol, gap: 14 }}>
            <Field label="USDOT number">
              <Input icon={<Hash />} placeholder="1234567" value={carrier.dot} onChange={setC('dot')} />
            </Field>
            <Field label="MC number" optional>
              <Input icon={<Hash />} placeholder="987654" value={carrier.mc} onChange={setC('mc')} />
            </Field>
          </div>
        </div>
      </Card>

      {/* HOS ruleset — locked, read-only. Reflects the fixed FMCSA limits the
          engine enforces on every trip (not user-configurable). */}
      <Card>
        <SectionHeader title="Hours of service ruleset" sub="The fixed FMCSA limits the engine enforces on every trip" badge="Locked" />
        <LockNote>
          Fixed for a{' '}
          <strong style={{ color: 'var(--text)', fontWeight: 600 }}>property-carrying driver under the 70-hour / 8-day cycle</strong>{' '}
          with no adverse conditions, per the assessment. These apply to every plan and aren't configurable.
        </LockNote>
        <div>
          <LockedRow label="Driving cycle" desc="Property-carrying driver, 70 hours over 8 days" value="70h / 8 days" />
          <LockedRow label="Max driving per shift" desc="Hard cap before a 10-hour reset is required" value="11 hours" />
          <LockedRow label="On-duty window" desc="No driving past 14 hours after coming on duty" value="14 hours" />
          <LockedRow label="Rest break" desc="Required after 8 cumulative hours of driving" value="30 minutes" />
          <LockedRow label="Required reset" desc="Off-duty / sleeper berth to start a new shift" value="10 hours" />
          <LockedRow label="Adverse driving conditions" desc="Assessment assumes none — no extra drive time" value="Off" status="off" />
        </div>
      </Card>

      {/* Vehicle */}
      <Card>
        <SectionHeader title="Vehicle" sub="Truck and trailer identifiers for log sheet records" />
        <div style={{ display: 'grid', gridTemplateColumns: threeCol, gap: 14 }}>
          <Field label="Truck number">
            <Input icon={<Truck />} placeholder="T-1042" value={vehicle.truckNum} onChange={setV('truckNum')} />
          </Field>
          <Field label="Trailer number" optional>
            <Input placeholder="TR-8821" value={vehicle.trailerNum} onChange={setV('trailerNum')} />
          </Field>
          <Field label="VIN" optional>
            <Input placeholder="1HGBH41JXMN109186" value={vehicle.vin} onChange={setV('vin')} />
          </Field>
        </div>
      </Card>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn onClick={() => setSaved(true)}>Save settings</Btn>
        {saved && <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>Saved</span>}
      </div>
    </div>
  );
}
