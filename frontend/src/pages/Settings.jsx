import React, { useState } from 'react';
import { Card, Btn, Field, Input } from '../components/ui';
import { Building2, Hash, Truck } from 'lucide-react';
import useIsMobile from '../hooks/useIsMobile';

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>{title}</h2>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{sub}</p>}
    </div>
  );
}

function Select({ value, onChange, options }) {
  const [f, setF] = useState(false);
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
      style={{
        width: '100%', height: 42, padding: '0 14px',
        border: `1px solid ${f ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10,
        fontSize: 14, color: 'var(--text)', background: '#fff',
        outline: 'none', cursor: 'pointer',
        boxShadow: f ? '0 0 0 3px var(--accent-tint)' : 'none',
        transition: 'all .15s ease', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
        paddingRight: 36,
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange, label, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--accent)' : 'var(--border-strong)',
          position: 'relative', transition: 'background .2s ease', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transition: 'left .2s ease', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      </button>
    </div>
  );
}

export default function Settings() {
  const [carrier, setCarrier] = useState({ name: '', dot: '', mc: '', address: '' });
  const [hos, setHos] = useState({ cycle: '70/8', shortHaul: false, adverseConditions: false, restart34h: true });
  const [vehicle, setVehicle] = useState({ truckNum: '', trailerNum: '', vin: '' });
  const [saved, setSaved] = useState(false);
  const isMobile = useIsMobile();
  const twoCol = isMobile ? '1fr' : '1fr 1fr';
  const threeCol = isMobile ? '1fr' : '1fr 1fr 1fr';

  const setC = key => e => { setCarrier(f => ({ ...f, [key]: e.target.value })); setSaved(false); };
  const setV = key => e => { setVehicle(f => ({ ...f, [key]: e.target.value })); setSaved(false); };
  const setHosField = (key, val) => { setHos(f => ({ ...f, [key]: val })); setSaved(false); };

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

      {/* HOS ruleset */}
      <Card>
        <SectionHeader title="Hours of service ruleset" sub="Controls how drive time and duty cycles are calculated" />
        <Field label="Driving cycle">
          <Select
            value={hos.cycle}
            onChange={val => setHosField('cycle', val)}
            options={[
              { value: '70/8', label: '70 hours / 8 days (property-carrying)' },
              { value: '60/7', label: '60 hours / 7 days (property-carrying)' },
            ]}
          />
        </Field>
        <div style={{ marginTop: 6 }}>
          <Toggle
            checked={hos.restart34h}
            onChange={v => setHosField('restart34h', v)}
            label="34-hour restart"
            sub="Reset weekly cycle after 34 consecutive off-duty hours"
          />
          <Toggle
            checked={hos.shortHaul}
            onChange={v => setHosField('shortHaul', v)}
            label="Short-haul exemption"
            sub="100 air-mile radius, returns to same work reporting location"
          />
          <Toggle
            checked={hos.adverseConditions}
            onChange={v => setHosField('adverseConditions', v)}
            label="Adverse driving conditions"
            sub="Allows up to 2 extra hours of drive time when conditions warrant"
          />
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
