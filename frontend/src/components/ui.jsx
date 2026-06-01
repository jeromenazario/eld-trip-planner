import React, { useState } from 'react';

export function DashedLine({ vertical = false, color = '#d6d6d3', dash = 7, gap = 7, thickness = 1.5, style }) {
  const grad = vertical
    ? `repeating-linear-gradient(180deg,${color} 0 ${dash}px,transparent ${dash}px ${dash + gap}px)`
    : `repeating-linear-gradient(90deg,${color} 0 ${dash}px,transparent ${dash}px ${dash + gap}px)`;
  return (
    <div style={{
      background: grad,
      ...(vertical ? { width: thickness } : { height: thickness, width: '100%' }),
      ...style,
    }} />
  );
}

export function Card({ children, style, pad = true, onClick, className }) {
  return (
    <div onClick={onClick} className={className} style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      ...(pad ? { padding: 22 } : {}), ...style,
    }}>
      {children}
    </div>
  );
}

export function Btn({ children, variant = 'primary', icon, size = 'md', style, ...rest }) {
  const [h, setH] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState([]);
  const disabled = rest.disabled;

  const base = {
    position: 'relative', overflow: 'hidden',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    border: '1px solid transparent', borderRadius: 11, fontWeight: 600,
    fontSize: size === 'sm' ? 13 : 14, lineHeight: 1,
    padding: size === 'sm' ? '9px 13px' : '11px 17px',
    transition: 'transform .12s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease, background .18s ease',
    whiteSpace: 'nowrap', cursor: disabled ? 'not-allowed' : 'pointer',
  };
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff', boxShadow: '0 1px 2px rgba(45,90,61,.25)' },
    ghost: { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-strong)' },
    soft: { background: 'var(--accent-soft)', color: 'var(--accent)' },
    subtle: { background: '#f3f3f2', color: 'var(--muted)' },
  };
  const hoverMap = {
    primary: { background: 'var(--accent-hover)', boxShadow: '0 8px 20px rgba(45,90,61,.34), 0 2px 6px rgba(45,90,61,.22)' },
    ghost: { background: '#fafafa', boxShadow: '0 4px 12px rgba(20,22,26,.07)' },
    soft: { background: '#e1ede4' },
    subtle: { background: '#ebebea' },
  };
  const transform = disabled ? 'none' : pressed ? 'translateY(0) scale(.955)' : h ? 'translateY(-2px) scale(1.018)' : 'none';

  const onDown = (e) => {
    setPressed(true);
    const r = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRipples(rs => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setRipples(rs => rs.filter(x => x.id !== id)), 620);
  };

  return (
    <button
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => { setH(false); setPressed(false); }}
      onMouseDown={onDown} onMouseUp={() => setPressed(false)}
      style={{ ...base, ...variants[variant], ...(h && !disabled ? hoverMap[variant] : {}), transform, ...style }}
      {...rest}
    >
      {ripples.map(rp => (
        <span key={rp.id} style={{
          position: 'absolute', left: rp.x, top: rp.y, width: 560, height: 560,
          borderRadius: '50%', background: 'rgba(255,255,255,.45)',
          transform: 'translate(-50%,-50%) scale(.36)', pointerEvents: 'none',
          animation: 'btnRipple .6s ease-out forwards',
        }} />
      ))}
      {icon && (
        <span style={{ display: 'inline-flex', transition: 'transform .2s ease', transform: h && !disabled ? 'translateX(2px) rotate(-3deg)' : 'none' }}>
          {React.cloneElement(icon, { size: size === 'sm' ? 15 : 17 })}
        </span>
      )}
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'green' }) {
  const tones = {
    green: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
    gray: { bg: '#f0f0ef', fg: 'var(--muted)' },
    blue: { bg: '#e8eefc', fg: 'var(--blue)' },
    amber: { bg: '#fdf0dc', fg: 'var(--amber)' },
  };
  const t = tones[tone] || tones.gray;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: t.bg, color: t.fg, fontSize: 12, fontWeight: 600, padding: '4px 9px', borderRadius: 20 }}>
      {children}
    </span>
  );
}

export function DottedBtn({ children, onClick }) {
  const [h, setH] = useState(false);
  const [pressed, setPressed] = useState(false);

  const style = {
    borderRadius: pressed ? 16 : h ? 6 : 16,
    border: '2px dashed var(--border-strong)',
    background: 'white',
    padding: '12px 24px',
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: 14,
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'all 0.3s',
    transform: pressed ? 'translate(0px, 0px)' : h ? 'translate(-4px, -4px)' : 'none',
    boxShadow: pressed ? 'none' : h ? '4px 4px 0px #b0b0b0' : 'none',
    letterSpacing: '0.04em',
  };

  return (
    <button
      style={style}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => { setH(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {children}
    </button>
  );
}

export function Field({ label, optional, children, hint, error }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
        {optional && <span style={{ fontSize: 11, color: 'var(--label)', fontWeight: 500 }}>optional</span>}
      </div>
      {children}
      {error
        ? <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5, fontWeight: 500 }}>Field required</div>
        : hint && <div style={{ fontSize: 11.5, color: 'var(--label)', marginTop: 5 }}>{hint}</div>}
    </label>
  );
}

export function Input({ icon, error, ...rest }) {
  const [f, setF] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      {icon && (
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: error ? '#f87171' : 'var(--label)', pointerEvents: 'none' }}>
          {React.cloneElement(icon, { size: 17 })}
        </span>
      )}
      <input
        {...rest}
        onFocus={e => { setF(true); rest.onFocus?.(e); }}
        onBlur={e => { setF(false); rest.onBlur?.(e); }}
        style={{
          width: '100%', height: 42, padding: icon ? '0 14px 0 38px' : '0 14px',
          border: `1px solid ${f ? 'var(--accent)' : error ? '#fca5a5' : 'var(--border)'}`, borderRadius: 10,
          fontSize: 14, color: 'var(--text)', background: error ? '#fff8f8' : '#fff', outline: 'none',
          boxShadow: f ? '0 0 0 3px var(--accent-tint)' : error ? '0 0 0 3px #fee2e2' : 'none',
          transition: 'all .15s ease',
          ...rest.style,
        }}
      />
    </div>
  );
}
