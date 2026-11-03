/* 주제34 「제국주의자에게 반박하기」 — 로직(app.js)
 * 화면 순서: 시작 → 찾기(주장 고르기 → 형광펜·믿음 한 줄) → 읽기(박람회 자료 5개, 자료마다 반응 한 번 → 근거 문장 고르기) → 쓰기(①②) → 마무리(복사·패들렛·제출)
 * 문구·원문은 data.js. */
const CONFIG = {
  SHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyXSjCfWY_HiZFqW_OBR-FQDoIfF1z_STqyKWUI31MacHeY3u7hbirFSFDvW-5yuUHaJQ/exec",
  /* 포털 커리큘럼 관리에 이 id 하나로 활동을 등록한다 */
  GAME_NAME: "34차시_제국주의_반박글"
};

const S = {
  sid: "", name: "", grade: 0, ban: 0, preview: false, screen: "s1", ri: 0,
  claim: "", marks: [], reacts: {}, ev: "", quote: [],
  copied: false, sending: false, submitted: false, padletUrl: ""
};

const SCREEN_STAGE = { s1: "find", s2: "find", s3: "read", s4: "read", s5: "write", s6: "wrap" };
const STAGES = ["find", "read", "write", "wrap"];
const SAVE_KEYS = ["screen", "ri", "claim", "marks", "reacts", "ev", "quote"];

const $ = id => document.getElementById(id);
const byId = (arr, id) => arr.find(x => x.id === id);
const val = id => $(id).value.trim();
const parts = s => s.split("|");
const plain = s => s.replace(/\|/g, "");
/* 교사 미리보기(?preview=1)에서는 필수 활동을 안 해도 다음으로 넘어간다(효니 2026-10-29). 학생 화면은 그대로. */
const skip = () => S.preview;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function parseSid(sid) {
  if (!/^\d{5}$/.test(sid)) return null;
  return { grade: Number(sid[0]), ban: Number(sid.slice(1, 3)), num: Number(sid.slice(3)) };
}

/* ── 진행 기억: 새로고침해도 이어서. 학번별 키라 공용 태블릿에서 안 섞인다. 글 칸은 draft_guard가 맡는다. ── */
function storeKey() { return "empire_rebut:" + CONFIG.GAME_NAME + ":" + S.sid; }

function save() {
  if (S.preview || !S.sid || S.submitted) return; // 제출 뒤에는 다시 저장하지 않는다(새로고침해 빈 글로 다시 내는 것 방지)
  const v = { ts: Date.now() };
  SAVE_KEYS.forEach(k => { v[k] = S[k]; });
  try { localStorage.setItem(storeKey(), JSON.stringify(v)); } catch (e) { /* 저장소가 막히면 메모리만 */ }
}

function load() {
  if (S.preview) return;
  try {
    const v = JSON.parse(localStorage.getItem(storeKey()) || "null");
    if (!v || Date.now() - (v.ts || 0) > 7 * 864e5) return;
    SAVE_KEYS.forEach(k => { if (v[k] !== undefined) S[k] = v[k]; });
  } catch (e) { /* 무시 */ }
}

function clearSave() {
  try { localStorage.removeItem(storeKey()); } catch (e) { /* 무시 */ }
}

/* ── 시트 전송 ── */
async function postToSheet(payload) {
  if (S.preview) return { result: "success", preview: true };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  let json;
  try {
    const res = await fetch(CONFIG.SHEET_WEBAPP_URL, { method: "POST", body: JSON.stringify(payload), signal: ctl.signal });
    json = await res.json();
  } finally {
    clearTimeout(timer);
  }
  if (json.result !== "success") {
    const err = new Error(json.message || "저장 실패");
    err.locked = !!json.locked;
    throw err;
  }
  return json;
}

/* 패들렛 링크는 백엔드 학년정보(포트폴리오)에서 가져온다. 반 정보가 든 링크라 레포에 적지 않는다. */
function ensureUrlScheme(u) {
  u = String(u || "").trim();
  return u && !/^https?:\/\//i.test(u) ? "https://" + u : u;
}

