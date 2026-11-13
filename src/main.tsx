import {Component, useState, useMemo, useRef, useEffect} from 'react'
import {Q} from './units'
import {createRoot} from 'react-dom/client'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import yaml from 'js-yaml'
import {solve, fmt, evaluate, roots, analyzeUnits, convert, Angle, Study} from './engine'
import './style.css'
import {registerSW} from 'virtual:pwa-register'
import {Calcolatrice, Convertitore, useCaret} from './keypad'

type Formula = {id: string; nome: string; latex: string; expr: string; stato: string; fonte: string; ipotesi?: string; variabili: Record<string, string>; materia: string}
const files = import.meta.glob('/content/formulario/**/formule.yaml', {query: '?raw', import: 'default', eager: true}) as Record<string, string>
const FORMULE: Formula[] = Object.entries(files).flatMap(([p, raw]) => {
  const materia = p.split('/').slice(-2, -1)[0]
  return (yaml.load(raw) as any[]).map(f => ({...f, materia}))
})
const Tex = ({t}: {t: string}) => <span dangerouslySetInnerHTML={{__html: katex.renderToString(t, {throwOnError: false})}} />
const store = {get: (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) ?? '') } catch { return d } }, set: (k: string, v: any) => localStorage.setItem(k, JSON.stringify(v))}

