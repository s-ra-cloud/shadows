import './_group.css';

export function OptionD() {
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
        OPTION D — DUAL-LAYER GRAPH
      </div>
      <div style={{ padding: '8px 20px', fontSize: '12px', color: '#8B7FA8', lineHeight: 1.6 }}>
        Two layers visible at once: <span style={{ color: '#8B7FA8' }}>thin trait edges</span> (what figures share) +{' '}
        <span style={{ color: '#FF69B4' }}>thick family edges</span> (how they're related).
        See overlap between traits and kinship.
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg viewBox="0 0 700 420" style={{ width: '100%', height: '100%' }}>
          <line x1="170" y1="130" x2="350" y2="90" stroke="#2A1F4E" strokeWidth="1" opacity="0.5" />
          <line x1="170" y1="130" x2="520" y2="160" stroke="#2A1F4E" strokeWidth="1" opacity="0.5" />
          <line x1="350" y1="90" x2="520" y2="160" stroke="#2A1F4E" strokeWidth="1" opacity="0.5" />
          <line x1="350" y1="90" x2="350" y2="270" stroke="#2A1F4E" strokeWidth="1" opacity="0.5" />
          <line x1="350" y1="90" x2="170" y2="280" stroke="#2A1F4E" strokeWidth="1" opacity="0.5" />
          <line x1="520" y1="160" x2="350" y2="270" stroke="#2A1F4E" strokeWidth="1" opacity="0.5" />
          <line x1="520" y1="160" x2="520" y2="330" stroke="#2A1F4E" strokeWidth="1" opacity="0.5" />
          <line x1="170" y1="280" x2="350" y2="270" stroke="#2A1F4E" strokeWidth="1" opacity="0.5" />
          <line x1="350" y1="270" x2="520" y2="330" stroke="#2A1F4E" strokeWidth="1" opacity="0.5" />
          <line x1="120" y1="370" x2="170" y2="280" stroke="#2A1F4E" strokeWidth="1" opacity="0.5" />

          <line x1="170" y1="130" x2="350" y2="90" stroke="#FF69B4" strokeWidth="3.5" opacity="0.85" />
          <line x1="520" y1="160" x2="520" y2="330" stroke="#FF69B4" strokeWidth="3.5" opacity="0.85" />
          <line x1="350" y1="90" x2="350" y2="270" stroke="#FFD700" strokeWidth="3.5" opacity="0.85" />
          <line x1="350" y1="90" x2="170" y2="280" stroke="#FFD700" strokeWidth="3.5" opacity="0.85" />
          <line x1="170" y1="280" x2="350" y2="270" stroke="#4DA6FF" strokeWidth="3.5" opacity="0.85" />
          <line x1="170" y1="280" x2="120" y2="370" stroke="#00CED1" strokeWidth="3.5" opacity="0.85" />

          <circle cx="170" cy="130" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="170" y="126" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Hera</text>
          <text x="170" y="138" textAnchor="middle" fill="#8B7FA8" fontSize="7">♀</text>

          <circle cx="350" cy="90" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="350" y="86" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Zeus</text>
          <text x="350" y="98" textAnchor="middle" fill="#8B7FA8" fontSize="7">♂</text>

          <circle cx="520" cy="160" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="520" y="156" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Poseidon</text>
          <text x="520" y="168" textAnchor="middle" fill="#8B7FA8" fontSize="7">♂</text>

          <circle cx="350" cy="270" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="350" y="266" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Athena</text>
          <text x="350" y="278" textAnchor="middle" fill="#8B7FA8" fontSize="7">♀</text>

          <circle cx="170" cy="280" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="170" y="276" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Ares</text>
          <text x="170" y="288" textAnchor="middle" fill="#8B7FA8" fontSize="7">♂</text>

          <circle cx="520" cy="330" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="520" y="326" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Amphitrite</text>
          <text x="520" y="338" textAnchor="middle" fill="#8B7FA8" fontSize="7">♀</text>

          <circle cx="120" cy="370" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="120" y="366" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Phobos</text>
          <text x="120" y="378" textAnchor="middle" fill="#8B7FA8" fontSize="7">♂</text>

          <rect x="460" y="355" width="230" height="60" rx="6" fill="rgba(26,16,64,0.95)" stroke="rgba(143,0,255,0.3)" strokeWidth="1" />
          <text x="470" y="372" fill="#E0D8F0" fontSize="9" fontWeight="bold">Dual Layer</text>
          <line x1="470" y1="385" x2="490" y2="385" stroke="#2A1F4E" strokeWidth="1" />
          <text x="496" y="389" fill="#8B7FA8" fontSize="8">trait connections (thin)</text>
          <line x1="470" y1="402" x2="490" y2="402" stroke="#FF69B4" strokeWidth="3" />
          <text x="496" y="406" fill="#E0D8F0" fontSize="8">family relations (thick, colored)</text>
        </svg>
      </div>
    </div>
  );
}