async function loadPadletUrl(grade, ban) {
  try {
    const res = await fetch(CONFIG.SHEET_WEBAPP_URL + "?mode=curriculum");
    const json = await res.json();
    const pf = json && json.grades && json.grades[String(grade)] && json.grades[String(grade)].portfolio;
    if (!pf) return "";
    return ensureUrlScheme(pf.urlByBan ? (pf.urlByBan[ban] || pf.urlByBan[String(ban)] || "") : (pf.url || ""));
  } catch (e) {
    return "";
  }
}

/* ── 공용: 버튼 대신 role=radio/checkbox div — 버튼 안은 glossary.js가 밑줄을 못 긋는다.
 *    밑줄 낱말(.term)을 누르면 풀이만 열고 고르기는 하지 않는다. ── */
function pickable(node, role, checked, onPick) {
  node.setAttribute("role", role);
  node.tabIndex = 0;
  node.setAttribute("aria-checked", checked ? "true" : "false");
  node.addEventListener("click", e => { if (e.target.closest && e.target.closest(".term")) return; onPick(); });
  node.addEventListener("keydown", e => { if (e.target !== node) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } });
  return node;
}

let riseObs = null;
function rise(node) {
  if (!riseObs) return node;
  node.classList.add("rise");
  riseObs.observe(node);
  return node;
}

/* 그림 + 출처 한 줄. 누르면 새 탭에서 크게 본다 */
function figure(img, cls) {
  const f = el("figure", "fig" + (cls ? " " + cls : ""));
  const i = el("img");
  i.src = img.src; i.alt = img.alt; i.loading = "lazy";
  f.appendChild(i);
  f.appendChild(el("figcaption", "credit", img.credit));
  return f;
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.tm);
  toast.tm = setTimeout(() => { t.hidden = true; }, 2200);
}

const claimObj = () => byId(CLAIMS, S.claim);
const evObj = () => byId(SOURCES, S.ev);
function quoteText() {
  const s = evObj();
  if (!s) return "";
  const list = sentList(s);
  return S.quote.slice().sort((a, b) => a - b).map(i => list[i]).filter(Boolean).join(" ");
}
/* 근거로 고를 수 있는 문장: 본문 문장 + 캡션 */
function sentList(s) {
  return parts(s.body).map(t => t.trim()).concat(s.captions.map(c => c.head + " " + c.text));
}

/* ── 화면 전환 ── */
function show(id) {
  S.screen = id; save();
  document.querySelectorAll(".screen").forEach(sc => { sc.hidden = sc.id !== id; });
  const stage = SCREEN_STAGE[id];
  $("steps").hidden = !stage;
  if (stage) {
    const k = STAGES.indexOf(stage);
    $("steps").querySelectorAll("li").forEach((li, i) => {
      li.classList.toggle("done", i < k);
      li.classList.toggle("now", i === k);
    });
  }
  if (id === "s1") renderClaims();
  if (id === "s2") renderMark();
  if (id === "s3") renderRead();
  if (id === "s4") renderEvidence();
  if (id === "s5") refreshWrite();
  if (id === "s6") renderSummary();
  renderPin(id);
  window.scrollTo(0, 0);
}

/* 고정 띠: 앞에서 고른 것·쓴 것을 다음 화면 위에 다시 보여 준다 */
function renderPin(id) {
  const box = $("pin");
  box.innerHTML = "";
  const c = claimObj();
  if (!c || !["s3", "s4", "s5"].includes(id)) { box.hidden = true; return; }
  const line = (label, text, cls) => {
    const p = el("p", cls || "");
    p.appendChild(el("b", "", label));
    p.appendChild(document.createTextNode(text));
    box.appendChild(p);
  };
  if (id === "s5") { // 주장 원문 + 내가 칠한 형광펜
    const p = el("p", "claim-full");
    p.appendChild(el("b", "", "주장"));
    parts(c.text).forEach((t, i) => p.appendChild(S.marks.includes(i) ? el("mark", "", t) : document.createTextNode(t)));
    box.appendChild(p);
  }
  else line("주장", c.title);
  line("이 주장이 믿는 것", val("premise") || "…", "mine");
  if (id === "s5" && evObj()) line("근거 · " + evObj().title + " (" + evObj().page + "쪽)", quoteText() || "…", "mine");
  box.hidden = false;
}

