/* The Psalms of David — a book, paginated and turned by hand. */
(function () {
'use strict';

var ORD = [null, 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth',
  'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth',
  'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth',
  'Nineteenth', 'Twentieth', 'Twenty-first', 'Twenty-second', 'Twenty-third',
  'Twenty-fourth', 'Twenty-fifth', 'Twenty-sixth', 'Twenty-seventh',
  'Twenty-eighth', 'Twenty-ninth', 'Thirtieth'];

var FRONT_PAGES = 5;            // flyleaf, title, table i–iii
var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

/* ——— compose the book ——— */

function verseHTML(v) {
  var h = '<p class="v"><span class="vn">' + v.v + '</span>' + esc(v.a);
  if (v.b) h += ' <span class="st">*</span> ' + esc(v.b);
  return h + '</p>';
}

function tableEntry(p) {
  var inc = (p.latin || '').replace(/,?\s*&c\.?\s*$/, '').replace(/[,.]\s*$/, '');
  return '<a class="tent" data-ps="' + p.n + '"><span class="tn">' + p.n +
    '</span><span class="ti">' + esc(inc) +
    '</span><span class="dots"></span><span class="tp"></span></a>';
}

function buildFlowHTML() {
  var parts = [];
  parts.push('<div class="fullpage fly"><div class="flycross">&#10016;</div></div>');
  parts.push('<div class="fullpage titlepage">' +
    '<div class="tp-cross">&#10016;</div>' +
    '<h1>THE PSALMS<br>OF DAVID</h1>' +
    '<div class="rule"></div>' +
    '<p class="tp-sub">Pointed as they are to be<br>said or sung in churches</p>' +
    '<div class="rule short"></div>' +
    '<p class="tp-tr">after the translation of<br><b>Miles Coverdale</b></p>' +
    '<p class="tp-year">MDXXXV</p>' +
    '</div>');

  for (var pg = 0; pg < 3; pg++) {
    var t = '<div class="fullpage tablepage"><h3 class="thead">The Table</h3><div class="toc">';
    for (var c = 0; c < 2; c++) {
      t += '<div class="tcol">';
      for (var i = 0; i < 25; i++) {
        var n = pg * 50 + c * 25 + i;
        if (n < 150) t += tableEntry(PSALTER[n]);
      }
      t += '</div>';
    }
    parts.push(t + '</div></div>');
  }

  var lastKey = '';
  PSALTER.forEach(function (p) {
    p.sections.forEach(function (s, si) {
      var keep = '<div class="keep">';
      var key = s.day + '/' + s.hour;
      if (key !== lastKey) {
        keep += '<div class="day">The ' + ORD[s.day] + ' Day &nbsp;&middot;&nbsp; ' +
          s.hour + ' Prayer</div>';
        lastKey = key;
      }
      if (si === 0) {
        keep += '<h2 class="psn" data-ps="' + p.n + '">Psalm ' + p.n + '</h2>';
        if (p.latin) keep += '<div class="inc">' + esc(p.latin) + '</div>';
      } else if (s.latin) {
        keep += '<div class="sinc">' + esc(s.latin) + '</div>';
      }
      keep += verseHTML(s.verses[0]) + '</div>';
      parts.push(keep);
      for (var vi = 1; vi < s.verses.length; vi++) {
        parts.push(verseHTML(s.verses[vi]));
      }
    });
  });

  parts.push('<div class="fullpage colophon">' +
    '<div class="end-cross">&#10016;</div>' +
    '<div class="end-line">Here endeth the Psalter.</div>' +
    '<p class="end-note">In months of one and thirty days, the Psalms of the ' +
    'thirtieth day are read again upon the one and thirtieth.</p>' +
    '</div>');
  return parts.join('');
}

/* ——— page components ——— */

function makePage(root) {
  root.innerHTML = '<div class="phead"></div><div class="port"><div class="flow"></div></div><div class="folio"></div>';
  return {
    head: root.querySelector('.phead'),
    port: root.querySelector('.port'),
    flow: root.querySelector('.flow'),
    folio: root.querySelector('.folio')
  };
}

var book = document.getElementById('book');
var leaf = document.getElementById('leaf');
var edge = document.getElementById('edge');
var ribbon = document.getElementById('ribbon');
var etip = document.getElementById('etip');
var gotoBox = document.getElementById('goto');
var gotoNum = document.getElementById('gotoNum');
var hint = document.getElementById('hint');

var L = makePage(document.getElementById('pageL'));
var R = makePage(document.getElementById('pageR'));
var F = makePage(leaf.querySelector('.face.front'));
var B = makePage(leaf.querySelector('.face.back'));

var FLOW_HTML = buildFlowHTML();
[L, R, F, B].forEach(function (c) { c.flow.innerHTML = FLOW_HTML; });

/* ——— geometry & pagination ——— */

var solo = false, colStep = 0, pages = 1, maxLeft = 0, cur = 0;
var heads = [], firstOn = [], startPage = {};
var animating = false, pending = null;

function computeGeometry() {
  var vw = innerWidth, vh = innerHeight;
  solo = vw < 820;
  document.body.classList.toggle('solo', solo);
  hint.innerHTML = solo
    ? 'swipe to turn the page&emsp;&middot;&emsp;riffle the page&#8209;edge below'
    : '&#8592;&#8201;&#8594;&ensp;turn the page&emsp;&middot;&emsp;riffle the ' +
      'page&#8209;edge&emsp;&middot;&emsp;type a psalm number&emsp;&middot;&emsp;T&ensp;the table';
  var availH = Math.max(360, vh - 112);
  var availW = solo ? vw - 28 : vw - 96;
  var ph = Math.min(availH, 1020);
  var pw = Math.round(ph * 0.68);
  var maxPw = solo ? availW : Math.floor(availW / 2);
  if (pw > maxPw) { pw = maxPw; ph = Math.min(availH, Math.round(pw / 0.68)); }
  pw = Math.max(pw, 250);
  var fs = Math.min(19, Math.max(13, pw / 25.5));
  var padh = Math.round(pw * 0.115);
  var porttop = Math.round(ph * 0.105);
  var padbot = Math.round(ph * 0.094);
  var colw = pw - 2 * padh;
  var gap = 2 * padh;
  colStep = colw + gap;
  var st = document.documentElement.style;
  st.setProperty('--pw', pw + 'px');
  st.setProperty('--ph', ph + 'px');
  st.setProperty('--padh', padh + 'px');
  st.setProperty('--porttop', porttop + 'px');
  st.setProperty('--flowh', (ph - porttop - padbot) + 'px');
  st.setProperty('--colw', colw + 'px');
  st.setProperty('--gap', gap + 'px');
  st.setProperty('--fs', fs.toFixed(2) + 'px');
}

function paginate() {
  // measure on the right copy with no transform
  R.flow.style.transform = 'none';
  void R.flow.offsetWidth;
  var gap = colStep - R.flow.clientWidth;
  pages = Math.max(1, Math.round((R.port.scrollWidth + gap) / colStep));
  maxLeft = solo ? pages - 1 : (pages - 1) - ((pages - 1) % 2);

  var starts = [];
  startPage = {};
  R.flow.querySelectorAll('.psn').forEach(function (el) {
    var p = Math.round(el.offsetLeft / colStep);
    var n = +el.dataset.ps;
    starts.push({ n: n, page: p, atTop: el.offsetTop < 8 });
    startPage[n] = p;
  });

  heads = []; firstOn = [];
  var lastN = 0, idx = 0;
  for (var p = 0; p < pages; p++) {
    var on = [];
    while (idx < starts.length && starts[idx].page === p) on.push(starts[idx++]);
    var first, last;
    if (on.length) {
      first = (on[0].atTop || !lastN) ? on[0].n : lastN;
      last = on[on.length - 1].n;
      lastN = last;
    } else {
      first = last = lastN;
    }
    firstOn[p] = first;
    heads[p] = first ? (first === last ? 'Psalm ' + first
      : 'Psalms ' + first + '–' + last) : '';
  }

  // fill the Table with folio numbers
  document.querySelectorAll('.tent').forEach(function (a) {
    var sp = startPage[+a.dataset.ps];
    a.querySelector('.tp').textContent = sp != null ? (sp - FRONT_PAGES + 1) : '';
  });
}

function setPage(c, p) {
  c.flow.style.transform = 'translateX(' + (-p * colStep) + 'px)';
  var inBody = p >= FRONT_PAGES && p < pages;
  c.head.textContent = inBody ? heads[p] : '';
  c.folio.textContent = inBody ? String(p - FRONT_PAGES + 1) : '';
}

function labelFor(p) {
  if (p <= 1) return 'Title';
  if (p < FRONT_PAGES) return 'The Table';
  return heads[p] || 'Psalm 150';
}

/* ——— painting & turning ——— */

function paint() {
  if (solo) {
    setPage(R, cur);
  } else {
    setPage(L, cur);
    setPage(R, cur + 1);
  }
  ribbon.style.left = 'calc(' + (maxLeft ? (cur / maxLeft) * 100 : 0).toFixed(3) + '% - 2px)';
  var n = firstOn[cur] || (!solo && firstOn[cur + 1]) || 0;
  try {
    localStorage.setItem('psalmsofdavid:at', JSON.stringify({ page: cur, ps: n }));
    history.replaceState(null, '', n ? location.pathname + '#' + n : location.pathname);
  } catch (e) { /* sandboxed */ }
}

function snap(p) {
  p = Math.max(0, Math.min(p, maxLeft));
  if (!solo) p -= p % 2;
  return p;
}

function jump(p) { cur = snap(p); paint(); }


function flip(p) {
  animating = true;
  var fwd = p > cur;
  if (fwd) {
    setPage(F, cur + 1);   // recto being turned away
    setPage(B, p);         // its verso: the new left page
    setPage(R, p + 1);     // revealed beneath
  } else {
    setPage(B, cur);       // verso being turned away
    setPage(F, p + 1);     // its recto: the new right page
    setPage(L, p);         // revealed beneath
  }
  leaf.style.transition = 'none';
  leaf.style.transform = fwd ? 'rotateY(0deg)' : 'rotateY(-180deg)';
  leaf.classList.add('on', 'turning');
  void leaf.offsetWidth;
  leaf.style.transition = 'transform 0.46s cubic-bezier(0.24, 0.52, 0.3, 1)';
  leaf.style.transform = fwd ? 'rotateY(-180deg)' : 'rotateY(0deg)';

  var settled = false;
  var done = function () {
    if (settled) return;
    settled = true;
    leaf.classList.remove('on', 'turning');
    leaf.style.transition = 'none';
    animating = false;
    cur = p;
    paint();
    if (pending !== null) { var t = pending; pending = null; setSpread(t, false); }
  };
  leaf.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 600);
}

function setSpread(p, anim) {
  p = snap(p);
  if (p === cur) return;
  if (animating) { pending = p; return; }
  if (anim && !solo && !REDUCED && Math.abs(p - cur) === 2) flip(p);
  else jump(p);
}

function gotoPsalm(n, anim) {
  if (!(n >= 1 && n <= 150) || startPage[n] == null) return;
  setSpread(startPage[n], anim);
}

/* ——— layout ——— */

function layout(preserveAnchor) {
  var anchor = (preserveAnchor && cur >= FRONT_PAGES) ? firstOn[cur] : 0;
  computeGeometry();
  paginate();
  if (anchor && startPage[anchor] != null) cur = snap(startPage[anchor]);
  else cur = snap(cur);
  paint();
  book.classList.add('ready');
}

/* ——— input ——— */

document.getElementById('zoneNext').addEventListener('click', function () {
  setSpread(cur + (solo ? 1 : 2), true);
});
document.getElementById('zonePrev').addEventListener('click', function () {
  setSpread(cur - (solo ? 1 : 2), true);
});

book.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('.tent');
  if (a) { e.preventDefault(); gotoPsalm(+a.dataset.ps, false); }
});

