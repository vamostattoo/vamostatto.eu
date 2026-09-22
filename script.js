/* Vamos Tattoo — menu and booking form.
   The form is the whole point of the page, so the validation is written
   around what Norbert actually needs in order to quote: a way to reach the
   person, what they want, where on the body, and the size in centimetres.

   Two checkboxes change what the form asks for. "Korrekció" means the tattoo
   already exists, so the form stops asking where it is and how big it is —
   that is on the photograph — and asks for the photograph instead. "Első
   tetoválás" changes nothing in the validation; it is a flag for Norbert, so
   he knows to explain more when he answers. */

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
korr.addEventListener('change', () => { applyMode(); clear(form.kepek); });
elso.addEventListener('change', applyMode);
applyMode();

form.addEventListener('submit', e => {
  e.preventDefault();
  const { nev, elerhetoseg: el, otlet, testresz: hol, meret, kepek } = form;
  [nev, el, otlet, hol, meret, kepek].forEach(clear);
  ok.hidden = true;
  let bad = null;

  if (!nev.value.trim()) { fail(nev, 'Írd be a neved, hogy tudjam, kihez szóljak.'); bad ||= nev; }

  const v = el.value.trim();
  const digits = (v.match(/\d/g) || []).length;
  if (!v) { fail(el, 'Elérhetőség nélkül nem tudok visszajelezni.'); bad ||= el; }
  else if (!EMAIL.test(v) && digits < 7) { fail(el, 'Ez így nem tűnik e-mail-címnek vagy telefonszámnak.'); bad ||= el; }

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

  form.reset();
  applyMode();
  ok.hidden = false;
});

[...form.querySelectorAll('input[type="text"], textarea')].forEach(f =>
  f.addEventListener('input', () => clear(f))
);
form.kepek.addEventListener('change', () => clear(form.kepek));
