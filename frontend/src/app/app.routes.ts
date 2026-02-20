import { inject } from '@angular/core'
import { CanActivateFn, Router, Routes } from '@angular/router'
import { CookingModeComponent } from './pages/cooking-mode/cooking-mode.component'
import { HomeComponent } from './pages/home/home.component'
import { LoginComponent } from './pages/login/login.component'
import { RecipeDetailComponent } from './pages/recipe-detail/recipe-detail.component'
import { RecipeEditorComponent } from './pages/recipe-editor/recipe-editor.component'
import { RecipeListComponent } from './pages/recipe-list/recipe-list.component'
import { RecipeApiService } from './recipe-api.service'

const authGuard: CanActivateFn = () => {
  const api = inject(RecipeApiService)
  const router = inject(Router)

  if (api.authLoading()) {
    return true
  }

  if (api.user()) {
    return true
  }

  return router.parseUrl('/login')
}

const loginGuard: CanActivateFn = () => {
  const api = inject(RecipeApiService)
  const router = inject(Router)

  if (api.user()) {
    return router.parseUrl('/')
  }

  return true
}

export const appRoutes: Routes = [
  { path: 'login', canActivate: [loginGuard], component: LoginComponent },
  { path: '', canActivate: [authGuard], component: HomeComponent },
  { path: 'recipes', canActivate: [authGuard], component: RecipeListComponent },
  { path: 'recipes/new', canActivate: [authGuard], component: RecipeEditorComponent },
  { path: 'recipes/:id', canActivate: [authGuard], component: RecipeDetailComponent },
  { path: 'recipes/:id/edit', canActivate: [authGuard], component: RecipeEditorComponent },
  { path: 'recipes/:id/cook', canActivate: [authGuard], component: CookingModeComponent },
  { path: '**', redirectTo: '' },
]
