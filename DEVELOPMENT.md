# Development Structure

## Frontend component layout

The application is organized by routed pages under `frontend/src/app/pages/`.

```text
frontend/src/app/
  app.component.ts
  app.component.html
  app.component.css
  app.routes.ts
  recipe-api.service.ts
  recipe-state.service.ts
  recipe-parser.ts
  pages/
    login/
      login.component.ts
      login.component.html
      login.component.scss
    home/
      home.component.ts
      home.component.html
      home.component.scss
    recipe-list/
      recipe-list.component.ts
      recipe-list.component.html
      recipe-list.component.scss
    recipe-detail/
      recipe-detail.component.ts
      recipe-detail.component.html
      recipe-detail.component.scss
    recipe-editor/
      recipe-editor.component.ts
      recipe-editor.component.html
      recipe-editor.component.scss
```

## Styling responsibility

- `app.component.css` contains only shell-level layout (top bar, bottom nav, global error slot, loading shell).
- Each routed page owns its own styles in local `*.component.scss` files.
- Feature visuals (list/detail/editor/login/home) are not styled at app root level.

## Routing

- Routes are declared in `app.routes.ts`.
- Authentication guard protects all routes except `/login`.
- `RecipeStateService` holds shared UI/data state across page components.
