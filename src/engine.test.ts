import {test, expect} from 'vitest'
import {solve, analyzeUnits, convert, evaluate} from './engine'
test('kg*m/s^2 = N', () => expect(analyzeUnits('kg*m/s^2').matches.map(m => m.unit)).toContain('N'))
test('V*A = W', () => expect(analyzeUnits('V*A').matches.map(m => m.unit)).toContain('W'))
test('temperatura offset', () => expect(convert(100, 'degC', 'K')).toBeCloseTo(373.15))
test('incompatibili', () => expect(() => convert(1, 'm', 's')).toThrow())
test('deg', () => expect(evaluate('sin(90)', 'deg')).toBeCloseTo(1))
test('equazione', () => expect(solve('x^2-5x+6=0', 'rad').lines.length).toBe(2))
test('studio', () => expect(solve('f(x)=x^3-3x', 'rad').study!.crit.length).toBe(2))
import {Q} from './units'
import {math as _m} from './engine'
test('tutte le unità del convertitore sono valide e coerenti', () => {
  for (const [q, us] of Object.entries(Q)) for (const [u] of us) {
    expect(() => convert(1, u, us[0][0]), `${q}:${u}`).not.toThrow()
  }
})