/* keyboard */
var gotoOpen = false, gotoVal = '';

function openGoto(d) {
  gotoOpen = true; gotoVal = d || '';
  gotoNum.textContent = gotoVal || ' ';
  gotoBox.classList.add('on');
}
function closeGoto() { gotoOpen = false; gotoVal = ''; gotoBox.classList.remove('on'); }

document.addEventListener('keydown', function (e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  wake();
  if (gotoOpen) {
    if (e.key >= '0' && e.key <= '9') {
      if (gotoVal.length < 3) { gotoVal += e.key; gotoNum.textContent = gotoVal; }
    } else if (e.key === 'Backspace') {
      gotoVal = gotoVal.slice(0, -1); gotoNum.textContent = gotoVal || ' ';
    } else if (e.key === 'Enter') {
      var n = parseInt(gotoVal, 10); closeGoto(); gotoPsalm(n, true);
    } else if (e.key === 'Escape') {
      closeGoto();
    }
    e.preventDefault();
    return;
  }
  var step = solo ? 1 : 2;
  switch (e.key) {
    case 'ArrowRight': case 'PageDown': case ' ':
      setSpread(cur + step * (e.shiftKey ? 10 : 1), !e.repeat && !e.shiftKey);
      e.preventDefault(); break;
    case 'ArrowLeft': case 'PageUp':
      setSpread(cur - step * (e.shiftKey ? 10 : 1), !e.repeat && !e.shiftKey);
      e.preventDefault(); break;
    case 'Home': setSpread(0, false); e.preventDefault(); break;
    case 'End': setSpread(maxLeft, false); e.preventDefault(); break;
    case 't': case 'T': setSpread(2, true); break;
    default:
      if (e.key >= '1' && e.key <= '9') openGoto(e.key);
  }
});

