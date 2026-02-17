# Analytické zadání – Webová aplikace pro správu receptů

## 1. Cíl aplikace

Vytvořit **dlouhodobě udržitelnou webovou aplikaci** pro správu osobní kuchařky, která:

* je **primárně používaná na mobilu při vaření**
* **sekundárně umožňuje tisk receptu na A4**
* klade důraz na **rychlé, přirozené zadávání receptů**
* **nevyžaduje strukturované formuláře při psaní**

## 2. Klíčový problém k řešení

Běžné aplikace nutí uživatele:

* vyplňovat pole (množství, jednotka, poznámka…)
* přepínat kontext
* zpomalují zápis receptu

👉 **Cílem je psát recept „jako do poznámek“**, ale zároveň z něj **automaticky získat strukturovaná data**.

## 3. Základní princip řešení

* **Jedno textové pole (editor)** jako hlavní vstup
* **Live náhled** strukturovaného receptu
* **Parser založený na heuristikách**, nikoliv striktní syntaxi
* Uživatel **není nucen znát žádný formát**
* Systém je **tolerantní k chybám**

## 4. Datový model (konceptuálně)

### Recept obsahuje:

* **Název receptu**
* **Sekce surovin** (např. „Těsto“, „Náplň“, „Ozdoba“)
* **Suroviny** v rámci sekcí
* **Postup** (jedna souvislá část na konci)
* **Varování / poznámky parseru**

## 5. Zápis receptu – očekávané chování

### Název receptu

* První neprázdný řádek

### Sekce

* Jakýkoliv řádek bez odrážky, před surovinami
* Např.:

  ```
  Těsto
  Náplň
  ```

### Suroviny

* Řádky začínající `-` nebo `–`
* Může obsahovat:

  * množství: `200 g mouky`
  * neurčité množství: `trochu soli`
  * poznámku v závorkách: `cibule (nadrobno)`
  * poznámku za pomlčkou: `cukr - krupice`

Parser:

* rozpozná množství + jednotku, pokud existují
* neurčitá množství **nejsou chyba**, jen warning
* text za pomlčkou = **poznámka k surovině**

### Implicitní sekce

* Pokud se objeví suroviny bez sekce → automaticky vznikne sekce **„Suroviny“**
* Vznikne **neotravné varování**

## 6. Postup

* Je **vždy až na konci receptu**
* Začíná řádkem `Postup` / `Postup:`
* Řádky postupu:

  * mohou být **číslované**
  * **nečíslované**
  * nebo s **odrážkami**
* Odrážky **neznamenají odstavce**, jen nový krok
* Výstup je vždy **normalizovaný seznam kroků**

## 7. Parser & validace

* Heuristický, tolerantní
* Nevyhazuje chyby → pouze **warnings**
* Warnings slouží jako:

  * informace („použita implicitní sekce“)
  * upozornění („neurčité množství“)
* UX zásada: **neotravovat, neblokovat**

## 8. UX zásady

* **Mobile-first**
* psaní bez přepínání kontextu
* live preview lze skrýt / zobrazit
* žádný markdown, žádná syntaxe k učení
* aplikace „nechává uživatele psát“
