-- Prima configurazione: chi aveva già degli utenti prima del wizard (sviluppo, installazioni create con
-- script) risulta configurato. Una tantum, solo alla migrazione: a runtime lo stato non dipende mai dagli utenti.
-- Un database nuovo, senza utenti, non riceve nulla e al primo avvio mostra il wizard su /setup.
INSERT INTO "impostazioni" ("chiave", "valore")
SELECT 'setup',
       jsonb_build_object(
         'setup_completed', true,
         'setup_version', 1,
         'setup_completed_at', to_jsonb(now()),
         'origine', 'installazione-esistente'
       )
WHERE EXISTS (SELECT 1 FROM "users")
ON CONFLICT ("chiave") DO NOTHING;
