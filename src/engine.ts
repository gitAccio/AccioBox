import {create, all} from 'mathjs'
export const math: any = create(all)
export type Angle = 'deg' | 'rad'
const D = Math.PI / 180
export function scope(angle: Angle, extra: Record<string, any> = {}) {
  const s: any = {...extra}
  if (angle === 'deg') {
    for (const f of ['sin', 'cos', 'tan']) s[f] = (x: number) => (math as any)[f](x * D)
    for (const f of ['asin', 'acos', 'atan']) s[f] = (x: number) => (math as any)[f](x) / D
  }
  return s
}
export const fmt = (v: any, p = 10) => math.format(v, {precision: p})
export function evaluate(expr: string, angle: Angle = 'rad', vars: Record<string, any> = {}) {
  return math.evaluate(expr, scope(angle, vars))
}
/** Radici numeriche di f(x)=0 su [a,b] (scansione + bisezione). Risultato NUMERICO. */
export function roots(f: (x: number) => number, a = -100, b = 100, n = 4000): number[] {
  const out: number[] = []; let x0 = a, y0 = f(a)
  for (let i = 1; i <= n; i++) {
    const x1 = a + (b - a) * i / n, y1 = f(x1)
    if (isFinite(y0) && isFinite(y1)) {
      if (y1 === 0) out.push(x1)
      else if (y0 * y1 < 0) { let l = x0, h = x1
        for (let k = 0; k < 80; k++) { const m = (l + h) / 2; f(l) * f(m) <= 0 ? h = m : l = m }
        out.push((l + h) / 2) }
    }
    x0 = x1; y0 = y1
  }
  return out.filter((r, i) => i === 0 || Math.abs(r - out[i - 1]) > 1e-9)
}
export interface Study { f: string; d1: string; d2: string; zeros: number[]; crit: {x: number; y: number; kind: string}[]; infl: number[]; fn: (x: number) => number }
/** Studio di funzione: derivate SIMBOLICHE (math.js), zeri/estremi/flessi NUMERICI. */
export function study(expr: string): Study {
  const node = math.parse(expr), d1 = math.derivative(node, 'x'), d2 = math.derivative(d1, 'x')
  const c = (n: any) => { const k = n.compile(); return (x: number) => Number(k.evaluate({x})) }
  const f = c(node), g1 = c(d1), g2 = c(d2)
  return {f: node.toString(), d1: math.simplify(d1).toString(), d2: math.simplify(d2).toString(),
    zeros: roots(f), infl: roots(g2),
    crit: roots(g1).map(x => ({x, y: f(x), kind: g2(x) > 1e-9 ? 'minimo' : g2(x) < -1e-9 ? 'massimo' : 'da verificare'})), fn: f}
}
export type Solved = {kind: string; method: 'simbolico' | 'numerico'; lines: string[]; study?: Study}
/** Barra stile Wolfram: espressione, conversione unità, equazione, f(x)=..., */
export function solve(input: string, angle: Angle): Solved {
  const s = input.trim()
  const fm = s.match(/^f\s*\(\s*x\s*\)\s*=\s*(.+)$/)
  if (fm) { const st = study(fm[1]); return {kind: 'Studio di funzione', method: 'numerico', study: st,
    lines: [`f(x) = ${st.f}`, `f'(x) = ${st.d1}  [simbolico]`, `f''(x) = ${st.d2}  [simbolico]`,
      `Zeri [numerico, x∈[-100,100]]: ${st.zeros.map(z => fmt(z, 8)).join(', ') || 'nessuno'}`,
      ...st.crit.map(c => `${c.kind} in x=${fmt(c.x, 8)}, y=${fmt(c.y, 8)}`),
      `Flessi [numerico]: ${st.infl.map(z => fmt(z, 8)).join(', ') || 'nessuno'}`]} }
  if (s.includes('=') && !/[<>]=/.test(s)) {
    const [l, r] = s.split('='); const k = math.parse(`(${l})-(${r})`).compile()
    const f = (x: number) => Number(k.evaluate(scope(angle, {x})))
    const rs = roots(f); return {kind: 'Equazione in x', method: 'numerico', lines: rs.length ? rs.map((v, i) => `x${i + 1} = ${fmt(v, 10)}`) : ['Nessuna radice reale in [-100,100]']}
  }
  return {kind: 'Espressione', method: 'simbolico', lines: [fmt(evaluate(s, angle))]}
}
// ---- Analizzatore unità composte ----
const NAMED: [string, string][] = [['N', 'forza'], ['J', 'energia / lavoro (N·m come coppia: stessa dimensione)'], ['W', 'potenza'], ['Pa', 'pressione'],
  ['C', 'carica elettrica'], ['V', 'tensione'], ['F', 'capacità'], ['ohm', 'resistenza'], ['H', 'induttanza'], ['Hz', 'frequenza (anche Bq)'],
  ['T', 'induzione magnetica'], ['Wb', 'flusso magnetico'], ['S', 'conduttanza'], ['m', 'lunghezza'], ['kg', 'massa'], ['s', 'tempo'], ['A', 'corrente'],
  ['K', 'temperatura'], ['mol', 'quantità di sostanza'], ['m^2', 'area'], ['m^3', 'volume'], ['m/s', 'velocità'], ['m/s^2', 'accelerazione (anche Gy/Sv: m²/s²)'], ['kg/m^3', 'densità']]
export function analyzeUnits(expr: string) {
  const u = math.unit(`1 ${expr}`), si = u.toSI()
  const matches = NAMED.filter(([n]) => { try { return math.unit(1, n).equalBase(u) } catch { return false } })
    .map(([n, q]) => ({unit: n, quantity: q, factor: fmt(u.toNumber(n), 8)}))
  return {si: si.toString(), matches, ambiguous: matches.length > 1}
}
export const convert = (v: number, from: string, to: string) => Number(math.unit(v, from).toNumber(to))
