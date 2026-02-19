**ucelené analytické shrnutí návrhu „Cooking mode“**, navazující přesně na editor, parser a filozofii aplikace.

---

# Cooking Mode – analytický návrh

## 1. Cíl Cooking mode

**Režim vaření** je optimalizovaný způsob zobrazení receptu **během samotného vaření**, kdy uživatel:

* má **špinavé ruce**
* dívá se na mobil jen krátce
* potřebuje **minimum interakcí**
* potřebuje **rychlou orientaci v postupu**

Cooking mode **není editor** a **není tisk** – je to třetí, specifický režim.

---

## 2. Zásadní principy

1. **Jedna věc na obrazovce**
2. **Minimum textu**
3. **Velké prvky**
4. **Žádné rozhodování navíc**
5. **Offline-first mindset**

---

## 3. Struktura Cooking mode

### 3.1 Hlavička (fixní)

* Název receptu
* Aktuální krok / počet kroků
  *„Krok 3 / 8“*

Volitelně:

* čas kroku (pokud detekován)
* teplota (pokud detekována)

---

### 3.2 Hlavní obsah – krok postupu

* **Jeden krok = jedna obrazovka**
* Velké písmo
* Maximální čitelnost

Příklad:

> „Na pánvi rozehřej olej a opeč cibuli dozlatova.“

---

### 3.3 Navigace mezi kroky

* Velké plochy / tlačítka:

  * **Další krok**
  * **Předchozí krok**
* Podpora:

  * swipe doleva / doprava
  * klik kdekoliv na obrazovku (konfigurovatelné)

---

## 4. Suroviny v Cooking mode

### 4.1 Přehled surovin (před startem)

* Zobrazí se **jednou před zahájením**
* Po sekcích
* Optimalizované pro rychlé zkontrolování

### 4.2 Inline připomenutí

Pokud parser v kroku detekuje surovinu:

> „Přidej **cibuli**“

→ zvýraznění
→ klik → rychlý overlay:

* kolik
* poznámka („nadrobno“)

---

## 5. Čas & čekání

### 5.1 Detekce času (heuristika)

Parser rozpoznává:

* `5 minut`
* `cca 10 min`
* `nech odležet`

### 5.2 Chování

* Nabídne:

  * „Spustit časovač“
* Nevnucuje
* Časovač:

  * fullscreen
  * vibrace / zvuk
  * návrat do kroku

---

## 6. Stav a kontext

Cooking mode **si pamatuje**:

* aktuální krok
* dokončené kroky
* přerušené vaření

Po návratu:

> „Pokračovat od kroku 4?“

---

## 7. Interakce bez rukou (future)

Není nutné v MVP, ale návrh s tím počítá:

* hlasové ovládání:

  * „Další krok“
  * „Zopakuj“
* always-on obrazovka
* zámek otáčení displeje

---

## 8. Chyby & UX filosofie

* **Žádná chybová hlášení**
* Pokud parser něco neví → prostě to nezobrazí
* Cooking mode **nikdy nekritizuje recept**

---

## 9. Vztah k ostatním módům

| Režim        | Účel               |
| ------------ | ------------------ |
| Editor       | Tvorba receptu     |
| Náhled       | Kontrola struktury |
| Cooking mode | Samotné vaření     |
| Tisk         | Papír / A4         |

---

## 10. Technický koncept

* Vychází ze **stejného parsovaného modelu**
* Žádná další syntaxe
* Žádná další editace
* Stav uložený lokálně (localStorage)
* Offline použitelný

---

## 11. Shrnutí jednou větou

> **Cooking mode je režim, který při vaření myslí místo tebe.**

---
