/** Calcolatori ingegneristici: funzioni di dominio pure (nessuna dipendenza dalla UI). */
import {math} from './engine'
export type Field = {k: string; label: string; unit: string; def: string; opt?: boolean}
export type Result = {label: string; value: string; unit?: string}
export type CalcOut = {results: Result[]; steps: string[]; warnings: string[]}
export interface Calc {id: string; group: string; name: string; desc: string; fields: Field[]; compute: (v: Record<string, string>) => CalcOut}
const g = (x: number) => math.format(x, {precision: 8})
const R_GAS = 8.314462618
function num(v: Record<string, string>, f: Field, pos = false): number {
  const raw = (v[f.k] ?? '').trim().replace(',', '.'); const x = Number(raw)
  if (raw === '' || !isFinite(x)) throw new Error(`Campo non valido: ${f.label}`)
  if (pos && x <= 0) throw new Error(`${f.label} deve essere > 0`)
  return x
}
const optNum = (v: Record<string, string>, f: Field) => (v[f.k] ?? '').trim() === '' ? null : num(v, f, true)
const F = (k: string, label: string, unit: string, def: string, opt = false): Field => ({k, label, unit, def, opt})
const mk = (id: string, group: string, name: string, desc: string, fields: Field[], compute: Calc['compute']): Calc => ({id, group, name, desc, fields, compute})
const f = (c: Calc, k: string) => c.fields.find(x => x.k === k)!
const EI = [F('E', 'Modulo di Young E (facoltativo)', 'Pa', '210e9', true), F('I', "Momento d'inerzia I (facoltativo)", 'm^4', '8.33e-6', true)]
function withEI(c: () => Calc, v: Record<string, string>, fn: (E: number, I: number) => Result[]): Result[] {
  const me = c(), E = optNum(v, f(me, 'E')), I = optNum(v, f(me, 'I')); return E !== null && I !== null ? fn(E, I) : []
}
export const mohr = mk('mohr', 'Meccanica', 'Cerchio di Mohr (stato piano)', 'Tensioni principali, tensione tangenziale massima e tensione equivalente di von Mises.',
  [F('sx', 'σx', 'MPa', '100'), F('sy', 'σy', 'MPa', '20'), F('txy', 'τxy', 'MPa', '40')], v => {
    const sx = num(v, mohr.fields[0]) * 1, sy = Number(v.sy.replace(',', '.')), t = Number(v.txy.replace(',', '.'))
    if (![sx, sy, t].every(isFinite)) throw new Error('Valori non validi')
    const c = (sx + sy) / 2, r = Math.hypot((sx - sy) / 2, t), s1 = c + r, s2 = c - r, th = 0.5 * Math.atan2(2 * t, sx - sy) * 180 / Math.PI, vm = Math.sqrt(s1 * s1 - s1 * s2 + s2 * s2)
    return {results: [{label: 'σ1', value: g(s1), unit: 'MPa'}, {label: 'σ2', value: g(s2), unit: 'MPa'}, {label: 'τmax', value: g(r), unit: 'MPa'}, {label: 'Centro del cerchio', value: g(c), unit: 'MPa'}, {label: 'θp (direzione di σ1)', value: g(th), unit: '°'}, {label: 'σ von Mises', value: g(vm), unit: 'MPa'}],
      steps: ['c = (σx+σy)/2', 'R = √(((σx−σy)/2)² + τxy²)', 'σ1,2 = c ± R', 'θp = ½·atan2(2τxy, σx−σy)', 'σvm = √(σ1² − σ1σ2 + σ2²)'],
      warnings: ['Stato piano di tensione, materiale isotropo. Le unità sono coerenti con quelle inserite. θp misurato dall\'asse x, in senso antiorario.']} })
