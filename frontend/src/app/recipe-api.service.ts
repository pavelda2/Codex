import { Injectable, signal } from '@angular/core'
import { initializeApp } from 'firebase/app'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { Auth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'
import { getAuth } from 'firebase/auth'
import { environment } from '../environments/environment'

export type RecipeImageThumb = {
  id: string
  data_url: string
}

export type RecipeImage = RecipeImageThumb & {
  full_data_url: string
  mime_type: string
  width: number
  height: number
  updated_at?: string
}

export type Recipe = {
  id: string
  raw_text: string
  image_thumbs: RecipeImageThumb[]
  updated_at?: string
}

@Injectable({ providedIn: 'root' })
export class RecipeApiService {
  private readonly db: Firestore
  private readonly auth: Auth
  private readonly googleProvider = new GoogleAuthProvider()
  private readonly fullImageCache = new Map<string, RecipeImage>()

  readonly user = signal<User | null>(null)
  readonly canWrite = signal(false)
  readonly authLoading = signal(true)

  constructor() {
    this.ensureFirebaseConfig()
    const app = initializeApp(environment.firebase)
    this.db = getFirestore(app)
    this.auth = getAuth(app)

    onAuthStateChanged(this.auth, async (user) => {
      this.user.set(user)

      if (!user) {
        this.canWrite.set(false)
        this.authLoading.set(false)
        return
      }

      const tokenResult = await user.getIdTokenResult()
      this.canWrite.set(tokenResult.claims['writer'] === true)
      this.authLoading.set(false)
    })
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.auth, this.googleProvider)
  }

  async signOut(): Promise<void> {
    await signOut(this.auth)
  }

  async listRecipes(): Promise<Recipe[]> {
    this.ensureSignedIn()

    const recipesRef = collection(this.db, 'recipes')
    const recipesQuery = query(recipesRef, orderBy('updated_at', 'desc'))
    const snapshot = await getDocs(recipesQuery)

    return snapshot.docs
      .map<Recipe | null>((recipeDoc) => {
        const data = recipeDoc.data()
        const rawText = data['raw_text']
        const updatedAt = data['updated_at']
        const imageThumbs = this.readThumbs(data['image_thumbs'])

        if (typeof rawText !== 'string') {
          return null
        }

        return {
          id: recipeDoc.id,
          raw_text: rawText,
          image_thumbs: imageThumbs,
          updated_at:
            updatedAt && typeof updatedAt.toDate === 'function'
              ? updatedAt.toDate().toISOString()
              : undefined,
        }
      })
      .filter((item): item is Recipe => item !== null)
  }

  async createRecipe(rawText: string): Promise<Recipe> {
    this.ensureCanWrite()

    const trimmed = this.validateRawText(rawText)
    const createdAt = new Date().toISOString()

    try {
      const result = await addDoc(collection(this.db, 'recipes'), {
        raw_text: trimmed,
        image_thumbs: [],
        updated_at: serverTimestamp(),
        updated_by: this.user()?.email ?? '',
      })

      return {
        id: result.id,
        raw_text: trimmed,
        image_thumbs: [],
        updated_at: createdAt,
      }
    } catch {
      throw new Error('Nemáš oprávnění k ukládání receptů.')
    }
  }

  async updateRecipe(id: string, rawText: string): Promise<void> {
    this.ensureCanWrite()

    const trimmed = this.validateRawText(rawText)

    try {
      await updateDoc(doc(this.db, 'recipes', id), {
        raw_text: trimmed,
        updated_at: serverTimestamp(),
        updated_by: this.user()?.email ?? '',
      })
    } catch {
      throw new Error('Nemáš oprávnění k úpravě receptu.')
    }
  }

  async saveRecipeImageThumbs(recipeId: string, thumbs: RecipeImageThumb[]): Promise<void> {
    this.ensureCanWrite()

    try {
      await updateDoc(doc(this.db, 'recipes', recipeId), {
        image_thumbs: thumbs,
        updated_at: serverTimestamp(),
        updated_by: this.user()?.email ?? '',
      })
    } catch {
      throw new Error('Nepodařilo se uložit náhledy obrázků receptu.')
    }
  }

  async listRecipeImages(recipeId: string): Promise<RecipeImage[]> {
    this.ensureSignedIn()

    try {
      const collectionRef = collection(this.db, 'recipes', recipeId, 'images')
      const snapshot = await getDocs(collectionRef)

      return snapshot.docs
      .map<RecipeImage | null>((imageDoc) => {
        const data = imageDoc.data()
        const fullDataUrl = data['full_data_url']
        const thumbDataUrl = data['thumb_data_url']
        const mimeType = data['mime_type']
        const width = data['width']
        const height = data['height']
        const updatedAt = data['updated_at']

        if (
          typeof fullDataUrl !== 'string' ||
          typeof thumbDataUrl !== 'string' ||
          typeof mimeType !== 'string' ||
          typeof width !== 'number' ||
          typeof height !== 'number'
        ) {
          return null
        }

        const image: RecipeImage = {
          id: imageDoc.id,
          full_data_url: fullDataUrl,
          data_url: thumbDataUrl,
          mime_type: mimeType,
          width,
          height,
          updated_at:
            updatedAt && typeof updatedAt.toDate === 'function'
              ? updatedAt.toDate().toISOString()
              : undefined,
        }

        this.setCachedImage(recipeId, image)
        return image
      })
      .filter((item): item is RecipeImage => item !== null)
    } catch {
      throw new Error('Nepodařilo se načíst obrázky receptu.')
    }
  }

  async upsertRecipeImage(recipeId: string, image: RecipeImage): Promise<void> {
    this.ensureCanWrite()

    try {
      await setDoc(doc(this.db, 'recipes', recipeId, 'images', image.id), {
        full_data_url: image.full_data_url,
        thumb_data_url: image.data_url,
        mime_type: image.mime_type,
        width: image.width,
        height: image.height,
        updated_at: serverTimestamp(),
        updated_by: this.user()?.email ?? '',
      })

      this.setCachedImage(recipeId, image)
    } catch {
      throw new Error('Nepodařilo se uložit obrázek receptu.')
    }
  }

  async deleteRecipeImage(recipeId: string, imageId: string): Promise<void> {
    this.ensureCanWrite()

    try {
      await deleteDoc(doc(this.db, 'recipes', recipeId, 'images', imageId))
      this.fullImageCache.delete(this.cacheKey(recipeId, imageId))
      localStorage.removeItem(this.cacheKey(recipeId, imageId))
    } catch {
      throw new Error('Nepodařilo se odstranit obrázek receptu.')
    }
  }

  getCachedRecipeImage(recipeId: string, imageId: string): RecipeImage | null {
    const key = this.cacheKey(recipeId, imageId)
    const inMemory = this.fullImageCache.get(key)
    if (inMemory) {
      return inMemory
    }

    const local = localStorage.getItem(key)
    if (!local) {
      return null
    }

    try {
      const parsed = JSON.parse(local) as RecipeImage
      this.fullImageCache.set(key, parsed)
      return parsed
    } catch {
      return null
    }
  }

  async deleteRecipe(id: string): Promise<void> {
    this.ensureCanWrite()

    try {
      await deleteDoc(doc(this.db, 'recipes', id))
    } catch {
      throw new Error('Nemáš oprávnění ke smazání receptu.')
    }
  }

  private readThumbs(value: unknown): RecipeImageThumb[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map<RecipeImageThumb | null>((item) => {
        if (!item || typeof item !== 'object') {
          return null
        }

        const id = (item as Record<string, unknown>)['id']
        const dataUrl = (item as Record<string, unknown>)['data_url']

        if (typeof id !== 'string' || typeof dataUrl !== 'string') {
          return null
        }

        return { id, data_url: dataUrl }
      })
      .filter((item): item is RecipeImageThumb => item !== null)
  }

  private setCachedImage(recipeId: string, image: RecipeImage): void {
    const key = this.cacheKey(recipeId, image.id)
    this.fullImageCache.set(key, image)

    try {
      localStorage.setItem(key, JSON.stringify(image))
    } catch {
      // ignore storage limits
    }
  }

  private cacheKey(recipeId: string, imageId: string): string {
    return `recipe-image:${recipeId}:${imageId}`
  }

  private validateRawText(rawText: string): string {
    const trimmed = rawText.trim()

    if (!trimmed) {
      throw new Error('Pole receptu nesmí být prázdné.')
    }

    return trimmed
  }

  private ensureCanWrite(): void {
    this.ensureSignedIn()

    if (!this.canWrite()) {
      throw new Error('Nemáš oprávnění k úpravám receptů.')
    }
  }

  private ensureSignedIn(): void {
    if (!this.user()) {
      throw new Error('Pro práci s recepty se nejprve přihlas přes Google.')
    }
  }

  private ensureFirebaseConfig(): void {
    const values = Object.values(environment.firebase)
    const isConfigured = values.every((value) => typeof value === 'string' && value.trim().length > 0)

    if (!isConfigured) {
      throw new Error(
        'Firebase není nakonfigurovaný. Doplň konfiguraci ve frontend/src/environments/firebase.config.ts.',
      )
    }
  }
}
