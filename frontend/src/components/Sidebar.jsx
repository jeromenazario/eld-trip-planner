import React, { useState } from 'react';
import { Truck, LayoutDashboard, Plus, History, Grid, Settings, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { DashedLine } from './ui';

const NAV = [
  { key: 'dashboard', label: 'Dashboard',    Icon: LayoutDashboard },
  { key: 'newtrip',   label: 'New Trip',      Icon: Plus },
  { key: 'history',   label: 'Trip History',  Icon: History },
  { key: 'logs',      label: 'Log Sheets',    Icon: Grid },
  { key: 'settings',  label: 'Settings',      Icon: Settings },
];

function NavItem({ Icon, label, active, collapsed, onClick }) {
  const [h, setH] = useState(false);
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <button
        onClick={onClick}
        aria-label={label}
        style={{
          display: 'flex', alignItems: 'center', gap: 13, width: '100%', height: 46,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 14px',
          borderRadius: 14, border: 'none', textAlign: 'left',
          background: active ? 'var(--accent)' : h ? '#f3f3f2' : 'transparent',
          color: active ? '#fff' : h ? 'var(--text)' : 'var(--muted)',
          fontWeight: active ? 600 : 500, fontSize: 14,
          transition: 'all .15s ease', cursor: 'pointer',
          boxShadow: active ? '0 4px 12px rgba(45,90,61,.28)' : 'none',
        }}
      >
        <Icon size={20} strokeWidth={active ? 2 : 1.8} />
        {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
      </button>

      {collapsed && h && (
        <span style={{
          position: 'absolute', left: 'calc(100% + 16px)', top: '50%',
          background: '#17191c', color: '#fff', fontSize: 12.5, fontWeight: 500,
          padding: '6px 11px', borderRadius: 9, whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 60,
          transform: 'translateY(-50%)',
          boxShadow: '0 6px 20px rgba(0,0,0,.25)',
        }}>
          <span style={{
            position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)',
            borderTop: '5px solid transparent', borderBottom: '5px solid transparent',
            borderRight: '5px solid #17191c',
          }} />
          {label}
        </span>
      )}
    </div>
  );
}

export default function Sidebar({ activePage, onNavigate, driver = 'John Doe', collapsed, setCollapsed, mobile = false, onClose }) {
  const W = collapsed ? 84 : 250;
  const initials = driver.split(' ').map(w => w[0]).slice(0, 2).join('');

  return (
    <aside style={{
      width: W, minWidth: W, margin: 14, borderRadius: 24,
      background: 'var(--card)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width .22s cubic-bezier(.4,0,.2,1)',
      position: 'relative', zIndex: 5,
      boxShadow: '0 10px 30px rgba(20,22,26,.06), var(--shadow)',
      flexShrink: 0,
      height: 'calc(100vh - 28px)',
    }}>

      {/* Brand */}
      <div style={{
        height: 72, display: 'flex', alignItems: 'center', gap: 12,
        padding: collapsed ? 0 : '0 18px', justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 13, background: 'var(--accent)', color: '#fff',
          display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 3px 8px rgba(45,90,61,.3)',
        }}>
          <Truck size={22} strokeWidth={1.8} />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>ELD Planner</div>
            <div style={{ fontSize: 11, color: 'var(--label)', whiteSpace: 'nowrap' }}>Hours of Service</div>
          </div>
        )}
        {mobile && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', display: 'grid', placeItems: 'center', color: 'var(--muted)', cursor: 'pointer' }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        )}
      </div>

      <div style={{ padding: collapsed ? '0 24px' : '0 18px' }}>
        <DashedLine color="var(--border-strong)" dash={5} gap={5} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {!collapsed && (
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--label)', letterSpacing: '.07em', textTransform: 'uppercase', padding: '4px 14px 8px' }}>
            Menu
          </div>
        )}
        {NAV.map(n => (
          <NavItem key={n.key} Icon={n.Icon} label={n.label}
            active={activePage === n.key} collapsed={collapsed}
            onClick={() => onNavigate(n.key)} />
        ))}
      </nav>

      {/* Collapse toggle — desktop only (mobile uses the drawer close button) */}
      {!mobile && (
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label="Toggle menu"
          style={{
            position: 'absolute', top: 76, right: -13, width: 26, height: 26,
            borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--border)',
            display: 'grid', placeItems: 'center', color: 'var(--muted)',
            boxShadow: 'var(--shadow)', cursor: 'pointer', zIndex: 6,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}

      <div style={{ padding: collapsed ? '0 24px' : '0 18px' }}>
        <DashedLine color="var(--border-strong)" dash={5} gap={5} />
      </div>

      {/* User */}
      <div style={{ padding: 12 }}>
        <button
          onClick={() => onNavigate('profile')}
          style={{
            display: 'flex', alignItems: 'center', gap: 11, width: '100%',
            padding: collapsed ? 0 : '8px', borderRadius: 14,
            justifyContent: collapsed ? 'center' : 'flex-start',
            border: 'none', background: activePage === 'profile' ? 'var(--accent-tint)' : 'transparent',
            cursor: 'pointer', transition: 'background .15s ease',
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#3a6b4c,#264e34)', color: '#fff',
            display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 14,
          }}>
            {initials}
          </div>
          {!collapsed && (
            <>
              <div style={{ overflow: 'hidden', textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{driver}</div>
                <div style={{ fontSize: 11.5, color: 'var(--label)', whiteSpace: 'nowrap' }}>Class A CDL</div>
              </div>
              <ChevronRight size={15} color="var(--label)" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
