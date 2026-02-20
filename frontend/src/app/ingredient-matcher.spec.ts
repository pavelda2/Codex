import { matchIngredientsSequence } from './ingredient-matcher'

describe('matchIngredientsSequence', () => {
  it('matches multiword ingredient and keeps punctuation', () => {
    const result = matchIngredientsSequence(
      [
        { original: 'citronová šťáva', item: 'citronová šťáva' },
        { original: '3 ks avokádo', item: 'avokádo' },
      ],
      'Avokádo rozmixujeme s citronovou šťávou.'
    )

    expect(result).toEqual([
      {
        type: 'ingredient',
        value: 'Avokádo',
        ingredient: 'avokádo',
        amount: '3 ks',
        original: '3 ks avokádo',
      },
      { type: 'text', value: ' rozmixujeme s ' },
      {
        type: 'ingredient',
        value: 'citronovou šťávou',
        ingredient: 'citronová šťáva',
        amount: null,
        original: 'citronová šťáva',
      },
      { type: 'text', value: '.' },
    ])
  })

  it('returns text token when nothing matches', () => {
    const result = matchIngredientsSequence([{ original: '1 ks vejce', item: 'vejce' }], 'Předehřejeme troubu.')

    expect(result).toEqual([{ type: 'text', value: 'Předehřejeme troubu.' }])
  })
})
