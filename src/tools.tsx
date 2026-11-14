import {useMemo, useState} from 'react'
import {math, scope, evaluate, roots, fmt, Angle} from './engine'
import {PlotView, Curve, Mark} from './plot'
import {CALCS, CalcOut, describe, polyfit, parseNums, parsePairs} from './calc'

type Row = {kind: 'y' | 'p'; a: string; b: string; t0: string; t1: string}
const PAL = ['--acc', '--blue', '--warn', '--bad', '--vio', '--cy']
const R0 = (a = '', kind: 'y' | 'p' = 'y'): Row => ({kind, a, b: '', t0: '0', t1: '2*pi'})
export function buildCurves(rows: Row[], angle: Angle) {
  const curves: Curve[] = [], errors: (string | null)[] = [], fns: {i: number; fn: (x: number) => number}[] = []
  rows.forEach((r, i) => { const color = PAL[i % PAL.length]
    try {
      if (r.kind === 'y') { const src = r.a.replace(/^\s*(y|[a-zA-Z]\w*\(x\))\s*=\s*/, ''); if (!src.trim()) throw new Error('Funzione vuota'); const k = math.parse(src).compile()
        const fn = (x: number) => { try { return Number(k.evaluate(scope(angle, {x}))) } catch { return NaN } }; if (!isFinite(fn(0.5)) && !isFinite(fn(1.5)) && !isFinite(fn(-1.5))) { const ok = [-3, -2, 2, 3].some(x => isFinite(fn(x))); if (!ok) throw new Error('Non valutabile: solo la variabile x è ammessa') }
        curves.push({kind: 'fn', fn, color, label: `y = ${src.trim()}`}); fns.push({i: curves.length - 1, fn}) }
      else { const kx = math.parse(r.a).compile(), ky = math.parse(r.b).compile(), t0 = Number(evaluate(r.t0, angle)), t1 = Number(evaluate(r.t1, angle)); if (!isFinite(t0) || !isFinite(t1) || t0 === t1) throw new Error('Intervallo di t non valido')
        const ev = (k: any) => (t: number) => { try { return Number(k.evaluate(scope(angle, {t}))) } catch { return NaN } }
        curves.push({kind: 'param', fx: ev(kx), fy: ev(ky), t0, t1, color, label: `(${r.a}, ${r.b})`}) }
      errors.push(null)
    } catch (e: any) { errors.push(e.message) } })
  const inter: {x: number; y: number; a: number; b: number}[] = []
  for (let p = 0; p < fns.length; p++) for (let q = p + 1; q < fns.length; q++) { const f1 = fns[p].fn, f2 = fns[q].fn
    roots(x => f1(x) - f2(x), -50, 50, 3000).slice(0, 8).forEach(x => inter.push({x, y: f1(x), a: p, b: q})) }
  return {curves, errors, inter}
}
export function Grafici({angle}: {angle: Angle}) {
  const [rows, setRows] = useState<Row[]>([R0('sin(x)'), R0('x/2')]), [applied, setApplied] = useState(rows), [n, setN] = useState(0)
  const built = useMemo(() => buildCurves(applied, angle), [applied, angle])
  const marks = useMemo<Mark[]>(() => built.inter.map(p => ({x: p.x, y: p.y, c: '--fg'})), [built])
  const set = (i: number, p: Partial<Row>) => setRows(rows.map((r, j) => j === i ? {...r, ...p} : r))
  const trace = () => { setApplied(rows); setN(n + 1) }
  return <section><h2>Grafici</h2>
    {rows.map((r, i) => <div key={i} className="card"><div className="row"><select style={{flex: '0 0 130px'}} value={r.kind} onChange={e => set(i, {kind: e.target.value as 'y' | 'p'})}><option value="y">y = f(x)</option><option value="p">parametrica</option></select>
      <span className="muted" style={{color: `var(${PAL[i % PAL.length]})`}}>■ {i + 1}</span>{rows.length > 1 && <button style={{marginLeft: 'auto'}} onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>}</div>
      {r.kind === 'y' ? <input className="big" value={r.a} placeholder="es. sin(x)/x" autoCapitalize="off" spellCheck={false} onChange={e => set(i, {a: e.target.value})} onKeyDown={e => e.key === 'Enter' && trace()} />
        : <><div className="row"><input value={r.a} placeholder="x(t) es. cos(t)" onChange={e => set(i, {a: e.target.value})} /><input value={r.b} placeholder="y(t) es. sin(t)" onChange={e => set(i, {b: e.target.value})} /></div>
          <div className="row"><input value={r.t0} placeholder="t da" onChange={e => set(i, {t0: e.target.value})} /><input value={r.t1} placeholder="t a" onChange={e => set(i, {t1: e.target.value})} /></div></>}
      {built.errors[i] && applied[i] === r && <p className="err">{built.errors[i]}</p>}</div>)}
    <div className="row"><button disabled={rows.length >= 6} onClick={() => setRows([...rows, R0()])}>＋ Funzione</button><button onClick={() => setRows([...rows, R0('cos(t)', 'p')].map((r, i, a) => i === a.length - 1 ? {...r, b: 'sin(t)'} : r))} disabled={rows.length >= 6}>＋ Parametrica</button><button className="primary" onClick={trace}>Traccia</button></div>
    <PlotView curves={built.curves} marks={marks} fitKey={n} />
    {built.inter.length > 0 && <div className="card"><b>Intersezioni</b> <span className="badge numerico">numerico</span><div className="muted">x ∈ [-50, 50], funzioni y=f(x)</div>
      {built.inter.slice(0, 12).map((p, i) => <div key={i} className="mono">({fmt(p.x, 7)}, {fmt(p.y, 7)}) — curve {p.a + 1} e {p.b + 1}</div>)}</div>}</section>
}