/* wheel: one turn per gesture beat */
var lastWheel = 0;
addEventListener('wheel', function (e) {
  var now = Date.now();
  if (now - lastWheel < 350) return;
  var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(d) < 4) return;
  lastWheel = now;
  setSpread(cur + (d > 0 ? 1 : -1) * (solo ? 1 : 2), true);
}, { passive: true });

/* touch swipe across the book */
var touchX = null;
book.addEventListener('pointerdown', function (e) {
  if (e.pointerType === 'touch') touchX = e.clientX;
});
book.addEventListener('pointerup', function (e) {
  if (e.pointerType !== 'touch' || touchX === null) return;
  var dx = e.clientX - touchX; touchX = null;
  if (Math.abs(dx) > 44) setSpread(cur + (dx < 0 ? 1 : -1) * (solo ? 1 : 2), true);
});

/* fore-edge riffle */
var riffling = false;

function edgePage(e) {
  var r = edge.getBoundingClientRect();
  var f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  return Math.round(f * maxLeft);
}
function showTip(e) {
  var p = snap(edgePage(e));
  etip.textContent = labelFor(p) || labelFor(p + 1) || '';
  var r = edge.getBoundingClientRect();
  etip.style.left = e.clientX + 'px';
  etip.style.top = r.top + 'px';
  etip.classList.add('on');
}
edge.addEventListener('pointerdown', function (e) {
  riffling = true;
  edge.setPointerCapture(e.pointerId);
  setSpread(edgePage(e), false);
  showTip(e);
  e.preventDefault();
});
edge.addEventListener('pointermove', function (e) {
  if (riffling) setSpread(edgePage(e), false);
  showTip(e);
});
edge.addEventListener('pointerup', function () { riffling = false; });
edge.addEventListener('pointercancel', function () { riffling = false; });
edge.addEventListener('pointerleave', function () {
  if (!riffling) etip.classList.remove('on');
});

