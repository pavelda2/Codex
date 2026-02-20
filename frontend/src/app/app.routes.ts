import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { RecipeApiService } from './recipe-api.service';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { RecipeListComponent } from './pages/recipe-list/recipe-list.component';
import { RecipeDetailComponent } from './pages/recipe-detail/recipe-detail.component';
import { RecipeEditorComponent } from './pages/recipe-editor/recipe-editor.component';
import { CookingModeComponent } from './pages/cooking-mode/cooking-mode.component';

const authGuard: CanActivateFn = () => {
  const api = inject(RecipeApiService);
  const router = inject(Router);

  if (api.user()) {
    return true;
  }

  return router.parseUrl('/login');
};

export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', canActivate: [authGuard], component: HomeComponent },
  { path: 'recipes', canActivate: [authGuard], component: RecipeListComponent },
  { path: 'recipes/new', canActivate: [authGuard], component: RecipeEditorComponent },
  { path: 'recipes/:id', canActivate: [authGuard], component: RecipeDetailComponent },
  { path: 'recipes/:id/edit', canActivate: [authGuard], component: RecipeEditorComponent },
  { path: 'recipes/:id/cook', canActivate: [authGuard], component: CookingModeComponent },
  { path: '**', redirectTo: '' },
];