type View = {x0: number; x1: number; y0: number; y1: number}
const nice = (span: number, n = 6) => { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p }
const tfmt = (t: number) => String(Number(t.toPrecision(6)))
function fitView(st: Study): View {
  const xs = [...st.zeros, ...st.crit.map(c => c.x), ...st.infl]
  const x0 = Math.max(-100, Math.min(-5, ...xs.map(x => x - 1))), x1 = Math.min(100, Math.max(5, ...xs.map(x => x + 1)))
  const ys: number[] = []; for (let i = 0; i <= 400; i++) { const y = st.fn(x0 + (x1 - x0) * i / 400); if (isFinite(y)) ys.push(y) }
  ys.sort((a, b) => a - b); let y0 = ys.length ? ys[Math.floor(ys.length * 0.02)] : -5, y1 = ys.length ? ys[Math.floor(ys.length * 0.98)] : 5
  const pad = (y1 - y0) * 0.15 || 1; return {x0, x1, y0: y0 - pad, y1: y1 + pad}
}
const zoomAt = (vw: View, ax: number, ay: number, k: number): View => {
  const sx = (vw.x1 - vw.x0) * k, sy = (vw.y1 - vw.y0) * k; if (sx < 1e-6 || sx > 1e7 || sy < 1e-6 || sy > 1e7) return vw
  const fx = (ax - vw.x0) / (vw.x1 - vw.x0), fy = (ay - vw.y0) / (vw.y1 - vw.y0)
  return {x0: ax - fx * sx, x1: ax - fx * sx + sx, y0: ay - fy * sy, y1: ay - fy * sy + sy}
}
function Plot({st}: {st: Study}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [v, setV] = useState<View>(() => fitView(st)), vr = useRef(v); vr.current = v
  const [cur, setCur] = useState<{x: number; y: number} | null>(null)
  const ptrs = useRef(new Map<number, {x: number; y: number}>()), lastD = useRef(0)
  useEffect(() => { setV(fitView(st)) }, [st])
  const toData = (cx: number, cy: number, vw: View) => { const r = ref.current!.getBoundingClientRect(); return {x: vw.x0 + (cx - r.left) / r.width * (vw.x1 - vw.x0), y: vw.y1 - (cy - r.top) / r.height * (vw.y1 - vw.y0)} }
  useEffect(() => { const c = ref.current!; const h = (e: WheelEvent) => { e.preventDefault(); const p = toData(e.clientX, e.clientY, vr.current); setV(zoomAt(vr.current, p.x, p.y, Math.exp(e.deltaY * 0.0015))) }
    c.addEventListener('wheel', h, {passive: false}); return () => c.removeEventListener('wheel', h) }, [])
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!, W = c.width, H = c.height, cs = getComputedStyle(c), col = (n: string) => cs.getPropertyValue(n).trim()
    const X = (x: number) => (x - v.x0) / (v.x1 - v.x0) * W, Y = (y: number) => H - (y - v.y0) / (v.y1 - v.y0) * H, cl = (a: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, a))
    g.fillStyle = col('--card'); g.fillRect(0, 0, W, H); g.font = '13px system-ui, sans-serif'
    const sx = nice(v.x1 - v.x0), sy = nice(v.y1 - v.y0), axY = cl(Y(0), 16, H - 6), axX = cl(X(0), 6, W - 44)
    g.lineWidth = 1
    for (let k = Math.ceil(v.x0 / sx); k <= Math.floor(v.x1 / sx) && k - Math.ceil(v.x0 / sx) < 60; k++) { const px = X(k * sx); g.strokeStyle = col('--line'); g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke(); if (k !== 0) { g.fillStyle = col('--mut'); g.fillText(tfmt(k * sx), px + 3, axY - 5 > 14 ? Math.min(axY + 15, H - 4) : 14) } }
    for (let k = Math.ceil(v.y0 / sy); k <= Math.floor(v.y1 / sy) && k - Math.ceil(v.y0 / sy) < 60; k++) { const py = Y(k * sy); g.strokeStyle = col('--line'); g.beginPath(); g.moveTo(0, py); g.lineTo(W, py); g.stroke(); if (k !== 0) { g.fillStyle = col('--mut'); g.fillText(tfmt(k * sy), axX + 5, py - 3) } }
    g.strokeStyle = col('--mut'); g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, axY); g.lineTo(W, axY); g.moveTo(axX, 0); g.lineTo(axX, H); g.stroke()
    g.fillStyle = col('--fg'); g.fillText(st.v, W - 16, axY - 6 < 12 ? axY + 16 : axY - 6); g.fillText(st.name + '(' + st.v + ')', axX + 8 > W - 90 ? axX - 90 : axX + 8, 14)
    g.strokeStyle = col('--acc'); g.lineWidth = 2.5; g.lineJoin = 'round'; g.beginPath(); let prev: number | null = null
    for (let i = 0; i <= W; i++) { const y = st.fn(v.x0 + (v.x1 - v.x0) * i / W)
      if (!isFinite(y) || Math.abs(Y(y)) > 1e5) { prev = null; continue }
      const py = Y(y); if (prev === null || Math.abs(py - prev) > H * 3) g.moveTo(i, py); else g.lineTo(i, py); prev = py }
    g.stroke()
    const dot = (x: number, y: number, c: string) => { if (!isFinite(y)) return; g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), 5, 0, 7); g.fill(); g.strokeStyle = col('--card'); g.lineWidth = 2; g.stroke() }
    st.zeros.slice(0, 40).forEach(x => dot(x, 0, col('--blue'))); st.crit.forEach(p => dot(p.x, p.y, col('--acc')))
  }, [st, v])
  const rect = () => ref.current!.getBoundingClientRect()
  const center = (k: number) => setV(zoomAt(v, (v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, k))
  return <div><canvas ref={ref} width={800} height={480} className="plot"
    onPointerDown={e => { ptrs.current.set(e.pointerId, {x: e.clientX, y: e.clientY}); (e.target as Element).setPointerCapture(e.pointerId); if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; lastD.current = Math.hypot(a.x - b.x, a.y - b.y) } }}
    onPointerMove={e => { const p = toData(e.clientX, e.clientY, vr.current); setCur({x: p.x, y: st.fn(p.x)})
      const prev = ptrs.current.get(e.pointerId); if (!prev) return; ptrs.current.set(e.pointerId, {x: e.clientX, y: e.clientY}); const r = rect()
      if (ptrs.current.size === 1) { const dx = (e.clientX - prev.x) / r.width * (vr.current.x1 - vr.current.x0), dy = (e.clientY - prev.y) / r.height * (vr.current.y1 - vr.current.y0); const w = vr.current; setV({x0: w.x0 - dx, x1: w.x1 - dx, y0: w.y0 + dy, y1: w.y1 + dy}) }
      else if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (lastD.current > 0 && d > 0) { const m = toData((a.x + b.x) / 2, (a.y + b.y) / 2, vr.current); setV(zoomAt(vr.current, m.x, m.y, lastD.current / d)) } lastD.current = d } }}
    onPointerUp={e => { ptrs.current.delete(e.pointerId); lastD.current = 0 }} onPointerCancel={e => { ptrs.current.delete(e.pointerId); lastD.current = 0 }} onPointerLeave={() => setCur(null)} />
    <div className="row"><button onClick={() => center(0.7)}>＋</button><button onClick={() => center(1 / 0.7)}>－</button><button onClick={() => setV(fitView(st))}>⤢ Adatta vista</button>
      <span className="mono muted" style={{marginLeft: 'auto'}}>{cur ? `${st.v}=${tfmt(cur.x)}  ${st.name}=${isFinite(cur.y) ? tfmt(cur.y) : '—'}` : 'trascina · pizzica/rotella per zoom'}</span></div>
    <p className="muted"><span className="dot blue" /> zeri · <span className="dot amber" /> estremi</p></div>
}

