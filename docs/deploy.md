# Deploy in produzione

Telaio gira sul nuovo VPS Ubuntu 24.04 con Docker Compose. Il reverse proxy è Nginx UI nel container
`nginx-ui`: il servizio web è collegato alla rete Docker esterna `proxy` con alias `telaio-web`.
Le immagini vengono costruite su GitHub Actions, pubblicate su GHCR con il commit SHA come tag e distribuite via SSH.

```
Internet ──443──▶ nginx-ui (Docker, Let's Encrypt)
                         │
                         ▼ rete Docker esterna "proxy" → telaio-web:3000
              ┌─────────────── Docker Compose (progetto telaio-prod) ───────────────┐
              │  web ──┬── rete "proxy" (condivisa con nginx-ui)                    │
              │        ├── rete "backend" (interna) ── postgres 18                  │
              │  worker┘                              └─ redis 7                    │
              │  migrate (job una tantum, prima di web e worker)                    │
              └─────────────────────────────────────────────────────────────────────┘
```

La porta locale `127.0.0.1:3100` resta disponibile solo per diagnostica e health check dal VPS.
PostgreSQL e Redis non pubblicano porte host.

- Un solo `Dockerfile` (multi-stage) con due immagini: `telaio-web` (Next.js standalone) e `telaio-worker`
  (job BullMQ; con un altro comando esegue anche le migrazioni).
- Postgres e Redis non hanno porte pubbliche e stanno su una rete Docker interna. Solo `web` e `worker`
  hanno anche accesso a internet (Twenty, SMTP, webhook in uscita).
- Lo sviluppo locale resta separato: `docker-compose.yml` e `.env` non cambiano.

| File                                    | A cosa serve                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `Dockerfile`                            | immagini `web` e `worker`                                                       |
| `docker-compose.prod.yml`               | stack di produzione                                                             |
| `.env.production.example`               | modello delle variabili (la copia reale sta solo sul VPS)                       |
| `deploy/deploy.sh`                      | pull → backup → migrazioni → aggiornamento → verifica (con rollback automatico) |
| `deploy/compose.sh`                     | `docker compose` con file di variabili e versione corrente già impostati        |
| `deploy/backup.sh`, `deploy/restore.sh` | backup, verifica e ripristino                                                   |
| `deploy/nginx/*.conf`                   | virtual host Nginx (e versione provvisoria per il certificato)                  |
| `deploy/cron/*`                         | backup notturno e verifica settimanale                                          |
| `.github/workflows/`                    | `ci-cd.yml`, `deploy-manuale.yml`, `_deploy.yml`                                |

## 1. Prerequisiti

- Il nuovo VPS Ubuntu 24.04 con Docker Engine e Docker Compose.
- La rete Docker esterna `proxy` già esistente e condivisa con `nginx-ui`.
- Il dominio `telaio.mattiacapelli.it` puntato a `13.140.222.243`.
- Il repository GitHub con GitHub Actions abilitate.
- Il deploy aggiunge il progetto Compose `telaio-prod` in `/opt/apps/telaio`; web si collega a `proxy`, mentre PostgreSQL e Redis restano nella rete backend interna.

## 2. DNS

Crea un record **A** (e, se il VPS ha IPv6, **AAAA**) per `telaio` nella zona `mattiacapelli.it` verso l'IP del VPS.
Controlla la propagazione prima di chiedere il certificato:

```bash
dig +short telaio.mattiacapelli.it
```

## 3. Preparazione del VPS

