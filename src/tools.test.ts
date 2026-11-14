import {test, expect} from 'vitest'
import {buildCurves} from './tools'
const row = (a: string, kind: 'y' | 'p' = 'y', b = '') => ({kind, a, b, t0: '0', t1: '2*pi'})
test('intersezione sin(x) e x/2 in x=0', () => { const r = buildCurves([row('sin(x)'), row('x/2')], 'rad'); expect(r.errors).toEqual([null, null]); expect(r.inter.some(p => Math.abs(p.x) < 1e-6)).toBe(true) })
test('parabola e retta: due intersezioni', () => expect(buildCurves([row('x^2'), row('x+2')], 'rad').inter.length).toBe(2))
test('parametrica: cerchio', () => { const c = buildCurves([row('cos(t)', 'p', 'sin(t)')], 'rad').curves[0] as any; const t = 1.3; expect(Math.hypot(c.fx(t), c.fy(t))).toBeCloseTo(1) })
test('funzione non valida: errore, nessuna curva', () => { const r = buildCurves([row('2*+')], 'rad'); expect(r.errors[0]).toBeTruthy(); expect(r.curves.length).toBe(0) })
test('y= prefisso accettato', () => expect(buildCurves([row('y = x^2')], 'rad').errors[0]).toBeNull())
