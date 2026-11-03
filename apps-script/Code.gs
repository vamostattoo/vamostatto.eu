/**
 * Vamos Tattoo — időpontfoglaló űrlap háttér.
 *
 * Miért nem a Web3Forms: az ingyenes csomag nem tud fájlfeltöltést,
 * automatikus válasz e-mailt és webhookot — mind a három a Pro csomag része.
 * Mivel a cél amúgy is egy Google Sheets, egyszerűbb a Google oldaláról
 * megoldani: ez a szkript Norbert saját fiókjában fut, és ingyenes.
 *
 * Mit csinál egy beküldéskor:
 *   1. új sort ír a Sheets táblába
 *   2. a csatolt képeket megkeresésenként külön Drive-mappába menti,
 *      és a linkjüket beírja a sorba
 *   3. értesítő e-mailt küld Norbertnek
 *   4. automatikus visszaigazolót küld a vendégnek
 *   5. a sor végére tesz egy "Válasz" linket, ami megnyit egy új Gmail
 *      levelet a vendég címére, előre kitöltött tárggyal
 *
 * Védelem (a böngészőben lévő korlátok megkerülhetők, ezért itt, a szerveren
 * is ellenőrzünk mindent): csak valódi kép fogadható (a fájl tartalma alapján,
 * nem a neve alapján), legfeljebb MAX_KEP darab, mindegyik legfeljebb 8 MB;
 * a szövegmezők hossza korlátos; a táblázatba beírt szöveg sosem fut le
 * képletként; óránként és címenként korlátozzuk a beküldések számát.
 *
 * Telepítés: lásd TELEPITES.md
 */

// ——— kitöltendő ———————————————————————————————————————————————
const SHEET_ID  = 'IDE_JON_A_TABLAZAT_ID';   // a Sheets URL /d/ és /edit közötti rész
const FOLDER_ID = 'IDE_JON_A_DRIVE_MAPPA_ID'; // a Drive mappa URL utolsó része
const NOTIFY_TO = 'tattoo.vamos@gmail.com';
const TZ        = 'Europe/Budapest';
// ———————————————————————————————————————————————————————————————

// ——— korlátok (visszaélés ellen) ——————————————————————————————
const MAX_KEP       = 5;                  // legfeljebb ennyi kép egy beküldésben
const MAX_KEP_BAJT  = 8 * 1024 * 1024;    // egy kép legfeljebb ennyi bájt
const MAX_KERES     = 32 * 1024 * 1024;   // a teljes kérés legfeljebb ennyi karakter
const MAX_ORANKENT  = 20;                 // összes beküldés óránként
const MAX_HATORA    = 40;                 // összes beküldés 6 óránként
const MAX_CIMENKENT = 3;                  // egy e-mail-címről 6 óránként
// ———————————————————————————————————————————————————————————————

const EMAIL = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']{2,}$/;

const HIBA_KEP = 'Csak képet (jpg, png, webp vagy heic) tudok fogadni, legfeljebb ' +
                 MAX_KEP + ' darabot, egyenként 8 MB-ig.';
const HIBA_NAGY = 'A képek együtt túl nagyok. Kérlek válassz kevesebbet vagy kisebbeket (együtt legfeljebb 20 MB).';
const HIBA_SOK = 'Most túl sok megkeresés érkezett. Kérlek próbáld újra később, ' +
                 'vagy írj e-mailt: tattoo.vamos@gmail.com';

const FEJLEC = [
  'Beérkezett', 'Név', 'E-mail', 'Telefon', 'Elképzelés', 'Testrész',
  'Méret', 'Mikorra', 'Korrekció', 'Első tetoválás', 'Képek', 'Státusz', 'Válasz'
];

const STATUSZOK = [
  'Új megkeresés', 'Válaszolva', 'Árajánlat elküldve', 'Foglalóra vár',
  'Időpont lefoglalva', 'Lezárva', 'Nem vállalom'
];

const AUTO_VALASZ =
  'Szia!\n\n' +
  'Köszönöm a megkeresésed, az űrlapod rendben megérkezett hozzám :)\n\n' +
  'Átnézem a küldött részleteket és referenciákat, és általában 1–3 munkanapon ' +
  'belül válaszolok az általad megadott e-mail címre.\n\n' +
  'Mivel minden megkeresést egyenként nézek át, kérlek addig ne küldd el újra az űrlapot.\n\n' +
  'Ha esetleg nem találod a válaszomat, érdemes a Spam / Promóciók mappát is ellenőrizni.\n\n' +
  'Üdv,\nNorbi';