const EX = ['a*x+b=0', 'x^2+b*x+c=0', 'f(x)=x^3-3*x', 'y=sin(x)', 'a=2; f(x)=a*x^2', 'sin(pi/4)^2+3!', '5 km/h to m/s']
const SYM = ['^', '(', ')', 'pi', 'sqrt(', '=', ';', 'f(x)=']
function Risolutore({angle}: {angle: Angle}) {
  const [q, setQ] = useState('a*x+b=0'); const [out, setOut] = useState<any>(null); const [err, setErr] = useState(''); const c = useCaret(q, setQ)
  const run = (s = q, v?: string) => { try { const r = solve(s, angle, v); setOut(r); setErr(''); store.set('hist', [s, ...(store.get('hist', []) as string[]).filter(h => h !== s)].slice(0, 30)) } catch (e: any) { setErr(e.message); setOut(null) } }
  return <section><h2>Risolutore</h2>
    <div className="row"><input {...c.bind} className="big" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Espressione, equazione o f(x)=..." autoCapitalize="off" autoCorrect="off" spellCheck={false} /><button className="primary" onClick={() => run()}>Risolvi</button></div>
    <div className="chips">{SYM.map(x => <button key={x} className="chip" onPointerDown={e => e.preventDefault()} onClick={() => c.insert(x)}>{x}</button>)}</div>
    <p className="muted">Lettere libere ammesse. Valori con <code>a=2;</code> davanti. Esempi:</p>
    <div className="chips">{EX.map(x => <button key={x} className="chip ex" onClick={() => { setQ(x); run(x) }}>{x}</button>)}</div>
    {err && <p className="err">{err}</p>}
    {out && <div className="card"><b>{out.kind}</b> <span className="badge">{out.method}</span>
      {out.vars && out.vars.length > 1 && out.forVar && <div className="chips"><span className="muted">Risolvi per:</span>{out.vars.map((x: string) => <button key={x} className={'chip ' + (x === out.forVar ? 'on' : '')} onClick={() => run(q, x)}>{x}</button>)}</div>}
      {out.lines.map((l: any, i: number) => <div key={i} className="line">{l.tex ? <Tex t={l.tex} /> : <span className="mono">{l.t}</span>}{l.approx && <span className="mono muted"> ≈ {l.approx}</span>}</div>)}
      {out.study && <Plot st={out.study} />}</div>}
    <h3>Cronologia</h3>{(store.get('hist', []) as string[]).map(h => <div key={h}><a onClick={() => { setQ(h); run(h) }}>{h}</a></div>)}
  </section>
}

