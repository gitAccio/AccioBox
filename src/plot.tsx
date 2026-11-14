import {useEffect, useMemo, useRef, useState} from 'react'
import type {Study} from './engine'

export type Curve = {kind: 'fn'; fn: (x: number) => number; color: string; label: string} | {kind: 'param'; fx: (t: number) => number; fy: (t: number) => number; t0: number; t1: number; color: string; label: string}
export type Mark = {x: number; y: number; c: string}
type View = {x0: number; x1: number; y0: number; y1: number}
const nice = (span: number, n = 6) => { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p }
const tfmt = (t: number) => String(Number(t.toPrecision(6)))
const zoomAt = (vw: View, ax: number, ay: number, k: number): View => {
  const sx = (vw.x1 - vw.x0) * k, sy = (vw.y1 - vw.y0) * k; if (!(sx > 1e-6 && sx < 1e7 && sy > 1e-6 && sy < 1e7)) return vw
  const fx = (ax - vw.x0) / (vw.x1 - vw.x0), fy = (ay - vw.y0) / (vw.y1 - vw.y0)
  return {x0: ax - fx * sx, x1: ax - fx * sx + sx, y0: ay - fy * sy, y1: ay - fy * sy + sy}
}
/** Vista iniziale che contiene le curve (percentili per ignorare i poli). */
export function fitCurves(cs: Curve[], hint: number[]): View {
  const pxs: number[] = [], ys: number[] = [], hasFn = cs.some(c => c.kind === 'fn')
  for (const c of cs) if (c.kind === 'param') for (let i = 0; i <= 400; i++) { const t = c.t0 + (c.t1 - c.t0) * i / 400, X = c.fx(t), Y = c.fy(t); if (isFinite(X) && isFinite(Y)) { pxs.push(X); ys.push(Y) } }
  let x0 = -5, x1 = 5
  if (hasFn) { x0 = Math.max(-100, Math.min(-5, ...hint.map(x => x - 1))); x1 = Math.min(100, Math.max(5, ...hint.map(x => x + 1))); if (pxs.length) { x0 = Math.min(x0, ...pxs); x1 = Math.max(x1, ...pxs) } }
  else if (pxs.length) { x0 = Math.min(...pxs); x1 = Math.max(...pxs); const p = (x1 - x0) * 0.12 || 1; x0 -= p; x1 += p }
  for (const c of cs) if (c.kind === 'fn') for (let i = 0; i <= 400; i++) { const y = c.fn(x0 + (x1 - x0) * i / 400); if (isFinite(y)) ys.push(y) }
  ys.sort((a, b) => a - b); const n = ys.length
  const lo = n ? ys[hasFn ? Math.floor(n * 0.02) : 0] : -5, hi = n ? ys[hasFn ? Math.min(n - 1, Math.ceil(n * 0.98)) : n - 1] : 5, pad = (hi - lo) * 0.15 || 1
  return {x0, x1, y0: lo - pad, y1: hi + pad}
}
export function PlotView({curves, marks = [], hint = [], fitKey, xl = 'x', yl = 'y'}: {curves: Curve[]; marks?: Mark[]; hint?: number[]; fitKey: string | number; xl?: string; yl?: string}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [v, setV] = useState<View>(() => fitCurves(curves, hint)), vr = useRef(v); vr.current = v
  const [cur, setCur] = useState<{x: number; y: number} | null>(null)
  const ptrs = useRef(new Map<number, {x: number; y: number}>()), lastD = useRef(0)
  useEffect(() => { setV(fitCurves(curves, hint)) }, [fitKey]) // eslint-disable-line
  const toData = (cx: number, cy: number, vw: View) => { const r = ref.current!.getBoundingClientRect(); return {x: vw.x0 + (cx - r.left) / (r.width || 1) * (vw.x1 - vw.x0), y: vw.y1 - (cy - r.top) / (r.height || 1) * (vw.y1 - vw.y0)} }
  useEffect(() => { const c = ref.current!; const h = (e: WheelEvent) => { e.preventDefault(); const p = toData(e.clientX, e.clientY, vr.current); setV(zoomAt(vr.current, p.x, p.y, Math.exp(e.deltaY * 0.0015))) }
    c.addEventListener('wheel', h, {passive: false}); return () => c.removeEventListener('wheel', h) }, [])
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d'); if (!g) return
    const W = c.width, H = c.height, cs = getComputedStyle(c), col = (n: string) => cs.getPropertyValue(n.startsWith('--') ? n : '--fg').trim() || '#888'
    const X = (x: number) => (x - v.x0) / (v.x1 - v.x0) * W, Y = (y: number) => H - (y - v.y0) / (v.y1 - v.y0) * H, cl = (a: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, a))
    g.fillStyle = col('--card'); g.fillRect(0, 0, W, H); g.font = '12px ui-monospace, Menlo, Consolas, monospace'
    const sx = nice(v.x1 - v.x0), sy = nice(v.y1 - v.y0), axY = cl(Y(0), 16, H - 6), axX = cl(X(0), 6, W - 50), k0x = Math.ceil(v.x0 / sx), k0y = Math.ceil(v.y0 / sy)
    g.lineWidth = 1
    for (let k = k0x; k <= Math.floor(v.x1 / sx) && k - k0x < 60; k++) { const px = X(k * sx); g.strokeStyle = col('--line'); g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke(); if (k !== 0) { g.fillStyle = col('--mut'); g.fillText(tfmt(k * sx), px + 3, axY + 15 < H - 2 ? axY + 15 : axY - 6) } }
    for (let k = k0y; k <= Math.floor(v.y1 / sy) && k - k0y < 60; k++) { const py = Y(k * sy); g.strokeStyle = col('--line'); g.beginPath(); g.moveTo(0, py); g.lineTo(W, py); g.stroke(); if (k !== 0) { g.fillStyle = col('--mut'); g.fillText(tfmt(k * sy), axX + 5, py - 3) } }
    g.strokeStyle = col('--mut'); g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, axY); g.lineTo(W, axY); g.moveTo(axX, 0); g.lineTo(axX, H); g.stroke()
    g.fillStyle = col('--fg'); g.fillText(xl, W - 14, axY - 6 < 12 ? axY + 16 : axY - 6); g.fillText(yl, axX + 8 > W - 40 ? axX - 20 : axX + 8, 14)
    g.lineWidth = 2.5; g.lineJoin = 'round'
    for (const c of curves) { g.strokeStyle = col(c.color); g.beginPath(); let prev: number | null = null
      if (c.kind === 'fn') for (let i = 0; i <= W; i++) { const y = c.fn(v.x0 + (v.x1 - v.x0) * i / W); if (!isFinite(y) || Math.abs(Y(y)) > 1e5) { prev = null; continue } const py = Y(y); if (prev === null || Math.abs(py - prev) > H * 3) g.moveTo(i, py); else g.lineTo(i, py); prev = py }
      else for (let i = 0; i <= 2000; i++) { const t = c.t0 + (c.t1 - c.t0) * i / 2000, px = X(c.fx(t)), py = Y(c.fy(t)); if (!isFinite(px) || !isFinite(py) || Math.abs(px) > 1e5 || Math.abs(py) > 1e5) { prev = null; continue } if (prev === null) g.moveTo(px, py); else g.lineTo(px, py); prev = 0 }
      g.stroke() }
    for (const m of marks) { if (!isFinite(m.y)) continue; g.fillStyle = col(m.c); g.beginPath(); g.arc(X(m.x), Y(m.y), 5, 0, 7); g.fill(); g.strokeStyle = col('--card'); g.lineWidth = 2; g.stroke() }
  }, [curves, marks, v, xl, yl])
  const center = (k: number) => setV(zoomAt(v, (v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, k))
  const single = curves.length === 1 && curves[0].kind === 'fn' ? curves[0] : null
  return <div><canvas ref={ref} width={800} height={480} className="plot"
    onPointerDown={e => { ptrs.current.set(e.pointerId, {x: e.clientX, y: e.clientY}); (e.target as Element).setPointerCapture?.(e.pointerId); if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; lastD.current = Math.hypot(a.x - b.x, a.y - b.y) } }}
    onPointerMove={e => { const p = toData(e.clientX, e.clientY, vr.current); setCur({x: p.x, y: single ? single.fn(p.x) : p.y})
      const prev = ptrs.current.get(e.pointerId); if (!prev) return; ptrs.current.set(e.pointerId, {x: e.clientX, y: e.clientY}); const r = ref.current!.getBoundingClientRect(), w = vr.current
      if (ptrs.current.size === 1) { const dx = (e.clientX - prev.x) / r.width * (w.x1 - w.x0), dy = (e.clientY - prev.y) / r.height * (w.y1 - w.y0); setV({x0: w.x0 - dx, x1: w.x1 - dx, y0: w.y0 + dy, y1: w.y1 + dy}) }
      else if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (lastD.current > 0 && d > 0) { const m = toData((a.x + b.x) / 2, (a.y + b.y) / 2, w); setV(zoomAt(w, m.x, m.y, lastD.current / d)) } lastD.current = d } }}
    onPointerUp={e => { ptrs.current.delete(e.pointerId); lastD.current = 0 }} onPointerCancel={e => { ptrs.current.delete(e.pointerId); lastD.current = 0 }} onPointerLeave={() => setCur(null)} />
    <div className="row wrap"><button onClick={() => center(0.7)}>＋</button><button onClick={() => center(1 / 0.7)}>－</button><button onClick={() => setV(fitCurves(curves, hint))}>⤢ Adatta vista</button>
      <span className="mono muted" style={{marginLeft: 'auto'}}>{cur ? `${xl}=${tfmt(cur.x)}  ${single ? single.label.split('(')[0] : yl}=${isFinite(cur.y) ? tfmt(cur.y) : '—'}` : 'trascina · pizzica o rotella per lo zoom'}</span></div>
    {curves.length > 1 && <div className="legend">{curves.map((c, i) => <span key={i}><i style={{background: `var(${c.color})`}} />{c.label}</span>)}</div>}</div>
}
export function Plot({st}: {st: Study}) {
  const curves = useMemo<Curve[]>(() => [{kind: 'fn', fn: st.fn, color: '--acc', label: `${st.name}(${st.v})`}], [st])
  const marks = useMemo<Mark[]>(() => [...st.zeros.slice(0, 40).map(x => ({x, y: 0, c: '--blue'})), ...st.crit.map(p => ({x: p.x, y: p.y, c: '--warn'}))], [st])
  const hint = useMemo(() => [...st.zeros, ...st.crit.map(c => c.x), ...st.infl], [st])
  return <div><PlotView curves={curves} marks={marks} hint={hint} fitKey={st.name + st.v + st.zeros.length + st.crit.length + (st.crit[0]?.x ?? '')} xl={st.v} yl={`${st.name}(${st.v})`} />
    <p className="muted"><span className="dot blue" />zeri · <span className="dot amber" />estremi</p></div>
}
