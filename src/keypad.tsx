import {useState, useMemo} from 'react'
import {evaluate, fmt, convert, analyzeUnits, Angle} from './engine'
import {Q} from './units'

type Key = {l: string; t?: string; k?: string}
const B = ({k, onClick, cls}: {k: string; onClick: () => void; cls?: string}) => <button className={'key ' + (cls ?? '')} onClick={onClick}>{k}</button>

export function Keypad({onKey, onDel, onClear, onEq, extra}: {onKey: (t: string) => void; onDel: () => void; onClear: () => void; onEq: () => void; extra?: Key[]}) {
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
  return <div>
    {extra && <div className="keys k5">{extra.map(x => <B key={x.l} k={x.l} onClick={() => onKey(x.t ?? x.l)} cls="fn" />)}</div>}
    <div className="keys k5">{rows.flat().map((x, i) => <B key={i} k={x.l} onClick={() => press(x)} cls={x.k === 'eq' ? 'eq' : /^[0-9.]$/.test(x.l) ? 'num' : x.k === 'inv' && inv ? 'on' : 'fn'} />)}</div></div>
}

export function Calcolatrice({angle}: {angle: Angle}) {
  const [e, setE] = useState(''); const [ans, setAns] = useState(0); const [done, setDone] = useState('')
  const preview = useMemo(() => { if (!e) return ''; try { return fmt(evaluate(e, angle, {Ans: ans}), 12) } catch { return '' } }, [e, angle, ans])
  const eq = () => { try { const v = evaluate(e, angle, {Ans: ans}); setDone(e + ' ='); setAns(typeof v === 'number' ? v : 0); setE(fmt(v, 12)) } catch (x: any) { setDone('Errore: ' + x.message) } }
  return <section><h2>Calcolatrice scientifica <span className="badge">{angle.toUpperCase()}</span></h2>
    <div className="card display"><div className="muted">{done}</div>
      <input inputMode="none" value={e} onChange={x => setE(x.target.value)} onKeyDown={x => x.key === 'Enter' && eq()} placeholder="0" /><div className="mono preview">{preview}</div></div>
    <Keypad onKey={t => setE(e + t)} onDel={() => setE(e.slice(0, -1))} onClear={() => { setE(''); setDone('') }} onEq={eq} /></section>
}

const NUM: Key[] = '789456123'.split('').map(l => ({l}))
export function Convertitore() {
  const [q, setQ] = useState('Lunghezza'); const [from, setFrom] = useState('m'); const [to, setTo] = useState('km'); const [v, setV] = useState('1')
  const pick = (n: string) => { setQ(n); setFrom(Q[n][0][0]); setTo(Q[n][1]?.[0] ?? Q[n][0][0]) }
  const conv = (t: string) => { try { return fmt(convert(+v, from, t), 10) } catch { return '—' } }
  const key = (t: string) => t === '⌫' ? setV(v.slice(0, -1)) : t === 'C' ? setV('') : t === '±' ? setV(v.startsWith('-') ? v.slice(1) : '-' + v) : setV(v + t)
  const [c, setC] = useState('kg*m/s^2'); let an: any = null, aerr = ''; try { an = analyzeUnits(c) } catch (x: any) { aerr = x.message }
  const chips = ['kg', 'g', 'm', 's', 'A', 'K', 'mol', 'N', 'J', 'W', 'Pa', 'V', 'ohm', 'Hz', 'C', 'F', 'H', '*', '/', '^', '2', '3', '(', ')']
  return <section><h2>Convertitore universale</h2>
    <label>1 · Grandezza <select value={q} onChange={e => pick(e.target.value)}>{Object.keys(Q).map(n => <option key={n}>{n}</option>)}</select></label>
    <div className="row"><label style={{flex: 1}}>Da <select value={from} onChange={e => setFrom(e.target.value)}>{Q[q].map(([u, n]) => <option key={u} value={u}>{n} ({u})</option>)}</select></label>
      <button onClick={() => { setFrom(to); setTo(from) }}>⇄</button>
      <label style={{flex: 1}}>A <select value={to} onChange={e => setTo(e.target.value)}>{Q[q].map(([u, n]) => <option key={u} value={u}>{n} ({u})</option>)}</select></label></div>
    <div className="card display"><input inputMode="none" value={v} onChange={e => setV(e.target.value)} /><div className="mono preview">= {conv(to)} {to}</div></div>
    <div className="keys k4">{[...NUM, {l: '.'}, {l: '0'}, {l: '±'}, {l: '⌫'}, {l: 'C'}].map(x => <B key={x.l} k={x.l} cls={/\d|\./.test(x.l) ? 'num' : 'fn'} onClick={() => key(x.l)} />)}</div>
    {q === 'Temperatura' && <p className="muted">Temperature assolute. Per le differenze di temperatura 1 K = 1 °C = 1,8 °F, senza offset.</p>}
    <h3>Tutte le unità</h3><div className="card">{Q[q].map(([u, n]) => <div key={u} className="row" style={{justifyContent: 'space-between'}}><span>{n} ({u})</span><span className="mono">{conv(u)}</span></div>)}</div>
    <h3>Analizzatore di unità composte</h3>
    <input inputMode="none" value={c} onChange={e => setC(e.target.value)} />
    <div className="chips">{chips.map(x => <button key={x} className="chip" onClick={() => setC(c + x)}>{x}</button>)}<button className="chip" onClick={() => setC(c.slice(0, -1))}>⌫</button><button className="chip" onClick={() => setC('')}>C</button></div>
    {aerr && <p className="err">{aerr}</p>}
    {an && <div className="card"><div className="mono">Forma SI: {an.si}</div>{an.matches.length ? an.matches.map((m: any) => <div key={m.unit}><b>{m.unit}</b> — {m.quantity} (1 {c} = {m.factor} {m.unit})</div>) : <div>Nessuna unità nominata corrisponde.</div>}{an.ambiguous && <p className="muted">Più grandezze condividono questa dimensione: scegli in base al contesto.</p>}</div>}
  </section>
}