```bash
# Utente dedicato al deploy (nessuna password, accesso solo con chiave SSH)
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -o deploy -g deploy -m 750 /opt/apps/telaio
sudo install -d -o deploy -g deploy -m 700 /var/backups/telaio
sudo install -m 640 -o deploy -g deploy /dev/null /var/log/telaio-backup.log

# La rete proxy esistente deve essere visibile a Docker Compose.
docker network inspect proxy >/dev/null

# Chiave SSH solo per il deploy (generala sul tuo computer, non sul VPS):
#   ssh-keygen -t ed25519 -C "telaio-deploy" -f telaio-deploy
# poi autorizza la chiave pubblica:
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
echo "<contenuto di telaio-deploy.pub>" | sudo tee /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

> L'utente nel gruppo `docker` equivale a root sul server. Per questo la chiave SSH è dedicata, vive solo nei
> secrets di GitHub e il suo accesso si può revocare togliendola da `authorized_keys`.

**Porta 3100.** Il web pubblica `127.0.0.1:3100` solo per diagnostica locale. Nginx UI non usa questa porta:
raggiunge `telaio-web:3000` sulla rete Docker esterna `proxy`. Verifica che la porta locale sia libera:

```bash
sudo ss -ltnp | grep ':3100' || echo "libera"
```

Se è occupata, modifica `WEB_PORT` in `.env.production`; l'alias Docker resta `telaio-web:3000`.

### Installazione di Docker (solo se manca)

```bash
docker --version && docker compose version   # se rispondono, salta questo blocco
# Procedura ufficiale: https://docs.docker.com/engine/install/ubuntu/
```

## 4. Configurazione delle variabili

Sul VPS, come utente `deploy`:

```bash
cd /opt/apps/telaio
# dal tuo computer:  scp .env.production.example deploy@<host>:/opt/apps/telaio/.env.production
chmod 600 .env.production
```

Modifica `/opt/apps/telaio/.env.production` e sostituisci ogni `CAMBIA-…`:

```bash
openssl rand -hex 32   # BETTER_AUTH_SECRET
openssl rand -hex 16   # SETUP_TOKEN
openssl rand -hex 24   # POSTGRES_PASSWORD, poi un altro per REDIS_PASSWORD
```

| Variabile                             | Note                                                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_URL`                     | `https://telaio.mattiacapelli.it`. Da qui derivano cookie, origini consentite e **passkey** (rpID = hostname): se cambia, le passkey registrate non valgono più                                                          |
| `SETUP_TOKEN`                         | codice per la **prima configurazione** (`/setup`), almeno 16 caratteri (`openssl rand -hex 16`). In produzione il wizard non parte senza, e rifiuta il valore di esempio. Dopo il setup puoi toglierlo                   |
| `BETTER_AUTH_SECRET`                  | firma i cookie e **cifra i segreti 2FA**: se lo perdi, la 2FA non è più utilizzabile. Si salva nel backup (cifrato)                                                                                                      |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD` | solo caratteri esadecimali: finiscono dentro un URL                                                                                                                                                                      |
| `DATABASE_URL`, `REDIS_URL`           | già costruiti dalle password; host `postgres` e `redis` della rete Docker                                                                                                                                                |
| `TWENTY_API_URL`, `TWENTY_API_KEY`    | senza, in produzione l'elenco clienti resta **vuoto**: i clienti di esempio esistono solo in sviluppo                                                                                                                    |
| `SMTP_*`                              | un provider SMTP reale per i solleciti (in produzione non c'è Mailpit). Mittente, firma e prova di invio si gestiscono poi in Impostazioni → Email e mittenti                                                            |
| `S3_*`                                | facoltative: il bucket dei documenti dei progetti si configura da Impostazioni → Archiviazione (chiavi cifrate nel database); qui un ripiego. Il backup del database non contiene i file: proteggili dal lato del bucket |
| `TELAIO_REGISTRY`                     | `ghcr.io/<proprietario in minuscolo>`                                                                                                                                                                                    |
| `WEB_PORT`                            | 3100 (porta dedicata a Telaio)                                                                                                                                                                                           |
| `*_MEM_LIMIT`, `*_CPUS`               | limiti di risorse, opzionali                                                                                                                                                                                             |
| `BACKUP_*`                            | vedi sezione Backup                                                                                                                                                                                                      |

`TELAIO_VERSION` non va scritta: la imposta il deploy.

## 5. Nginx UI e certificato HTTPS

Il reverse proxy è il container Docker `nginx-ui`. Non installare un secondo Nginx sull'host e non modificare
i virtual host di Twenty (`crm.mattiacapelli.it`) o della dashboard (`nginx.mattiacapelli.it`).

Il DNS A di `telaio.mattiacapelli.it` deve puntare a `13.140.222.243`. Il webroot HTTP-01 condiviso con Nginx UI
è `/opt/infrastructure/www`; Certbot è installato sull'host.

Dopo aver copiato i file del repository in `/opt/apps/telaio`:

```bash
CONF=/opt/infrastructure/nginx/sites-available/telaio.conf
ENABLED=/opt/infrastructure/nginx/sites-enabled/telaio.conf

