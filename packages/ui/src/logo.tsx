/**
 * The One Accord mark, "Gathered": twelve strokes in a ring around a flame.
 * Acts 2:1-3 — the disciples all with one accord in one place, and the fire
 * that fell on them. The twelve strokes are the people; the flame is the
 * presence they gathered for.
 *
 * Drawn inline rather than loaded as a file so one component serves both
 * themes: the ring and the wordmark take the theme's ink, and the tagline
 * goes muted on Day and gold on Night, as BRAND.md asks. The flame keeps its
 * own colours in every city and is never recoloured.
 */

/** Twelve strokes, every 30 degrees. */
const STROKES = Array.from({ length: 12 }, (_, i) => i * 30);

function Gathered() {
  return (
    <>
      {STROKES.map((angle) => (
        <rect
          key={angle}
          x="46.5"
          y="4"
          width="7"
          height="17"
          rx="2"
          fill="var(--oa-ink)"
          transform={`rotate(${angle} 50 50)`}
        />
      ))}
      <path
        d="M50 28 C58 39 65 47 65 58 A15 15 0 0 1 35 58 C35 47 42 39 50 28 Z"
        fill="var(--oa-fire)"
      />
      <path
        d="M50 45 C54 50 57 54 57 59 A7 7 0 0 1 43 59 C43 54 46 50 50 45 Z"
        fill="var(--oa-gold)"
      />
    </>
  );
}

export interface LogoProps {
  /** The lockup carries the words; the mark is the ring and flame alone. */
  variant?: 'lockup' | 'mark';
  /**
   * Width in pixels. BRAND.md: the horizontal lockup never below 140px, and
   * the full mark never below 32px.
   */
  width?: number;
  className?: string;
  title?: string;
}

export function Logo({
  variant = 'lockup',
  width = variant === 'lockup' ? 160 : 40,
  className,
  title = 'One Accord by Upper Room',
}: LogoProps) {
  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 100 100"
        width={width}
        height={width}
        role="img"
        aria-label={title}
        className={className}
      >
        <title>{title}</title>
        <Gathered />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 600 140"
      width={width}
      height={(width * 140) / 600}
      role="img"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <g transform="translate(6 10) scale(1.2)">
        <Gathered />
      </g>
      {/* Live text: Barlow Condensed ExtraBold Italic, as the wordmark. */}
      <text
        x="150"
        y="92"
        fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif"
        fontStyle="italic"
        fontWeight="800"
        fontSize="96"
        textLength="430"
        lengthAdjust="spacingAndGlyphs"
        fill="var(--oa-ink)"
      >
        ONE ACCORD
      </text>
      <text
        x="154"
        y="124"
        fontFamily="Archivo, Arial, sans-serif"
        fontWeight="800"
        letterSpacing="3.1"
        fontSize="14"
        fill="var(--oa-logo-tagline)"
      >
        BY UPPER ROOM
      </text>
    </svg>
  );
}