/* hint fades when the reader settles */
var hintTimer = null;
function wake() {
  hint.classList.remove('dim');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(function () { hint.classList.add('dim'); }, 6000);
}
addEventListener('pointermove', wake, { passive: true });
wake();

/* resize */
var resizeTimer = null;
addEventListener('resize', function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () { layout(true); }, 140);
});

addEventListener('hashchange', function () {
  var m = location.hash.match(/^#(\d{1,3})$/);
  if (m) gotoPsalm(+m[1], true);
});

/* ——— begin ——— */

/* capture before the first paint rewrites the URL */
var OPENED_AT = location.hash.match(/^#(\d{1,3})$/) ||
  location.search.match(/[?&]ps=(\d{1,3})/);

layout(false);

(function restore() {
  if (OPENED_AT) { gotoPsalm(+OPENED_AT[1], false); return; }
  try {
    var saved = JSON.parse(localStorage.getItem('psalmsofdavid:at') || 'null');
    if (saved) {
      if (saved.ps && startPage[saved.ps] != null) jump(startPage[saved.ps]);
      else jump(saved.page || 0);
    }
  } catch (e) { /* first opening */ }
})();

/* re-measure once the type itself has arrived; unless the reader has
   already begun turning pages, keep the book open where it was asked */
var userMoved = false;
['pointerdown', 'keydown', 'wheel'].forEach(function (ev) {
  addEventListener(ev, function () { userMoved = true; },
    { capture: true, passive: true, once: true });
});
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () {
    layout(true);
    if (OPENED_AT && !userMoved) gotoPsalm(+OPENED_AT[1], false);
  });
}

})();