# 5.1 Virtual host provvisorio per la challenge Let's Encrypt
sudo cp /opt/apps/telaio/deploy/nginx/telaio.mattiacapelli.it.bootstrap.conf "$CONF"
sudo ln -s ../sites-available/telaio.conf "$ENABLED"
docker exec nginx-ui nginx -t && docker exec nginx-ui nginx -s reload

# 5.2 Certificato con webroot condiviso
sudo certbot certonly --webroot -w /opt/infrastructure/www -d telaio.mattiacapelli.it \
  --agree-tos -m <la-tua-email> \
  --deploy-hook /etc/letsencrypt/renewal-hooks/deploy/20-reload-nginx-ui.sh

# 5.3 Virtual host definitivo: proxy verso telaio-web:3000 sulla rete Docker proxy
sudo cp /opt/apps/telaio/deploy/nginx/telaio.mattiacapelli.it.conf "$CONF"
docker exec nginx-ui nginx -t && docker exec nginx-ui nginx -s reload
```

La configurazione definitiva usa il resolver Docker `127.0.0.11` per risolvere dinamicamente l'alias `telaio-web`.
Può quindi essere caricata anche prima del primo deploy, quando il container applicativo non esiste ancora.

- Il rinnovo è gestito da `certbot.timer`; il deploy hook `20-reload-nginx-ui.sh` ricarica il container Nginx UI.
- Il virtual host imposta HSTS (senza `includeSubDomains`), header forwarded, limite ai tentativi di accesso e
  buffering disattivato per `/mcp` (risposte in streaming).
- Il limite upload generale è 10 MB; per i documenti progetto è 260 MB.

## 6. GitHub: GHCR, secrets e ambiente

### Immagini (GHCR)

La pipeline pubblica `ghcr.io/<proprietario>/telaio-web:<sha>` e `…/telaio-worker:<sha>` con il `GITHUB_TOKEN`,
senza token personali. I pacchetti nascono privati e ereditano i permessi del repository. Durante il deploy il
`GITHUB_TOKEN` viene passato al server solo per il tempo del pull (login, deploy, logout).

Per operare a mano sul server (ad esempio un rollback senza GitHub) serve un login con un token personale
(_classic_, solo `read:packages`):

```bash
echo "<token>" | docker login ghcr.io -u <utente-github> --password-stdin
```

### Secrets

In _Settings → Environments → New environment → `production`_ (consigliato) crea i secrets:

| Secret                | Contenuto                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VPS_HOST`            | indirizzo del VPS                                                                                                                                                                          |
| `VPS_USER`            | `deploy`                                                                                                                                                                                   |
| `VPS_SSH_KEY`         | chiave **privata** `telaio-deploy` (tutto il file, con le righe BEGIN/END)                                                                                                                 |
| `VPS_SSH_KNOWN_HOSTS` | output di `ssh-keyscan -t ed25519 <host>`, **confrontato a mano** con l'impronta mostrata dal VPS (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`). Il deploy rifiuta host sconosciuti |