/* ── 찾기 1/2: 주장 고르기 ── */
function renderClaims() {
  const box = $("claimList");
  box.innerHTML = "";
  CLAIMS.forEach(c => {
    const card = el("div", "claim");
    const head = el("div", "c-head");
    head.appendChild(el("span", "c-title", c.title));
    head.appendChild(el("span", "c-kind", c.kind));
    card.appendChild(head);
    if (c.img) card.appendChild(figure(c.img, "thumb"));
    card.appendChild(el("p", "c-text", plain(c.text) + (c.cite ? " " + c.cite : "")));
    card.appendChild(el("p", "c-page", c.page + "쪽"));
    pickable(card, "radio", S.claim === c.id, () => {
      if (S.claim && S.claim !== c.id && (val("premise") || S.ev) && !confirm("주장을 바꾸면 형광펜·믿음·근거를 다시 골라야 해. 바꿀까?")) return;
      if (S.claim !== c.id) { // 다른 주장의 믿음·근거가 섞이지 않게 비운다(쓰기 칸 ①②는 학생 글이라 남긴다)
        S.claim = c.id; S.marks = []; S.ev = ""; S.quote = [];
        $("premise").value = ""; $("premise").dispatchEvent(new Event("input", { bubbles: true }));
      }
      save();
      box.querySelectorAll(".claim").forEach(x => x.setAttribute("aria-checked", x === card ? "true" : "false"));
      $("s1Next").disabled = false;
    });
    box.appendChild(rise(card));
  });
  $("s1Next").disabled = !S.claim && !skip();
}

/* ── 찾기 2/2: 형광펜 + 믿음 한 줄 ── */
function renderMark() {
  const c = claimObj() || CLAIMS[0];
  const box = $("markBox");
  box.innerHTML = "";
  $("markFig").innerHTML = "";
  if (c.img) $("markFig").appendChild(figure(c.img));
  parts(c.text).forEach((t, i) => {
    const sp = el("span", "chunk", t.trimEnd()); // 조각 사이 띄어쓰기는 칠하지 않아 조각이 나뉘어 보이게
    pickable(sp, "checkbox", S.marks.includes(i), () => {
      const on = S.marks.includes(i);
      if (!on && S.marks.length >= 2) { toast("형광펜은 2곳까지야. 하나를 지우고 칠해 줘."); return; }
      S.marks = on ? S.marks.filter(x => x !== i) : S.marks.concat(i);
      sp.setAttribute("aria-checked", on ? "false" : "true");
      save(); refreshPremise();
    });
    box.appendChild(sp);
    if (t !== t.trimEnd()) box.appendChild(document.createTextNode(" "));
  });
  $("markCite").textContent = c.cite || "";
  $("markNote").textContent = c.note ? "※ " + c.note : "";
  $("premiseHint").textContent = c.hint;
  refreshPremise();
}

function refreshPremise() {
  const n = val("premise").length;
  $("premiseCount").textContent = n + "자 (40자 안쪽이면 좋아)";
  $("premiseCount").classList.toggle("warn", n > 40);
  $("s2Next").disabled = (S.marks.length < 1 || n < 2) && !skip();
}

/* ── 읽기 1/5 ~ 5/5 ── */
function renderRead() {
  const s = SOURCES[S.ri];
  $("readProg").textContent = "읽기 " + (S.ri + 1) + "/" + SOURCES.length;
  $("expoWord").hidden = S.ri !== 0;
  $("srcPage").textContent = s.page + "쪽";
  $("srcTitle").textContent = s.title;
  const body = $("srcBody");
  body.innerHTML = "";
  body.appendChild(el("p", "", plain(s.body)));
  $("srcCite").textContent = s.cite || "";
  const caps = $("srcCaps");
  caps.innerHTML = "";
  s.captions.forEach(c => {
    const d = el("div", "cap");
    const h = el("span", "cap-head");
    h.appendChild(el("span", "cap-tag", "사진 설명"));
    h.appendChild(document.createTextNode(c.head));
    d.appendChild(h);
    d.appendChild(el("span", "", c.text));
    if (c.img) d.appendChild(figure(c.img));
    caps.appendChild(rise(d));
  });
  const rb = $("reactBox");
  rb.innerHTML = "";
  REACTIONS.forEach(r => {
    const b = el("div", "react");
    b.appendChild(el("span", "ri", r.icon));
    b.appendChild(document.createTextNode(r.name));
    pickable(b, "radio", S.reacts[s.id] === r.id, () => {
      S.reacts[s.id] = r.id; save();
      rb.querySelectorAll(".react").forEach(x => x.setAttribute("aria-checked", x === b ? "true" : "false"));
      $("s3Next").disabled = false; $("s3Err").textContent = "";
    });
    rb.appendChild(b);
  });
  $("s3Next").disabled = !S.reacts[s.id] && !skip();
}

