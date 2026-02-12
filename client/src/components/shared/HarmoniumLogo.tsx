export function HarmoniumLogo({
  size = 80,
  className = '',
  animate = false,
}: {
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Harmonium"
    >
      {animate && (
        <>
          <defs>
            <filter id="h-glow-blur">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>
          <style>{`
            /* Source dots scale in */
            .h-dot {
              transform-box: fill-box;
              transform-origin: center;
              animation: h-dot-in 0.35s ease-out both;
            }
            .h-dot-r { animation-delay: 0.06s; }

            @keyframes h-dot-in {
              from { transform: scale(0); opacity: 0; }
              to   { transform: scale(1); opacity: 1; }
            }

            /* Arcs scale outward from their source dot */
            .h-arc-l { transform-origin: 24px 50px; }
            .h-arc-r { transform-origin: 76px 50px; }

            .h-arc {
              animation:
                h-emit 0.45s ease-out both,
                h-interfere 0.7s ease-in-out 1.1s both;
            }

            @keyframes h-emit {
              from { transform: scale(0); opacity: 0; }
              30%  { opacity: var(--o); }
              to   { transform: scale(1); opacity: var(--o); }
            }

            /* Constructive interference: arcs pulse bright then settle */
            @keyframes h-interfere {
              0%   { opacity: var(--o); }
              40%  { opacity: 1; }
              100% { opacity: var(--o); }
            }

            .h-a1l { --o: 1;   animation-delay: 0.15s, 1.1s; }
            .h-a2l { --o: 0.7; animation-delay: 0.35s, 1.1s; }
            .h-a3l { --o: 0.4; animation-delay: 0.55s, 1.1s; }
            .h-a1r { --o: 1;   animation-delay: 0.2s,  1.1s; }
            .h-a2r { --o: 0.7; animation-delay: 0.4s,  1.1s; }
            .h-a3r { --o: 0.4; animation-delay: 0.6s,  1.1s; }

            /* Center glow at point of interference */
            .h-glow {
              animation: h-glow-pulse 0.9s ease-in-out 1.05s both;
            }

            @keyframes h-glow-pulse {
              0%   { opacity: 0; }
              35%  { opacity: 0.2; }
              100% { opacity: 0; }
            }

            @media (prefers-reduced-motion: reduce) {
              .h-dot, .h-dot-r { animation: none; }
              .h-arc { animation: none; transform: none; opacity: var(--o); }
              .h-glow { animation: none; opacity: 0; }
            }
          `}</style>

          {/* Constructive-interference glow */}
          <circle
            cx="50"
            cy="50"
            r="18"
            fill="currentColor"
            filter="url(#h-glow-blur)"
            className="h-glow"
          />
        </>
      )}

      {/* Left wave source */}
      <circle
        cx="24"
        cy="50"
        r="3.5"
        fill="currentColor"
        className={animate ? 'h-dot' : undefined}
      />

      {/* Left emanating arcs */}
      <path
        d="M33 41 A11 11 0 0 1 33 59"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={animate ? 'h-arc h-arc-l h-a1l' : undefined}
      />
      <path
        d="M40 33 A19 19 0 0 1 40 67"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity={animate ? undefined : 0.7}
        className={animate ? 'h-arc h-arc-l h-a2l' : undefined}
      />
      <path
        d="M47 24 A28 28 0 0 1 47 76"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity={animate ? undefined : 0.4}
        className={animate ? 'h-arc h-arc-l h-a3l' : undefined}
      />

      {/* Right wave source */}
      <circle
        cx="76"
        cy="50"
        r="3.5"
        fill="currentColor"
        className={animate ? 'h-dot h-dot-r' : undefined}
      />

      {/* Right emanating arcs */}
      <path
        d="M67 41 A11 11 0 0 0 67 59"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={animate ? 'h-arc h-arc-r h-a1r' : undefined}
      />
      <path
        d="M60 33 A19 19 0 0 0 60 67"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity={animate ? undefined : 0.7}
        className={animate ? 'h-arc h-arc-r h-a2r' : undefined}
      />
      <path
        d="M53 24 A28 28 0 0 0 53 76"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity={animate ? undefined : 0.4}
        className={animate ? 'h-arc h-arc-r h-a3r' : undefined}
      />
    </svg>
  );
}