export const travUnif: Calc = mk('trave-q', 'Meccanica', 'Trave appoggiata, carico uniforme', 'Reazioni, momento massimo e freccia massima.',
  [F('L', 'Luce L', 'm', '4'), F('q', 'Carico q', 'N/m', '10000'), ...EI], v => {
    const L = num(v, travUnif.fields[0], true), q = num(v, travUnif.fields[1], true)
    return {results: [{label: 'RA = RB', value: g(q * L / 2), unit: 'N'}, {label: 'M max (mezzeria)', value: g(q * L * L / 8), unit: 'N·m'}, ...withEI(() => travUnif, v, (E, I) => [{label: 'Freccia max', value: g(5 * q * L ** 4 / (384 * E * I)), unit: 'm'}])],
      steps: ['R = qL/2', 'Mmax = qL²/8', 'f = 5qL⁴/(384EI)'], warnings: ['Trave isostatica su due appoggi, sezione costante, materiale elastico lineare, piccoli spostamenti, taglio trascurato. Verifica preliminare, non una certificazione.']} })
export const travConc: Calc = mk('trave-f', 'Meccanica', 'Trave appoggiata, carico concentrato', 'Reazioni e momento sotto il carico.',
  [F('L', 'Luce L', 'm', '4'), F('F', 'Forza F', 'N', '10000'), F('a', 'Distanza a dall\'appoggio A', 'm', '1'), ...EI], v => {
    const L = num(v, travConc.fields[0], true), P = num(v, travConc.fields[1], true), a = num(v, travConc.fields[2], true)
    if (a >= L) throw new Error('a deve essere minore di L'); const b = L - a
    return {results: [{label: 'RA', value: g(P * b / L), unit: 'N'}, {label: 'RB', value: g(P * a / L), unit: 'N'}, {label: 'M sotto il carico (= M max)', value: g(P * a * b / L), unit: 'N·m'},
      ...withEI(() => travConc, v, (E, I) => [{label: 'Freccia sotto il carico', value: g(P * a * a * b * b / (3 * E * I * L)), unit: 'm'}])],
      steps: ['b = L − a', 'RA = F·b/L', 'RB = F·a/L', 'M = F·a·b/L', 'f = F·a²·b²/(3EIL)'], warnings: ['Trave isostatica, sezione costante, elastico lineare, piccoli spostamenti. Verifica preliminare.']} })
export const mensola: Calc = mk('mensola', 'Meccanica', 'Mensola, carico in punta', "Momento all'incastro e freccia in punta.",
  [F('L', 'Lunghezza L', 'm', '1.5'), F('F', 'Forza F', 'N', '2000'), ...EI], v => {
    const L = num(v, mensola.fields[0], true), P = num(v, mensola.fields[1], true)
    return {results: [{label: 'M incastro', value: g(P * L), unit: 'N·m'}, {label: 'Taglio', value: g(P), unit: 'N'}, ...withEI(() => mensola, v, (E, I) => [{label: 'Freccia in punta', value: g(P * L ** 3 / (3 * E * I)), unit: 'm'}])],
      steps: ['M = F·L', 'f = F·L³/(3EI)'], warnings: ['Incastro ideale, sezione costante, elastico lineare, taglio trascurato.']} })
export const sezRett: Calc = mk('sez-rett', 'Meccanica', 'Sezione rettangolare', 'Area, momenti e moduli di resistenza a flessione.',
  [F('b', 'Base b', 'm', '0.1'), F('h', 'Altezza h', 'm', '0.2')], v => {
    const b = num(v, sezRett.fields[0], true), h = num(v, sezRett.fields[1], true), A = b * h, Ix = b * h ** 3 / 12, Iy = h * b ** 3 / 12
    return {results: [{label: 'Area A', value: g(A), unit: 'm²'}, {label: 'Ix (asse parallelo a b)', value: g(Ix), unit: 'm⁴'}, {label: 'Iy', value: g(Iy), unit: 'm⁴'}, {label: 'Wx', value: g(b * h * h / 6), unit: 'm³'}, {label: 'Wy', value: g(h * b * b / 6), unit: 'm³'}, {label: 'Raggio d\'inerzia ix', value: g(Math.sqrt(Ix / A)), unit: 'm'}],
      steps: ['A = b·h', 'Ix = b·h³/12', 'Iy = h·b³/12', 'Wx = b·h²/6'], warnings: ['Assi baricentrici principali.']} })
