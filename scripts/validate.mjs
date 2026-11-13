import fs from 'fs'; import path from 'path'; import yaml from 'js-yaml'; import {evaluate} from 'mathjs'
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
const errs = [], ids = new Set(), STATI = ['verificato', 'da_verificare', 'bozza']
const FN = new Set(['pi', 'e', 'sin', 'cos', 'tan', 'sqrt', 'log', 'log10', 'exp', 'abs', 'asin', 'acos', 'atan'])
const load = f => { try { return yaml.load(fs.readFileSync(f, 'utf8')) } catch (e) { errs.push(`${f}: YAML non valido: ${e.message.split('\n')[0]}`) } }
let nf = 0
for (const f of walk('content')) {
  if (f.endsWith('_materia.yaml')) { const d = load(f); if (d && !d.nome) errs.push(`${f}: manca "nome"`) }
  if (f.endsWith('formule.yaml')) { const a = load(f); if (!a) continue; if (!Array.isArray(a)) { errs.push(`${f}: deve essere una lista`); continue }
    a.forEach((x, i) => { nf++; const w = `${f} [#${i + 1} ${x?.id}]`
      for (const k of ['id', 'nome', 'latex', 'expr', 'stato', 'fonte', 'ipotesi', 'variabili']) if (!x[k]) errs.push(`${w}: manca "${k}"`)
      if (!STATI.includes(x.stato)) errs.push(`${w}: stato non valido "${x.stato}"`)
      if (ids.has(x.id)) errs.push(`${w}: id duplicato`); ids.add(x.id)
      if (!x.expr || !x.variabili) return
      const vars = Object.keys(x.variabili), idf = (x.expr.match(/\b[A-Za-z_]\w*\b/g) || []).filter(s => !FN.has(s))
      for (const s of new Set(idf)) if (!vars.includes(s)) errs.push(`${w}: simbolo "${s}" in expr non dichiarato in variabili`)
      for (const v of vars) if (!idf.includes(v)) errs.push(`${w}: variabile "${v}" dichiarata ma non usata in expr`)
      try { const sc = Object.fromEntries(vars.map(v => [v, 2])); x.expr.split('=').forEach(s => evaluate(s, {...sc})) } catch (e) { errs.push(`${w}: expr non valutabile: ${e.message}`) } }) }
  if (f.endsWith('materiali.yaml')) { const a = load(f); (a || []).forEach(x => { for (const k of ['id', 'nome', 'categoria', 'stato', 'proprieta']) if (!x[k]) errs.push(`${f} [${x.id}]: manca "${k}"`) }) }
}
if (errs.length) { console.error('ERRORI NEI CONTENUTI:\n' + errs.join('\n')); process.exit(1) }
console.log(`Contenuti OK: ${nf} formule`)
