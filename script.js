/* Vamos Tattoo — menu and booking form.
   The form is the whole point of the page, so the validation is written
   around what Norbert actually needs in order to quote: a way to reach the
   person, what they want, where on the body, and the size in centimetres.

   Two checkboxes change what the form asks for. "Korrekció" means the tattoo
   already exists, so the form stops asking where it is and how big it is —
   that is on the photograph — and asks for the photograph instead. "Első
   tetoválás" changes nothing in the validation; it is a flag for Norbert, so
   he knows to explain more when he answers. */

/* ===================================================================
   IDE MÁSOLD BE a Google Apps Script webalkalmazás címét, amit
   Norberttől kapsz. Így néz ki:
   https://script.google.com/macros/s/AKfycb.../exec
   Amíg üresen marad, az űrlap nem küld, hanem e-mailre irányít.
   =================================================================== */
const ENDPOINT = '';

const MAX_FILE = 8 * 1024 * 1024;   /* fájlonként 8 MB */

const burger = document.querySelector('.burger');
const nav = document.querySelector('.nav');

function setMenu(open) {
  nav.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
}
burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', e => { if (e.target.tagName === 'A') setMenu(false); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); burger.focus(); }
});

/* ---------- form ---------- */

const form = document.querySelector('#f');
const ok = document.querySelector('#ok');
const korr = document.querySelector('#f-korr');
const elso = document.querySelector('#f-elso');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Phone is off by default and only appears behind a tick, so the form asks
   for one thing to reach the person by. It is disabled while hidden, so an
   empty value never travels with the submission. */
const telKell = document.querySelector('#f-tel-kell');
const fldTel = document.querySelector('#fld-tel');
const tel = document.querySelector('#f-tel');

const failBox = document.querySelector('#fail');
const submitBtn = document.querySelector('#f button[type="submit"]');

function showFail(msg) {
  failBox.textContent = msg;
  failBox.hidden = false;
}

/* A képeket base64-ben küldjük, mert az Apps Script nem fogad multipartot. */
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data: s.slice(s.indexOf(',') + 1)
      });
    };
    r.onerror = () => reject(new Error(file.name + ' beolvasása nem sikerült.'));
    r.readAsDataURL(file);
  });
}

const hintKep = document.querySelector('#hint-kep');
const optKep = document.querySelector('#opt-kep');
const lblOtlet = document.querySelector('label[for="f-otlet"]');
const noteKorr = document.querySelector('#note-korr');
const noteElso = document.querySelector('#note-elso');

/* What a correction cannot answer. */
const offOnKorr = [document.querySelector('#f-hol'), document.querySelector('#f-meret')];

function fail(input, msg) {
  input.closest('.fld').classList.add('bad');
  const err = document.querySelector(`.err[data-for="${input.id}"]`);
  if (err) err.textContent = msg;
}
function clear(input) {
  input.closest('.fld').classList.remove('bad');
}

/* Disabled rather than hidden: the person can see what the tick did, and a
   disabled field is not submitted, so a stale value cannot travel with a
   correction request. The typed text stays, in case they untick again. */
function setOff(input, off) {
  input.disabled = off;
  input.closest('.fld').classList.toggle('off', off);
  if (off) clear(input);
}

function applyMode() {
  const c = korr.checked;

  offOnKorr.forEach(i => setOff(i, c));

  /* A correction is by definition not somebody's first tattoo. */
  if (c) elso.checked = false;
  setOff(elso, c);

  noteKorr.hidden = !c;
  noteElso.hidden = !elso.checked;

  optKep.textContent = c ? '(kötelező)' : '(nem kötelező)';
  hintKep.textContent = c
    ? 'Egy éles fotó a gyógyult tetoválásról, arról a részről, ami javítást igényelhet.'
    : 'Inspirációs képek, vagy takarás esetén a meglévő tetoválás.';
  lblOtlet.textContent = c ? 'Mit javítanál rajta?' : 'Mi az elképzelésed?';
  form.otlet.placeholder = c
    ? 'Írd le, melyik résszel nem vagy elégedett, és mikor készült a tetoválás.'
    : 'Mit szeretnél, és mit jelent neked? Ha van hozzá történet, írd meg.';
}
function applyTel() {
  const on = telKell.checked;
  fldTel.hidden = !on;
  tel.disabled = !on;
  if (!on) { tel.value = ''; clear(tel); }
}
telKell.addEventListener('change', applyTel);
applyTel();

