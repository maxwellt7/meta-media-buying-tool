import { getHealthColor, getHealthLabel } from '../utils/normalize';

/**
 * Circular health gauge showing 0-100 score with color coding.
 */
export default function HealthGauge({ score, size = 140, label = 'Account Health' }) {
  const color = getHealthColor(score);
  const statusLabel = getHealthLabel(score);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out, stroke 0.3s' }}
        />
      </svg>
      {/* Score text overlay */}
      <div className="flex flex-col items-center -mt-[calc(50%+16px)]" style={{ marginTop: `-${size / 2 + 16}px` }}>
        <div className="text-3xl font-bold tabular-nums" style={{ color, marginTop: `${size / 2 - 20}px` }}>
          {score}
        </div>
        <div className="text-[10px] tracking-widest uppercase mt-1" style={{ color }}>
          {statusLabel}
        </div>
      </div>
      <div className="text-xs text-[var(--color-text-muted)] mt-3 tracking-wider uppercase">{label}</div>
    </div>
  );
}
