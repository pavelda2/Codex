import { Injectable, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  Firestore,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { Auth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { environment } from '../environments/environment';

export type Recipe = {
  id: string;
  raw_text: string;
  updated_at?: string;
};

@Injectable({ providedIn: 'root' })
export class RecipeApiService {
  private readonly db: Firestore;
  private readonly auth: Auth;
  private readonly googleProvider = new GoogleAuthProvider();

  readonly user = signal<User | null>(null);
  readonly canWrite = signal(false);
  readonly authLoading = signal(true);

  constructor() {
    this.ensureFirebaseConfig();
    const app = initializeApp(environment.firebase);
    this.db = getFirestore(app);
    this.auth = getAuth(app);

    onAuthStateChanged(this.auth, async (user) => {
      this.user.set(user);

      if (!user) {
        this.canWrite.set(false);
        this.authLoading.set(false);
        return;
      }

      const tokenResult = await user.getIdTokenResult();
      this.canWrite.set(tokenResult.claims['writer'] === true);
      this.authLoading.set(false);
    });
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.auth, this.googleProvider);
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  async listRecipes(): Promise<Recipe[]> {
    this.ensureSignedIn();

    const recipesRef = collection(this.db, 'recipes');
    const recipesQuery = query(recipesRef, orderBy('updated_at', 'desc'));
    const snapshot = await getDocs(recipesQuery);

    return snapshot.docs
      .map((recipeDoc): Recipe | null => {
        const data = recipeDoc.data();
        const rawText = data['raw_text'];
        const updatedAt = data['updated_at'];

        if (typeof rawText !== 'string') {
          return null;
        }

        return {
          id: recipeDoc.id,
          raw_text: rawText,
          updated_at:
            updatedAt && typeof updatedAt.toDate === 'function'
              ? updatedAt.toDate().toISOString()
              : undefined,
        } satisfies Recipe;
      })
      .filter((item): item is Recipe => item !== null);
  }

  async createRecipe(rawText: string): Promise<Recipe> {
    this.ensureSignedIn();

    if (!this.canWrite()) {
      throw new Error('Nemáš oprávnění k ukládání receptů.');
    }

    const trimmed = rawText.trim();
    if (!trimmed) {
      throw new Error('Pole receptu nesmí být prázdné.');
    }

    const createdAt = new Date().toISOString();

    try {
      const result = await addDoc(collection(this.db, 'recipes'), {
        raw_text: trimmed,
        updated_at: serverTimestamp(),
        updated_by: this.user()?.email ?? '',
      });

      return {
        id: result.id,
        raw_text: trimmed,
        updated_at: createdAt,
      };
    } catch {
      throw new Error('Nemáš oprávnění k ukládání receptů.');
    }
  }

  private ensureSignedIn(): void {
    if (!this.user()) {
      throw new Error('Pro práci s recepty se nejprve přihlas přes Google.');
    }
  }

  private ensureFirebaseConfig(): void {
    const values = Object.values(environment.firebase);
    const isConfigured = values.every((value) => typeof value === 'string' && value.trim().length > 0);

    if (!isConfigured) {
      throw new Error(
        'Firebase není nakonfigurovaný. Doplň konfiguraci přes frontend/src/environments/firebase.config.ts nebo GitHub Secrets.',
      );
    }
  }
}