function Scheda({f, angle}: {f: Formula; angle: Angle}) {
  const vars = Object.keys(f.variabili); const [vals, setVals] = useState<Record<string, string>>({}); const [target, setTarget] = useState(vars[0]); const [res, setRes] = useState(''); const [note, setNote] = useState<string>(store.get('note:' + f.id, ''))
  const calc = () => { try {
    const [l, r] = f.expr.split('='); const known: any = {}; vars.filter(x => x !== target).forEach(x => known[x] = Number(vals[x]))
    if (vars.some(x => x !== target && !isFinite(known[x]))) throw new Error('Compila tutte le altre variabili')
    if (l.trim() === target) return setRes(`${target} = ${fmt(evaluate(r, angle, known))}  [valutazione diretta]`)
    const F = (x: number) => Number(evaluate(`(${l})-(${r})`, angle, {...known, [target]: x}))
    const rs = roots(F, -1e4, 1e4, 20000); setRes(rs.length ? rs.map(z => `${target} = ${fmt(z)}`).join(' ; ') + '  [numerico]' : 'Nessuna soluzione reale in [-1e4,1e4]')
  } catch (e: any) { setRes('Errore: ' + e.message) } }
  return <div><span className={'badge ' + f.stato}>{f.stato}</span>
    <div className="tex"><Tex t={f.latex} /></div>{f.ipotesi && <p className="muted">Ipotesi: {f.ipotesi}</p>}<p className="muted">Fonte: {f.fonte}</p>
    <label>Calcola <select value={target} onChange={e => setTarget(e.target.value)}>{vars.map(v => <option key={v}>{v}</option>)}</select></label>
    {vars.filter(v => v !== target).map(v => <div className="row" key={v}><span style={{width: 70}}>{v}</span><input inputMode="decimal" value={vals[v] ?? ''} onChange={e => setVals({...vals, [v]: e.target.value})} placeholder={f.variabili[v]} /></div>)}
    <button onClick={calc}>Calcola</button><div className="mono">{res}</div><textarea className="note" placeholder="Appunti" value={note} onChange={e => { setNote(e.target.value); store.set('note:' + f.id, e.target.value) }} /></div>
}

const MATS = Object.entries(import.meta.glob('/content/formulario/**/_materia.yaml', {query: '?raw', import: 'default', eager: true}) as Record<string, string>).map(([p, r]) => { const x = p.split('/'); return {key: x[x.length - 2], area: x[x.length - 3], nome: (yaml.load(r) as any).nome as string} })
const pretty = (s: string) => s.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())
const cnt = (m: string) => FORMULE.filter(f => f.materia === m).length
function Formulario({angle}: {angle: Angle}) {
  const [q, setQ] = useState(() => { const p = store.get('prefill', ''); store.set('prefill', ''); return p as string }); const [fav, setFav] = useState<string[]>(store.get('fav', []))
  const [area, setArea] = useState('Tutte'), [mat, setMat] = useState('Tutte'), [open, setOpen] = useState<string | null>(null), [onlyFav, setOnlyFav] = useState(false)
  const areas = [...new Set(MATS.map(m => m.area))]
  const mats = MATS.filter(m => area === 'Tutte' || m.area === area)
  const list = useMemo(() => FORMULE.filter(f => (area === 'Tutte' || MATS.find(m => m.key === f.materia)?.area === area) && (mat === 'Tutte' || f.materia === mat) && (!onlyFav || fav.includes(f.id)) && (f.nome + ' ' + f.latex + ' ' + Object.keys(f.variabili).join(' ')).toLowerCase().includes(q.toLowerCase())), [q, area, mat, onlyFav, fav])
  return <section><h2>Formulario</h2>
    <div className="row"><label style={{flex: 1}}>Area <select value={area} onChange={e => { setArea(e.target.value); setMat('Tutte') }}><option>Tutte</option>{areas.map(a => <option key={a} value={a}>{pretty(a)}</option>)}</select></label>
      <label style={{flex: 1}}>Materia <select value={mat} onChange={e => setMat(e.target.value)}><option>Tutte</option>{mats.map(m => <option key={m.key} value={m.key}>{m.nome} ({cnt(m.key)})</option>)}</select></label></div>
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca nome o simbolo..." />
    <label><input type="checkbox" style={{width: 'auto'}} checked={onlyFav} onChange={e => setOnlyFav(e.target.checked)} /> Solo preferite</label>
    <p className="muted">{list.length} formule{mat !== 'Tutte' && cnt(mat) === 0 ? ' — materia ancora da popolare (vedi content/)' : ''}</p>
    {list.map(f => <div key={f.id} className="card"><div className="row" style={{justifyContent: 'space-between'}}>
      <a onClick={() => setOpen(open === f.id ? null : f.id)}>{open === f.id ? '▾' : '▸'} {f.nome}</a>
      <a onClick={() => { const n = fav.includes(f.id) ? fav.filter(x => x !== f.id) : [...fav, f.id]; setFav(n); store.set('fav', n) }}>{fav.includes(f.id) ? '★' : '☆'}</a></div>
      {open === f.id && <Scheda f={f} angle={angle} />}</div>)}</section>
}

