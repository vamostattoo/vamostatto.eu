# Űrlap → Google Sheets + Drive + automatikus válasz

## Miért kell lecserélni a Web3Formsot

Norbert három dolgot kért az űrlaphoz: automatikus visszaigazolót, működő
képfeltöltést, és hogy minden beküldés bekerüljön egy Google Sheets táblába.

A jelenlegi Web3Forms **ingyenes** csomagján mind a három ki van zárva:

| Amit kért | Web3Forms ingyenes | Web3Forms Pro |
|---|---|---|
| Automatikus válasz a vendégnek | nem | igen |
| Képfeltöltés | **nem** | igen (1 fájl, 5 MB) |
| Webhook (ez kellene a Sheetshez) | nem | igen |

Ezért kapott Norbert mindig hibaüzenetet a fájlfeltöltésnél — jól tippelte,
hogy fizetős verzió kell hozzá. A Pro 12 USD/hó (éves fizetéssel), és még
azzal sem lenne kész: a webhookot akkor is fogadni kellene valahol, a képeket
Drive-ba tenni, a sorokat a táblába írni.

Mivel a végcél amúgy is Google Sheets, egyszerűbb a Google oldaláról megoldani.
A `Code.gs` egy Google Apps Script, ami Norbert saját fiókjában fut, **ingyen**,
és egyben elintézi mind a négyet: táblázat, Drive, értesítő, automata válasz.

## Amit Norbertnek kell csinálnia (kb. 15 perc)

1. **Táblázat**: új Google Sheets, neve például „Vamos Tattoo — megkeresések".
   Az URL-ből a `/d/` és `/edit` közötti hosszú kód a **SHEET_ID**.
2. **Drive mappa**: új mappa, például „Tetoválás megkeresések".
   A mappa URL-jének utolsó része a **FOLDER_ID**.
3. **Szkript**: a táblázatban *Bővítmények → Apps Script*. A `Code.gs` tartalmát
   másold be, és töltsd ki felül a `SHEET_ID` és `FOLDER_ID` értékeket.
4. **Közzététel**: *Telepítés → Új telepítés → Webalkalmazás*.
   - Futtatás mint: **én** (Norbert)
   - Hozzáférés: **Bárki**
   Az első mentésnél engedélyt kér a Drive-hoz és a Gmailhez — ezt el kell fogadni.
   A végén kapsz egy `https://script.google.com/macros/s/.../exec` címet.
5. Ezt a címet küldd el Vincének — ez kerül az űrlapba.

> A „Bárki" hozzáférés azt jelenti, hogy az űrlap el tudja érni. A táblázatot
> és a Drive mappát **nem** teszi nyilvánossá, azok Norberté maradnak.

## Amit a weboldalon kell tenni

Semmi kódolás: a `script.js` legtetején van egy sor, és abba kell bemásolni a
4. lépésben kapott címet.

```js
const ENDPOINT = '';
```

Ennyi. A küldés, a képek base64-re alakítása, a hibakezelés és a sikerüzenet
már bent van a fájlban.

## Amit a táblázat tudni fog

| Oszlop | Tartalom |
|---|---|
| A | Beérkezett (dátum, idő) |
| B–D | Név, e-mail, telefon |
| E–H | Elképzelés, testrész, méret, mikorra |
| I–J | Korrekció, első tetoválás |
| K | Képek Drive-linkjei |
| L | **Státusz** — legördülő: Új megkeresés / Válaszolva / Árajánlat elküldve / Foglalóra vár / Időpont lefoglalva / Lezárva / Nem vállalom |
| M | **Válasz** — kattintásra új Gmail levél nyílik a vendég címére, kitöltött tárggyal |

A levél szövegét szándékosan nem generálja semmi — Norbert azt írja meg, ahogy
kérte.

## Korlátok, amiket érdemes tudni

- Egy Gmail-fiók **napi 100 e-mailt** küldhet Apps Scriptből. Értesítő +
  automata válasz = 2 levél beküldésenként, tehát napi ~50 megkeresésig elég.
  Ez bőven a valós forgalom fölött van.
- A base64 kódolás ~33%-kal növeli a méretet, és az Apps Script kérésnek van
  felső határa, ezért van 8 MB-os korlát fájlonként a fenti kódban.
- A Drive-ra kerülő képek „bárki a linkkel megnézheti" jogot kapnak, hogy a
  táblázatból egy kattintással megnyíljanak. Ha ez nem tetszik, vedd ki a
  `setSharing` sort — akkor viszont csak bejelentkezve látszanak.
