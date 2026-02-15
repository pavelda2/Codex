# Správa receptů (Angular + Firebase Firestore)

Jednoduchá aplikace pro správu receptů se zaměřením na:

1. **Mobile first UI**
2. **Rychlou editaci celého receptu v jediném textovém poli**
3. **Raw text jako source of truth v úložišti**
4. **Heuristický parsing na nadpis, ingredience (včetně sekcí) a postup**

## Architektura

- `frontend/`: Angular aplikace (standalone komponenta)
- `Firebase Authentication`: přihlášení uživatele přes **Google auth**
- `Firebase Firestore`: cloudové úložiště receptů (`recipes` kolekce) + whitelist (`authorizedUsers`)
- bez PHP backendu a bez SQL databáze

## Bezpečná konfigurace ve veřejném GitHub repozitáři

V repozitáři nejsou uložené žádné reálné Firebase hodnoty. Konfigurace je oddělená:

- `frontend/src/environments/firebase.config.ts` obsahuje jen prázdné placeholdery
- reálné hodnoty se injektují přes **GitHub Actions Secrets/Variables** při CI build procesu

> Poznámka: Firebase Web `apiKey` není serverové tajemství, ale pravidla přístupu musí být vždy vynucená přes Firebase Security Rules.

## Jak nakonfigurovat Firebase

1. Vytvoř projekt na [Firebase Console](https://console.firebase.google.com/).
2. Zapni **Authentication → Sign-in method → Google**.
3. Zapni **Firestore Database** (Production mode).
4. Vytvoř Web App a zkopíruj Firebase config hodnoty.
5. Vytvoř kolekci `authorizedUsers`, kde **ID dokumentu = Google e-mail uživatele**, který má mít právo zápisu.
   - Příklad ID dokumentu: `admin@firma.cz`
   - Obsah dokumentu může být např. `{ "role": "writer" }`

### Firestore Security Rules (bez možnosti listovat `authorizedUsers`)

Použij soubor `firestore.rules` v tomto repozitáři. Důležité je:
- všichni přihlášení přes Google mohou číst recepty,
- zápis je povolen jen e-mailům z `authorizedUsers`,
- kolekci `authorizedUsers` nelze z klienta číst ani listovat (`allow read, write: if false`).

```bash
# příklad nasazení pravidel přes Firebase CLI
firebase deploy --only firestore:rules
```

Tím je splněno:
- všichni přihlášení přes Google mohou číst recepty,
- pouze vyjmenované e-maily v `authorizedUsers` mohou zapisovat,
- všichni autorizovaní uživatelé mohou pracovat se všemi recepty,
- a zároveň není možné vypsat whitelist ostatních uživatelů z klientské aplikace.

### Je možné to udělat ještě bezpečněji?

Ano: robustnější varianta je používat **Firebase Custom Claims** (např. `writer: true`) nastavované serverově (Cloud Functions/Admin SDK).
Pak pravidla nečtou `authorizedUsers` vůbec a autorizace se řídí pouze token claimem.

## Jak nastavit GitHub (Secrets + Variables)

V GitHub repozitáři otevři **Settings → Secrets and variables → Actions** a založ:

### Variables
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`

### Secrets
- `FIREBASE_API_KEY`
- `FIREBASE_APP_ID`

Workflow při buildu vytvoří `frontend/src/environments/firebase.config.ts` z těchto hodnot.

## Lokální spuštění

### Varianta A: Docker Compose

```bash
docker compose up --build
```

Frontend poběží na http://localhost:4200.

### Varianta B: npm

```bash
cd frontend
npm install
# doplň vlastní Firebase hodnoty do src/environments/firebase.config.ts
npm start
```

## GitHub Pages deploy

Workflow `.github/workflows/deploy-pages.yml`:
1. nainstaluje frontend závislosti,
2. vygeneruje Firebase konfiguraci z GitHub Secrets/Variables,
3. provede Angular production build,
4. publikuje build do GitHub Pages v produkčním prostředí (Angular `production` konfigurace).

Pro aktivaci v GitHubu nastav:
- **Settings → Pages → Source: GitHub Actions**
- merge do `main` branch (nebo ruční `workflow_dispatch`).

## Režim ukládání dat

Aplikace neobsahuje mock režim ani `localStorage` fallback.
Čtení i zápis probíhá výhradně přes Firebase služby.
