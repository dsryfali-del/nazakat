import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type CandlestickData,
  type LineData,
  type Time,
} from 'lightweight-charts';
import type { Candle } from '@/lib/types';

// Candlestick chart built on lightweight-charts (v4). Supports optional EMA
// overlay lines and fits the terminal aesthetic. The chart auto-resizes to
// its container and cleans up on unmount.

type Overlay = { values: number[]; color: string; title: string };

export function CandlestickChart({
  candles,
  overlays = [],
  height = 320,
  decimals = 2,
}: {
  candles: Candle[];
  overlays?: Overlay[];
  height?: number;
  decimals?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const overlaySeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  // Create / destroy the chart instance once.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(45,58,82,0.25)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(45,58,82,0.25)', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3b4a66', labelBackgroundColor: '#1b2435' },
        horzLine: { color: '#3b4a66', labelBackgroundColor: '#1b2435' },
      },
      rightPriceScale: {
        borderColor: 'rgba(45,58,82,0.5)',
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: 'rgba(45,58,82,0.5)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#14b8a6',
      downColor: '#f43f5e',
      wickUpColor: '#14b8a6',
      wickDownColor: '#f43f5e',
      borderVisible: false,
      priceFormat: { type: 'price', precision: decimals, minMove: 1 / Math.pow(10, decimals) },
    });
    candleSeriesRef.current = candleSeries;

    // Resize observer to make the chart responsive.
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      overlaySeriesRef.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update candle data when candles change.
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    // Deduplicate by time (lightweight-charts requires strictly ascending unique times).
    const seen = new Set<number>();
    const data: CandlestickData<Time>[] = [];
    for (const c of candles) {
      const t = Math.floor(c.time / 1000) as UTCTimestamp;
      if (seen.has(t)) continue;
      seen.add(t);
      data.push({ time: t, open: c.open, high: c.high, low: c.low, close: c.close });
    }
    candleSeriesRef.current.setData(data);

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles]);

  // Update overlays (EMA lines) when they change.
  useEffect(() => {
    if (!chartRef.current) return;

    // Remove old overlay series.
    for (const s of overlaySeriesRef.current) {
      chartRef.current.removeSeries(s);
    }
    overlaySeriesRef.current = [];

    // Add new overlay series.
    for (const ov of overlays) {
      if (ov.values.length === 0) continue;

      const lineSeries = chartRef.current.addLineSeries({
        color: ov.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      const seen = new Set<number>();
      const lineData: LineData<Time>[] = [];
      for (let i = 0; i < ov.values.length; i++) {
        const c = candles[i];
        if (!c) continue;
        const t = Math.floor(c.time / 1000) as UTCTimestamp;
        if (seen.has(t)) continue;
        seen.add(t);
        const v = ov.values[i];
        if (isFinite(v)) lineData.push({ time: t, value: v });
      }
      lineSeries.setData(lineData);
      overlaySeriesRef.current.push(lineSeries);
    }
  }, [overlays, candles]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
