import { useMemo } from 'react';

// Lightweight pure-SVG line chart. No charting dependency — keeps the bundle
// lean and the rendering fully under our control for the terminal aesthetic.

type Series = { values: number[]; color: string; width?: number; dashed?: boolean };

export function LineChart({
  series, height = 240, yPad = 8, showZeroLine = false, zeroColor = '#3b4a66',
}: {
  series: Series[];
  height?: number;
  yPad?: number;
  showZeroLine?: boolean;
  zeroColor?: string;
}) {
  const { paths, w, h, minX, maxX, minY, maxY } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    if (all.length === 0) {
      return { paths: [], w: 1000, h: height, minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
    const len = Math.max(...series.map((s) => s.values.length));
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08;
    lo -= pad; hi += pad;
    const width = 1000;
    const x = (i: number) => (len <= 1 ? 0 : (i / (len - 1)) * width);
    const y = (v: number) => height - yPad - ((v - lo) / (hi - lo)) * (height - 2 * yPad);

    const paths = series.map((s) => {
      if (s.values.length === 0) return '';
      const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
      return d;
    });
    return { paths, w: width, h: height, minX: 0, maxX: len, minY: lo, maxY: hi };
  }, [series, height, yPad]);

  if (paths.length === 0 || paths.every((p) => p === '')) {
    return <div className="flex items-center justify-center text-sm text-slate-600" style={{ height }}>No data</div>;
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {showZeroLine && (
        <line
          x1={0} x2={w}
          y1={height - yPad - ((0 - minY) / (maxY - minY || 1)) * (height - 2 * yPad)}
          y2={height - yPad - ((0 - minY) / (maxY - minY || 1)) * (height - 2 * yPad)}
          stroke={zeroColor} strokeWidth={1} strokeDasharray="4 4"
        />
      )}
      {series.map((s, i) => (
        <path
          key={i}
          d={paths[i]}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? 1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={s.dashed ? '5 4' : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