export function Calcolatori() {
  const [id, setId] = useState(CALCS[0].id), [vals, setVals] = useState<Record<string, Record<string, string>>>({})
  const c = CALCS.find(x => x.id === id)!, cur = vals[id] ?? Object.fromEntries(c.fields.map(f => [f.k, f.def]))
  let out: CalcOut | null = null, err = ''; try { out = c.compute(cur) } catch (e: any) { err = e.message }
  return <section><h2>Calcolatori</h2>
    <label>Calcolatore <select value={id} onChange={e => setId(e.target.value)}>{[...new Set(CALCS.map(x => x.group))].map(g => <optgroup key={g} label={g}>{CALCS.filter(x => x.group === g).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</select></label>
    <p className="muted">{c.desc}</p>
    <div className="card">{c.fields.map(f => <label key={f.k}>{f.label} <span className="muted">[{f.unit}]</span><input inputMode="decimal" value={cur[f.k] ?? ''} onChange={e => setVals({...vals, [id]: {...cur, [f.k]: e.target.value}})} /></label>)}</div>
    {err && <p className="err">{err}</p>}
    {out && <div className="card res"><h3 style={{marginTop: 0}}>Risultati</h3>{out.results.map(r => <div className="r" key={r.label}><span>{r.label}</span><span className="v">{r.value}{r.unit ? ' ' + r.unit : ''}</span></div>)}
      <h3>Passaggi</h3><ul className="steps">{out.steps.map((s, i) => <li key={i} className="mono">{s}</li>)}</ul>{out.warnings.map((w, i) => <p key={i} className="warn">⚠ {w}</p>)}</div>}</section>
}

const poly = (c: number[]) => 'y = ' + c.map((v, k) => `${k === 0 ? '' : v < 0 ? ' − ' : ' + '}${fmt(k === 0 ? v : Math.abs(v), 6)}${k === 0 ? '' : k === 1 ? '·x' : `·x^${k}`}`).join('')
export function Statistica() {
  const [mode, setMode] = useState<'d' | 'r'>('d'), [txt, setTxt] = useState('2 4 4 4 5 5 7 9'), [pairs, setPairs] = useState('0 1\n1 3\n2 5\n3 7.2'), [deg, setDeg] = useState(1), [xp, setXp] = useState('4')
  let body: any = null, err = ''
  try {
    if (mode === 'd') { const d = describe(parseNums(txt)); const rows: [string, number][] = [['n', d.n], ['Somma', d.sum], ['Media', d.mean], ['Mediana', d.median], ['Minimo', d.min], ['Massimo', d.max], ['Dev. standard campionaria (n−1)', d.stdS], ['Dev. standard popolazione (n)', d.stdP], ['Varianza campionaria', d.varS], ['Varianza popolazione', d.varP]]
      body = <div className="card res">{rows.map(([l, v]) => <div className="r" key={l}><span>{l}</span><span className="v">{isFinite(v) ? fmt(v, 8) : '—'}</span></div>)}</div> }
    else { const pts = parsePairs(pairs), r = polyfit(pts, deg), x = Number(xp.replace(',', '.'))
      body = <div className="card res"><div className="r"><span>Modello</span><span className="v">{poly(r.coeffs)}</span></div><div className="r"><span>R²</span><span className="v">{fmt(r.r2, 8)}</span></div><div className="r"><span>Punti</span><span className="v">{pts.length}</span></div>
        {xp.trim() !== '' && isFinite(x) && <div className="r"><span>y({fmt(x, 6)}) previsto</span><span className="v">{fmt(r.coeffs.reduce((a, c, k) => a + c * x ** k, 0), 8)}</span></div>}
        <p className="warn">⚠ Previsioni fuori dall'intervallo dei dati (estrapolazione) e gradi alti con pochi punti non sono affidabili.</p></div> }
  } catch (e: any) { err = e.message }
  return <section><h2>Statistica</h2><div className="seg"><button className={mode === 'd' ? 'on' : ''} onClick={() => setMode('d')}>Descrittiva</button><button className={mode === 'r' ? 'on' : ''} onClick={() => setMode('r')}>Regressione</button></div>
    {mode === 'd' ? <><label>Dati (separati da spazio, a capo o ;)<textarea className="data" value={txt} onChange={e => setTxt(e.target.value)} /></label></>
      : <><label>Coppie "x y", una per riga<textarea className="data" value={pairs} onChange={e => setPairs(e.target.value)} /></label>
        <div className="row"><label>Grado<select value={deg} onChange={e => setDeg(+e.target.value)}><option value={1}>1 · lineare</option><option value={2}>2 · parabola</option><option value={3}>3 · cubica</option></select></label><label>Prevedi y per x =<input inputMode="decimal" value={xp} onChange={e => setXp(e.target.value)} /></label></div></>}
    {err ? <p className="err">{err}</p> : body}</section>
}
