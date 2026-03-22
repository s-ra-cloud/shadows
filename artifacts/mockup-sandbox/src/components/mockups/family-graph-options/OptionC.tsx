import './_group.css';

export function OptionC() {
  return (
    <div style={{
      width: '100%', height: '100vh', background: '#0B0626',
      fontFamily: "'Sofia Sans', sans-serif", color: '#E0D8F0',
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(143,0,255,0.3)',
        fontFamily: "'Cinzel Decorative', serif", fontSize: '14px',
        color: '#8F00FF', letterSpacing: '2px'
      }}>
        OPTION C — RELATIONSHIP SUB-FILTER
      </div>
      <div style={{ padding: '8px 20px', fontSize: '12px', color: '#8B7FA8', lineHeight: 1.6 }}>
        Checking "spouse" reveals a toggle: <span style={{ color: '#03FF9B' }}>"Show married-to connections"</span>.
        This replaces trait-based edges with direct family links for those figures.
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{
          width: '180px', borderRight: '1px solid rgba(143,0,255,0.2)',
          padding: '12px', fontSize: '11px', flexShrink: 0
        }}>
          <div style={{ color: '#8F00FF', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>FILTER FIGURES</div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#8B7FA8', fontSize: '9px', marginBottom: '4px' }}>GENDER</div>
            <div style={{ paddingLeft: '8px', color: '#E0D8F0', fontSize: '10px', lineHeight: 2 }}>
              ☑ Male<br />☑ Female
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#8B7FA8', fontSize: '9px', marginBottom: '4px' }}>FAMILY ROLES</div>
            <div style={{ paddingLeft: '8px', color: '#E0D8F0', fontSize: '10px', lineHeight: 2 }}>
              <span style={{ color: '#03FF9B' }}>☑ Spouse</span><br />
              <div style={{
                marginLeft: '12px', padding: '6px 8px', marginTop: '2px', marginBottom: '4px',
                background: 'rgba(3,255,155,0.08)', border: '1px solid rgba(3,255,155,0.3)',
                borderRadius: '4px', fontSize: '9px'
              }}>
                <div style={{ color: '#03FF9B', marginBottom: '3px' }}>Connection mode:</div>
                <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                  <span style={{ color: '#8B7FA8' }}>○ Shared traits</span>
                  <span style={{ color: '#03FF9B' }}>● Married-to links</span>
                </div>
              </div>
              ☐ Father<br />☐ Mother<br />☐ Brother
            </div>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg viewBox="0 0 500 420" style={{ width: '100%', height: '100%' }}>
            <line x1="130" y1="140" x2="350" y2="100" stroke="#FF69B4" strokeWidth="3" strokeDasharray="8,4" />
            <text x="240" y="108" fill="#FF69B4" fontSize="9" textAnchor="middle">married to</text>
            <line x1="350" y1="100" x2="350" y2="300" stroke="#2A1F4E" strokeWidth="1" opacity="0.3" />
            <line x1="130" y1="140" x2="350" y2="300" stroke="#2A1F4E" strokeWidth="1" opacity="0.3" />
            <line x1="130" y1="320" x2="350" y2="300" stroke="#2A1F4E" strokeWidth="1" opacity="0.3" />

            <circle cx="130" cy="140" r="30" fill="#1A1040" stroke="#FF69B4" strokeWidth="2.5" />
            <text x="130" y="136" textAnchor="middle" fill="#E0D8F0" fontSize="10" fontWeight="bold">Hera</text>
            <text x="130" y="150" textAnchor="middle" fill="#FF69B4" fontSize="7">spouse</text>

            <circle cx="350" cy="100" r="30" fill="#1A1040" stroke="#FF69B4" strokeWidth="2.5" />
            <text x="350" y="96" textAnchor="middle" fill="#E0D8F0" fontSize="10" fontWeight="bold">Zeus</text>
            <text x="350" y="110" textAnchor="middle" fill="#FF69B4" fontSize="7">spouse</text>

            <circle cx="350" cy="300" r="30" fill="#1A1040" stroke="#8B7FA8" strokeWidth="1" opacity="0.5" />
            <text x="350" y="296" textAnchor="middle" fill="#8B7FA8" fontSize="10">Athena</text>
            <text x="350" y="310" textAnchor="middle" fill="#8B7FA8" fontSize="7">not spouse</text>

            <circle cx="130" cy="320" r="30" fill="#1A1040" stroke="#8B7FA8" strokeWidth="1" opacity="0.5" />
            <text x="130" y="316" textAnchor="middle" fill="#8B7FA8" fontSize="10">Ares</text>
            <text x="130" y="330" textAnchor="middle" fill="#8B7FA8" fontSize="7">not spouse</text>

            <rect x="280" y="350" width="210" height="60" rx="6" fill="rgba(26,16,64,0.95)" stroke="rgba(143,0,255,0.3)" strokeWidth="1" />
            <text x="290" y="368" fill="#E0D8F0" fontSize="9">Mode: Relationship connections</text>
            <text x="290" y="385" fill="#8B7FA8" fontSize="8">Only "married to" edges shown</text>
            <text x="290" y="400" fill="#8B7FA8" fontSize="8">Trait edges hidden for clarity</text>
          </svg>
        </div>
      </div>
    </div>
  );
}