Variabili (_Settings → Secrets and variables → Actions → Variables_):

| Variabile           | Predefinito                       | Uso                                     |
| ------------------- | --------------------------------- | --------------------------------------- |
| `VPS_SSH_PORT`      | `22`                              | porta SSH                               |
| `VPS_DEPLOY_PATH`   | `/opt/apps/telaio`                | cartella sul nuovo VPS                  |
| `TELAIO_URL`        | `https://telaio.mattiacapelli.it` | URL usato per la verifica finale        |
| `DEPLOY_AUTOMATICO` | prima `false`, poi `true`         | opt-in per il deploy automatico su `v2` |

`DEPLOY_AUTOMATICO` va creata come **variabile di repository** (Settings → Secrets and variables → Actions → Variables), perché il workflow chiamante la legge prima di entrare nell'ambiente `production`. Per semplicità puoi salvare lì anche le altre tre variabili.

Per avere una **conferma manuale** prima di ogni deploy: nell'ambiente `production` attiva _Required reviewers_.

### Pipeline

- `ci-cd.yml`: su ogni PR esegue lint, typecheck, test e build senza pubblicare. Su push a `main` o `v2`
  pubblica immagini su GHCR con tag SHA completo; solo push su `v2` con `DEPLOY_AUTOMATICO=true` avvia il deploy.
- `_deploy.yml`: workflow riutilizzabile. Verifica che le immagini esistano su GHCR, copia `docker-compose.prod.yml`
  e `deploy/` sul VPS (del commit che si sta pubblicando), esegue `deploy/deploy.sh` e controlla `/api/health`
  da internet, verificando anche che risponda la versione attesa.
- `deploy-manuale.yml`: _Actions → Deploy manuale → Run workflow_, inserendo lo SHA completo di una versione già
  pubblicata. Serve per ridistribuire una versione precedente (rollback).

Le azioni di terze parti sono fissate al tag maggiore (`@v4`, `@v6`…). Per un controllo più stretto puoi fissarle
allo SHA del commit.

## 7. Primo deploy (procedura)

1. **DNS**: crea il record A `telaio` verso `13.140.222.243`; non creare un record AAAA perché questo VPS non pubblica IPv6.
2. **VPS**: crea l'utente SSH `deploy`, aggiungilo al gruppo `docker`, prepara `/opt/apps/telaio` e installa la chiave dedicata per GitHub Actions.
3. **Variabili**: crea `/opt/apps/telaio/.env.production` con i segreti generati sul VPS (sezione 4). Non copiarlo nel repository.
4. **Proxy**: installa prima il virtual host bootstrap su Nginx UI, emetti il certificato Let's Encrypt e poi attiva il virtual host definitivo (sezione 5).
5. **GitHub**: crea l'ambiente `production`, inserisci i quattro secrets e configura le variabili (sezione 6). Mantieni `DEPLOY_AUTOMATICO=false`.
6. **Build**: esegui un push su `v2`. GitHub Actions esegue CI e pubblica le immagini GHCR, ma non fa deploy.
7. **Primo deploy**: da Actions → Deploy manuale → Run workflow, inserisci lo SHA completo del commit appena pubblicato. Il workflow copia Compose e script, avvia database e Redis, applica le migrazioni, avvia web e worker e verifica `/api/health`.
8. **Setup**: apri `https://telaio.mattiacapelli.it/setup`, inserisci il `SETUP_TOKEN` e completa la creazione dell'azienda e del primo amministratore.
9. **Autodeploy**: dopo aver verificato login, health check e collegamento a Twenty, imposta la variabile di repository `DEPLOY_AUTOMATICO=true`. I push successivi su `v2` faranno deploy automatico.

I backup pianificati (cron e copia offsite) non vengono installati in questa procedura. Il deploy mantiene comunque il backup locale di sicurezza prima degli aggiornamenti successivi al primo rilascio.