function doPost(e) {
  try {
    const nyers = (e && e.postData && e.postData.contents) || '';
    if (nyers.length > MAX_KERES) return json({ ok: false, error: HIBA_NAGY });
    const d = JSON.parse(nyers);

    // Rejtett mező: ha ki van töltve, robot töltötte ki. Csendben eldobjuk.
    if (d.botcheck) return json({ ok: true });

    // Minden szöveg tisztítva és rövidítve, mielőtt bármit csinálnánk vele.
    const adat = {
      nev:       szoveg_(d.nev, 100),
      email:     szoveg_(d.email, 120).toLowerCase(),
      telefon:   szoveg_(d.telefon, 40),
      otlet:     szoveg_(d.otlet, 3000, true),
      testresz:  szoveg_(d.testresz, 100),
      meret:     szoveg_(d.meret, 60),
      mikor:     szoveg_(d.mikor, 300, true),
      korrekcio: d.korrekcio === true,
      elso:      d.elso === true
    };
    if (!adat.nev || !EMAIL.test(adat.email)) {
      return json({ ok: false, error: 'Hiányzó név vagy érvénytelen e-mail.' });
    }

    // Képek: a fájl első bájtjai döntik el, mi az, nem a neve vagy a megadott típus.
    const kepek = Array.isArray(d.kepek) ? d.kepek : [];
    if (kepek.length > MAX_KEP) return json({ ok: false, error: HIBA_KEP });
    const jok = [];
    for (let i = 0; i < kepek.length; i++) {
      const b64 = kepek[i] && kepek[i].data;
      if (typeof b64 !== 'string' || b64.length > MAX_KEP_BAJT * 4 / 3 + 8) {
        return json({ ok: false, error: HIBA_KEP });
      }
      const bajtok = Utilities.base64Decode(b64);
      const tipus = kepTipus_(bajtok);
      if (!tipus || bajtok.length > MAX_KEP_BAJT) return json({ ok: false, error: HIBA_KEP });
      jok.push({ bajtok: bajtok, tipus: tipus });
    }

    // Csak ezután számít bele a korlátba, és csak ezután van bármilyen mellékhatás.
    if (!korlat_(adat.email)) return json({ ok: false, error: HIBA_SOK });

    const sh = sheet_();
    const most = new Date();
    const stamp = Utilities.formatDate(most, TZ, 'yyyy-MM-dd HH-mm');

    // Képek: megkeresésenként saját mappa, hogy a Drive ne legyen kupac.
    // A fájlokat a script saját nevekkel menti, és nem osztja meg senkivel.
    const linkek = [];
    if (jok.length) {
      const mappa = DriveApp.getFolderById(FOLDER_ID)
                           .createFolder(stamp + ' — ' + adat.nev.replace(/[\\/:*?"<>|]/g, ' ').slice(0, 60));
      jok.forEach(function (k, i) {
        const blob = Utilities.newBlob(k.bajtok, k.tipus[0], 'kep-' + (i + 1) + '.' + k.tipus[1]);
        linkek.push(mappa.createFile(blob).getUrl());
      });
    }

    // A sort egyszerre csak egy beküldés írhatja. A B–H cellák szövegként
    // vannak formázva, így a "=..." kezdetű szöveg nem lesz képlet.
    let sor;
    const zar = LockService.getScriptLock();
    zar.waitLock(20000);
    try {
      sor = sh.getLastRow() + 1;
      sh.getRange(sor, 2, 1, 7).setNumberFormat('@');
      sh.getRange(sor, 1, 1, 12).setValues([[
        Utilities.formatDate(most, TZ, 'yyyy-MM-dd HH:mm'),
        adat.nev, adat.email, adat.telefon, adat.otlet, adat.testresz,
        adat.meret, adat.mikor,
        adat.korrekcio ? 'igen' : '', adat.elso ? 'igen' : '',
        linkek.join('\n'), STATUSZOK[0]
      ]]);
      valaszGomb_(sh, sor);
      statuszLista_(sh, sor);
    } finally {
      zar.releaseLock();
    }

    MailApp.sendEmail({
      to: NOTIFY_TO,
      replyTo: adat.email,
      subject: 'Új tetoválás megkeresés — ' + adat.nev,
      body: ertesito_(adat, linkek, sor)
    });

    MailApp.sendEmail({
      to: adat.email,
      subject: 'Megkaptam a jelentkezésed — Vamos Tattoo',
      body: AUTO_VALASZ,
      name: 'Vamos Tattoo'
    });

    return json({ ok: true });

  } catch (err) {
    // A vendég ne lásson stack tracet, de a napló őrizze meg.
    console.error(err);
    return json({ ok: false, error: 'Szerverhiba.' });
  }
}

/* Vezérlőkarakterek ki, hossz korlátozva. Egysoros mezőkben a sortörés is
   szóközzé válik. */
function szoveg_(v, max, tobbsoros) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (!tobbsoros) s = s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}

/* Képtípus a fájl első bájtjaiból. Az Apps Script bájtjai előjelesek (-128..127),
   ezért az & 0xFF. Visszaad: [MIME típus, kiterjesztés], vagy null. */
function kepTipus_(b) {
  if (!b || b.length < 16) return null;
  const u = function (i) { return b[i] & 0xFF; };
  if (u(0) === 0xFF && u(1) === 0xD8 && u(2) === 0xFF) return ['image/jpeg', 'jpg'];
  if (u(0) === 0x89 && u(1) === 0x50 && u(2) === 0x4E && u(3) === 0x47 &&
      u(4) === 0x0D && u(5) === 0x0A && u(6) === 0x1A && u(7) === 0x0A) return ['image/png', 'png'];
  if (u(0) === 0x52 && u(1) === 0x49 && u(2) === 0x46 && u(3) === 0x46 &&
      u(8) === 0x57 && u(9) === 0x45 && u(10) === 0x42 && u(11) === 0x50) return ['image/webp', 'webp'];
  if (u(4) === 0x66 && u(5) === 0x74 && u(6) === 0x79 && u(7) === 0x70) {   // "ftyp"
    const marka = String.fromCharCode(u(8), u(9), u(10), u(11));
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].indexOf(marka) >= 0) return ['image/heic', 'heic'];
  }
  return null;
}

