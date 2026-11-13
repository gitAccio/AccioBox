import {useState, useMemo, useRef, useLayoutEffect} from 'react'
import {evaluate, fmt, convert, analyzeUnits, Angle} from './engine'
import {Q} from './units'

/** Inserimento nel punto in cui si trova il cursore (o sostituzione della selezione). */
export function useCaret(val: string, set: (s: string) => void) {
  const ref = useRef<HTMLInputElement>(null), pos = useRef<number | null>(null), touched = useRef(false)
  useLayoutEffect(() => { const el = ref.current, p = pos.current; if (el && p !== null) { pos.current = null; el.focus({preventScroll: true}); el.setSelectionRange(p, p) } })
  const range = () => { const el = ref.current; if (!el || !touched.current) return [val.length, val.length]; return [el.selectionStart ?? val.length, el.selectionEnd ?? val.length] }
  return {
    bind: {ref, onFocus: () => { touched.current = true }},
    insert: (t: string, replaceAll = false) => { if (replaceAll) { set(t); pos.current = t.length; touched.current = true; return }
      const [s, e] = range(); set(val.slice(0, s) + t + val.slice(e)); pos.current = s + t.length; touched.current = true },
    del: () => { const [s, e] = range(); touched.current = true; if (s !== e) { set(val.slice(0, s) + val.slice(e)); pos.current = s } else if (s > 0) { set(val.slice(0, s - 1) + val.slice(s)); pos.current = s - 1 } },
    caretEnd: (n: number) => { pos.current = n; touched.current = true }}
}
const keep = (e: React.PointerEvent) => e.preventDefault() // i tasti non tolgono il focus al campo
type Key = {l: string; t?: string; k?: string}
const B = ({k, onClick, cls}: {k: string; onClick: () => void; cls?: string}) => <button className={'key ' + (cls ?? '')} onPointerDown={keep} onClick={onClick}>{k}</button>
const OPS = new Set(['+', '-', '*', '/', '^', '^2', '^(-1)', '!', '*10^', ')'])

export function Keypad({onKey, onDel, onClear, onEq}: {onKey: (t: string) => void; onDel: () => void; onClear: () => void; onEq: () => void}) {
  const [inv, setInv] = useState(false)
  const k = (a: Key, b?: Key) => (inv && b ? b : a)
  const rows: Key[][] = [
    [{l: 'INV', k: 'inv'}, k({l: 'sin', t: 'sin('}, {l: 'sin⁻¹', t: 'asin('}), k({l: 'cos', t: 'cos('}, {l: 'cos⁻¹', t: 'acos('}), k({l: 'tan', t: 'tan('}, {l: 'tan⁻¹', t: 'atan('}), {l: '⌫', k: 'del'}],
    [k({l: 'ln', t: 'log('}, {l: 'eˣ', t: 'exp('}), k({l: 'log', t: 'log10('}, {l: '10ˣ', t: '10^('}), {l: '√', t: 'sqrt('}, {l: 'x²', t: '^2'}, {l: 'xʸ', t: '^'}],
    [{l: 'π', t: 'pi'}, {l: 'e', t: 'e'}, {l: 'n!', t: '!'}, {l: '(', t: '('}, {l: ')', t: ')'}],
    [{l: '7'}, {l: '8'}, {l: '9'}, {l: '÷', t: '/'}, {l: 'C', k: 'clear'}],
    [{l: '4'}, {l: '5'}, {l: '6'}, {l: '×', t: '*'}, {l: '1/x', t: '^(-1)'}],
    [{l: '1'}, {l: '2'}, {l: '3'}, {l: '−', t: '-'}, {l: 'Ans'}],
    [{l: '0'}, {l: '.'}, {l: 'EXP', t: '*10^'}, {l: '+'}, {l: '=', k: 'eq'}]]
  const press = (x: Key) => x.k === 'inv' ? setInv(!inv) : x.k === 'del' ? onDel() : x.k === 'clear' ? onClear() : x.k === 'eq' ? onEq() : onKey(x.t ?? x.l)
  const cls = (x: Key) => x.k === 'eq' ? 'eq' : x.k === 'inv' ? (inv ? 'on' : 'fn') : x.k === 'del' || x.k === 'clear' ? 'del' : /^[0-9.]$/.test(x.l) ? 'num' : '÷×−+'.includes(x.l) ? 'op' : 'fn'
  return <div className="keys k5">{rows.flat().map((x, i) => <B key={i} k={x.l} onClick={() => press(x)} cls={cls(x)} />)}</div>
}

const KbBtn = ({on, set}: {on: boolean; set: (b: boolean) => void}) => <button className={'chip ' + (on ? 'on' : '')} title="Tastiera del dispositivo" onClick={() => set(!on)}>⌨ {on ? 'Tastiera attiva' : 'Tastiera'}</button>

