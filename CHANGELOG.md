# Changelog
0.1.0 - shell 5 tab, Risolutore + studio di funzione, calcolatrice, convertitore + analizzatore unità, formulario YAML calcolabile, costanti, backup.

0.2.0 - Tastiere a pulsanti (calcolatrice, risolutore, convertitore a menu), Formulario per area/materia, validatore contenuti (`npm run validate`, eseguito in test e build), error boundary, ricerca universale in Home, dashboard configurabile (Profilo), appunti per formula, Database materiali (valori tipici da_verificare), scheletro di tutte le materie della specifica, 69 formule.

0.3.0 - PWA: manifest, icone, service worker con precache (vite-plugin-pwa), aggiornamento automatico, stato offline e pulsante Installa in Profilo. Test: `npm run build && npm run preview` (il service worker non gira in `npm run dev`).

0.4.0 - Rinominato AccioBox. Risolutore: tastiera di sistema, lettere libere (equazioni lineari/quadratiche simboliche, "risolvi per", definizioni "a=2;", studio di f(t), y=...), grafico con assi/griglia/etichette, zoom sul cursore, pizzico, pan, "Adatta vista". Calcolatrice: inserimento nel punto del cursore; dopo "=" un operatore riusa il risultato, una cifra riparte da zero. Convertitore: cursore ovunque + tastiera di sistema opzionale. Nuovo design (header, icone, tasti per tipo). Test di avvio dell'intera UI (jsdom).
