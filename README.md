# Správa receptů (Angular + Firebase Firestore)

Jednoduchá aplikace pro správu receptů se zaměřením na:

1. **Mobile first UI**
2. **Rychlou editaci celého receptu v jediném textovém poli**
3. **Raw text jako source of truth v úložišti**
4. **Heuristický parsing na nadpis, ingredience (včetně sekcí) a postup**.

## Architektura

- `frontend/`: Angular aplikace (standalone komponenta)
- `Firebase Authentication`: přihlášení uživatele přes **Google auth**
- `Firebase Custom Claims`: autorizace zápisu přes claim `writer: true`
- `Firebase Firestore`: cloudové úložiště receptů (`recipes` kolekce)
- bez PHP backendu a bez SQL databáze

## Firebase konfigurace v repozitáři

Firebase Web konfigurace je uložená přímo v `frontend/src/environments/firebase.config.ts` a verzovaná v GitHubu.

> Poznámka: Firebase Web `apiKey` není serverové tajemství, ale pravidla přístupu musí být vždy vynucená přes Firebase Security Rules.

## Jak nakonfigurovat Firebase

1. Vytvoř projekt na [Firebase Console](https://console.firebase.google.com/).
2. Zapni **Authentication → Sign-in method → Google**.
3. Zapni **Firestore Database** (Production mode).
4. Vytvoř Web App a zkopíruj Firebase config hodnoty.
5. Nastav writer oprávnění přes **Firebase Custom Claims** (`writer: true`) serverově přes Admin SDK.

### Firestore Security Rules (Custom Claims)

Použij soubor `firestore.rules` v tomto repozitáři. Důležité je:
- číst recepty může každý uživatel přihlášený přes Google,
- zapisovat může jen uživatel s custom claimem `writer: true`.

```bash
# příklad nasazení pravidel přes Firebase CLI
firebase deploy --only firestore:rules
```

### Jak nastavit Custom Claims přes Firebase UI

Pokud nechceš používat Admin SDK skript, můžeš claim nastavit i přes UI:

1. Otevři Firebase projekt a přejdi do **Authentication → Users**.
2. Vyber konkrétního uživatele (Google účet), kterému chceš povolit zápis.
3. V detailu uživatele otevři **Custom claims** (nebo **Edit claims**).
4. Zadej JSON:

```json
{"writer": true}
```

5. Ulož změnu.
6. Uživatel se musí odhlásit a znovu přihlásit (nebo obnovit token), aby se nový claim propsal do aplikace.

> Poznámka: V některých projektech je editace claimů dostupná přes Google Cloud Console (Identity Platform), podle typu projektu a nastavení Firebase/Identity Platform.

### Jak nastavit Custom Claims (Admin SDK)

Claimy musí nastavovat důvěryhodný server (např. Cloud Functions/Admin SDK), ne frontend.

Příklad (Node.js/Admin SDK):

```ts
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp();

await getAuth().setCustomUserClaims('USER_UID', {
  writer: true,
});
```

Po změně claimů je potřeba obnovit ID token (odhlášení/přihlášení, nebo refresh tokenu), aby se nová role propsala do klienta.

## Jak upravit Firebase konfiguraci

Pokud potřebuješ změnit projekt, uprav přímo soubor `frontend/src/environments/firebase.config.ts` a změny commitni do repozitáře.

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
# případné změny Firebase projektu proveď v src/environments/firebase.config.ts
npm start
```

## GitHub Pages deploy

Workflow `.github/workflows/deploy-pages.yml`:
1. nainstaluje frontend závislosti,
2. provede Angular production build,
3. publikuje build do GitHub Pages v produkčním prostředí (Angular `production` konfigurace).

Pro aktivaci v GitHubu nastav:
- **Settings → Pages → Source: GitHub Actions**
- merge do `main` branch (nebo ruční `workflow_dispatch`).

## Režim ukládání dat

Aplikace neobsahuje mock režim ani `localStorage` fallback.
Čtení i zápis probíhá výhradně přes Firebase služby.
