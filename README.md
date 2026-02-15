# Správa receptů (Angular + PHP + MariaDB)

Jednoduchá aplikace pro správu receptů se zaměřením na:

1. **Mobile first UI**
2. **Rychlou editaci celého receptu v jediném textovém poli**
3. **Raw text jako source of truth v databázi**
4. **Heuristický parsing na nadpis, ingredience (včetně sekcí) a postup**

## Architektura

- `frontend/`: Angular aplikace (standalone komponenta)
- `backend/`: PHP REST API pro persistenci (volitelně pro lokální backend)
- `mariadb`: databáze s tabulkou `recipes`

## Mock režim frontendu (pro GitHub Pages)

Frontend je aktuálně nastavený na **mock API** (`useMockApi: true`) a ukládá data do `localStorage` v prohlížeči. To znamená, že aplikace funguje i bez běžícího PHP backendu a je vhodná pro statický hosting přes GitHub Pages.

Konfigurace je v:
- `frontend/src/environments/environment.ts`
- `frontend/src/environments/environment.prod.ts`

## Spuštění lokálně

```bash
docker compose up --build
```

- Frontend: http://localhost:4200
- Backend API: http://localhost:8080
- DB: localhost:3306

## GitHub Pages deploy

V repozitáři je workflow `.github/workflows/deploy-pages.yml`, které:
1. nainstaluje frontend závislosti,
2. provede Angular build s `--base-href "/<repo-name>/"`,
3. publikuje build do GitHub Pages.

Pro aktivaci v GitHubu nastav:
- **Settings → Pages → Source: GitHub Actions**
- merge do `main` branch (nebo ruční spuštění workflow `workflow_dispatch`).

## API

- `GET /recipes` – seznam uložených receptů
- `POST /recipes` – uložení receptu
  - payload: `{ "rawText": "..." }`

## Poznámka k datům

Do databáze se ukládá pouze **raw text** (`raw_text`). Veškeré odvozené informace (nadpis, sekce ingrediencí, postup) se heuristicky parsují až na frontendu.
