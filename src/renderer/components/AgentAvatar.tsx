interface Props {
  running: boolean
}

export default function AgentAvatar({ running }: Props) {
  return (
    <div className="shrink-0 mt-0.5">
      <svg viewBox="0 0 80 60" width="40" height="30" className={running ? 'agent-lobster' : ''} fill="none">
      {/* Body */}
      <ellipse cx="40" cy="38" rx="22" ry="14" className="al-body" fill="#dc2626" />
      {/* Tail */}
      <path d="M18 38 Q8 30 4 22 Q6 28 12 34" className="al-tail" fill="#b91c1c" />
      <path d="M18 42 Q8 48 4 56 Q6 48 12 42" className="al-tail" fill="#b91c1c" />
      {/* Head */}
      <ellipse cx="58" cy="36" rx="10" ry="11" className="al-head" fill="#ef4444" />
      {/* Left claw */}
      <g className="al-claw-l">
        <path d="M26 30 Q18 20 10 18 Q14 22 16 26 Q12 22 6 22 Q14 26 18 30" fill="#dc2626" />
      </g>
      {/* Right claws */}
      <g className="al-claw-r">
        <path d="M26 46 Q18 54 10 56 Q14 52 16 48 Q12 52 6 52 Q14 48 18 44" fill="#dc2626" />
      </g>
      {/* Legs */}
      <g className="al-legs">
        <line x1="28" y1="36" x2="18" y2="40" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" className="al-leg" />
        <line x1="30" y1="40" x2="20" y2="46" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" className="al-leg" />
        <line x1="34" y1="42" x2="24" y2="50" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" className="al-leg" />
        <line x1="44" y1="42" x2="52" y2="50" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" className="al-leg" />
        <line x1="48" y1="40" x2="56" y2="46" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" className="al-leg" />
        <line x1="50" y1="36" x2="58" y2="40" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" className="al-leg" />
      </g>
      {/* Eyes */}
      <circle cx="62" cy="32" r="2.5" fill="white" className="al-eye" />
      <circle cx="62" cy="32" r="1.2" fill="#1a1a2e" className="al-eye" />
      <circle cx="66" cy="30" r="2.5" fill="white" className="al-eye" />
      <circle cx="66" cy="30" r="1.2" fill="#1a1a2e" className="al-eye" />
      {/* Antennae */}
      <path d="M66 26 Q72 16 76 10" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" className="al-antenna-l" />
      <path d="M68 28 Q76 22 80 18" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" className="al-antenna-r" />
      <style>{AgentAvatarStyles}</style>
    </svg>
    </div>
  )
}

const AgentAvatarStyles = `
  .agent-lobster {
    animation: al-breathe 2s ease-in-out infinite;
  }
  @keyframes al-breathe {
    0%, 100% { transform: scale(1) translateY(0); }
    50% { transform: scale(1.06) translateY(-0.5px); }
  }
  .al-claw-l {
    animation: al-claw-l 1.2s ease-in-out infinite;
    transform-origin: 26px 30px;
  }
  @keyframes al-claw-l {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-10deg); }
  }
  .al-claw-r {
    animation: al-claw-r 1.2s ease-in-out infinite 0.3s;
    transform-origin: 26px 46px;
  }
  @keyframes al-claw-r {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(10deg); }
  }
  .al-legs .al-leg:nth-child(odd) {
    animation: al-leg-l 0.6s ease-in-out infinite;
  }
  .al-legs .al-leg:nth-child(even) {
    animation: al-leg-r 0.6s ease-in-out infinite 0.3s;
  }
  @keyframes al-leg-l {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-8deg); }
  }
  @keyframes al-leg-r {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(8deg); }
  }
  .al-eye {
    animation: al-blink 3s ease-in-out infinite;
  }
  @keyframes al-blink {
    0%, 42%, 48%, 100% { transform: scaleY(1); }
    45% { transform: scaleY(0.1); }
  }
`
