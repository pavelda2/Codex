declare module 'snowball-stemmer.jsx/dest/czech-stemmer.common' {
  export class CzechStemmer {
    setCurrent(word: string): void
    stem(): boolean
    getCurrent(): string
  }
}