Per diagnosi manuale: copia `docker-compose.prod.yml` e `deploy/` in `/opt/apps/telaio`, poi esegui
`./deploy/deploy.sh <sha>` dopo il login a GHCR.

## Prima configurazione (wizard)

Al primo avvio con un database senza stato di configurazione, ogni indirizzo dell'app rimanda a `/setup`.

- **Stato nel database**, non negli utenti: la riga `setup` della tabella `impostazioni` (`setup_completed`,
  `setup_version`, `setup_completed_at`, `origine`, `admin_id`). Cancellare gli utenti **non** riapre il setup.
- **Una sola volta**: l'inizializzazione crea azienda, primo amministratore e impostazioni in un'unica transazione, sotto
  un blocco di Postgres che serializza le richieste concorrenti. Una seconda richiesta, anche simultanea, viene
  rifiutata; con utenti già presenti non si crea mai un altro amministratore.
- **Protezione**: in produzione serve il `SETUP_TOKEN` (confronto a tempo costante, cookie httpOnly firmato, valido 2
  ore sul solo percorso `/setup`). Le richieste devono arrivare dall'origine di `BETTER_AUTH_URL`. La password non viene
  mai salvata in chiaro: nella bozza resta solo l'hash di Better Auth e non torna mai al browser.
- **Ripresa**: ogni passo si salva sul server; dopo un refresh il wizard riparte dal punto in cui eri (la password va
  eventualmente riscritta solo se vuoi cambiarla).
- **Che dati crea**: una ragione sociale (nome, tipo, partita IVA, IVA e formati di numerazione), l'utente `admin`, e le
  impostazioni `generali` (paese, fuso orario, valuta, lingua), `sicurezza` (lunghezza minima delle password, guida a 2FA e
  passkey) e, se caricato, `azienda.logo`. Nessun dato demo, nessuna password predefinita.
- **Installazioni già esistenti** (per esempio un ambiente di sviluppo con utenti): una migrazione le segna come
  configurate, senza passare dal wizard. In sviluppo `pnpm db:seed` fa lo stesso.
- **Account perso o dimenticato**: il wizard non si riapre mai. Vedi «Recupero dell'amministratore» qui sotto.

## Recupero dell'amministratore

Non esiste una procedura di «password dimenticata» via email. Se perdi l'accesso, si interviene dal server, dove
l'hash si genera con la stessa funzione di Better Auth contenuta nell'immagine del worker. Provato su uno stack reale.

**Password dimenticata** (come utente `deploy`, in `/opt/apps/telaio`):

```bash
read -r -s -p "Nuova password: " NUOVA_PASSWORD; echo; export NUOVA_PASSWORD
export EMAIL_ADMIN="mario.rossi@example.com"
./deploy/compose.sh run --rm -T -e NUOVA_PASSWORD -e EMAIL_ADMIN migrate \
  sh -c 'cd "$(readlink -f node_modules/@telaio/db)" && node --input-type=module' <<'EOF'
import postgres from "postgres";
import { hashPassword } from "better-auth/crypto";
const sql = postgres(process.env.DATABASE_URL);
const hash = await hashPassword(process.env.NUOVA_PASSWORD);
const r = await sql`update accounts set password = ${hash}, updated_at = now()
  where provider_id = 'credential' and user_id = (select id from users where email = ${process.env.EMAIL_ADMIN})
  returning id`;
console.log(r.length === 1 ? "Password reimpostata" : "Utente non trovato: nessuna modifica");
await sql.end();
EOF
unset NUOVA_PASSWORD
```

Stampa «Password reimpostata» se l'email esiste, altrimenti non modifica nulla. Da qui la lunghezza minima scelta nel
setup non viene controllata: scegline una lunga e cambiala dall'app subito dopo l'accesso. Le sessioni già aperte
restano valide: per chiuderle, `delete from sessions where user_id = …`.

**Telefono perso senza codici di recupero (2FA):**

