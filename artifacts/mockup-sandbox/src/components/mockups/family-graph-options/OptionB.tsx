import './_group.css';

export function OptionB() {
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
        OPTION B — COLOR-CODED EDGE LEGEND (ALWAYS ON)
      </div>
      <div style={{ padding: '8px 20px', fontSize: '12px', color: '#8B7FA8', lineHeight: 1.6 }}>
        All relationship edges always have <span style={{ color: '#E0D8F0' }}>distinct colors by type</span>.
        A legend shows the color code. Toggle each type on/off in the sidebar.
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg viewBox="0 0 700 420" style={{ width: '100%', height: '100%' }}>
          <line x1="180" y1="130" x2="350" y2="90" stroke="#FF69B4" strokeWidth="2.5" />
          <line x1="350" y1="90" x2="520" y2="130" stroke="#FFD700" strokeWidth="2.5" />
          <line x1="350" y1="90" x2="350" y2="260" stroke="#FFD700" strokeWidth="2.5" />
          <line x1="350" y1="90" x2="180" y2="260" stroke="#FFD700" strokeWidth="2.5" />
          <line x1="350" y1="260" x2="180" y2="260" stroke="#4DA6FF" strokeWidth="2.5" />
          <line x1="520" y1="130" x2="520" y2="310" stroke="#FF69B4" strokeWidth="2.5" />
          <line x1="350" y1="260" x2="520" y2="310" stroke="#4DA6FF" strokeWidth="2.5" />
          <line x1="180" y1="260" x2="120" y2="370" stroke="#00CED1" strokeWidth="2.5" />

          <text x="255" y="100" fill="#FF69B4" fontSize="8" opacity="0.8">married to</text>
          <text x="380" y="80" fill="#FFD700" fontSize="8" opacity="0.8">parent of</text>
          <text x="260" y="268" fill="#4DA6FF" fontSize="8" opacity="0.8">sibling of</text>
          <text x="528" y="225" fill="#FF69B4" fontSize="8" opacity="0.8">married to</text>

          <circle cx="180" cy="130" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="180" y="126" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Hera</text>
          <text x="180" y="138" textAnchor="middle" fill="#8B7FA8" fontSize="7">♀</text>

          <circle cx="350" cy="90" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="350" y="86" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Zeus</text>
          <text x="350" y="98" textAnchor="middle" fill="#8B7FA8" fontSize="7">♂</text>

          <circle cx="520" cy="130" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="520" y="126" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Poseidon</text>
          <text x="520" y="138" textAnchor="middle" fill="#8B7FA8" fontSize="7">♂</text>

          <circle cx="350" cy="260" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="350" y="256" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Athena</text>
          <text x="350" y="268" textAnchor="middle" fill="#8B7FA8" fontSize="7">♀</text>

          <circle cx="180" cy="260" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="180" y="256" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Ares</text>
          <text x="180" y="268" textAnchor="middle" fill="#8B7FA8" fontSize="7">♂</text>

          <circle cx="520" cy="310" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="520" y="306" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Amphitrite</text>
          <text x="520" y="318" textAnchor="middle" fill="#8B7FA8" fontSize="7">♀</text>

          <circle cx="120" cy="370" r="28" fill="#1A1040" stroke="#E0D8F0" strokeWidth="1.5" />
          <text x="120" y="366" textAnchor="middle" fill="#E0D8F0" fontSize="9" fontWeight="bold">Phobos</text>
          <text x="120" y="378" textAnchor="middle" fill="#8B7FA8" fontSize="7">♂</text>

          <rect x="500" y="350" width="190" height="65" rx="6" fill="rgba(26,16,64,0.95)" stroke="rgba(143,0,255,0.3)" strokeWidth="1" />
          <text x="510" y="368" fill="#E0D8F0" fontSize="9" fontWeight="bold">Relationship Types</text>
          <line x1="510" y1="380" x2="530" y2="380" stroke="#FF69B4" strokeWidth="2.5" />
          <text x="536" y="384" fill="#FF69B4" fontSize="8">married to</text>
          <line x1="600" y1="380" x2="620" y2="380" stroke="#FFD700" strokeWidth="2.5" />
          <text x="626" y="384" fill="#FFD700" fontSize="8">parent of</text>
          <line x1="510" y1="400" x2="530" y2="400" stroke="#4DA6FF" strokeWidth="2.5" />
          <text x="536" y="404" fill="#4DA6FF" fontSize="8">sibling of</text>
          <line x1="600" y1="400" x2="620" y2="400" stroke="#00CED1" strokeWidth="2.5" />
          <text x="626" y="404" fill="#00CED1" fontSize="8">child of</text>
        </svg>
      </div>
    </div>
  );
}
