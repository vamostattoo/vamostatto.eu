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

## Védelem a visszaélés ellen (2026. 11. 02-től)

A böngészőben lévő korlátok (képek száma, mérete) bárkinél megkerülhetők, ha
közvetlenül a szkript címére küld valaki. Ezért a `Code.gs` **a szerveren is**
ellenőriz mindent, és ami nem felel meg, azt el sem menti:

| Mit | Hogyan |
|---|---|
| **Csak valódi kép** | a fájl első bájtjai döntik el, nem a neve vagy a megadott típus: jpg, png, webp, heic fogadható. Átnevezett .exe, .html, .svg, .pdf, .gif elutasítva |
| **Mennyi** | legfeljebb 5 kép beküldésenként, egyenként legfeljebb 8 MB, együtt legfeljebb ~20 MB |
| **Szövegek hossza** | név 100, e-mail 120, telefon 40, elképzelés 3000, testrész 100, méret 60, időpont 300 karakter; a vezérlőkarakterek kiszűrve |
| **E-mail-cím** | formai ellenőrzés; a név sortörése megszűnik, így a levél fejlécébe nem lehet beleírni |
| **Táblázat** | a B–H oszlopok szövegként formázottak, így a `=...` kezdetű beírás nem fut le képletként |
| **Drive** | a képek `kep-1.jpg`, `kep-2.png` … néven mentődnek, és nincsenek megosztva |
| **Robotok** | a rejtett „botcheck" mező: ha kitöltik, a kérést csendben eldobja |
| **Elárasztás** | összesen legfeljebb 20 beküldés óránként, 40 hatóránként, és egy e-mail-címről legfeljebb 3 hatóránként. A túllépők hibaüzenetet kapnak, és a **visszautasított kérés nem küld levelet, nem ír sort, nem tölt fel semmit** |
| **Hibák** | a látogató csak annyit lát, hogy „Szerverhiba." — a részletek a szkript naplójában (Végrehajtások) maradnak |

A korlátot a `Code.gs` tetején lévő `MAX_…` sorokban lehet átírni.

Mit **nem** véd ez: aki szándékosan, sok különböző e-mail-címmel és
helyes képekkel, de kevesebb mint 20/óra ütemben küldözget, az átmegy, de a
napi kerete akkor is véges (és a Gmail napi 100 levele sem fogy el, lásd lent).
Ha ez valaha gondot okoz, a következő lépés egy láthatatlan CAPTCHA
(Cloudflare Turnstile) — ez harmadik fél szkriptjét hozná az oldalra, ezért
csak akkor érdemes, ha tényleg kell.

## Meglévő szkript frissítése (nem kell új telepítés)

A weboldal már egy telepített szkript címére küld, ezt **nem szabad** megváltoztatni.

1. Nyisd meg a táblázatot → *Bővítmények → Apps Script*.
2. A régi `Code.gs` **felső részét** (a `SHEET_ID`, `FOLDER_ID`, `NOTIFY_TO`, `TZ`
   sorokat) hagyd meg — ezek a te azonosítóid.
3. Az alattuk lévő **összes többi** kódot töröld ki, és másold be helyére az új
   `Code.gs` tartalmát a `// ——— korlátok (visszaélés ellen) ———` sortól kezdve
   (a fájl végéig).
4. Mentés (Ctrl+S).
5. *Telepítés → Telepítések kezelése* → a meglévő telepítés mellett a ceruza →
   **Verzió: Új verzió** → *Telepítés*. A cím ugyanaz marad, a weboldalhoz nem
   kell hozzányúlni.
6. Próba: egy teszt-megkeresés képpel; majd a Drive-ban ellenőrizd, hogy a
   fájl `kep-1.jpg` néven van-e.

## Korlátok, amiket érdemes tudni

- Egy Gmail-fiók **napi 100 e-mailt** küldhet Apps Scriptből. Értesítő +
  automata válasz = 2 levél beküldésenként, tehát napi ~50 megkeresésig elég.
  Ez bőven a valós forgalom fölött van.
- A base64 kódolás ~33%-kal növeli a méretet, és az Apps Script kérésnek van
  felső határa, ezért van 8 MB-os korlát fájlonként és 20 MB összesen.
- A Drive-ra kerülő képek privátak maradnak: csak abból a Google-fiókból
  nyithatók meg, amelyben a szkript fut. A táblázatból egy kattintással
  így is megnyílnak, ha be vagy jelentkezve. (A vendégek képei adatvédelmi
  szempontból érzékenyek lehetnek, ezért nincs rajtuk „bárki a linkkel"
  jog.)
- A számlálók a Cache-ben élnek, ami legfeljebb 6 órát őriz meg, ezért a
  leghosszabb korlát-ablak 6 óra. Egy újratelepítés nem nullázza, de a Cache
  maga néha kiürülhet — ez legfeljebb azt jelenti, hogy a korlát hamarabb
  újraindul, a biztonsága nem sérül.

## Karbantartás átadás után

- **Adatmegőrzés:** a régi megkereséseket időnként töröld a táblázatból és a
  Drive mappából (a weboldal adatkezelési tájékoztatója szerint a lezárt
  megkereséseket nem tartjuk örökké). Egy egyszerű szabály: évente egyszer
  átnézni, és ami 1–2 évnél régebbi és nem ügyfél lett belőle, mehet.
- **Hozzáférés:** a Google-fiókban kapcsold be a kétlépcsős azonosítást, a
  táblázat és a Drive mappa megosztásánál ellenőrizd, kinek van hozzáférése.
- **Próba:** havonta egyszer küldj magadnak egy teszt-megkeresést, hogy lásd,
  megérkezik-e (a Gmail-korlát vagy egy lejárt engedély csendben tönkre tudja
  tenni).
