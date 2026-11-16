import { useState } from 'react';
import type { ReportBlock } from '../lib/reports';
import { formatDay, toDay } from '../lib/dates';

type Props = Extract<ReportBlock, { type: 'line' }>;

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const step = value <= 10 ? 2 : value <= 25 ? 5 : 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

const VIEW_W = 1000;
const VIEW_H = 100;

export function LineChart({ title, description, unit = '', data, ranges = [] }: Props) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return null;

  // Each point sits at its period's midpoint; the x-domain spans the first period's start to the last one's end.
  const domainStart = toDay(data[0].start);
  const domainEnd = toDay(data[data.length - 1].end) + 1;
  const xFraction = (day: number) => (day - domainStart) / (domainEnd - domainStart);
  const pointX = data.map((d) => xFraction((toDay(d.start) + toDay(d.end) + 1) / 2));

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i);
  const yFraction = (value: number) => value / max;

  const points = data.map((d, i) => `${pointX[i] * VIEW_W},${VIEW_H - yFraction(d.value) * VIEW_H}`).join(' ');

  const visibleRanges = ranges
    .map((range) => ({
      ...range,
      from: Math.max(0, xFraction(toDay(range.start))),
      to: Math.min(1, xFraction(toDay(range.end) + 1)),
    }))
    .filter((range) => range.to > range.from);

  // Hover columns split the plot halfway between neighbouring points, so the target is wider than the dot.
  const hitBounds = pointX.map((x, i) => ({
    left: i === 0 ? 0 : (pointX[i - 1] + x) / 2,
    right: i === pointX.length - 1 ? 1 : (x + pointX[i + 1]) / 2,
  }));

  const activePoint = active === null ? null : data[active];
  const pct = (fraction: number) => `${fraction * 100}%`;

  return (
    <figure className="line-chart">
      <figcaption>
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
      </figcaption>

      <div className="line-ranges" aria-hidden="true">
        {visibleRanges.map((range, i) => (
          <span
            key={range.label}
            className={`line-range-label${i % 2 === 1 ? ' alt' : ''}`}
            style={{ left: pct(range.from), width: pct(range.to - range.from) }}
          >
            {range.label}
          </span>
        ))}
      </div>

      <div className="line-plot">
        <div className="bar-axis" aria-hidden="true">
          {[...ticks].reverse().map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="line-area" onMouseLeave={() => setActive(null)}>
          {visibleRanges.map((range, i) => (
            <div
              key={range.label}
              className={`line-range-band${i % 2 === 1 ? ' alt' : ''}`}
              style={{ left: pct(range.from), width: pct(range.to - range.from) }}
              aria-hidden="true"
            />
          ))}
          <div className="bar-grid" aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} style={{ bottom: pct(yFraction(tick)) }} />
            ))}
          </div>
          {visibleRanges
            .filter((range) => range.from > 0)
            .map((range) => (
              <div key={range.label} className="line-boundary" style={{ left: pct(range.from) }} aria-hidden="true" />
            ))}

          <svg className="line-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden="true">
            <polyline points={points} fill="none" stroke="var(--chart-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>

          {active !== null && <div className="line-crosshair" style={{ left: pct(pointX[active]) }} aria-hidden="true" />}

          {data.map((d, i) => (
            <span
              key={d.start}
              className={`line-dot${active === i ? ' active' : ''}`}
              style={{ left: pct(pointX[i]), bottom: pct(yFraction(d.value)) }}
              aria-hidden="true"
            />
          ))}

          <ul className="line-hits">
            {data.map((d, i) => (
              <li
                key={d.start}
                tabIndex={0}
                style={{ left: pct(hitBounds[i].left), width: pct(hitBounds[i].right - hitBounds[i].left) }}
                aria-label={`${d.label}: ${d.value} ${unit}${d.detail ? `. ${d.detail}` : ''}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            ))}
          </ul>

          {activePoint && active !== null && (
            <div
              className={`bar-tooltip line-tooltip${pointX[active] > 0.8 ? ' flip' : ''}`}
              role="status"
              style={{ left: pct(pointX[active]), bottom: pct(yFraction(activePoint.value)) }}
            >
              <strong>{activePoint.label}</strong>
              <span>
                {activePoint.value} {unit}
              </span>
              {activePoint.detail && <span className="muted">{activePoint.detail}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="line-labels" aria-hidden="true">
        {data.map((d, i) =>
          // Label every other point when crowded so labels never collide.
          data.length > 12 && i % 2 === 1 ? null : (
            <span key={d.start} style={{ left: pct(pointX[i]) }}>
              {formatDay(toDay(d.start))}
            </span>
          ),
        )}
      </div>
    </figure>
  );
}