/* Beküldés-korlát: óránként összesen, 6 óránként összesen, és 6 óránként egy
   e-mail-címről. A számlálók a Cache-ben élnek (a legrövidebb ablak 1 óra, a
   leghosszabb 6 óra, ennél a Cache nem enged többet). Igaz, ha még belefér. */
function korlat_(email) {
  const zar = LockService.getScriptLock();
  zar.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const most = new Date();
    const hat = Math.floor(most.getTime() / (6 * 3600 * 1000));
    const korlatok = [
      ['o' + Utilities.formatDate(most, TZ, 'yyyyMMddHH'), MAX_ORANKENT, 3600],
      ['h' + hat, MAX_HATORA, 21600],
      ['e' + hat + email, MAX_CIMENKENT, 21600]
    ];
    for (let i = 0; i < korlatok.length; i++) {
      if (Number(cache.get(korlatok[i][0]) || 0) >= korlatok[i][1]) return false;
    }
    korlatok.forEach(function (k) {
      cache.put(k[0], String(Number(cache.get(k[0]) || 0) + 1), k[2]);
    });
    return true;
  } finally {
    zar.releaseLock();
  }
}

function sheet_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  if (sh.getLastRow() === 0) {
    sh.appendRow(FEJLEC);
    sh.getRange(1, 1, 1, FEJLEC.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Kattintható link, ami új Gmail levelet nyit a vendég címére, kitöltött
   tárggyal. A levél szövegét Norbert írja — ezt szándékosan nem generáljuk. */
function valaszGomb_(sh, sor) {
  sh.getRange(sor, 13).setFormula(
    '=HYPERLINK("https://mail.google.com/mail/?view=cm&fs=1&to=" & ENCODEURL(C' + sor + ') & ' +
    '"&su=" & ENCODEURL("Vamos Tattoo — válasz a megkeresésedre"), "Válasz")'
  );
}

function statuszLista_(sh, sor) {
  const szabaly = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUSZOK, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(sor, 12).setDataValidation(szabaly);
}

function ertesito_(d, linkek, sor) {
  return [
    'Név: ' + d.nev,
    'E-mail: ' + d.email,
    'Telefon: ' + (d.telefon || '—'),
    '',
    'Elképzelés:', d.otlet || '—',
    '',
    'Testrész: ' + (d.testresz || '—'),
    'Méret: ' + (d.meret || '—'),
    'Mikorra: ' + (d.mikor || '—'),
    'Korrekció: ' + (d.korrekcio ? 'igen' : 'nem'),
    'Első tetoválás: ' + (d.elso ? 'igen' : 'nem'),
    '',
    'Képek:', linkek.length ? linkek.join('\n') : '—',
    '',
    'Táblázat sora: ' + sor
  ].join('\n');
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
                       .setMimeType(ContentService.MimeType.JSON);
}
