// ===== 高考英语单词复习 - 应用逻辑 =====

const WORDS_PER_DAY = 15;
const STORAGE_KEY = 'word_remember_progress';

// ===== 进度 =====
function loadProgress() {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    if (d) return JSON.parse(d);
  } catch(e) {}
  return {
    learnedWords: [],    // {wordId, stage(0-5), lastReview, nextReview, correctCount, incorrectCount}
    learnedSet: [],      // word strings that have been learned (for quick lookup)
    streak: 0,
    lastStudyDate: null,
    dailyNewCount: 0,
    dailyDate: null,
    startDate: new Date().toISOString()
  };
}

function saveProgress(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function dateStr(d) {
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function getWordIndex(word) {
  return WORDS.findIndex(w => w.w === word);
}

// ===== 路由 =====
function route(name) {
  const t = document.getElementById('page-' + name);
  if (!t) return;
  document.getElementById('app').innerHTML = t.innerHTML;
  window.scrollTo(0, 0);
  switch(name) {
    case 'home': renderHome(); break;
    case 'learn': renderLearn(); break;
    case 'review': renderReview(); break;
    case 'wordlist': renderWordlist(); break;
  }
}

// ===== Home =====
function renderHome() {
  const p = loadProgress();
  const total = WORDS.length;

  // Stats
  const learnedCount = p.learnedSet.length;
  const reviewCount = p.learnedWords.filter(w => {
    if (w.stage >= 5) return false;
    if (!w.nextReview) return true;
    return new Date(w.nextReview) <= new Date();
  }).length;
  const masteredCount = p.learnedWords.filter(w => w.stage >= 5).length;

  el('stat-learned').textContent = learnedCount;
  el('stat-review').textContent = reviewCount;
  el('stat-mastered').textContent = masteredCount;
  el('stat-streak').textContent = p.streak;

  // Review desc
  el('review-desc').textContent = reviewCount > 0 ? `还有 ${reviewCount} 个单词待复习` : '没有待复习的单词';

  // List progress
  const lp = el('list-progress');
  const types = [
    { key: 'gaokao', label: '高考词汇' },
    { key: 'middle', label: '初中高频' }
  ];
  lp.innerHTML = '';
  for (const t of types) {
    const totalInList = WORDS.filter(w => w.l === t.key).length;
    const learnedInList = WORDS.filter(w => w.l === t.key && p.learnedSet.includes(w.w)).length;
    const pct = totalInList > 0 ? Math.round(learnedInList / totalInList * 100) : 0;
    lp.innerHTML += `
      <div class="list-progress-item">
        <span class="label">${t.label}</span>
        <div class="bar-wrap"><div class="bar" style="width:${pct}%"></div></div>
        <span class="num">${learnedInList}/${totalInList}</span>
      </div>`;
  }

  // Actions
  el('action-learn').onclick = () => route('learn');
  el('action-review').onclick = () => route('review');
  el('action-wordlist').onclick = () => route('wordlist');
}

// ===== Learn =====
let learnWords = [];
let learnIndex = 0;

function renderLearn() {
  const p = loadProgress();
  const today = dateStr(new Date());

  // Check daily limit
  if (p.dailyDate !== today) {
    p.dailyNewCount = 0;
    p.dailyDate = today;
    saveProgress(p);
  }

  // Get words not yet learned
  const available = WORDS.filter(w => !p.learnedSet.includes(w.w));
  const remaining = WORDS_PER_DAY - p.dailyNewCount;
  const toLearn = available.slice(0, Math.max(0, remaining));

  const container = el('learn-content');

  if (toLearn.length === 0) {
    container.innerHTML = available.length === 0
      ? '<div style="text-align:center;padding:60px 20px"><div style="font-size:3rem;margin-bottom:12px">🎉</div><p style="font-size:1.1rem;font-weight:600">所有单词已学完！</p><p style="color:var(--text-secondary);margin-top:8px">去做复习吧</p></div>'
      : '<div style="text-align:center;padding:60px 20px"><div style="font-size:3rem;margin-bottom:12px">📚</div><p style="font-size:1.1rem;font-weight:600">今天的新词已学完</p><p style="color:var(--text-secondary);margin-top:8px">明天再来吧！</p></div>';
    el('learn-progress').textContent = '';
    return;
  }

  learnWords = toLearn;
  learnIndex = 0;
  showLearnCard(0);

  el('learn-back').onclick = () => route('home');
  el('learn-next').onclick = nextLearnCard;
  el('learn-prev').onclick = () => { if (learnIndex > 0) showLearnCard(learnIndex - 1); };
}

let learnRevealed = false;

function showLearnCard(idx) {
  if (idx < 0 || idx >= learnWords.length) return;
  learnIndex = idx;
  const w = learnWords[idx];
  const cc = el('learn-card-container');

  const rev = learnRevealed;
  cc.innerHTML = `
    <div class="word-card">
      <div class="word">${w.w}</div>
      <div class="phonetic">${w.p || ''}</div>
      ${rev ? `<div class="translation">${w.t}</div>` : ''}
      ${rev && w.e ? `<div class="example">${w.e}</div>` : ''}
      ${rev && w.et ? `<div class="example-trans">${w.et}</div>` : ''}
      ${rev ? `<button class="sound-btn" data-word="${w.w}">🔊 发音</button>` : `<button class="btn secondary" id="reveal-btn" style="margin-top:20px">👆 显示答案</button>`}
    </div>
  `;

  el('learn-progress').textContent = `${idx + 1}/${learnWords.length}`;
  el('learn-prev').disabled = idx === 0;
  el('learn-next').textContent = idx === learnWords.length - 1 ? '✓ 完成' : '下一个 →';

  const revealBtn = el('reveal-btn');
  if (revealBtn) revealBtn.onclick = () => { learnRevealed = true; showLearnCard(idx); };

  const soundBtn = cc.querySelector('.sound-btn');
  if (soundBtn) soundBtn.onclick = () => speak(soundBtn.dataset.word);
}

function nextLearnCard() {
  const w = learnWords[learnIndex];
  // Mark as learned
  const p = loadProgress();
  if (!p.learnedSet.includes(w.w)) {
    p.learnedSet.push(w.w);
    p.learnedWords.push({
      word: w.w,
      stage: 0,
      lastReview: new Date().toISOString(),
      nextReview: tomorrowDate(),
      correctCount: 0,
      incorrectCount: 0
    });
    p.dailyNewCount = (p.dailyNewCount || 0) + 1;
    updateStreak(p);
    saveProgress(p);
  }

  learnRevealed = false;

  if (learnIndex >= learnWords.length - 1) {
    route('home');
    toast(`✅ 学习了 ${learnWords.length} 个新词！`);
  } else {
    showLearnCard(learnIndex + 1);
  }
}

function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function nextReviewDate(stage) {
  const d = new Date();
  const intervals = [1, 2, 4, 7, 14, 30];
  const days = intervals[Math.min(stage, intervals.length - 1)];
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ===== Review =====
let reviewWords = [];
let reviewIndex = 0;
let reviewRevealed = false;

function renderReview() {
  const p = loadProgress();
  const now = new Date();
  const today = dateStr(now);

  const dueWords = p.learnedWords.filter(w => {
    if (w.stage >= 5) return false;
    if (!w.nextReview) return true;
    return w.nextReview <= today;
  });

  if (dueWords.length === 0) {
    el('review-content').style.display = 'none';
    el('review-empty').style.display = 'block';
    const goBtn = el('review-empty').querySelector('.btn');
    if (goBtn) goBtn.onclick = () => route('learn');
    return;
  }

  el('review-content').style.display = 'flex';
  el('review-empty').style.display = 'none';

  // Prefer words with lower stage, and those with incorrectCount > correctCount
  dueWords.sort((a, b) => {
    if ((a.incorrectCount - a.correctCount) !== (b.incorrectCount - b.correctCount)) {
      return (b.incorrectCount - b.correctCount) - (a.incorrectCount - a.correctCount);
    }
    return a.stage - b.stage;
  });

  reviewWords = dueWords.slice(0, 20);
  reviewIndex = 0;
  reviewRevealed = false;
  showReviewCard(0);

  el('review-back').onclick = () => route('home');
  el('show-answer').onclick = showReviewAnswer;
  el('review-forgot').onclick = () => submitReview(0);
  el('review-hard').onclick = () => submitReview(0.5);
  el('review-good').onclick = () => submitReview(1);
}

function showReviewCard(idx) {
  if (idx < 0 || idx >= reviewWords.length) return;
  reviewIndex = idx; reviewRevealed = false;
  const p = loadProgress();
  const prog = p.learnedWords.find(w => w.word === reviewWords[idx].word);
  const wData = WORDS.find(w => w.w === reviewWords[idx].word);
  if (!wData) return;

  el('review-word-text').textContent = wData.w;
  el('review-phonetic').textContent = wData.p || '';
  el('review-translation').textContent = wData.t;
  el('review-example').textContent = wData.e ? `${wData.e} — ${wData.et || ''}` : '';
  el('review-answer').style.display = 'none';
  el('review-actions').style.display = 'none';
  el('show-answer').style.display = 'block';
  el('review-progress').textContent = `${idx + 1}/${reviewWords.length}`;
}

function showReviewAnswer() {
  reviewRevealed = true;
  el('review-answer').style.display = 'block';
  el('review-actions').style.display = 'grid';
  el('show-answer').style.display = 'none';
  speak(el('review-word-text').textContent);
}

function submitReview(score) {
  if (!reviewRevealed) return;
  const p = loadProgress();
  const word = reviewWords[reviewIndex];
  const prog = p.learnedWords.find(w => w.word === word.word);
  if (!prog) return;

  if (score >= 1) {
    prog.stage = Math.min(prog.stage + 1, 5);
    prog.correctCount = (prog.correctCount || 0) + 1;
  } else if (score >= 0.5) {
    // hard: stage stays same
    prog.incorrectCount = (prog.incorrectCount || 0) + 1;
  } else {
    // forgot: reset stage
    prog.stage = Math.max(0, prog.stage - 1);
    prog.incorrectCount = (prog.incorrectCount || 0) + 1;
  }

  prog.lastReview = new Date().toISOString();
  prog.nextReview = nextReviewDate(prog.stage);
  updateStreak(p);
  saveProgress(p);

  if (reviewIndex >= reviewWords.length - 1) {
    route('home');
    toast('🎉 复习完成！');
  } else {
    showReviewCard(reviewIndex + 1);
  }
}

// ===== Word List =====
function renderWordlist() {
  el('wordlist-back').onclick = () => route('home');

  el('wordlist-filter').onchange = () => loadWordlist();
  let searchTimer;
  el('wordlist-search').oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadWordlist, 300);
  };

  loadWordlist();
}

function loadWordlist() {
  const filter = el('wordlist-filter').value;
  const query = el('wordlist-search').value.trim().toLowerCase();
  const p = loadProgress();

  let words = WORDS;
  if (filter !== 'all') words = words.filter(w => w.l === filter);
  if (query) words = words.filter(w => w.w.toLowerCase().includes(query) || w.t.includes(query));

  const container = el('wordlist-items');

  if (words.length === 0) {
    container.innerHTML = '<div class="wordlist-empty">没有找到匹配的单词</div>';
    return;
  }

  container.innerHTML = `<div style="padding:8px 16px;font-size:13px;color:var(--text-secondary)">共 ${words.length} 个单词</div>`;

  for (const w of words) {
    const learned = p.learnedSet.includes(w.w);
    const prog = p.learnedWords.find(x => x.word === w.w);
    const stage = prog ? prog.stage : -1;
    const stageLabels = ['刚学', '复习1', '复习2', '复习3', '复习4', '已掌握'];

    const statusClass = stage >= 5 ? 's5' : stage >= 0 ? 's' + stage : '';
    const statusText = stage >= 0 ? stageLabels[Math.min(stage, 5)] : '未学';

    container.innerHTML += `
      <div class="word-item">
        <div>
          <div class="en">${w.w}</div>
          <div class="cn">${w.t}</div>
        </div>
        <span class="status ${statusClass}">${statusText}</span>
      </div>`;
  }
}

// ===== Speech =====
function speak(word) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US'; u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

// ===== Streak =====
function updateStreak(p) {
  const today = dateStr(new Date());
  const last = p.lastStudyDate;
  if (last === today) return;
  const yesterday = dateStr(new Date(Date.now() - 86400000));
  p.streak = last === yesterday ? (p.streak || 0) + 1 : 1;
  p.lastStudyDate = today;
}

// ===== Toast =====
function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2000);
}

function el(id) { return document.getElementById(id); }

// ===== Init =====
(function init() {
  route('home');
})();
