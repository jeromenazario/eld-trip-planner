import React, { useState } from 'react';
import { Card, Btn, Field, Input } from '../components/ui';
import { User, Mail, CreditCard, MapPin, Home } from 'lucide-react';

const CDL_CLASSES = ['Class A', 'Class B', 'Class C'];
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>{title}</h2>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{sub}</p>}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }) {
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
        fontSize: 14, color: value ? 'var(--text)' : 'var(--label)', background: '#fff',
        outline: 'none', cursor: 'pointer',
        boxShadow: f ? '0 0 0 3px var(--accent-tint)' : 'none',
        transition: 'all .15s ease', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
        paddingRight: 36,
      }}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function Profile() {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    cdlNumber: '', cdlClass: '', licenseState: '',
    homeTerminal: '',
  });
  const [saved, setSaved] = useState(false);

  const set = key => val => { setForm(f => ({ ...f, [key]: val })); setSaved(false); };
  const setInput = key => e => set(key)(e.target.value);

  const initials = [form.firstName[0], form.lastName[0]].filter(Boolean).join('').toUpperCase() || 'JD';
  const fullName = [form.firstName, form.lastName].filter(Boolean).join(' ') || 'John Doe';

  const handleSave = () => setSaved(true);

  return (
    <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Avatar + name banner */}
      <Card style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#3a6b4c,#264e34)', color: '#fff',
          display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 22,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>{fullName}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {form.cdlClass || 'Class A CDL'} · {form.licenseState || 'License state not set'}
          </div>
        </div>
      </Card>

      {/* Personal info */}
      <Card>
        <SectionHeader title="Personal information" sub="Your name and contact details" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="First name">
            <Input icon={<User />} placeholder="John" value={form.firstName} onChange={setInput('firstName')} />
          </Field>
          <Field label="Last name">
            <Input placeholder="Doe" value={form.lastName} onChange={setInput('lastName')} />
          </Field>
          <Field label="Email" optional>
            <Input icon={<Mail />} type="email" placeholder="john@example.com" value={form.email} onChange={setInput('email')} />
          </Field>
          <Field label="Home terminal" optional>
            <Input icon={<Home />} placeholder="Dallas, TX" value={form.homeTerminal} onChange={setInput('homeTerminal')} />
          </Field>
        </div>
      </Card>

      {/* CDL info */}
      <Card>
        <SectionHeader title="License & credentials" sub="Your commercial driver's license details" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="CDL number" style={{ gridColumn: 'span 1' }}>
            <Input icon={<CreditCard />} placeholder="TX-1234567" value={form.cdlNumber} onChange={setInput('cdlNumber')} />
          </Field>
          <Field label="CDL class">
            <Select value={form.cdlClass} onChange={set('cdlClass')} options={CDL_CLASSES} placeholder="Select class" />
          </Field>
          <Field label="License state">
            <Select value={form.licenseState} onChange={set('licenseState')} options={US_STATES} placeholder="State" />
          </Field>
        </div>
      </Card>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn onClick={handleSave}>Save profile</Btn>
        {saved && <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>Saved</span>}
      </div>
    </div>
  );
}