export const sezCirc: Calc = mk('sez-circ', 'Meccanica', 'Sezione circolare piena', 'Area, momenti d\'inerzia e moduli.', [F('d', 'Diametro d', 'm', '0.05')], v => {
  const d = num(v, sezCirc.fields[0], true), A = Math.PI * d * d / 4, I = Math.PI * d ** 4 / 64
  return {results: [{label: 'Area A', value: g(A), unit: 'm²'}, {label: 'I (flessione)', value: g(I), unit: 'm⁴'}, {label: 'J (polare)', value: g(2 * I), unit: 'm⁴'}, {label: 'W (flessione)', value: g(Math.PI * d ** 3 / 32), unit: 'm³'}, {label: 'Wt (torsione)', value: g(Math.PI * d ** 3 / 16), unit: 'm³'}],
    steps: ['A = πd²/4', 'I = πd⁴/64', 'J = πd⁴/32', 'W = πd³/32', 'Wt = πd³/16'], warnings: []} })
export const sezCava: Calc = mk('sez-cava', 'Meccanica', 'Sezione circolare cava', 'Area, momenti d\'inerzia e moduli.', [F('D', 'Diametro esterno D', 'm', '0.06'), F('d', 'Diametro interno d', 'm', '0.05')], v => {
  const D = num(v, sezCava.fields[0], true), d = num(v, sezCava.fields[1], true); if (d >= D) throw new Error('d deve essere minore di D')
  const I = Math.PI * (D ** 4 - d ** 4) / 64, A = Math.PI * (D * D - d * d) / 4
  return {results: [{label: 'Area A', value: g(A), unit: 'm²'}, {label: 'I (flessione)', value: g(I), unit: 'm⁴'}, {label: 'J (polare)', value: g(2 * I), unit: 'm⁴'}, {label: 'W (flessione)', value: g(I / (D / 2)), unit: 'm³'}, {label: 'Wt (torsione)', value: g(2 * I / (D / 2)), unit: 'm³'}],
    steps: ['A = π(D²−d²)/4', 'I = π(D⁴−d⁴)/64', 'J = 2I', 'W = I/(D/2)'], warnings: []} })
export const reynolds: Calc = mk('reynolds', 'Fluidi', 'Reynolds e regime in condotto', 'Numero di Reynolds, regime, fattore di attrito e perdita distribuita.',
  [F('rho', 'Densità ρ', 'kg/m^3', '998'), F('v', 'Velocità media v', 'm/s', '1.5'), F('D', 'Diametro D', 'm', '0.05'), F('mu', 'Viscosità dinamica μ', 'Pa·s', '0.001'), F('L', 'Lunghezza L (facoltativa)', 'm', '10', true)], v => {
    const [r, vv, D, mu] = [0, 1, 2, 3].map(i => num(v, reynolds.fields[i], true)), L = optNum(v, reynolds.fields[4]), Re = r * vv * D / mu
    const regime = Re < 2300 ? 'laminare' : Re <= 4000 ? 'transizione (non prevedibile)' : 'turbolento', w: string[] = ['Soglie indicative per condotto circolare pieno.']
    const res: Result[] = [{label: 'Re', value: g(Re)}, {label: 'Regime', value: regime}, {label: 'Portata Q', value: g(Math.PI * D * D / 4 * vv), unit: 'm³/s'}]; const steps = ['Re = ρvD/μ', 'Q = πD²v/4']
    let fr: number | null = null
    if (Re < 2300) { fr = 64 / Re; steps.push('f = 64/Re (laminare)') } else if (Re > 4000) { fr = 0.3164 / Re ** 0.25; steps.push('f = 0.3164/Re^0.25 (Blasius)'); if (Re > 1e5) w.push('Blasius valido solo per tubi lisci e Re < 10^5: qui è fuori campo, usa Colebrook o diagramma di Moody.'); w.push('Tubo liscio assunto: la scabrezza non è considerata.') }
    else w.push('In transizione il fattore di attrito non è determinabile con una formula.')
    if (fr !== null) { res.push({label: 'f (Darcy)', value: g(fr)}); if (L !== null) { res.push({label: 'Perdita Δp', value: g(fr * (L / D) * r * vv * vv / 2), unit: 'Pa'}); steps.push('Δp = f·(L/D)·ρv²/2') } }
    return {results: res, steps, warnings: w} })
