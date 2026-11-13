import {Component, useState, useMemo, useRef, useEffect} from 'react'
import {Q} from './units'
import {createRoot} from 'react-dom/client'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import yaml from 'js-yaml'
import {solve, fmt, evaluate, roots, analyzeUnits, convert, Angle, Study} from './engine'
import './style.css'
import {registerSW} from 'virtual:pwa-register'
import {Keypad, Calcolatrice, Convertitore} from './keypad'

type Formula = {id: string; nome: string; latex: string; expr: string; stato: string; fonte: string; ipotesi?: string; variabili: Record<string, string>; materia: string}
const files = import.meta.glob('/content/formulario/**/formule.yaml', {query: '?raw', import: 'default', eager: true}) as Record<string, string>
const FORMULE: Formula[] = Object.entries(files).flatMap(([p, raw]) => {
  const materia = p.split('/').slice(-2, -1)[0]
  return (yaml.load(raw) as any[]).map(f => ({...f, materia}))
})
const Tex = ({t}: {t: string}) => <span dangerouslySetInnerHTML={{__html: katex.renderToString(t, {throwOnError: false})}} />
const store = {get: (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) ?? '') } catch { return d } }, set: (k: string, v: any) => localStorage.setItem(k, JSON.stringify(v))}

function Plot({st}: {st: Study}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [v, setV] = useState({x0: -6, x1: 6, y0: -6, y1: 6})
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!, W = c.width, H = c.height
    const X = (x: number) => (x - v.x0) / (v.x1 - v.x0) * W, Y = (y: number) => H - (y - v.y0) / (v.y1 - v.y0) * H
    g.clearRect(0, 0, W, H); g.strokeStyle = '#888'; g.beginPath(); g.moveTo(X(0), 0); g.lineTo(X(0), H); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.stroke()
    g.strokeStyle = '#e8a33d'; g.lineWidth = 2; g.beginPath(); let pen = false
    for (let i = 0; i <= W; i++) { const x = v.x0 + (v.x1 - v.x0) * i / W, y = st.fn(x)
      if (!isFinite(y) || Math.abs(y) > 1e6) { pen = false; continue }
      pen ? g.lineTo(i, Y(y)) : g.moveTo(i, Y(y)); pen = true }
    g.stroke()
  }, [st, v])
  const drag = useRef<{x: number; y: number} | null>(null)
  return <canvas ref={ref} width={640} height={360} className="plot"
    onWheel={e => { const k = e.deltaY > 0 ? 1.15 : 1 / 1.15, cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2, hx = (v.x1 - v.x0) / 2 * k, hy = (v.y1 - v.y0) / 2 * k; setV({x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy}) }}
    onPointerDown={e => { drag.current = {x: e.clientX, y: e.clientY}; (e.target as Element).setPointerCapture(e.pointerId) }}
    onPointerUp={() => drag.current = null}
    onPointerMove={e => { if (!drag.current) return; const r = ref.current!.getBoundingClientRect(), dx = (e.clientX - drag.current.x) / r.width * (v.x1 - v.x0), dy = (e.clientY - drag.current.y) / r.height * (v.y1 - v.y0)
      drag.current = {x: e.clientX, y: e.clientY}; setV({x0: v.x0 - dx, x1: v.x1 - dx, y0: v.y0 + dy, y1: v.y1 + dy}) }} />
}

function Risolutore({angle}: {angle: Angle}) {
  const [q, setQ] = useState('f(x) = x^3 - 3x'); const [out, setOut] = useState<any>(null); const [err, setErr] = useState('')
  const run = (s = q) => { try { const r = solve(s, angle); setOut(r); setErr(''); store.set('hist', [s, ...store.get('hist', []).filter((h: string) => h !== s)].slice(0, 30)) } catch (e: any) { setErr(e.message); setOut(null) } }
  return <section><h2>Risolutore</h2>
    <p className="muted">Esempi: <code>sin(pi/4)^2+3!</code> · <code>x^2-5x+6=0</code> · <code>f(x)=x^3-3x</code> · <code>5 km/h to m/s</code></p>
    <input inputMode="none" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} />
    <Keypad onKey={t => setQ(q + t)} onDel={() => setQ(q.slice(0, -1))} onClear={() => setQ('')} onEq={() => run()} extra={[{l: 'x'}, {l: '=', t: ' = '}, {l: 'f(x)=', t: 'f(x) = '}, {l: 'abs', t: 'abs('}, {l: 'to', t: ' to '}]} />
    {err && <p className="err">{err}</p>}
    {out && <div className="card"><b>{out.kind}</b> <span className="badge">{out.method}</span>{out.lines.map((l: string, i: number) => <div key={i} className="mono">{l}</div>)}{out.study && <Plot st={out.study} />}</div>}
    <h3>Cronologia</h3>{store.get('hist', []).map((h: string) => <div key={h}><a onClick={() => { setQ(h); run(h) }}>{h}</a></div>)}
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
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], {type: 'application/json'})); a.download = 'toolbox-backup.json'; a.click() }
  const imp = (f: File) => f.text().then(t => { Object.entries(JSON.parse(t)).forEach(([k, v]) => localStorage.setItem(k, v as string)); location.reload() })
  return <section><h2>Profilo</h2><label>Tema <select value={theme} onChange={e => setTheme(e.target.value)}><option value="dark">Scuro</option><option value="light">Chiaro</option></select></label>
    <label>Angoli <select value={angle} onChange={e => setAngle(e.target.value)}><option value="rad">RAD</option><option value="deg">DEG</option></select></label>
    <div className="row"><button onClick={exp}>Esporta backup</button><input type="file" accept=".json" onChange={e => e.target.files?.[0] && imp(e.target.files[0])} /></div>
    <PwaInfo /><DashCfg /><button onClick={() => { localStorage.removeItem('hist'); location.reload() }}>Elimina cronologia</button></section>
}

function App() {
  const [tab, setTab] = useState('Home'), [sub, setSub] = useState('Risolutore')
  const [angle, setAngle] = useState<Angle>(store.get('angle', 'rad')), [theme, setTheme] = useState<string>(store.get('theme', 'dark'))
  useEffect(() => { document.documentElement.dataset.theme = theme; store.set('theme', theme); store.set('angle', angle) }, [theme, angle])
  const tools: Record<string, any> = {Risolutore: <Risolutore angle={angle} />, Calcolatrice: <Calcolatrice angle={angle} />, Convertitore: <Convertitore />}
  return <div className="app"><main>
    {tab === 'Home' && <Home go={(t, x) => { setTab(t); if (x) setSub(x) }} />}
    {tab === 'Toolbox' && <><div className="tabs">{Object.keys(tools).map(t => <button key={t} className={sub === t ? 'on' : ''} onClick={() => setSub(t)}>{t}</button>)}</div>{tools[sub]}</>}
    {tab === 'Formulario' && <Formulario angle={angle} />}{tab === 'Database' && <Database />}
    {tab === 'Profilo' && <Profilo angle={angle} setAngle={setAngle} theme={theme} setTheme={setTheme} />}</main>
    <nav>{['Home', 'Toolbox', 'Formulario', 'Database', 'Profilo'].map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav></div>
}
createRoot(document.getElementById('root')!).render(<Boundary><App /></Boundary>)
