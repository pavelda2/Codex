import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { RecipeApiService } from './recipe-api.service';
import { HomePageComponent } from './pages/home-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { RecipeListPageComponent } from './pages/recipe-list-page.component';
import { RecipeDetailPageComponent } from './pages/recipe-detail-page.component';
import { RecipeEditorPageComponent } from './pages/recipe-editor-page.component';

const authGuard: CanActivateFn = () => {
  const api = inject(RecipeApiService);
  const router = inject(Router);

  if (api.user()) {
    return true;
  }

  return router.parseUrl('/login');
};

export const appRoutes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: '', canActivate: [authGuard], component: HomePageComponent },
  { path: 'recipes', canActivate: [authGuard], component: RecipeListPageComponent },
  { path: 'recipes/new', canActivate: [authGuard], component: RecipeEditorPageComponent },
  { path: 'recipes/:id', canActivate: [authGuard], component: RecipeDetailPageComponent },
  { path: 'recipes/:id/edit', canActivate: [authGuard], component: RecipeEditorPageComponent },
  { path: '**', redirectTo: '' },
];
