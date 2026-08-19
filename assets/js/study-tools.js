/* ============================================================
   雅思通关 · 共享学习工具
   - 同步 SHA1（与 Python 端一致，用于 edge-tts 音频文件名）
   - 点击发音（edge-tts 预生成 mp3，无 Web Speech 回退）
   - SRS 记忆 + 进度/错题/收藏（localStorage）
   - VocabApp：三本词汇书共用的统一 UI 渲染
   ============================================================ */
(function () {
  "use strict";
  var IELTS = (window.IELTS = window.IELTS || {});
  IELTS.AUDIO_BASE = IELTS.AUDIO_BASE || "../audio/";

  /* ---------- 同步 SHA1（与 Python hashlib.sha1 一致） ---------- */
  function sha1(str) {
    function rot(x, n) { return (x << n) | (x >>> (32 - n)); }
    function utf8(s) { return unescape(encodeURIComponent(s)); }
    var msg = utf8(str), len = msg.length, w = [], a = 1732584193, b = -271733879,
        c = -1732584194, d = 271733878, e = -1009589776, i, j, t, t2;
    msg += String.fromCharCode(128);
    while (msg.length % 64 !== 56) msg += String.fromCharCode(0);
    for (i = 0; i < msg.length; i += 4)
      w.push(msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 |
             msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3));
    w.push(len * 8 >>> 0, 0);
    for (i = 0; i < w.length; i += 16) {
      var o = [a, b, c, d, e];
      for (j = 0; j < 80; j++) {
        t = w[i + (j & 15)];
        if (j >= 16) t = rot(w[i + ((j - 3) & 15)] ^ w[i + ((j - 8) & 15)] ^
                            w[i + ((j - 14) & 15)] ^ w[i + ((j - 15) & 15)], 1);
        if (j < 20) t2 = (b & c) | (~b & d) + 1518500249;
        else if (j < 40) t2 = b ^ c ^ d + 1859775393;
        else if (j < 60) t2 = (b & c) | (b & d) | (c & d) + -1894007588;
        else t2 = b ^ c ^ d + -899497514;
        t = (rot(a, 5) + t2 + e + t) >>> 0; e = d; d = c; c = rot(b, 30) >>> 0; b = a; a = t;
      }
      a = (a + o[0]) >>> 0; b = (b + o[1]) >>> 0; c = (c + o[2]) >>> 0;
      d = (d + o[3]) >>> 0; e = (e + o[4]) >>> 0;
    }
    function h(x) { return ("0000000" + (x >>> 0).toString(16)).slice(-8); }
    return h(a) + h(b) + h(c) + h(d) + h(e);
  }
  IELTS.sha1 = sha1;
  IELTS.normalize = function (t) { return (t || "").trim().toLowerCase().replace(/\s+/g, " "); };
  IELTS.audioUrl = function (text) { return IELTS.AUDIO_BASE + sha1(IELTS.normalize(text)) + ".mp3"; };

  /* ---------- 点击发音（edge-tts 预生成音频） ---------- */
  var current = null;
  IELTS.speak = function (text, btn) {
    if (!text) return;
    var url = IELTS.audioUrl(text);
    if (current) { try { current.pause(); } catch (e) {} }
    var a = new Audio(url);
    if (btn) { btn.classList.add("playing"); }
    a.addEventListener("ended", function () { if (btn) btn.classList.remove("playing"); });
    a.addEventListener("error", function () { if (btn) btn.classList.remove("playing"); });
    current = a;
    var p = a.play();
    if (p && p.catch) p.catch(function () { if (btn) btn.classList.remove("playing"); });
  };
  IELTS.makeSpeakBtn = function (text, cls) {
    var b = document.createElement("button");
    b.className = "speak" + (cls ? " " + cls : "");
    b.innerHTML = "🔊";
    b.title = "点击发音";
    b.addEventListener("click", function (e) { e.stopPropagation(); IELTS.speak(text, b); });
    return b;
  };
  /* 将一段英文变为可点击发音的文本节点（保留原 HTML 结构） */
  IELTS.makeSpeakable = function (text, asWord) {
    var span = document.createElement(asWord ? "span" : "span");
    span.className = "word-click en";
    span.textContent = text;
    span.addEventListener("click", function () { IELTS.speak(text, null); });
    return span;
  };

  /* ---------- 笔记渲染 ---------- */
  var NOTE_LABEL = { "记": "记忆", "例": "例句", "搭": "搭配", "同": "同义", "反": "反义",
                     "根": "同根", "近": "近义", "辨": "辨析", "派": "派生" };
  IELTS.renderNotes = function (notes) {
    if (!notes) return "";
    var order = ["例", "记", "搭", "同", "反", "近", "根", "辨", "派"];
    var html = "";
    order.forEach(function (k) {
      if (notes[k]) {
        html += '<div><span class="nt">' + (NOTE_LABEL[k] || k) + "：</span>" +
                escapeHtml(notes[k]) + "</div>";
      }
    });
    Object.keys(notes).forEach(function (k) {
      if (order.indexOf(k) < 0)
        html += '<div><span class="nt">' + (NOTE_LABEL[k] || k) + "：</span>" +
                escapeHtml(notes[k]) + "</div>";
    });
    return html;
  };

  /* 交互版：例句（例）中的英文部分可点击发音 */
  IELTS.renderNotesEl = function (notes) {
    var box = el("div", "wnotes");
    if (!notes) return box;
    var order = ["例", "记", "搭", "同", "反", "近", "根", "辨", "派"];
    var keys = order.filter(function (k) { return notes[k]; })
      .concat(Object.keys(notes).filter(function (k) { return order.indexOf(k) < 0; }));
    keys.forEach(function (k) {
      var row = el("div");
      row.appendChild(el("span", "nt", (NOTE_LABEL[k] || k) + "："));
      var txt = notes[k];
      if (k === "例") {
        var m = txt.search(/[一-鿿]/);
        var en = m < 0 ? txt : txt.slice(0, m);
        var cn = m < 0 ? "" : txt.slice(m);
        if (en.trim()) {
          var sp = el("span", "word-click en", en.trim());
          sp.addEventListener("click", function () { IELTS.speak(en.trim(), null); });
          row.appendChild(sp);
        }
        if (cn) row.appendChild(document.createTextNode(cn));
      } else {
        row.appendChild(document.createTextNode(txt));
      }
      box.appendChild(row);
    });
    return box;
  };
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  IELTS.escapeHtml = escapeHtml;

  /* ---------- SRS 存储（localStorage） ---------- */
  var DAY = 86400000;
  var INTERVALS = [0, 1, 3, 7, 15, 30]; // 天数（level 0..5）
  var Store = {
    _key: function (bookId) { return "ielts_v1_" + bookId; },
    _read: function (bookId) {
      try { return JSON.parse(localStorage.getItem(this._key(bookId))) || {}; }
      catch (e) { return {}; }
    },
    _write: function (bookId, obj) {
      try { localStorage.setItem(this._key(bookId), JSON.stringify(obj)); } catch (e) {}
    },
    getState: function (bookId, key) {
      var o = this._read(bookId); return o[key] || null;
    },
    setState: function (bookId, key, st) {
      var o = this._read(bookId); o[key] = st; this._write(bookId, o);
    },
    recordReview: function (bookId, key, correct) {
      var o = this._read(bookId);
      var st = o[key] || { lvl: 0, due: 0, wrong: 0, correct: 0 };
      st.last = Date.now();
      if (correct) {
        st.correct++; st.lvl = Math.min(st.lvl + 1, INTERVALS.length - 1);
      } else {
        st.wrong++; st.lvl = 0;
      }
      st.due = Date.now() + INTERVALS[st.lvl] * DAY;
      o[key] = st; this._write(bookId, o); return st;
    },
    stats: function (bookId, total) {
      var o = this._read(bookId), learned = 0, mastered = 0, due = 0, now = Date.now();
      Object.keys(o).forEach(function (k) {
        var st = o[k]; if (!st) return;
        if (st.lvl > 0) learned++;
        if (st.lvl >= 4) mastered++;
        if (st.due <= now) due++;
      });
      return { total: total, learned: learned, mastered: mastered, due: due };
    },
    /* 收藏 */
    toggleFav: function (bookId, word) {
      var k = "fav_" + bookId, arr = this._readArr(k);
      var i = arr.indexOf(word);
      if (i >= 0) arr.splice(i, 1); else arr.push(word);
      this._writeArr(k, arr); return i < 0;
    },
    isFav: function (bookId, word) { return this._readArr("fav_" + bookId).indexOf(word) >= 0; },
    getFav: function (bookId) { return this._readArr("fav_" + bookId); },
    /* 错题 */
    addWrong: function (bookId, word) {
      var k = "wrong_" + bookId, arr = this._readArr(k);
      if (arr.indexOf(word) < 0) arr.push(word); this._writeArr(k, arr);
    },
    removeWrong: function (bookId, word) {
      var k = "wrong_" + bookId, arr = this._readArr(k);
      var i = arr.indexOf(word); if (i >= 0) arr.splice(i, 1); this._writeArr(k, arr);
    },
    getWrong: function (bookId) { return this._readArr("wrong_" + bookId); },
    _readArr: function (k) { try { return JSON.parse(localStorage.getItem("ielts_v1_" + k)) || []; } catch (e) { return []; } },
    _writeArr: function (k, arr) { try { localStorage.setItem("ielts_v1_" + k, JSON.stringify(arr)); } catch (e) {} }
  };
  IELTS.Store = Store;

  /* ---------- 工具 ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  IELTS.el = el;

  /* ============================================================
     VocabApp：三本词汇书共用的统一界面
     cfg = { bookId, data, type: 'sentence'|'theme'|'root' }
     ============================================================ */
  function VocabApp(cfg) {
    this.bookId = cfg.bookId;
    this.data = cfg.data;
    this.type = cfg.type;
    this.feature = cfg.feature || "";
    this.WORDS = this._buildWords();
    this.total = this.WORDS.length;
  }

  VocabApp.prototype._buildWords = function () {
    var arr = [], self = this;
    function pushWord(w, group) {
      arr.push({
        key: self.bookId + ":" + arr.length,
        word: w.word, phonetic: w.phonetic || "", meaning: w.meaning || "",
        notes: w.notes || {}, example: (w.notes && w.notes["例"]) || "",
        group: group || ""
      });
    }
    if (this.type === "sentence") {
      this.data.sentences.forEach(function (s) {
        s.coreWords.forEach(function (w) { pushWord(w, "核心词·句" + s.id); });
        s.themeGroups.forEach(function (g) {
          g.words.forEach(function (w) { pushWord(w, "主题·" + g.label); });
        });
      });
    } else {
      this.data.chapters.forEach(function (ch) {
        ch.words.forEach(function (w) { pushWord(w, ch.title); });
      });
    }
    return arr;
  };

  VocabApp.prototype.findWord = function (word) {
    for (var i = 0; i < this.WORDS.length; i++)
      if (this.WORDS[i].word === word) return this.WORDS[i];
    return null;
  };

  /* 渲染整体页面（容器：#app-header, #app-tabs, #app-panels） */
  VocabApp.prototype.render = function () {
    var self = this;
    this._renderHeader();
    this._renderTabs();
    this._renderBrowse();
    this._renderFlash();
    this._renderSpell();
    this._renderWrong();
    this._renderProgress();
    this._showReminder();
    this._activateTab("browse");
  };

  VocabApp.prototype._renderHeader = function () {
    var m = this.data.meta || {};
    var hdr = document.getElementById("app-header");
    if (!hdr) return;
    var st = Store.stats(this.bookId, this.total);
    var feat = this.feature || (m.note ? "" : "");
    hdr.innerHTML =
      '<div class="bookhead"><div class="meta">' +
      '<h1>' + IELTS.escapeHtml(m.title || "词汇") + "</h1>" +
      '<div class="author">作者：' + IELTS.escapeHtml(m.author || "—") + "　·　共 " +
      this.total + " 个词条</div>" +
      (feat ? '<div class="feat">✨ ' + IELTS.escapeHtml(feat) + "</div>" : "") +
      (m.note ? '<div class="feat" style="background:#fff3e0;color:#9a6212;">⚠️ ' + IELTS.escapeHtml(m.note) + "</div>" : "") +
      "</div>" +
      '<div class="stats">' +
      '<div class="stat"><b>' + this.total + '</b><span>总词数</span></div>' +
      '<div class="stat"><b id="hdr-learned">' + st.learned + '</b><span>已学习</span></div>' +
      '<div class="stat"><b id="hdr-due">' + st.due + '</b><span>待复习</span></div>' +
      "</div></div>";
  };

  VocabApp.prototype._refreshHeader = function () {
    var st = Store.stats(this.bookId, this.total);
    var l = document.getElementById("hdr-learned"), d = document.getElementById("hdr-due");
    if (l) l.textContent = st.learned;
    if (d) d.textContent = st.due;
  };

  VocabApp.prototype._renderTabs = function () {
    var tabs = document.getElementById("app-tabs");
    var defs = [
      ["browse", "单词浏览"], ["flash", "卡片学习"], ["spell", "拼写测试"],
      ["wrong", "错题本"], ["progress", "学习进度"]
    ];
    tabs.innerHTML = "";
    var self = this;
    defs.forEach(function (d) {
      var b = el("button", "tab", d[1]); b.dataset.tab = d[0];
      b.addEventListener("click", function () { self._activateTab(d[0]); });
      tabs.appendChild(b);
    });
  };

  VocabApp.prototype._activateTab = function (name) {
    var tabs = document.getElementById("app-tabs").children;
    for (var i = 0; i < tabs.length; i++)
      tabs[i].classList.toggle("active", tabs[i].dataset.tab === name);
    var panels = document.getElementById("app-panels").children;
    for (var j = 0; j < panels.length; j++)
      panels[j].classList.toggle("active", panels[j].id === "panel-" + name);
    if (name === "wrong") this._renderWrong();
    if (name === "progress") this._renderProgress();
  };

  /* ---------- 浏览 ---------- */
  VocabApp.prototype._renderBrowse = function () {
    var panel = document.getElementById("panel-browse");
    panel.innerHTML = "";
    var self = this;
    if (this.type === "sentence") {
      this.data.sentences.forEach(function (s) {
        panel.appendChild(self._sentenceBlock(s));
      });
    } else {
      this.data.chapters.forEach(function (ch) {
        panel.appendChild(self._chapterBlock(ch));
      });
    }
  };

  VocabApp.prototype._sentenceBlock = function (s) {
    var self = this;
    var block = el("div", "sentence-block");
    var en = el("div", "sen-en");
    // 英文可点击发音
    en.appendChild(IELTS.makeSpeakable(s.en));
    var speakBtn = IELTS.makeSpeakBtn(s.en);
    en.appendChild(speakBtn);
    block.appendChild(en);
    block.appendChild(el("div", "sen-cn", IELTS.escapeHtml(s.cn)));
    if (s.source) block.appendChild(el("div", "sen-src", "来源：" + IELTS.escapeHtml(s.source)));
    // 折叠词表
    var toggle = el("button", "btn ghost sm", "显示核心词 + 主题词 ▾");
    var wordsWrap = el("div");
    wordsWrap.style.display = "none"; wordsWrap.style.marginTop = "12px";
    toggle.addEventListener("click", function () {
      if (wordsWrap.style.display === "none") {
        if (!wordsWrap.dataset.built) {
          var grid = el("div", "wordlist");
          s.coreWords.forEach(function (w) { grid.appendChild(self._wordItem(w)); });
          s.themeGroups.forEach(function (g) {
            grid.appendChild(el("div", "", '<div class="gcount" style="grid-column:1/-1;font-weight:700;color:var(--c-primary-d);margin:6px 0 2px;">' + IELTS.escapeHtml(g.label) + "</div>"));
            g.words.forEach(function (w) { grid.appendChild(self._wordItem(w)); });
          });
          wordsWrap.appendChild(grid); wordsWrap.dataset.built = "1";
        }
        wordsWrap.style.display = "block"; toggle.textContent = "隐藏核心词 + 主题词 ▴";
      } else { wordsWrap.style.display = "none"; toggle.textContent = "显示核心词 + 主题词 ▾"; }
    });
    block.appendChild(toggle);
    block.appendChild(wordsWrap);
    return block;
  };

  VocabApp.prototype._chapterBlock = function (ch) {
    var self = this;
    var wrap = el("div", "chapter-block");
    var title = el("div", "ch-title", IELTS.escapeHtml(ch.title) +
      ' <span class="gcount">（' + ch.words.length + " 词）</span>");
    wrap.appendChild(title);
    var grid = el("div", "wordlist");
    ch.words.forEach(function (w) { grid.appendChild(self._wordItem(w)); });
    wrap.appendChild(grid);
    return wrap;
  };

  VocabApp.prototype._wordItem = function (w) {
    var self = this;
    var item = el("div", "witem");
    var top = el("div", "wtop");
    var wword = el("span", "wword", IELTS.escapeHtml(w.word));
    top.appendChild(wword);
    if (w.phonetic) top.appendChild(el("span", "wphon", "/" + IELTS.escapeHtml(w.phonetic) + "/"));
    top.appendChild(IELTS.makeSpeakBtn(w.word));
    var star = el("span", "star" + (Store.isFav(this.bookId, w.word) ? " on" : ""), "★");
    star.title = "收藏";
    star.addEventListener("click", function () {
      var on = Store.toggleFav(self.bookId, w.word);
      star.classList.toggle("on", on);
    });
    top.appendChild(star);
    item.appendChild(top);
    if (w.meaning) item.appendChild(el("div", "wmean", IELTS.escapeHtml(w.meaning)));
    if (w.notes && Object.keys(w.notes).length) {
      item.appendChild(IELTS.renderNotesEl(w.notes));
    }
    return item;
  };

  /* ---------- 闪卡 ---------- */
  VocabApp.prototype._renderFlash = function () {
    var self = this, panel = document.getElementById("panel-flash");
    panel.innerHTML = "";
    var area = el("div", "flash-area");
    var card = el("div", "flashcard");
    card.innerHTML = '<div class="inner"><div class="face front"><div class="f-word"></div>' +
      '<div class="f-phon"></div><div class="f-hint">点击卡片翻转 · 🔊 发音</div></div>' +
      '<div class="face back"><div class="f-mean"></div><div class="f-notes"></div>' +
      '<div class="f-hint">认识 → 不认识 ←</div></div></div>';
    var speakFront = IELTS.makeSpeakBtn("", "lg");
    card.querySelector(".front").appendChild(speakFront);
    card.addEventListener("click", function () { card.classList.toggle("flipped"); });
    speakFront.addEventListener("click", function (e) {
      e.stopPropagation(); if (self._cur) IELTS.speak(self._cur.word, speakFront);
    });
    var prog = el("div", "flash-progress");
    var ctrls = el("div", "flash-ctrls");
    var bNo = el("button", "btn", "😶 不认识");
    var bYes = el("button", "btn accent", "😎 认识");
    ctrls.appendChild(bNo); ctrls.appendChild(bYes);
    area.appendChild(card); area.appendChild(prog); area.appendChild(ctrls);
    panel.appendChild(area);

    var order = this.WORDS.slice();
    function next() {
      if (!order.length) {
        card.querySelector(".f-word").textContent = "🎉";
        card.querySelector(".f-phon").textContent = "";
        card.querySelector(".back .f-mean").textContent = "本轮已完成！";
        card.querySelector(".back .f-notes").innerHTML = "";
        speakFront.style.display = "none";
        prog.textContent = "已完成"; bNo.disabled = bYes.disabled = true; return;
      }
      self._cur = order.shift();
      var w = self._cur;
      card.classList.remove("flipped");
      card.querySelector(".f-word").textContent = w.word;
      card.querySelector(".f-phon").textContent = w.phonetic ? "/" + w.phonetic + "/" : "";
      card.querySelector(".back .f-mean").textContent = w.meaning;
      var fnotes = card.querySelector(".back .f-notes");
      fnotes.innerHTML = ""; fnotes.appendChild(IELTS.renderNotesEl(w.notes));
      speakFront.style.display = "";
      prog.textContent = "剩余 " + order.length + " 词";
    }
    bNo.addEventListener("click", function (e) {
      e.stopPropagation(); if (!self._cur) return;
      Store.recordReview(self.bookId, self._cur.key, false); next();
    });
    bYes.addEventListener("click", function (e) {
      e.stopPropagation(); if (!self._cur) return;
      Store.recordReview(self.bookId, self._cur.key, true); next();
    });
    panel._start = function (subset) {
      order = (subset && subset.length ? subset : self.WORDS).slice();
      bNo.disabled = bYes.disabled = false; next();
    };
    panel._start();
  };

  /* ---------- 拼写测试 ---------- */
  VocabApp.prototype._renderSpell = function () {
    var self = this, panel = document.getElementById("panel-spell");
    panel.innerHTML = "";
    var area = el("div", "spell-area");
    var mean = el("div", "spell-mean");
    var row = el("div", "spell-row");
    var input = el("input", "spell-input"); input.placeholder = "听发音，拼写英文单词";
    var speak = IELTS.makeSpeakBtn("", "lg");
    row.appendChild(input); row.appendChild(speak);
    var fb = el("div", "spell-feedback");
    var ctrls = el("div", "flash-ctrls");
    var bNext = el("button", "btn", "下一题 ▶");
    var bShow = el("button", "btn ghost", "看答案");
    ctrls.appendChild(bShow); ctrls.appendChild(bNext);
    area.appendChild(mean); area.appendChild(row); area.appendChild(fb); area.appendChild(ctrls);
    panel.appendChild(area);

    var queue = this.WORDS.slice(), idx = 0, cur = null, answered = false;
    function norm(s) { return (s || "").trim().toLowerCase().replace(/[\s\-'.]/g, ""); }
    function next() {
      if (!queue.length) { mean.textContent = "🎉 拼写测试全部完成！"; input.style.display = "none"; speak.style.display = "none"; fb.textContent = ""; bNext.disabled = true; bShow.disabled = true; return; }
      cur = queue.shift(); answered = false;
      mean.textContent = cur.meaning + (cur.group ? "  ·  " + cur.group : "");
      input.value = ""; input.className = "spell-input"; input.disabled = false; input.focus();
      fb.className = "spell-feedback"; fb.textContent = "";
      IELTS.speak(cur.word, speak);
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !answered) submit();
    });
    speak.addEventListener("click", function (e) { e.stopPropagation(); if (cur) IELTS.speak(cur.word, speak); });
    function submit() {
      if (answered || !cur) return;
      answered = true; input.disabled = true;
      if (norm(input.value) === norm(cur.word)) {
        input.className = "spell-input ok";
        fb.className = "spell-feedback ok"; fb.textContent = "✓ 正确！";
        Store.recordReview(self.bookId, cur.key, true);
      } else {
        input.className = "spell-input bad";
        fb.className = "spell-feedback bad";
        fb.textContent = "✗ 正确答案：" + cur.word + (cur.phonetic ? "  /" + cur.phonetic + "/" : "");
        Store.recordReview(self.bookId, cur.key, false);
        Store.addWrong(self.bookId, cur.word);
      }
    }
    bNext.addEventListener("click", function () { if (!answered) submit(); next(); });
    bShow.addEventListener("click", function () {
      if (answered || !cur) return; answered = true; input.disabled = true;
      input.value = cur.word; input.className = "spell-input";
      fb.className = "spell-feedback"; fb.textContent = "提示：试拼写 " + cur.word.length + " 个字母";
    });
    panel._start = function (subset) { queue = (subset && subset.length ? subset : self.WORDS).slice(); idx = 0; next(); };
    panel._start();
  };

  /* ---------- 错题本 ---------- */
  VocabApp.prototype._renderWrong = function () {
    var self = this, panel = document.getElementById("panel-wrong");
    panel.innerHTML = "";
    var words = Store.getWrong(this.bookId);
    if (!words.length) { panel.appendChild(el("div", "empty", "📭 还没有错题。拼写测试中答错的单词会在这里收集，方便集中复习。")); return; }
    var head = el("div", "section-title", '<span class="bar"></span><h2>错题本（' + words.length + "）</h2>");
    panel.appendChild(head);
    var review = el("button", "btn accent", "▶ 集中复习这些错题");
    panel.appendChild(review);
    var list = el("div", "table-list"); list.style.marginTop = "14px";
    words.forEach(function (w) {
      var wd = self.findWord(w); if (!wd) return;
      var row = el("div", "trow");
      row.appendChild(el("span", "tw", IELTS.escapeHtml(wd.word)));
      if (wd.phonetic) row.appendChild(el("span", "wphon", "/" + IELTS.escapeHtml(wd.phonetic) + "/"));
      row.appendChild(IELTS.makeSpeakBtn(wd.word));
      row.appendChild(el("span", "tm", IELTS.escapeHtml(wd.meaning)));
      var del = el("button", "btn ghost sm", "移除");
      del.addEventListener("click", function () { Store.removeWrong(self.bookId, w); self._renderWrong(); });
      row.appendChild(del);
      list.appendChild(row);
    });
    panel.appendChild(list);
    review.addEventListener("click", function () {
      var subset = words.map(function (w) { return self.findWord(w); }).filter(Boolean);
      self._activateTab("flash");
      document.getElementById("panel-flash")._start(subset);
    });
  };

  /* ---------- 进度 ---------- */
  VocabApp.prototype._renderProgress = function () {
    var self = this, panel = document.getElementById("panel-progress");
    panel.innerHTML = "";
    this._refreshHeader();
    var st = Store.stats(this.bookId, this.total);
    var head = el("div", "section-title", '<span class="bar"></span><h2>学习进度</h2>');
    panel.appendChild(head);
    var dash = el("div", "dash");
    [["总词数", st.total], ["已学习", st.learned], ["已掌握", st.mastered], ["待复习", st.due, "due"]].forEach(function (d) {
      var box = el("div", "box" + (d[2] ? " " + d[2] : ""));
      box.appendChild(el("b", "", String(d[1])));
      box.appendChild(el("span", "", d[0]));
      dash.appendChild(box);
    });
    panel.appendChild(dash);
    var pct = st.total ? Math.round(st.learned / st.total * 100) : 0;
    var bar = el("div", "progressbar"); var i = el("i"); i.style.width = pct + "%"; bar.appendChild(i);
    panel.appendChild(bar);
    panel.appendChild(el("div", "", '<span class="gcount">已学习占比 ' + pct + "%</span>"));

    if (st.due > 0) {
      var rem = el("div", "reminder", "⏰ 你有 <b>" + st.due + "</b> 个单词待复习，点击下面的按钮开始复习提醒计划。");
      panel.appendChild(rem);
      var rb = el("button", "btn accent", "▶ 开始复习（待复习单词）");
      panel.appendChild(rb);
      rb.addEventListener("click", function () {
        var now = Date.now(), subset = self.WORDS.filter(function (w) {
          var s = Store.getState(self.bookId, w.key); return s && s.due <= now;
        });
        self._activateTab("flash");
        document.getElementById("panel-flash")._start(subset);
      });
    }
    // 收藏列表
    var favs = Store.getFav(this.bookId);
    if (favs.length) {
      panel.appendChild(el("div", "section-title", '<span class="bar"></span><h2>我的收藏（' + favs.length + "）</h2>"));
      var list = el("div", "table-list"); list.style.marginTop = "10px";
      favs.forEach(function (w) {
        var wd = self.findWord(w); if (!wd) return;
        var row = el("div", "trow");
        row.appendChild(el("span", "tw", IELTS.escapeHtml(wd.word)));
        row.appendChild(IELTS.makeSpeakBtn(wd.word));
        row.appendChild(el("span", "tm", IELTS.escapeHtml(wd.meaning)));
        list.appendChild(row);
      });
      panel.appendChild(list);
    }
  };

  VocabApp.prototype._showReminder = function () {
    var st = Store.stats(this.bookId, this.total);
    var box = document.getElementById("app-reminder");
    this._refreshHeader();
    if (!box) return;
    if (st.due > 0) {
      box.style.display = "";
      box.innerHTML = "⏰ 复习提醒：你有 <b>" + st.due + "</b> 个单词到了复习时间，去「学习进度」开始复习吧！";
    } else { box.style.display = "none"; }
  };

  IELTS.VocabApp = VocabApp;
})();
