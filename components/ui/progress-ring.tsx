interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  value,
  size = 176,
  strokeWidth = 8,
  label,
  children,
}: ProgressRingProps) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        aria-label={label}
        role="img"
      >
        <circle
          className="ring-track"
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        <circle
          className="ring-value"
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {children && <div className="ring-copy">{children}</div>}
    </div>
  );
}
