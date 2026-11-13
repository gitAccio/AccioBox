// @vitest-environment jsdom
import {test, expect, beforeAll} from 'vitest'
beforeAll(() => {
  document.body.innerHTML = '<div id="root"></div>'
  ;(window as any).matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}})
  ;(HTMLCanvasElement.prototype as any).getContext = () => new Proxy({}, {get: () => () => {}, set: () => true})
})
const tick = () => new Promise(r => setTimeout(r, 50))
const click = (txt: string) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim().startsWith(txt)); if (!b) throw new Error('bottone non trovato: ' + txt); (b as HTMLElement).click() }
test('l\'app si avvia e tutte le schermate si aprono', async () => {
  await import('./main')
  await tick(); expect(document.body.textContent).toContain('AccioBox')
  for (const t of ['Toolbox', 'Formulario', 'Database', 'Profilo', 'Home']) { click(t); await tick(); expect(document.querySelector('.card.err'), t).toBeNull() }
  click('Toolbox'); await tick()
  for (const t of ['Calcolatrice', 'Convertitore', 'Risolutore']) { click(t); await tick(); expect(document.querySelector('.card.err'), t).toBeNull() }
  click('Risolutore'); await tick(); click('Risolvi'); await tick(); expect(document.body.textContent).toContain('simbolico')
  click('f(x)=x^3-3*x'); await tick(); expect(document.body.textContent).toContain('Studio di funzione')
  click('Calcolatrice'); await tick(); for (const k of ['7', '+', '8', '=']) { click(k); await tick() }
  expect((document.querySelector('.display input') as HTMLInputElement).value).toBe('15')
  click('+'); await tick(); click('2'); await tick(); click('='); await tick()
  expect((document.querySelector('.display input') as HTMLInputElement).value).toBe('17')
  click('5'); await tick(); expect((document.querySelector('.display input') as HTMLInputElement).value).toBe('5')
})
