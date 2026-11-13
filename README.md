# Engineering Toolbox (web app)
`npm install && npm run dev` · `npm test` · `npm run build`
Contenuti in `content/` (vedi content/README.md). Motore in `src/engine.ts` (math.js isolato in un solo file).
Stato: iterazione 1, non ancora compilata/testata (vedi CHANGELOG).

## Contenuti
`npm run validate` controlla tutti i YAML in `content/` (campi obbligatori, id univoci, simboli di `expr` dichiarati in `variabili`, espressione valutabile) e indica file e scheda in errore. Viene eseguito anche da `npm test` e `npm run build`.
