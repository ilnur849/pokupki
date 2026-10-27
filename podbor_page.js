// 🛍 Скрипт страниц магазинов для «Подбора» (PodborActivity, 27.10; Ильнур: «поиск товаров на Озон, WB, Маркет,
// ВсеИнструменты, Лемана ПРО, Максидом, Мегастрой, Колорит… например, мне нужна краска»). Подставляется в страницу
// поиска любого магазина и даёт window.__podbor:
//   state()      — что на странице: карточки товаров, проверка «вы не робот», «ничего не нашлось»;
//   search(q)    — найти строку поиска на странице и искать (для магазинов, чей адрес поиска не известен заранее);
//   template(q)  — адрес этой страницы с {q} вместо запроса: так телефон запоминает адрес поиска магазина;
//   scroll()     — прокрутить вниз: многие сайты дорисовывают карточки и картинки по прокрутке.
// Один способ на все магазины, без знания вёрстки: от каждой цены («₽», «руб.») вверх до наименьшего блока, где есть
// ссылка и картинка, — это карточка. Текст карточки разбирает модель в n8n («🛍 Подбор», pokupki/подбор.js).
// С 2.20 «Помощник» берёт этот файл с GitHub Pages (pokupki/podbor_page.js), встроенный — запасной: правится без новой
// версии приложения. Новая версия скрипта — новое `v`, иначе на открытой странице останется старая.
// Проверка — pokupki/widget/test_podbor_page.js (живые Колорит и Максидом, макеты Озона, проверки и строки поиска).
(function () {
  if (window.__podbor && window.__podbor.v === 2) return;
  var PRICE = /\d[\d\s  ]*(?:[.,]\d{1,2})?\s*(?:₽|руб\.?|р\.(?![а-яё]))/i;
  var МАКС = 40;
  function txt(el) { return String((el && (el.innerText || el.textContent)) || '').replace(/[\s  ]+/g, ' ').trim(); }
  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return ''; } }
  function goodHref(a) {
    var h = String(a.getAttribute('href') || '');
    return h && h.charAt(0) !== '#' && !/^(javascript|mailto|tel):/i.test(h);
  }
  function hrefs(el) {
    var s = {};
    [].forEach.call(el.querySelectorAll('a[href]'), function (a) { if (goodHref(a)) s[abs(a.getAttribute('href')).split('#')[0]] = a; });
    return s;
  }
  function imgOf(el) {
    var im = el.querySelector('img');
    if (!im) return '';
    var s = im.currentSrc || im.getAttribute('src') || '';
    if (!s || /^data:/.test(s)) s = im.getAttribute('data-src') || im.getAttribute('data-original') || im.getAttribute('data-lazy') || '';
    if (!s || /^data:/.test(s)) s = String(im.getAttribute('srcset') || im.getAttribute('data-srcset') || '').trim().split(/\s+/)[0] || '';
    return s && !/^data:/.test(s) ? abs(s) : '';
  }
  // Блоки с ценой: элементы, чей собственный текст — цена (короткий), без вложенных таких же.
  function priceEls() {
    var out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var seen = typeof Set !== 'undefined' ? new Set() : null;
    for (var n = w.nextNode(); n; n = w.nextNode()) {
      var t = n.nodeValue;
      if (!t || !/\d/.test(t)) continue;
      var el = n.parentElement;
      // «1 299» и «₽» бывают в соседних элементах — берём родителя, пока текст короткий и цена в нём есть.
      for (var k = 0; k < 3 && el && !PRICE.test(txt(el)); k++) el = el.parentElement;
      if (!el || !PRICE.test(txt(el)) || txt(el).length > 60) continue;
      if (seen) { if (seen.has(el)) continue; seen.add(el); }
      out.push(el);
    }
    return out;
  }
  // Ссылки с картинкой внутри: у карточки она одна (картинка и название ведут на один товар), у сетки — по одной на товар.
  function imgLinks(el) {
    var s = {};
    [].forEach.call(el.querySelectorAll('a[href]'), function (a) { if (goodHref(a) && a.querySelector('img')) s[abs(a.getAttribute('href')).split('#')[0]] = 1; });
    return Object.keys(s).length;
  }
  // От цены вверх: последний уровень, где ссылка с картинкой одна (нет таких — ссылок не больше двух), есть картинка.
  function cardOf(priceEl) {
    var el = priceEl, best = null;
    for (var k = 0; k < 12 && el && el !== document.body; k++) {
      el = el.parentElement;
      if (!el || el === document.body) break;
      var il = imgLinks(el), hs = Object.keys(hrefs(el)).length;
      if (il > 1 || (il === 0 && hs > 2) || txt(el).length > 1500) break;
      if (hs && el.querySelector('img')) best = el;
    }
    return best;
  }
  // Ссылка на сам товар: не корзина, не бренд, не отзывы; с картинкой внутри или встречается в карточке дважды
  // (картинка и название), иначе — с самым длинным текстом. У WB, например, ссылка товара — пустая накладка поверх
  // карточки, а с текстом — «В корзину» (тогда все карточки слиплись бы в одну).
  var NOT_ITEM = /(basket|cart|korzin|корзин|brand|seller|shop\/|store\/|review|feedback|otzyv|compare|favorite|wishlist|login|auth|#)/i;
  function mainLink(card) {
    var счёт = {}, сКартинкой = {}, текст = {}, ссылка = {};
    [].forEach.call(card.querySelectorAll('a[href]'), function (a) {
      if (!goodHref(a)) return;
      var h = abs(a.getAttribute('href')).split('#')[0];
      if (NOT_ITEM.test(h.replace(/^https?:\/\/[^\/]+/, ''))) return;
      счёт[h] = (счёт[h] || 0) + 1;
      if (a.querySelector('img')) сКартинкой[h] = 1;
      var l = Math.max(txt(a).length, String(a.getAttribute('aria-label') || a.getAttribute('title') || '').length);
      if (!ссылка[h] || l > (текст[h] || 0)) { ссылка[h] = a; текст[h] = l; }
    });
    var hs = Object.keys(ссылка);
    if (!hs.length) return null;
    hs.sort(function (x, y) {
      return (сКартинкой[y] || 0) - (сКартинкой[x] || 0) || (счёт[y] > 1) - (счёт[x] > 1) || (текст[y] || 0) - (текст[x] || 0);
    });
    return { href: hs[0], a: ссылка[hs[0]] };
  }
  function cards() {
    var out = [], byHref = {};
    priceEls().forEach(function (p) {
      if (out.length >= МАКС) return;
      var c = cardOf(p);
      if (!c) return;
      var m = mainLink(c);
      if (!m || byHref[m.href]) return;
      byHref[m.href] = 1;
      out.push({ i: out.length, href: m.href, img: imgOf(c), т: txt(c).slice(0, 400),
        н: (txt(m.a) || String(m.a.getAttribute('aria-label') || m.a.getAttribute('title') || '')).slice(0, 200) });
    });
    return out;
  }
  function body() { return txt(document.body).slice(0, 6000); }
  function visible(e) { return !!(e.offsetWidth || e.offsetHeight || (e.getClientRects && e.getClientRects().length)); }
  function searchInput() {
    var sel = ['input[type="search"]', 'input[name="q"]', 'input[name="text"]', 'input[name="search"]', 'input[name="query"]',
      'input[name="what"]', 'input[name="s"]', 'input[placeholder*="оиск"]', 'input[placeholder*="айти"]', 'input[aria-label*="оиск"]'];
    for (var i = 0; i < sel.length; i++) {
      var l = [].slice.call(document.querySelectorAll(sel[i]));
      for (var j = 0; j < l.length; j++) if (visible(l[j]) && !l[j].disabled) return l[j];
      if (l.length) return l[0];
    }
    return null;
  }
  window.__podbor = {
    v: 2,
    state: function () {
      var b = body(), list = cards();
      return JSON.stringify({
        путь: (location.pathname + location.search).slice(0, 300),
        адрес: location.href.slice(0, 500),
        // 403 без текста (Лемана, Маркет отсюда) — тоже проверка: на телефоне такую страницу человек хотя бы увидит.
        проверка: !list.length && (/xpvnsulc|showcaptcha|captcha|ddos-guard|__qrator|challenge/i.test(location.href)
          || /^\s*(?:HTTP\s*)?(?:403|429)\b|forbidden|access denied|доступ (?:запрещ|ограничен)/i.test(document.title)
          || /(не робот|подтвердите, что вы|проверка браузера|проверяем браузер|checking your browser|доступ ограничен|ddos-guard|пройдите проверку|подозрительн)/i.test(b)),
        пусто: !list.length && /(ничего не найдено|ничего не нашлось|ничего не нашли|по вашему запросу .{0,80}(не найдено|ничего)|нет товаров по запросу|не нашлось товаров|товары не найдены)/i.test(b),
        готово: document.readyState,
        карточки: list
      });
    },
    search: function (q) {
      var inp = searchInput();
      if (!inp) return 'нет поля';
      var set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      inp.focus();
      set.call(inp, q);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      if (inp.form) {
        try { if (inp.form.requestSubmit) inp.form.requestSubmit(); else inp.form.submit(); return 'форма'; } catch (e) { /* дальше кнопка */ }
      }
      var box = inp.parentElement;
      for (var k = 0; k < 4 && box; k++, box = box.parentElement) {
        var b = [].filter.call(box.querySelectorAll('button, [role="button"]'), function (x) {
          return x.type === 'submit' || /(найти|поиск|искать)/i.test(txt(x) + ' ' + (x.getAttribute('aria-label') || ''));
        })[0];
        if (b) { b.click(); return 'кнопка'; }
      }
      ['keydown', 'keypress', 'keyup'].forEach(function (t) {
        inp.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      });
      return 'enter';
    },
    template: function (q) {
      var u = location.href, вар = [encodeURIComponent(q), encodeURIComponent(q).replace(/%20/g, '+'), q, q.replace(/ /g, '+')];
      for (var i = 0; i < вар.length; i++) {
        var at = u.indexOf(вар[i]);
        if (at > 0 && /[?&=\/]/.test(u.charAt(at - 1))) return u.slice(0, at) + '{q}' + u.slice(at + вар[i].length);
      }
      try {
        var p = new URL(u);
        var найден = '';
        p.searchParams.forEach(function (v, k) { if (!найден && v.toLowerCase() === q.toLowerCase()) найден = k; });
        if (найден) { p.searchParams.set(найден, '__Q__'); return p.href.replace('__Q__', '{q}'); }
      } catch (e) { /* нет */ }
      return '';
    },
    scroll: function () { window.scrollBy(0, Math.max(800, window.innerHeight * 2)); return document.body.scrollHeight; },
    // Снимок непонятной страницы — сессии разработки: подписи кнопок (без цифр — там бывает адрес), ссылки, сколько цен,
    // кусок вокруг первой цены и начало текста страницы. Куки, адрес доставки и имя сюда не попадают.
    diag: function () {
      var labels = {};
      [].forEach.call(document.querySelectorAll('[aria-label]'), function (b) { var l = String(b.getAttribute('aria-label') || '').trim(); if (l && l.length < 60 && !/\d/.test(l)) labels[l] = 1; });
      [].forEach.call(document.querySelectorAll('button'), function (b) { var t = txt(b); if (t && t.length < 40 && !/\d/.test(t)) labels[t] = 1; });
      var ps = priceEls(), кусок = '';
      if (ps.length) {
        var el = ps[0];
        for (var k = 0; k < 6 && el.parentElement && el.parentElement !== document.body; k++) el = el.parentElement;
        кусок = el.outerHTML.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<svg[\s\S]*?<\/svg>/gi, '<svg/>').slice(0, 20000);
      }
      return JSON.stringify({ путь: (location.pathname + location.search).slice(0, 300), заголовок: document.title.slice(0, 200), ua: navigator.userAgent,
        кнопки: Object.keys(labels).slice(0, 80), ссылки: Object.keys(hrefs(document.body)).slice(0, 30), цены: ps.length, карточка: кусок,
        текст: body().slice(0, 3000) });
    }
  };
})();
