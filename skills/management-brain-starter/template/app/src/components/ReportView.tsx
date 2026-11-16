import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Report, ReportBlock, ReportCell } from '../lib/reports';
import { LineChart } from './LineChart';

export function ReportView({ report }: { report: Report }) {
  return (
    <article className="report">
      <header>
        <h1>{report.title}</h1>
        <p className="muted">
          Created {new Date(report.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
        {report.description && <p className="report-description">{report.description}</p>}
      </header>
      {report.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
      {report.method && (
        <footer className="report-method">
          <h2>How this was measured</h2>
          <div className="markdown">
            <Markdown remarkPlugins={[remarkGfm]}>{report.method}</Markdown>
          </div>
        </footer>
      )}
    </article>
  );
}

function Block({ block }: { block: ReportBlock }) {
  switch (block.type) {
    case 'markdown':
      return (
        <div className="markdown">
          <Markdown remarkPlugins={[remarkGfm]}>{block.text}</Markdown>
        </div>
      );
    case 'stats':
      return (
        <div className="stat-row">
          {block.items.map((item) => (
            <div key={item.label} className="stat-tile">
              <span className="stat-label">{item.label}</span>
              <span className="stat-value">{item.value}</span>
              {item.detail && <span className="stat-detail">{item.detail}</span>}
            </div>
          ))}
        </div>
      );
    case 'bar':
      return <BarChart {...block} />;
    case 'line':
      return <LineChart {...block} />;
    case 'table':
      return <Table {...block} />;
  }
}

function niceMax(value: number): number {
  if (value <= 5) return Math.max(value, 1);
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => value / s <= 5) ?? magnitude * 10;
  return Math.ceil(value / step) * step;
}

function BarChart({ title, description, unit = '', data }: Extract<ReportBlock, { type: 'bar' }>) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f * 100) / 100);
  const activeDatum = active === null ? null : data[active];

  return (
    <figure className="bar-chart">
      <figcaption>
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
      </figcaption>
      <div className="bar-plot">
        <div className="bar-axis" aria-hidden="true">
          {[...ticks].reverse().map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="bar-area">
          <div className="bar-grid" aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} style={{ bottom: `${(tick / max) * 100}%` }} />
            ))}
          </div>
          <ul className="bars" onMouseLeave={() => setActive(null)}>
            {data.map((d, i) => (
              <li
                key={d.label}
                className={`bar-slot${active === i ? ' active' : ''}`}
                tabIndex={0}
                aria-label={`${d.label}: ${d.value} ${unit}${d.detail ? `. ${d.detail}` : ''}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <span className="bar" style={{ height: `${(d.value / max) * 100}%` }} />
              </li>
            ))}
          </ul>
          {activeDatum && active !== null && (
            <div
              className="bar-tooltip"
              role="status"
              style={{
                left: `${((active + 0.5) / data.length) * 100}%`,
                bottom: `${(activeDatum.value / max) * 100}%`,
              }}
            >
              <strong>{activeDatum.label}</strong>
              <span>
                {activeDatum.value} {unit}
              </span>
              {activeDatum.detail && <span className="muted">{activeDatum.detail}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="bar-labels" aria-hidden="true">
        {data.map((d, i) => (
          // Label every other bar when crowded so labels never collide.
          <span key={d.label}>{data.length > 12 && i % 2 === 1 ? '' : d.label}</span>
        ))}
      </div>
    </figure>
  );
}

function Cell({ cell }: { cell: ReportCell }) {
  if (typeof cell === 'object') {
    return (
      <a href={cell.href} target="_blank" rel="noreferrer">
        {cell.text}
      </a>
    );
  }
  return <>{cell}</>;
}

function Table({ title, columns, rows, collapsed }: Extract<ReportBlock, { type: 'table' }>) {
  const table = (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>
                  <Cell cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (collapsed) {
    return (
      <details className="report-section">
        <summary>
          {title} ({rows.length})
        </summary>
        {table}
      </details>
    );
  }
  return (
    <section className="report-section">
      <h2>{title}</h2>
      {table}
    </section>
  );
}