/* ── 읽기 마지막: 근거 고르기 ── */
function renderEvidence() {
  const box = $("evList");
  box.innerHTML = "";
  const rank = s => ({ clash: 0, unsure: 1, fit: 2 }[S.reacts[s.id]] ?? 3);
  SOURCES.slice().sort((a, b) => rank(a) - rank(b)).forEach(s => {
    const r = byId(REACTIONS, S.reacts[s.id]);
    const b = el("div", "ev");
    b.appendChild(el("span", "", s.title));
    b.appendChild(el("span", "ev-tag" + (r && r.id === "clash" ? " clash" : ""), r ? r.icon + " " + r.name : s.page + "쪽"));
    pickable(b, "radio", S.ev === s.id, () => {
      if (S.ev !== s.id) { S.ev = s.id; S.quote = []; }
      save(); renderEvidence();
    });
    box.appendChild(b);
  });
  const s = evObj();
  $("evOpen").hidden = !s;
  if (s) {
    $("evPage").textContent = s.page + "쪽";
    $("evTitle").textContent = s.title;
    const list = $("evSents");
    list.innerHTML = "";
    const nBody = parts(s.body).length;
    sentList(s).forEach((t, i) => {
      const d = el("div", "sent");
      if (i >= nBody) d.appendChild(el("span", "s-tag", "사진 설명"));
      d.appendChild(document.createTextNode(t));
      pickable(d, "checkbox", S.quote.includes(i), () => {
        const on = S.quote.includes(i);
        if (!on && S.quote.length >= 2) { toast("근거 문장은 2개까지야."); return; }
        S.quote = on ? S.quote.filter(x => x !== i) : S.quote.concat(i);
        d.setAttribute("aria-checked", on ? "false" : "true");
        save(); refreshEvidenceNext();
      });
      list.appendChild(d);
    });
  }
  refreshEvidenceNext();
}

function refreshEvidenceNext() {
  $("s4Next").disabled = (!S.ev || !S.quote.length) && !skip();
}

/* ── 쓰기 ── */
function refreshWrite() {
  $("w1c").textContent = val("w1").length + "자";
  $("w2c").textContent = val("w2").length + "자";
  $("s5Next").disabled = (val("w1").length < 5 || val("w2").length < 5) && !skip();
}

/* ── 마무리 ── */
const bodyText = () => [val("w1"), val("w2")].filter(Boolean).join(" ");
const copyHead = () => { const c = claimObj(); return c ? "「" + c.title + "」에 반박하기 (교과서 " + c.page + "쪽)" : ""; };
const copyAll = () => copyHead() + "\n" + bodyText();

function renderSummary() {
  const box = $("summary");
  box.innerHTML = "";
  box.appendChild(el("p", "sum-head", copyHead()));
  box.appendChild(el("p", "", bodyText() || "(아직 글이 없어)"));
  const n = bodyText().length;
  const short = n < TEXT.minChars;
  $("bodyCount").textContent = "내가 쓴 글 " + n + "자 (첫 줄 제외)" + (short ? " — " + TEXT.minChars + "자 이상 써 보자." : "");
  $("bodyCount").classList.toggle("warn", short);
  $("submitBtn").disabled = S.submitted || S.sending;
  $("submitBtn").textContent = S.submitted ? "제출 완료" : "제출";
  renderPadlet();
}

function renderPadlet() {
  const a = $("padletBtn");
  if (S.padletUrl) {
    a.href = S.padletUrl; a.hidden = false; $("padletMsg").textContent = "";
  } else {
    a.hidden = true; $("padletMsg").textContent = "패들렛 링크는 선생님이 알려 준 곳을 써 줘.";
  }
}