export function Calcolatrice({angle}: {angle: Angle}) {
  const [e, setE] = useState(''), [ans, setAns] = useState(0), [done, setDone] = useState(''), [fresh, setFresh] = useState(false), [kb, setKb] = useState(false)
  const c = useCaret(e, setE)
  const preview = useMemo(() => { if (!e || fresh) return ''; try { return fmt(evaluate(e, angle, {Ans: ans}), 12) } catch { return '' } }, [e, angle, ans, fresh])
  const key = (t: string) => { if (fresh) { setFresh(false); if (!OPS.has(t)) { c.insert(t, true); return } c.caretEnd(e.length); setE(e + t); c.caretEnd(e.length + t.length); return } c.insert(t) }
  const del = () => { setFresh(false); c.del() }
  const eq = () => { try { const v = evaluate(e, angle, {Ans: ans}), r = fmt(v, 12); setDone(e + ' ='); setAns(typeof v === 'number' ? v : ans); setE(r); c.caretEnd(r.length); setFresh(true) } catch (x: any) { setDone('Errore: ' + x.message) } }
  return <section><h2>Calcolatrice scientifica <span className="badge">{angle.toUpperCase()}</span></h2>
    <div className="card display"><div className="muted hist">{done}</div>
      <input {...c.bind} inputMode={kb ? 'text' : 'none'} value={e} onChange={x => { setFresh(false); setE(x.target.value) }} onPointerUp={() => setFresh(false)} onKeyDown={x => x.key === 'Enter' && eq()} placeholder="0" />
      <div className="mono preview">{preview}</div></div>
    <div className="row"><KbBtn on={kb} set={setKb} /><span className="muted">Tocca il campo per spostare il cursore</span></div>
    <Keypad onKey={key} onDel={del} onClear={() => { setE(''); setDone(''); setFresh(false) }} onEq={eq} /></section>
}

export function Convertitore() {
  const [q, setQ] = useState('Lunghezza'), [from, setFrom] = useState('m'), [to, setTo] = useState('km'), [v, setV] = useState('1')
  const pick = (n: string) => { setQ(n); setFrom(Q[n][0][0]); setTo(Q[n][1]?.[0] ?? Q[n][0][0]) }
  const conv = (t: string) => { try { return fmt(convert(+v, from, t), 10) } catch { return '—' } }
  const cv = useCaret(v, setV), [kv, setKv] = useState(false)
  const [c, setC] = useState('kg*m/s^2'), cc = useCaret(c, setC), [kc, setKc] = useState(false)
  let an: any = null, aerr = ''; try { an = analyzeUnits(c) } catch (x: any) { aerr = x.message }
  const chips = ['kg', 'g', 'm', 's', 'A', 'K', 'mol', 'N', 'J', 'W', 'Pa', 'V', 'ohm', 'Hz', 'C', 'F', 'H', '*', '/', '^', '2', '3', '(', ')']
  const nk = (t: string) => t === '⌫' ? cv.del() : t === 'C' ? setV('') : t === '±' ? setV(v.startsWith('-') ? v.slice(1) : '-' + v) : cv.insert(t)
  return <section><h2>Convertitore universale</h2>
    <label>1 · Grandezza <select value={q} onChange={e => pick(e.target.value)}>{Object.keys(Q).map(n => <option key={n}>{n}</option>)}</select></label>
    <div className="row"><label style={{flex: 1}}>Da <select value={from} onChange={e => setFrom(e.target.value)}>{Q[q].map(([u, n]) => <option key={u} value={u}>{n} ({u})</option>)}</select></label>
      <button className="swap" onClick={() => { setFrom(to); setTo(from) }}>⇄</button>
      <label style={{flex: 1}}>A <select value={to} onChange={e => setTo(e.target.value)}>{Q[q].map(([u, n]) => <option key={u} value={u}>{n} ({u})</option>)}</select></label></div>
    <div className="card display"><input {...cv.bind} inputMode={kv ? 'decimal' : 'none'} value={v} onChange={e => setV(e.target.value)} /><div className="mono preview">= {conv(to)} {to}</div></div>
    <div className="row"><KbBtn on={kv} set={setKv} /></div>
    <div className="keys k4">{['7', '8', '9', '⌫', '4', '5', '6', 'C', '1', '2', '3', '±', '0', '.'].map(x => <B key={x} k={x} cls={/\d|\./.test(x) ? 'num' : 'del'} onClick={() => nk(x)} />)}</div>
    {q === 'Temperatura' && <p className="muted">Temperature assolute. Per le differenze di temperatura 1 K = 1 °C = 1,8 °F, senza offset.</p>}
    <h3>Tutte le unità</h3><div className="card">{Q[q].map(([u, n]) => <div key={u} className="row" style={{justifyContent: 'space-between'}}><span>{n} ({u})</span><span className="mono">{conv(u)}</span></div>)}</div>
    <h3>Analizzatore di unità composte</h3>
    <input {...cc.bind} inputMode={kc ? 'text' : 'none'} value={c} onChange={e => setC(e.target.value)} placeholder="es. kg*m/s^2" />
    <div className="chips"><KbBtn on={kc} set={setKc} />{chips.map(x => <button key={x} className="chip" onPointerDown={keep} onClick={() => cc.insert(x)}>{x}</button>)}<button className="chip" onPointerDown={keep} onClick={cc.del}>⌫</button><button className="chip" onClick={() => setC('')}>C</button></div>
    {aerr && <p className="err">{aerr}</p>}
    {an && <div className="card"><div className="mono">Forma SI: {an.si}</div>{an.matches.length ? an.matches.map((m: any) => <div key={m.unit}><b>{m.unit}</b> — {m.quantity} (1 {c} = {m.factor} {m.unit})</div>) : <div>Nessuna unità nominata corrisponde.</div>}{an.ambiguous && <p className="muted">Più grandezze condividono questa dimensione: scegli in base al contesto.</p>}</div>}
  </section>
}
