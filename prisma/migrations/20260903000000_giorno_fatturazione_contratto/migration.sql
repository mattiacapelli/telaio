-- Giorno del mese (1-28, intervallo scelto per evitare la casistica dei mesi
-- corti) in cui lo scheduler genera automaticamente la fattura del canone
-- corrente. NULL = nessuna fatturazione automatica, resta manuale tramite il
-- bottone "Fattura canone".
ALTER TABLE "Contratto" ADD COLUMN "giornoFatturazione" INTEGER;

-- Difesa in profondità oltre alla validazione Zod: il range è già garantito
-- dall'API, un CHECK a livello DB evita che altre vie di scrittura (script,
-- import futuri) violino l'invariante che rende superfluo il fallback sui
-- mesi corti.
ALTER TABLE "Contratto" ADD CONSTRAINT "Contratto_giornoFatturazione_check"
    CHECK ("giornoFatturazione" IS NULL OR ("giornoFatturazione" BETWEEN 1 AND 28));