function reflectionText() {
  const c = claimObj(), s = evObj();
  return "[주장] " + (c ? c.title : "") +
    " / [전제] " + val("premise") +
    " / [근거] " + (s ? s.title : "") + ": " + quoteText() +
    " / ① " + val("w1") +
    " / ② " + val("w2");
}

async function submitAll() {
  if (S.sending || S.submitted) return;
  $("outErr").textContent = "";
  const n = bodyText().length;
  if (n < TEXT.minChars && !skip() && !confirm("아직 " + n + "자야. " + TEXT.minChars + "자보다 짧은데 그래도 제출할까?")) return;
  S.sending = true; renderSummary(); $("submitBtn").textContent = "보내는 중…";
  const c = claimObj(), s = evObj();
  const payload = {
    studentId: S.sid, studentName: S.name, gameName: CONFIG.GAME_NAME,
    choiceSummary: (c ? c.title : "") + " ← " + (s ? s.title : ""),
    diffSummary: "",
    reflection: reflectionText(), // 시트 G열
    choicesJson: JSON.stringify({
      sid: S.sid, name: S.name, ban: S.ban,
      claimId: S.claim, marks: S.marks.map(i => c ? parts(c.text)[i] : i),
      premise: val("premise"), reacts: S.reacts,
      sourceId: S.ev, quote: quoteText(), s1: val("w1"), s2: val("w2"),
      writing: bodyText(), ts: new Date().toISOString()
    })
  };
  Object.assign(payload, FocusGuard.payload());
  try {
    await postToSheet(payload);
  } catch (e) {
    $("outErr").textContent = e.locked ? e.message : "저장이 안 됐어. 인터넷을 확인하고 다시 눌러 줘.";
    S.sending = false; renderSummary();
    return;
  }
  S.sending = false; S.submitted = true;
  if (!S.preview) {
    if (window.DraftGuard) DraftGuard.clear(); // 저장 성공 → 임시저장 삭제
    clearSave();
  }
  ["premise", "w1", "w2"].forEach(id => { $(id).readOnly = true; });
  renderSummary();
  $("outMsg").textContent = S.preview ? "미리보기라 저장하지 않았어." : (S.copied ? "제출했어! 복사한 글을 패들렛에 올려 줘." : "제출했어! 이제 글을 복사해서 패들렛에 올려 줘.");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = el("textarea");
    ta.value = text; ta.setAttribute("data-no-draft", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}

/* ── 시작 ── */
function startApp() {
  const sid = $("sid").value.trim();
  const name = $("sname").value.trim();
  const p = parseSid(sid);
  if (!p) { $("startErr").textContent = "학번은 숫자 5자리로 써 줘. (예: 20512)"; return; }
  if (!name) { $("startErr").textContent = "이름을 써 줘."; return; }
  $("startErr").textContent = "";
  S.sid = sid; S.name = name; S.grade = p.grade; S.ban = p.ban;
  FocusGuard.start({ key: CONFIG.GAME_NAME + ":" + sid }); // 작성 중 화면 이탈·붙여넣기 기록 (history26 snippets/focus_guard.js)
  if (window.DraftGuard) DraftGuard.start({ key: CONFIG.GAME_NAME, sid: sid }); // 글쓰기 칸 임시저장
  loadPadletUrl(p.grade, p.ban).then(u => { S.padletUrl = u; renderPadlet(); });
  load();
  show(SCREEN_STAGE[S.screen] ? S.screen : "s1");
  setTimeout(() => { refreshPremise(); refreshWrite(); renderPin(S.screen); }, 700); // draft_guard가 글을 되살린 뒤 다시 그린다
}

/* ── 부팅 (모든 함수 선언 뒤, 파일 맨 마지막) ── */
function init() {
  const q = new URLSearchParams(location.search);
  S.preview = q.get("preview") === "1";
  let sid = (q.get("sid") || "").trim(), name = (q.get("name") || "").trim();
  if (S.preview) {
    $("previewBar").textContent = "미리보기 모드 — 저장되지 않아 · 활동을 다 안 해도 «다음»으로 넘어갈 수 있어";
    $("previewBar").hidden = false;
    if (!sid) sid = "20512";
    if (!name) name = "미리보기";
  }
  $("sid").value = sid; $("sname").value = name;

  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    riseObs = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); riseObs.unobserve(e.target); }
    }), { threshold: 0.1 });
  }

  $("eyebrow").textContent = INTRO.eyebrow;
  $("appTitle").textContent = INTRO.title;
  $("introQ").textContent = INTRO.question;
  $("claimQ").textContent = TEXT.claimQ;
  $("claimHow").textContent = TEXT.claimHow;
  $("markQ").textContent = TEXT.markQ;
  $("markHow").textContent = TEXT.markHow;
  $("premiseQ").textContent = TEXT.premiseQ;
  $("premiseLead").textContent = TEXT.premiseLead;
  $("premiseTail").textContent = TEXT.premiseTail;
  $("premise").placeholder = TEXT.premisePh;
  $("expoWord").textContent = "💬 " + EXPO_WORD + " (168쪽)";
  $("readHow").textContent = TEXT.readHow;
  $("reactQ").textContent = TEXT.reactQ;
  $("evQ").textContent = TEXT.evQ;
  $("evHow").textContent = TEXT.evHow;
  $("w1Q").textContent = TEXT.w1Q;
  $("w2Q").textContent = TEXT.w2Q;
  $("w1").placeholder = TEXT.wPh;
  $("w2").placeholder = TEXT.wPh;
  $("wHint").textContent = TEXT.wHint;
  $("padletNote").textContent = TEXT.padletNote;

  $("startBtn").addEventListener("click", startApp);
  $("s1Next").addEventListener("click", () => { if (S.claim || skip()) { if (!S.claim) S.claim = CLAIMS[0].id; show("s2"); } });
  $("s2Prev").addEventListener("click", () => show("s1"));
  $("s2Next").addEventListener("click", () => {
    if (S.marks.length < 1 && !skip()) { $("s2Err").textContent = "주장에서 1곳 이상 형광펜을 칠해 줘."; return; }
    if (val("premise").length < 2 && !skip()) { $("s2Err").textContent = "빈칸을 채워 줘."; return; }
    $("s2Err").textContent = ""; S.ri = 0; show("s3");
  });
  $("premise").addEventListener("input", refreshPremise);
  $("s3Prev").addEventListener("click", () => { if (S.ri > 0) { S.ri--; show("s3"); } else show("s2"); });
  $("s3Next").addEventListener("click", () => {
    if (!S.reacts[SOURCES[S.ri].id] && !skip()) { $("s3Err").textContent = "세 가지 중 하나를 눌러 줘."; return; }
    if (S.ri < SOURCES.length - 1) { S.ri++; show("s3"); } else show("s4");
  });
  $("s4Prev").addEventListener("click", () => { S.ri = SOURCES.length - 1; show("s3"); });
  $("s4Next").addEventListener("click", () => {
    if ((!S.ev || !S.quote.length) && !skip()) { $("s4Err").textContent = "자료를 고르고 근거 문장을 1개 이상 눌러 줘."; return; }
    $("s4Err").textContent = ""; show("s5");
  });
  ["w1", "w2"].forEach(id => $(id).addEventListener("input", refreshWrite));
  $("s5Prev").addEventListener("click", () => show("s4"));
  $("s5Next").addEventListener("click", () => {
    if ((val("w1").length < 5 || val("w2").length < 5) && !skip()) { $("s5Err").textContent = "①과 ②를 한 문장씩 써 줘."; return; }
    $("s5Err").textContent = ""; show("s6");
  });
  $("s6Prev").addEventListener("click", () => show("s5"));
  $("copyBtn").addEventListener("click", async () => {
    const ok = await copyText(copyAll());
    S.copied = ok;
    toast(ok ? "복사했어! 패들렛에 붙여 넣어 줘." : "복사가 안 됐어. 글을 길게 눌러 직접 복사해 줘.");
  });
  $("submitBtn").addEventListener("click", submitAll);
  document.querySelectorAll(".hint-btn").forEach(b => b.addEventListener("click", () => {
    const h = $(b.dataset.hint);
    h.hidden = !h.hidden;
    b.setAttribute("aria-expanded", h.hidden ? "false" : "true");
  }));

  Glossary.start({ terms: GLOSSARY, skip: [".eyebrow", ".c-title", ".credit", "#steps", ".progress", ".react", ".ev", ".page-tag", ".cap-tag", ".s-tag", ".c-kind", ".pin b", ".toast", ".preview-bar"] });
}

init();