korr.addEventListener('change', () => { applyMode(); clear(form.kepek); });
elso.addEventListener('change', applyMode);
applyMode();

form.addEventListener('submit', async e => {
  e.preventDefault();
  failBox.hidden = true;
  const { nev, email, otlet, testresz: hol, meret, kepek } = form;
  [nev, email, tel, otlet, hol, meret, kepek].forEach(clear);
  ok.hidden = true;
  let bad = null;

  if (!nev.value.trim()) { fail(nev, 'Írd be a neved, hogy tudjam, kihez szóljak.'); bad ||= nev; }

  const ev = email.value.trim();
  if (!ev) { fail(email, 'E-mail-cím nélkül nem tudok visszajelezni.'); bad ||= email; }
  else if (!EMAIL.test(ev)) { fail(email, 'Ez így nem tűnik e-mail-címnek.'); bad ||= email; }

  if (telKell.checked) {
    const tv = tel.value.trim();
    const digits = (tv.match(/\d/g) || []).length;
    if (!tv) { fail(tel, 'Írd be a számot, vagy vedd ki a pipát.'); bad ||= tel; }
    else if (digits < 7) { fail(tel, 'Ez így nem tűnik telefonszámnak.'); bad ||= tel; }
  }

  if (!otlet.value.trim()) {
    fail(otlet, korr.checked ? 'Írd le, melyik részt javítanád.' : 'Írd le pár mondatban, mit szeretnél.');
    bad ||= otlet;
  }

  if (!korr.checked) {
    if (!hol.value.trim()) { fail(hol, 'Írd meg, a test melyik részére szeretnéd.'); bad ||= hol; }

    /* Size drives the quote and the length of the session, so it is required
       and has to contain a number — "kicsi" is not a size. */
    const m = meret.value.trim();
    if (!m) { fail(meret, 'A méret nélkül nem tudok árat mondani — elég egy közelítő szám cm-ben.'); bad ||= meret; }
    else if (!/\d/.test(m)) { fail(meret, 'Írj bele egy számot, például "10 cm".'); bad ||= meret; }
  }

  if (korr.checked && kepek.files.length === 0) {
    fail(kepek, 'Korrekcióhoz kérlek csatolj egy éles fotót a gyógyult tetoválásról.');
    bad ||= kepek;
  }

  if (bad) { bad.focus(); return; }

  /* Amíg nincs bekötve a háttér, ne nyeljük el némán a jelentkezést. */
  if (!ENDPOINT) {
    showFail('Az űrlap küldése még nincs bekötve. Kérlek írj e-mailt: tattoo.vamos@gmail.com');
    return;
  }

  const label = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Küldés…';

  try {
    const files = [];
    for (const f of kepek.files) {
      if (f.size > MAX_FILE) throw new Error(f.name + ' nagyobb 8 MB-nál, kérlek küldj kisebbet.');
      files.push(await toBase64(f));
    }

    /* text/plain, hogy a böngésző ne küldjön CORS preflightot — az Apps
       Script webalkalmazás nem válaszol OPTIONS kérésre. */
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        nev: nev.value.trim(),
        email: email.value.trim(),
        telefon: tel.disabled ? '' : tel.value.trim(),
        otlet: otlet.value.trim(),
        testresz: hol.disabled ? '' : hol.value.trim(),
        meret: meret.disabled ? '' : meret.value.trim(),
        mikor: form.mikor.value.trim(),
        korrekcio: korr.checked,
        elso: elso.checked,
        botcheck: form.botcheck.checked,
        kepek: files
      })
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'A küldés nem sikerült.');

    form.reset();
    applyMode();
    applyTel();
    ok.hidden = false;
    ok.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    /* A saját hibáink magyarul szólnak (túl nagy fájl, szerver válasza). A fetch
       viszont "Failed to fetch"-et dob, azt nem a látogató elé valóra cseréljük. */
    const msg = (err && err.message) || '';
    const halozati = err instanceof TypeError || /fetch|network/i.test(msg);
    showFail(halozati
      ? 'Nem sikerült elküldeni. Ellenőrizd az internetkapcsolatot, vagy írj e-mailt: tattoo.vamos@gmail.com'
      : msg || 'A küldés nem sikerült. Kérlek próbáld újra.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = label;
  }
});

[...form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea')].forEach(f =>
  f.addEventListener('input', () => clear(f))
);
form.kepek.addEventListener('change', () => clear(form.kepek));