const DASH0 = ['search', 'tools', 'recenti', 'preferiti', 'materie']
const DLBL: Record<string, string> = {search: 'Ricerca universale', tools: 'Strumenti rapidi', recenti: 'Ultimi calcoli', preferiti: 'Formule preferite', materie: 'Materie'}
const dash = () => store.get('dash', {order: DASH0, hidden: []}) as {order: string[]; hidden: string[]}
const TOOLS = ['Risolutore', 'Calcolatrice', 'Convertitore']
function Home({go}: {go: (t: string, s?: string) => void}) {
  const [q, setQ] = useState(''); const d = dash(); const ql = q.toLowerCase()
  const res = ql.length < 2 ? [] : [
    ...FORMULE.filter(f => (f.nome + ' ' + f.latex + ' ' + Object.keys(f.variabili).join(' ')).toLowerCase().includes(ql)).slice(0, 8).map(f => ({t: 'Formula', n: f.nome, a: () => { store.set('prefill', f.nome); go('Formulario') }})),
    ...MATS.filter(m => m.nome.toLowerCase().includes(ql)).map(m => ({t: 'Materia', n: m.nome, a: () => go('Formulario')})),
    ...COST.filter(c => c[0].toLowerCase().includes(ql)).map(c => ({t: 'Costante', n: c[0] + ' = ' + c[1], a: () => go('Database')})),
    ...MATERIALI.filter(m => (m.nome + m.categoria).toLowerCase().includes(ql)).map(m => ({t: 'Materiale', n: m.nome, a: () => go('Database')})),
    ...TOOLS.filter(t => t.toLowerCase().includes(ql)).map(t => ({t: 'Strumento', n: t, a: () => go('Toolbox', t)})),
    ...Object.keys(Q).filter(n => n.toLowerCase().includes(ql)).map(n => ({t: 'Grandezza', n, a: () => go('Toolbox', 'Convertitore')}))]
  const sec: Record<string, any> = {
    search: <><input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca formule, materie, costanti, materiali, strumenti..." />
      {res.map((r, i) => <div key={i} className="card"><a onClick={r.a}><span className="badge">{r.t}</span> {r.n}</a></div>)}{ql.length >= 2 && !res.length && <p className="muted">Nessun risultato.</p>}</>,
    tools: <div className="grid">{TOOLS.map(t => <button key={t} onClick={() => go('Toolbox', t)}>{t}</button>)}<button onClick={() => go('Formulario')}>Formulario</button><button onClick={() => go('Database')}>Database</button></div>,
    recenti: <><h3>Ultimi calcoli</h3>{(store.get('hist', []) as string[]).slice(0, 5).map(h => <div key={h} className="mono">{h}</div>) }</>,
    preferiti: <><h3>Formule preferite</h3>{FORMULE.filter(f => (store.get('fav', []) as string[]).includes(f.id)).map(f => <div key={f.id}><a onClick={() => { store.set('prefill', f.nome); go('Formulario') }}>{f.nome}</a></div>)}</>,
    materie: <><h3>Materie</h3><div className="chips">{MATS.filter(m => cnt(m.key) > 0).map(m => <button key={m.key} className="chip" onClick={() => go('Formulario')}>{m.nome} ({cnt(m.key)})</button>)}</div></>}
  return <section><h2>Home</h2>{d.order.filter(k => sec[k] && !d.hidden.includes(k)).map(k => <div key={k}>{sec[k]}</div>)}</section>
}
function DashCfg() {
  const [d, setD] = useState(dash()); const save = (n: typeof d) => { setD(n); store.set('dash', n) }
  const mv = (i: number, j: number) => { if (j < 0 || j >= d.order.length) return; const o = [...d.order];[o[i], o[j]] = [o[j], o[i]]; save({...d, order: o}) }
  return <div><h3>Dashboard</h3>{d.order.map((k, i) => <div className="row" key={k}><input type="checkbox" style={{width: 'auto'}} checked={!d.hidden.includes(k)} onChange={() => save({...d, hidden: d.hidden.includes(k) ? d.hidden.filter(x => x !== k) : [...d.hidden, k]})} />
    <span style={{flex: 1}}>{DLBL[k]}</span><button onClick={() => mv(i, i - 1)}>▲</button><button onClick={() => mv(i, i + 1)}>▼</button></div>)}
    <button onClick={() => save({order: DASH0, hidden: []})}>Ripristina configurazione iniziale</button></div>
}
const MATERIALI: any[] = Object.values(import.meta.glob('/content/materiali/**/materiali.yaml', {query: '?raw', import: 'default', eager: true}) as Record<string, string>).flatMap(r => yaml.load(r) as any[])
class Boundary extends Component<{children: any}, {e: Error | null}> {
  state = {e: null as Error | null}; static getDerivedStateFromError(e: Error) { return {e} }
  render() { return this.state.e ? <div className="card err"><b>Errore dell'applicazione</b><pre style={{whiteSpace: 'pre-wrap'}}>{this.state.e.message}</pre><button onClick={() => location.reload()}>Ricarica</button></div> : this.props.children }
}
const COST = [['Velocità della luce c', '299792458 m/s', 'esatta'], ['Costante di Planck h', '6.62607015e-34 J s', 'esatta'], ['Carica elementare e', '1.602176634e-19 C', 'esatta'], ['Costante di Boltzmann k', '1.380649e-23 J/K', 'esatta'], ['Numero di Avogadro N_A', '6.02214076e23 1/mol', 'esatta'], ['Costante dei gas R', '8.314462618 J/(mol K)', 'esatta'], ['Accelerazione di gravità standard g_n', '9.80665 m/s^2', 'esatta (convenzionale)'], ['Costante gravitazionale G', '6.67430e-11 m^3/(kg s^2)', 'misurata (CODATA 2018, ±0.00015e-11)']]
function Database() {
  const [t, setT] = useState('Costanti'), [q, setQ] = useState('')
  return <section><h2>Database</h2><div className="tabs"><button className={t === 'Costanti' ? 'on' : ''} onClick={() => setT('Costanti')}>Costanti</button><button className={t === 'Materiali' ? 'on' : ''} onClick={() => setT('Materiali')}>Materiali</button></div>
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtra..." />
    {t === 'Costanti' ? COST.filter(c => c[0].toLowerCase().includes(q.toLowerCase())).map(c => <div className="card" key={c[0]}><b>{c[0]}</b><div className="mono">{c[1]}</div><span className="badge">{c[2]}</span></div>)
      : MATERIALI.filter(m => (m.nome + m.categoria).toLowerCase().includes(q.toLowerCase())).map(m => <div className="card" key={m.id}><b>{m.nome}</b> <span className={'badge ' + m.stato}>{m.stato}</span><div className="muted">{m.categoria}</div>
        {m.proprieta.map((p: any) => <div className="row" key={p.nome} style={{justifyContent: 'space-between'}}><span>{p.nome}</span><span className="mono">{p.valore} {p.unita}</span></div>)}<p className="muted">{m.note}</p></div>)}
    <p className="muted">Tabelle tecniche normative: da popolare (non inserite dati non verificati).</p></section>
}

let deferred: any = null
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e })
registerSW({immediate: true, onOfflineReady() { store.set('offlineReady', true) }})
function PwaInfo() {
  const ready = store.get('offlineReady', false), app = matchMedia('(display-mode: standalone)').matches
  return <div><h3>App e offline</h3><p className="muted">Offline: {ready ? 'pronto ✔' : 'non ancora attivo (serve aprire l\'app una volta con connessione, su HTTPS)'}{app ? ' · installata' : ''}</p>
    {deferred && !app && <button onClick={() => deferred.prompt()}>Installa app</button>}</div>
}
function Profilo({angle, setAngle, theme, setTheme}: any) {
  const exp = () => { const d: any = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; d[k] = localStorage.getItem(k) }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], {type: 'application/json'})); a.download = 'acciobox-backup.json'; a.click() }
  const imp = (f: File) => f.text().then(t => { Object.entries(JSON.parse(t)).forEach(([k, v]) => localStorage.setItem(k, v as string)); location.reload() })
  return <section><h2>Profilo</h2><label>Tema <select value={theme} onChange={e => setTheme(e.target.value)}><option value="dark">Scuro</option><option value="light">Chiaro</option></select></label>
    <label>Angoli <select value={angle} onChange={e => setAngle(e.target.value)}><option value="rad">RAD</option><option value="deg">DEG</option></select></label>
    <div className="row"><button onClick={exp}>Esporta backup</button><input type="file" accept=".json" onChange={e => e.target.files?.[0] && imp(e.target.files[0])} /></div>
    <PwaInfo /><DashCfg /><button onClick={() => { localStorage.removeItem('hist'); location.reload() }}>Elimina cronologia</button></section>
}

