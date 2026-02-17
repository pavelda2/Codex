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

## GitHub Pages deploy (main + PR preview)

Workflow `.github/workflows/deploy-pages.yml` nasazuje aplikaci na GitHub Pages takto:

- **push do `main`** → buildne frontend a publikuje ho do kořene Pages webu projektu,
  (při deployi se root vždy přegeneruje „načisto“, ale adresář `previews/` zůstává zachovaný),
- **PR (`opened`, `reopened`, `synchronize`)** → vytvoří/aktualizuje preview na adrese `.../previews/pr-<cislo-pr>/`,
- workflow zároveň přidá/aktualizuje komentář přímo v PR s odkazem na preview URL,
- **PR `closed` (včetně merge)** → smaže odpovídající preview složku.

Díky tomu zůstává hlavní aplikace stále dostupná na hlavní URL projektu a PR preview běží vedle ní v podsložkách.

### Co je potřeba nastavit v GitHub repozitáři

1. **Settings → Pages**
   - `Build and deployment` nastav na **Deploy from a branch**,
   - branch nastav na **`gh-pages`** a složku **`/(root)`**.
2. **Settings → Actions → General → Workflow permissions**
   - povol **Read and write permissions** (workflow musí pushovat do `gh-pages`).
3. Ujisti se, že default branch je `main` (workflow na ni reaguje pro produkční deploy).

> Poznámka: první spuštění workflow automaticky založí branch `gh-pages`, pokud ještě neexistuje.


#### Rychlé debug kroky pro GitHub 404 na preview URL

1. Otevři poslední běh workflow a zkontroluj job **deploy-pr-preview** (musí být zelený).
2. V logu kroku **Publish PR preview** ověř, že proběhl `git push origin gh-pages` bez chyby.
3. Ve workflow run summary zkontroluj vypsanou **Expected URL**.
4. V repozitáři ověř branch `gh-pages`, že obsahuje `previews/pr-<cislo-pr>/index.html`.
5. V **Settings → Pages** musí být:
   - **Deploy from a branch**
   - branch **gh-pages**
   - složka **/(root)**
6. Po nasazení vyčkej ~1-2 minuty (GitHub Pages propagace), pak URL obnov.

## Režim ukládání dat

Aplikace neobsahuje mock režim ani `localStorage` fallback.
Čtení i zápis probíhá výhradně přes Firebase služby.
