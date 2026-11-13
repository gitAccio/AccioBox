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
export type Line = {t: string; tex?: string; approx?: string}
export interface Study { v: string; name: string; fn: (x: number) => number; zeros: number[]; crit: {x: number; y: number; kind: string}[]; infl: number[] }
export type Solved = {kind: string; method: 'simbolico' | 'numerico'; lines: Line[]; study?: Study; vars?: string[]; forVar?: string}
const CONST = new Set(['pi', 'e', 'i', 'tau', 'phi', 'E', 'PI', 'Infinity', 'NaN', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2', 'true', 'false', 'null', 'undefined'])
const isUnit = (n: string) => { try { return math.Unit.isValuelessUnit(n) } catch { return false } }
/** Simboli liberi (lettere) di un'espressione, esclusi funzioni, costanti e nomi noti. */
export function freeSymbols(node: any, known: string[] = []): string[] {
  const s = new Set<string>()
  node.traverse((n: any, p: string, par: any) => { if (n.isSymbolNode && !(par?.isFunctionNode && p === 'fn') && !CONST.has(n.name) && !known.includes(n.name)) s.add(n.name) })
  return [...s]
}
const subst = (node: any, map: Record<string, number>) => node.transform((n: any, p: string, par: any) => n.isSymbolNode && n.name in map && !(par?.isFunctionNode && p === 'fn') ? new math.ConstantNode(map[n.name]) : n)
const simp = (n: any) => math.simplify(n)
const texOf = (n: any) => { try { return n.toTex() } catch { return undefined } }
const L = (t: string, tex?: string, approx?: string): Line => ({t, tex, approx})
const clean = (x: number) => Math.abs(x) < 1e-9 ? 0 : x
const zero = (n: any) => simp(n).toString() === '0'
const lim = (xs: number[], n = 12) => xs.slice(0, n).map(z => fmt(clean(z), 8)).join(', ') + (xs.length > n ? ` … (${xs.length} in totale)` : '')

/** Studio di funzione. Derivate SIMBOLICHE; zeri, estremi e flessi NUMERICI (solo se non restano parametri). */
function studyFn(src: string, v: string, sc: Record<string, number>, angle: Angle, name = 'f'): Solved {
  const node = subst(math.parse(src), sc), extra = freeSymbols(node, [v])
  const d1 = simp(math.derivative(node, v)), d2 = simp(math.derivative(d1, v)), f0 = simp(node)
  const lines: Line[] = [L(`${name}(${v}) = ${f0}`, `${name}(${v}) = ${texOf(f0)}`), L(`${name}'(${v}) = ${d1}`, `${name}'(${v}) = ${texOf(d1)}`), L(`${name}''(${v}) = ${d2}`, `${name}''(${v}) = ${texOf(d2)}`)]
  if (extra.length) { lines.push(L(`Parametri senza valore: ${extra.join(', ')}. Per grafico e zeri assegna i valori, es. "${extra[0]}=2; ${name}(${v})=${src}"`)); return {kind: 'Studio di funzione', method: 'simbolico', lines, vars: extra} }
  const ev = (nd: any) => { const k = nd.compile(); return (x: number) => Number(k.evaluate(scope(angle, {[v]: x}))) }
  const f = ev(node), g1 = ev(d1), g2 = ev(d2)
  const zeros = roots(f), infl = roots(g2), crit = roots(g1).map(x => ({x: clean(x), y: f(x), kind: g2(x) > 1e-9 ? 'minimo' : g2(x) < -1e-9 ? 'massimo' : 'da verificare'}))
  lines.push(L(`Zeri [numerico, ${v}∈[-100,100]]: ${zeros.length ? lim(zeros) : 'nessuno'}`))
  crit.slice(0, 10).forEach(c => lines.push(L(`${c.kind} in ${v}=${fmt(c.x, 8)}, ${name}=${fmt(clean(c.y), 8)}`)))
  lines.push(L(`Flessi [numerico]: ${infl.length ? lim(infl) : 'nessuno'}`), L(`${name}(0) = ${fmt(clean(f(0)), 8)}`))
  return {kind: 'Studio di funzione', method: 'numerico', lines, study: {v, name, fn: f, zeros, crit, infl}}
}
function solveEq(l: string, r: string, sc: Record<string, number>, angle: Angle, forVar?: string): Solved {
  const g = subst(math.parse(`(${l})-(${r})`), sc), syms = freeSymbols(g)
  if (!syms.length) throw new Error('Nessuna incognita: usa una lettera (es. x)')
  const v = forVar && syms.includes(forVar) ? forVar : syms.includes('x') ? 'x' : syms[0], others = syms.filter(s => s !== v)
  const ex = (name: string, e: any): Line => { const s = simp(e); let ap: string | undefined
    if (!others.length) try { const n = fmt(math.evaluate(s.toString()), 10); if (n !== s.toString()) ap = n } catch { /* resta esatto */ }
    return L(`${name} = ${s}`, `${name} = ${texOf(s)}`, ap) }
  const base = {kind: `Equazione, incognita ${v}`, vars: syms, forVar: v}
  try {
    const D = (n: any, k: number) => { let x = n; for (let i = 0; i < k; i++) x = math.derivative(x, v); return x }
    if (zero(D(g, 3))) {
      const z = {[v]: 0}, a0 = simp(subst(g, z)).toString(), a1 = simp(subst(D(g, 1), z)).toString(), a2 = simp(math.parse(`(${simp(subst(D(g, 2), z)).toString()})/2`)).toString()
      const lines: Line[] = []
      if (a2 === '0' && a1 === '0') return {...base, method: 'simbolico', lines: [L(a0 === '0' ? 'Identità: vera per ogni valore' : 'Equazione impossibile')]}
      if (a2 === '0') { lines.push(ex(v, math.parse(`-(${a0})/(${a1})`))); if (freeSymbols(math.parse(a1)).length) lines.push(L(`Condizione: (${a1}) ≠ 0`)) }
      else { const disc = simp(math.parse(`(${a1})^2-4*(${a2})*(${a0})`)).toString()
        lines.push(ex(`${v}₁`, math.parse(`(-(${a1})+sqrt(${disc}))/(2*(${a2}))`)), ex(`${v}₂`, math.parse(`(-(${a1})-sqrt(${disc}))/(2*(${a2}))`)), L(`Discriminante = ${disc}`))
        if (freeSymbols(math.parse(a2)).length) lines.push(L(`Condizione: (${a2}) ≠ 0`)) }
      return {...base, method: 'simbolico', lines}
    }
  } catch { /* non polinomiale: provo il numerico */ }
  if (others.length) return {...base, method: 'numerico', lines: [L(`Non risolvibile in forma simbolica con più lettere (solo polinomi fino al 2° grado). Assegna valori a ${others.join(', ')}, es. "${others[0]}=2; ${l}=${r}"`)]}
  const k = g.compile(), rs = roots(x => Number(k.evaluate(scope(angle, {[v]: x}))))
  return {...base, method: 'numerico', lines: rs.length ? [...rs.slice(0, 12).map((x, i) => L(`${v}${i + 1} = ${fmt(clean(x), 10)}`)), ...(rs.length > 12 ? [L(`… ${rs.length} soluzioni in [-100,100]`)] : [])] : [L('Nessuna radice reale in [-100,100]')]}
}
/** Una sola barra: espressioni, conversioni, equazioni (anche con sole lettere), funzioni, definizioni "a=2; ...". */
export function solve(input: string, angle: Angle, forVar?: string): Solved {
  const parts = input.split(';').map(s => s.trim()).filter(Boolean), main = parts.pop()
  if (!main) throw new Error('Scrivi un\'espressione')
  const sc: Record<string, number> = {}
  for (const p of parts) { const m = p.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/); if (!m) throw new Error('Definizione non valida: ' + p); sc[m[1]] = Number(evaluate(m[2], angle, sc)) }
  if (/\s(to|in)\s/.test(main)) return {kind: 'Conversione', method: 'numerico', lines: [L(fmt(evaluate(main, angle, sc)))]}
  const fm = main.match(/^([A-Za-z]\w*)\s*\(\s*([A-Za-z]\w*)\s*\)\s*=\s*(.+)$/)
  if (fm) return studyFn(fm[3], fm[2], sc, angle, fm[1])
  const ym = main.match(/^y\s*=\s*(.+)$/)
  if (ym && !/\by\b/.test(ym[1])) { const sy = freeSymbols(subst(math.parse(ym[1]), sc)); if (sy.length) return studyFn(ym[1], sy.includes('x') ? 'x' : sy[0], sc, angle, 'y') }
  if (main.includes('=') && !/[<>!]=|==/.test(main)) { const [l, r] = main.split('='); return solveEq(l, r, sc, angle, forVar) }
  const node = subst(math.parse(main), sc), syms = freeSymbols(node)
  if (!syms.length || syms.every(isUnit)) return {kind: 'Espressione', method: 'numerico', lines: [L(fmt(evaluate(main, angle, sc)))]}
  const lines: Line[] = [], s = simp(node)
  lines.push(L(`${s}`, texOf(s)))
  try { const ra = math.rationalize(node); if (ra.toString() !== s.toString()) lines.push(L(`Forma espansa: ${ra}`, texOf(ra))) } catch { /* non polinomiale */ }
  const v = syms.includes('x') ? 'x' : syms[0]
  try { const d = simp(math.derivative(node, v)); lines.push(L(`d/d${v}: ${d}`, `\\frac{d}{d${v}} = ${texOf(d)}`)) } catch { /* non derivabile */ }
  return {kind: 'Espressione simbolica', method: 'simbolico', lines, vars: syms}
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
