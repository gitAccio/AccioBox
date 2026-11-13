import {test, expect} from 'vitest'
import {solve, analyzeUnits, convert, evaluate} from './engine'
test('kg*m/s^2 = N', () => expect(analyzeUnits('kg*m/s^2').matches.map(m => m.unit)).toContain('N'))
test('V*A = W', () => expect(analyzeUnits('V*A').matches.map(m => m.unit)).toContain('W'))
test('temperatura offset', () => expect(convert(100, 'degC', 'K')).toBeCloseTo(373.15))
test('incompatibili', () => expect(() => convert(1, 'm', 's')).toThrow())
test('deg', () => expect(evaluate('sin(90)', 'deg')).toBeCloseTo(1))
test('equazione', () => expect(solve('x^2-5x+6=0', 'rad').lines.length).toBe(3))
test('studio', () => expect(solve('f(x)=x^3-3x', 'rad').study!.crit.length).toBe(2))
import {Q} from './units'
import {math as _m} from './engine'
test('tutte le unità del convertitore sono valide e coerenti', () => {
  for (const [q, us] of Object.entries(Q)) for (const [u] of us) {
    expect(() => convert(1, u, us[0][0]), `${q}:${u}`).not.toThrow()
  }
})

test('equazione lineare con sole lettere', () => { const r = solve('a*x+b=0', 'rad'); expect(r.method).toBe('simbolico'); expect(r.lines[0].t.replace(/\s/g, '')).toBe('x=-(b/a)') })
test('quadratica simbolica', () => { const r = solve('x^2+b*x+c=0', 'rad'); expect(r.lines.length).toBeGreaterThanOrEqual(2); expect(r.vars).toContain('b') })
test('risolvi per altra lettera', () => expect(solve('a*x+b=0', 'rad', 'b').lines[0].t.replace(/\s/g, '')).toBe('b=-(a*x)'))
test('radici numeriche quadratica', () => expect(solve('x^2-5x+6=0', 'rad').lines.map(l => l.t + (l.approx ?? '')).join(' ')).toMatch(/2/))
test('definizioni e studio con parametro', () => { const r = solve('a=2; f(x)=a*x^2', 'rad'); expect(r.study!.crit.length).toBe(1); expect(r.study!.crit[0].kind).toBe('minimo') })
test('y= con altra variabile', () => expect(solve('y=t^2-4', 'rad').study!.zeros.length).toBe(2))
test('parametri senza valore: solo simbolico', () => { const r = solve('f(x)=a*x^2+b', 'rad'); expect(r.study).toBeUndefined(); expect(r.lines[1].t).toContain("f'(x)") })
test('espressione simbolica', () => expect(solve('x+x+y', 'rad').method).toBe('simbolico'))
test('unità come espressione', () => expect(solve('5 km/h to m/s', 'rad').lines[0].t).toContain('1.38'))