```bash
./deploy/compose.sh exec -T postgres psql -U telaio -d telaio -c "
  update users set two_factor_enabled = false where email = 'mario.rossi@example.com';
  delete from two_factors where user_id = (select id from users where email = 'mario.rossi@example.com');"
```

Poi accedi con la sola password e riattiva la 2FA da «Profilo e sicurezza». Le passkey registrate restano valide.

Ogni intervento di questo tipo va preceduto da un backup (`./deploy/backup.sh`).

## 8. Deploy successivi, migrazioni e verifica

Un push su `main` fa partire la pipeline. `deploy/deploy.sh <sha>` esegue, nell'ordine:

1. scarica `telaio-web` e `telaio-worker` della versione;
2. avvia Postgres e Redis se non sono attivi;
3. **backup prima del deploy** (`deploy/backup.sh --prima-del-deploy`): se fallisce, il deploy si ferma;
4. **migrazioni** (`migrate`, job una tantum con l'immagine del worker): se falliscono, web e worker non vengono
   toccati e la versione in esecuzione resta quella di prima;
5. aggiorna web e worker e aspetta che i loro healthcheck siano sani;
6. verifica `/api/health` in locale (stato `ok` **e** versione uguale a quella pubblicata);
7. se la verifica fallisce, **torna alla versione precedente** e il deploy risulta fallito;
8. salva la versione in `/opt/apps/telaio/.versione` (la precedente in `.versione-precedente`).

**Regola per le migrazioni.** Le migrazioni girano mentre la versione vecchia è ancora in esecuzione, e un rollback
riporta il codice vecchio sul database nuovo. Quindi devono essere _retrocompatibili_: aggiungere colonne, tabelle e
indici va bene; rinominare o eliminare colonne si fa in due release (prima si smette di usarle, poi si rimuovono).

Controlli utili:

```bash
cd /opt/apps/telaio
./deploy/compose.sh ps                      # stato dei servizi
./deploy/compose.sh logs -f web             # log (con rotazione: 5 file da 10 MB per servizio)
curl -s http://127.0.0.1:3100/api/health    # health check locale sul VPS
# Nginx UI instrada il traffico pubblico verso telaio-web:3000 sulla rete Docker proxy
cat .versione                               # versione in esecuzione
```

`/api/health` risponde **200** se Postgres e Redis rispondono entro 2 secondi, **503** altrimenti; non espone
credenziali né messaggi d'errore.

## 9. Backup

**Cosa si salva**: il database PostgreSQL (tutti i dati contabili, gli utenti, le passkey, i segreti 2FA cifrati) e, nella
copia offsite, `.env.production`. Redis contiene solo le code (si ricostruiscono dai job schedulati) e non va salvato.

`deploy/backup.sh`:
- `pg_dump` in formato custom (compresso, in una sola transazione, quindi consistente) dal container Postgres;
- controllo dell'archivio (`pg_restore --list`) e checksum SHA-256 accanto al file;
- retention configurabile (`BACKUP_KEEP_DAYS`, predefinito 14), con almeno 3 copie sempre conservate;
- copia offsite **cifrata** con [age](https://github.com/FiloSottile/age), via `rclone` o `rsync`.

> Un backup che resta sul VPS non protegge da un guasto del VPS. Lo script rifiuta di inviare copie offsite non cifrate
> e avvisa a ogni esecuzione se la copia offsite non è configurata.

### Configurazione della copia offsite

```bash
sudo apt install -y age rclone          # o rsync
age-keygen -o telaio-backup.key         # TIENI la chiave privata FUORI dal VPS (password manager). Stampa la chiave pubblica "age1…"
# come utente deploy (sudo -iu deploy): i backup girano con quell'utente
rclone config                           # crea un remoto (Backblaze B2, S3, Hetzner Storage Box…)
```

In `/opt/apps/telaio/.env.production`:

```bash
BACKUP_AGE_RECIPIENT=age1…                       # chiave pubblica
BACKUP_RCLONE_REMOTE=nome-remoto:telaio-backup   # oppure BACKUP_RSYNC_TARGET=utente@host:/percorso/
```

La retention della copia remota si imposta sul servizio (regole di ciclo di vita del bucket): lo script non
cancella nulla da remoto. Il job notturno interno del worker (02:30) tiene inoltre copie locali nel volume
`telaio-prod_backups`; non sostituiscono quelle offsite.

### Pianificazione

```bash
sudo cp /opt/apps/telaio/deploy/cron/telaio-backup /etc/cron.d/telaio-backup
sudo cp /opt/apps/telaio/deploy/cron/telaio-backup.logrotate /etc/logrotate.d/telaio-backup
```

Backup ogni notte alle 03:30 e, la domenica, verifica automatica dell'ultimo backup (entrambi come utente `deploy`). Per controllare che i backup
girino, `/var/backups/telaio/ultimo-backup-ok` contiene l'orario dell'ultimo riuscito: allarma un monitor esterno
(per esempio healthchecks.io) se è più vecchio di 26 ore.

### Verifica dell'integrità

```bash
cd /opt/apps/telaio
ls -lt /var/backups/telaio | head
./deploy/restore.sh --verifica /var/backups/telaio/telaio-<data>.dump
```

`--verifica` controlla il checksum, ripristina il dump in un database temporaneo (i dati reali non si toccano),
conta tabelle, utenti e migrazioni e poi elimina il database temporaneo. Per un file offsite:
`BACKUP_AGE_IDENTITY=telaio-backup.key ./deploy/restore.sh --verifica telaio-<data>.dump.age`.
**Provalo almeno una volta subito dopo il primo backup e dopo ogni cambio di configurazione**: un backup mai
ripristinato non è una garanzia.

## 10. Restore, rollback e ripristino del database

### Rollback applicativo (il codice, non i dati)

_Actions → Deploy manuale → Run workflow_ con lo SHA della versione precedente (lo trovi in
`/opt/apps/telaio/.versione-precedente` o nella cronologia dei commit). Il deploy rifà gli stessi passi, incluso il backup.
Se le migrazioni sono retrocompatibili (sezione 8), il codice vecchio funziona sul database nuovo.

Senza GitHub: `ssh deploy@<host> "cd /opt/apps/telaio && ./deploy/deploy.sh <sha>"` (dopo il login a GHCR).

### Ripristino del database

Quando i dati sono danneggiati o una migrazione è andata male in modo non retrocompatibile:

```bash
cd /opt/apps/telaio
ls -lt /var/backups/telaio                       # scegli il backup (c'è anche "prima-del-deploy")
./deploy/restore.sh --ripristina /var/backups/telaio/telaio-<data>.dump
```

Lo script chiede di scrivere `RIPRISTINA`, fa una copia di sicurezza dello stato attuale
(`…-prima-del-ripristino.dump`), ferma web e worker, ricrea il database, ripristina il dump, riapplica le migrazioni e
riavvia. **Si perdono i dati successivi al backup.** Se il codice in esecuzione è più recente del database ripristinato,
le migrazioni mancanti vengono riapplicate; se invece vuoi anche tornare al codice di allora, fai prima il rollback
applicativo.

Da un backup offsite: copia il `.dump.age` sul VPS e usa `BACKUP_AGE_IDENTITY` come nella sezione 9.

### Perdita totale del VPS

Nuovo VPS → sezioni 2-6 → recupera `env-<data>.age` dalla copia offsite e decifralo con la chiave age
(`age -d -i telaio-backup.key env-<data>.age > /opt/apps/telaio/.env.production`: contiene **lo stesso**
`BETTER_AUTH_SECRET`) → primo deploy → **non** completare il wizard: `restore.sh --ripristina` con l'ultimo backup riporta anche lo stato di
configurazione, quindi il wizard non riparte e trovi utenti e dati come prima.

## 11. Troubleshooting

| Sintomo                                                      | Causa probabile e rimedio                                                                                                                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `required variable … is missing`                             | manca una variabile in `.env.production`, o `TELAIO_VERSION`: usa sempre `deploy/compose.sh` e `deploy/deploy.sh`                                                          |
| La pipeline fallisce su «Le immagini esistono su GHCR»       | il job `immagini` non è riuscito, o la versione non è mai stata pubblicata: controlla la scheda Actions                                                                    |
| `denied` / `unauthorized` al pull                            | login a GHCR mancante o pacchetto non accessibile al repository (_Package settings → Manage Actions access_)                                                               |
| `Host key verification failed`                               | `VPS_SSH_KNOWN_HOSTS` mancante o non corrispondente al server                                                                                                              |
| Il deploy riesce ma la verifica esterna fallisce             | Nginx UI o certificato: `docker exec nginx-ui nginx -t`, `curl -I https://telaio.mattiacapelli.it/api/health`, DNS e rete Docker `proxy`                             |
| `502 Bad Gateway`                                            | il web non è in ascolto: `./deploy/compose.sh ps` e `logs web`                                                                                                             |
| `/api/health` risponde 503                                   | guarda quale tra `database` e `redis` è `errore`: `./deploy/compose.sh ps`, `logs postgres` o `logs redis`                                                                 |
| `port is already allocated` su 3100                          | porta occupata: cambia `WEB_PORT` e l'upstream Nginx                                                                                                                       |
| Migrazioni fallite                                           | il deploy si ferma prima di toccare web e worker. Leggi l'errore (`./deploy/compose.sh logs migrate`), correggi e ripubblica                                               |
| Login che non funziona dietro Nginx, errore «Invalid origin» | `BETTER_AUTH_URL` diverso dall'indirizzo reale (http/https, dominio)                                                                                                       |
| `/setup` mostra «Configurazione non disponibile»             | in produzione manca `SETUP_TOKEN`, è troppo corto (< 16 caratteri) o è ancora il valore di esempio: correggi `.env.production` e riavvia (`./deploy/compose.sh up -d web`) |
| `/setup` chiede un codice che non ricordo                    | è il `SETUP_TOKEN` di `/opt/apps/telaio/.env.production`                                                                                                                  |
| Le passkey smettono di funzionare                            | è cambiato il dominio in `BETTER_AUTH_URL`: vanno registrate di nuovo                                                                                                      |
| La 2FA non accetta più i codici                              | `BETTER_AUTH_SECRET` cambiato: ripristina quello originale (sta nel backup cifrato). Come ultima risorsa, i codici di recupero                                             |
| La PWA mostra una versione vecchia                           | il Service Worker si aggiorna su richiesta dell'utente: compare l'avviso «È disponibile un aggiornamento»                                                                  |
| Disco pieno                                                  | `docker system df`; `docker image prune -f` rimuove le immagini non più usate (solo quelle senza tag); vecchi backup in `/var/backups/telaio`                              |
| Il worker non esegue i job                                   | `./deploy/compose.sh logs worker`; Redis raggiungibile? Il worker si riconnette da solo quando Redis torna                                                                 |

## 12. Note operative

- **Aggiornare Postgres** (da 18 a una major successiva) non è un semplice cambio di tag: richiede dump e ripristino.
- Le immagini di base (`postgres:18-alpine`, `redis:7-alpine`) seguono i tag delle convenzioni del progetto; per le patch
  di sicurezza ricrea i container con `./deploy/compose.sh pull postgres redis && ./deploy/compose.sh up -d`.
- I container web e worker girano senza privilegi (utente `node`, `cap_drop: ALL`, `no-new-privileges`).
- I segreti stanno solo in `/opt/apps/telaio/.env.production` (600) e nei secrets di GitHub; non entrano mai nelle immagini.
