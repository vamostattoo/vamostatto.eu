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

## Amit Vincének kell csinálnia

A `prod.html` alján lévő Web3Forms küldő szkriptet le kell cserélni. A lényeg,
hogy a képeket base64-ben, JSON-ként kell küldeni, `text/plain` fejléccel —
így az Apps Script fogadja, és nem akad el CORS preflighton.

```js
const ENDPOINT = 'IDE_JON_AZ_APPS_SCRIPT_URL';

async function fileToBase64(file) {
  const buf = await file.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return { name: file.name, type: file.type, data: btoa(bin) };
}

async function sendForm(form) {
  const kepek = [];
  for (const f of form.kepek.files) {
    if (f.size > 8 * 1024 * 1024) throw new Error(f.name + ' nagyobb 8 MB-nál.');
    kepek.push(await fileToBase64(f));
  }
  const body = {
    nev: form.nev.value.trim(),
    email: form.email.value.trim(),
    telefon: form.telefon && !form.telefon.disabled ? form.telefon.value.trim() : '',
    otlet: form.otlet.value.trim(),
    testresz: form.testresz.disabled ? '' : form.testresz.value.trim(),
    meret: form.meret.disabled ? '' : form.meret.value.trim(),
    mikor: form.mikor.value.trim(),
    korrekcio: form.korrekcio.checked,
    elso: form.elso.checked,
    botcheck: form.botcheck.checked,
    kepek
  };
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Ismeretlen hiba.');
}
```

A Web3Forms rejtett mezői (`access_key`, `subject`) ezután törölhetők a
`prod.html`-ből; a `botcheck` maradjon, azt a szkript is figyeli.

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
