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
 * Telepítés: lásd TELEPITES.md
 */

// ——— kitöltendő ———————————————————————————————————————————————
const SHEET_ID  = 'IDE_JON_A_TABLAZAT_ID';   // a Sheets URL /d/ és /edit közötti rész
const FOLDER_ID = 'IDE_JON_A_DRIVE_MAPPA_ID'; // a Drive mappa URL utolsó része
const NOTIFY_TO = 'tattoo.vamos@gmail.com';
const TZ        = 'Europe/Budapest';
// ———————————————————————————————————————————————————————————————

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
    const d = JSON.parse(e.postData.contents);

    // Rejtett mező: ha ki van töltve, robot töltötte ki. Csendben eldobjuk.
    if (d.botcheck) return json({ ok: true });

    if (!d.nev || !d.email) return json({ ok: false, error: 'Hiányzó név vagy e-mail.' });

    const sh = sheet_();
    const now = new Date();
    const stamp = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH-mm');

    // Képek: megkeresésenként saját mappa, hogy a Drive ne legyen kupac.
    const linkek = [];
    const kepek = d.kepek || [];
    if (kepek.length) {
      const mappa = DriveApp.getFolderById(FOLDER_ID)
                           .createFolder(stamp + ' — ' + d.nev);
      kepek.forEach(function (f) {
        const blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.type, f.name);
        const file = mappa.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        linkek.push(file.getUrl());
      });
    }

    sh.appendRow([
      Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm'),
      d.nev, d.email, d.telefon || '', d.otlet || '', d.testresz || '',
      d.meret || '', d.mikor || '',
      d.korrekcio ? 'igen' : '', d.elso ? 'igen' : '',
      linkek.join('\n'), STATUSZOK[0]
    ]);

    const sor = sh.getLastRow();
    valaszGomb_(sh, sor);
    statuszLista_(sh, sor);

    MailApp.sendEmail({
      to: NOTIFY_TO,
      replyTo: d.email,
      subject: 'Új tetoválás megkeresés — ' + d.nev,
      body: ertesito_(d, linkek, sor)
    });

    MailApp.sendEmail({
      to: d.email,
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
