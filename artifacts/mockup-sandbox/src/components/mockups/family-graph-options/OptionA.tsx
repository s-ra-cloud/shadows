import './_group.css';

export function OptionA() {
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
        OPTION A — HIGHLIGHT MATCHING EDGES
      </div>
      <div style={{ padding: '8px 20px', fontSize: '12px', color: '#8B7FA8', lineHeight: 1.6 }}>
        When you filter by a family role (e.g. "spouse"), all figures stay visible but the
        edges matching that relationship <span style={{ color: '#03FF9B' }}>glow in color</span>.
        Other trait-based edges remain dim.
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg viewBox="0 0 700 420" style={{ width: '100%', height: '100%' }}>
          <line x1="180" y1="120" x2="350" y2="80" stroke="#2A1F4E" strokeWidth="1.5" opacity="0.4" />
          <line x1="180" y1="120" x2="520" y2="200" stroke="#2A1F4E" strokeWidth="1.5" opacity="0.4" />
          <line x1="350" y1="80" x2="520" y2="200" stroke="#2A1F4E" strokeWidth="1.5" opacity="0.4" />
          <line x1="350" y1="80" x2="350" y2="280" stroke="#2A1F4E" strokeWidth="1.5" opacity="0.4" />
          <line x1="520" y1="200" x2="350" y2="280" stroke="#2A1F4E" strokeWidth="1.5" opacity="0.4" />
          <line x1="520" y1="200" x2="520" y2="350" stroke="#2A1F4E" strokeWidth="1.5" opacity="0.4" />

          <line x1="180" y1="120" x2="350" y2="80" stroke="#FF69B4" strokeWidth="3" opacity="0.9">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="520" y1="200" x2="520" y2="350" stroke="#FF69B4" strokeWidth="3" opacity="0.9">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
          </line>

          <circle cx="180" cy="120" r="28" fill="#1A1040" stroke="#FF69B4" strokeWidth="2.5" />
          <text x="180" y="116" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Hera</text>
          <text x="180" y="128" textAnchor="middle" fill="#FF69B4" fontSize="7">♀ spouse</text>

          <circle cx="350" cy="80" r="28" fill="#1A1040" stroke="#FF69B4" strokeWidth="2.5" />
          <text x="350" y="76" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Zeus</text>
          <text x="350" y="88" textAnchor="middle" fill="#FF69B4" fontSize="7">♂ spouse</text>

          <circle cx="520" cy="200" r="28" fill="#1A1040" stroke="#8B7FA8" strokeWidth="1.5" />
          <text x="520" y="196" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Athena</text>
          <text x="520" y="208" textAnchor="middle" fill="#8B7FA8" fontSize="7">♀</text>

          <circle cx="350" cy="280" r="28" fill="#1A1040" stroke="#8B7FA8" strokeWidth="1.5" />
          <text x="350" y="276" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Apollo</text>
          <text x="350" y="288" textAnchor="middle" fill="#8B7FA8" fontSize="7">♂</text>

          <circle cx="520" cy="350" r="28" fill="#1A1040" stroke="#FF69B4" strokeWidth="2.5" />
          <text x="520" y="346" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Amphitrite</text>
          <text x="520" y="358" textAnchor="middle" fill="#FF69B4" fontSize="7">♀ spouse</text>

          <circle cx="180" cy="300" r="28" fill="#1A1040" stroke="#8B7FA8" strokeWidth="1.5" />
          <text x="180" y="296" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Ares</text>
          <text x="180" y="308" textAnchor="middle" fill="#8B7FA8" fontSize="7">♂</text>

          <rect x="12" y="340" width="160" height="70" rx="6" fill="rgba(26,16,64,0.9)" stroke="rgba(143,0,255,0.3)" strokeWidth="1" />
          <text x="22" y="358" fill="#8B7FA8" fontSize="9">Filter: Spouse ✓</text>
          <line x1="22" y1="375" x2="42" y2="375" stroke="#FF69B4" strokeWidth="3" />
          <text x="48" y="379" fill="#FF69B4" fontSize="9">married to</text>
          <line x1="22" y1="395" x2="42" y2="395" stroke="#2A1F4E" strokeWidth="1.5" />
          <text x="48" y="399" fill="#8B7FA8" fontSize="9">other traits (dim)</text>
        </svg>
      </div>
    </div>
  );
}