const ICON: Record<string, any> = {
  Home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  Toolbox: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  Formulario: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M9 8h6M9 12h4" /></>,
  Database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  Profilo: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>}
const Ic = ({n}: {n: string}) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICON[n]}</svg>
function App() {
  const [tab, setTab] = useState('Home'), [sub, setSub] = useState('Risolutore')
  const [angle, setAngle] = useState<Angle>(store.get('angle', 'rad')), [theme, setTheme] = useState<string>(store.get('theme', 'dark'))
  useEffect(() => { document.documentElement.dataset.theme = theme; store.set('theme', theme); store.set('angle', angle) }, [theme, angle])
  const tools: Record<string, any> = {Risolutore: <Risolutore angle={angle} />, Calcolatrice: <Calcolatrice angle={angle} />, Convertitore: <Convertitore />}
  return <div className="app">
    <header className="top"><svg viewBox="0 0 64 64" width="28" height="28"><rect width="64" height="64" rx="14" fill="var(--acc)" /><path d="M10 40C20 14 28 14 32 32S44 50 54 24" fill="none" stroke="#14161a" strokeWidth="6" strokeLinecap="round" /></svg><b>AccioBox</b><span className="muted">{tab}</span>
      <button className="chip" onClick={() => setAngle(angle === 'rad' ? 'deg' : 'rad')}>{angle.toUpperCase()}</button></header>
    <main>
      {tab === 'Home' && <Home go={(t, x) => { setTab(t); if (x) setSub(x) }} />}
      {tab === 'Toolbox' && <><div className="seg">{Object.keys(tools).map(t => <button key={t} className={sub === t ? 'on' : ''} onClick={() => setSub(t)}>{t}</button>)}</div>{tools[sub]}</>}
      {tab === 'Formulario' && <Formulario angle={angle} />}{tab === 'Database' && <Database />}
      {tab === 'Profilo' && <Profilo angle={angle} setAngle={setAngle} theme={theme} setTheme={setTheme} />}</main>
    <nav>{['Home', 'Toolbox', 'Formulario', 'Database', 'Profilo'].map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}><Ic n={t} /><span>{t}</span></button>)}</nav></div>
}
createRoot(document.getElementById('root')!).render(<Boundary><App /></Boundary>)