export const gas: Calc = mk('gas', 'Termodinamica', 'Gas ideale (p·V = n·R·T)', 'Lascia vuoto UN solo campo: viene calcolato.',
  [F('p', 'Pressione p', 'Pa', '101325', true), F('V', 'Volume V', 'm^3', '0.0224', true), F('n', 'Moli n', 'mol', '1', true), F('T', 'Temperatura T (assoluta)', 'K', '', true)], v => {
    const raw = gas.fields.map(x => (v[x.k] ?? '').trim()), empty = raw.filter(x => x === '').length
    if (empty !== 1) throw new Error('Lascia vuoto esattamente un campo')
    const k = gas.fields[raw.indexOf('')].k, [p, V, n, T] = gas.fields.map(x => (v[x.k] ?? '').trim() === '' ? NaN : num(v, x, true))
    const val = k === 'p' ? n * R_GAS * T / V : k === 'V' ? n * R_GAS * T / p : k === 'n' ? p * V / (R_GAS * T) : p * V / (n * R_GAS)
    const unit = {p: 'Pa', V: 'm³', n: 'mol', T: 'K'}[k as 'p']
    return {results: [{label: k, value: g(val), unit}], steps: ['p·V = n·R·T', 'R = 8.314462618 J/(mol·K) (CODATA 2018, esatta)'], warnings: ['Gas ideale. T in kelvin (non °C). Fuori campo a pressioni alte o vicino alla condensazione.']} })
export const CALCS: Calc[] = [mohr, travUnif, travConc, mensola, sezRett, sezCirc, sezCava, reynolds, gas]

// ---- Statistica ----
export function parseNums(text: string): number[] {
  const t = text.trim(); if (!t) throw new Error('Nessun dato')
  return t.split(/[\s;]+/).filter(Boolean).map(s => { const x = Number(s.replace(',', '.')); if (!isFinite(x)) throw new Error(`Valore non numerico: "${s}"`); return x })
}
export function parsePairs(text: string): [number, number][] {
  const rows = text.split('\n').map(s => s.trim()).filter(Boolean); if (!rows.length) throw new Error('Nessun dato')
  return rows.map((r, i) => { const p = parseNums(r); if (p.length !== 2) throw new Error(`Riga ${i + 1}: servono due valori (x y)`); return [p[0], p[1]] })
}
export function describe(xs: number[]) {
  const n = xs.length, s = [...xs].sort((a, b) => a - b), sum = xs.reduce((a, b) => a + b, 0), mean = sum / n, ss = xs.reduce((a, b) => a + (b - mean) ** 2, 0)
  return {n, sum, mean, median: n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2, min: s[0], max: s[n - 1], varP: ss / n, stdP: Math.sqrt(ss / n), varS: n > 1 ? ss / (n - 1) : NaN, stdS: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN}
}
/** Regressione polinomiale ai minimi quadrati (equazioni normali). Restituisce c0..cdeg e R². */
export function polyfit(pts: [number, number][], deg: number) {
  if (pts.length <= deg) throw new Error(`Servono almeno ${deg + 1} punti per il grado ${deg}`)
  const A = Array.from({length: deg + 1}, (_, i) => Array.from({length: deg + 1}, (_, j) => pts.reduce((s, [x]) => s + x ** (i + j), 0))), b = Array.from({length: deg + 1}, (_, i) => pts.reduce((s, [x, y]) => s + y * x ** i, 0))
  let c: number[]; try { c = (math.lusolve(A, b) as number[][]).map(r => Number(r[0])) } catch { throw new Error('Sistema singolare: punti insufficienti o tutti uguali in x') }
  const my = pts.reduce((s, [, y]) => s + y, 0) / pts.length, ssTot = pts.reduce((s, [, y]) => s + (y - my) ** 2, 0), ssRes = pts.reduce((s, [x, y]) => s + (y - c.reduce((a, ck, k) => a + ck * x ** k, 0)) ** 2, 0)
  return {coeffs: c, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot}
}
