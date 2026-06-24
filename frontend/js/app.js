const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let currentPage = '';

function showPage(name) {
  $$('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) { page.classList.add('active'); currentPage = name; }
}

function render(html) { document.getElementById('app').innerHTML = html; }

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast show'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2000);
}

// 音频 - 使用 Web Speech API
function speak(word) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US'; u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

// ============ 路由 ============
async function route(name, ...args) {
  switch (name) {
    case 'login': renderLogin(); break;
    case 'home': renderHome(); break;
    case 'learn': renderLearn(); break;
    case 'review': renderReview(...args); break;
    case 'wordlist': renderWordlist(); break;
    default: showPage('home');
  }
}

// ============ 登录页 ============
function renderLogin() {
  const t = document.getElementById('page-login');
  document.getElementById('app').innerHTML = t.innerHTML;
  showPage('login');

  const tabs = $$('.tab');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('#login-form').style.display = t.dataset.tab === 'login' ? 'block' : 'none';
    $('#register-form').style.display = t.dataset.tab === 'register' ? 'block' : 'none';
  }));

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#login-btn'); btn.disabled = true; btn.textContent = '登录中...';
    try {
      const res = await api.login($('#login-username').value, $('#login-password').value);
      api.setToken(res.token);
      route('home');
    } catch (err) { $('#login-error').textContent = err.message; }
    finally { btn.disabled = false; btn.textContent = '登录'; }
  });

  $('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#reg-btn'); btn.disabled = true; btn.textContent = '注册中...';
    try {
      const res = await api.register($('#reg-username').value, $('#reg-password').value);
      api.setToken(res.token);
      route('home');
    } catch (err) { $('#reg-error').textContent = err.message; }
    finally { btn.disabled = false; btn.textContent = '注册'; }
  });
}

// ============ 主页 ============
async function renderHome() {
  const t = document.getElementById('page-home');
  document.getElementById('app').innerHTML = t.innerHTML;
  showPage('home');

  $('#logout-btn').addEventListener('click', () => { api.clearToken(); route('login'); });

  try {
    const stats = await api.getStats();
    $('#stat-learned').textContent = stats.learned_words || 0;
    $('#stat-review').textContent = stats.today_review || 0;
    $('#stat-mastered').textContent = stats.mastered_words || 0;
    $('#stat-streak').textContent = stats.streak || 0;
    $('#review-desc').textContent = `还有 ${stats.today_review || 0} 个单词待复习`;

    // 词库进度
    const lp = $('#list-progress'); lp.innerHTML = '';
    if (stats.list_progress && stats.list_progress.length) {
      for (const item of stats.list_progress) {
        const pct = item.total > 0 ? Math.round(item.learned / item.total * 100) : 0;
        const label = item.list_type === 'gaokao' ? '高考词汇' : '初中高频';
        lp.innerHTML += `
          <div class="list-progress-item">
            <span class="label">${label}</span>
            <div class="bar-wrap"><div class="bar" style="width:${pct}%"></div></div>
            <span class="num">${item.learned}/${item.total}</span>
          </div>`;
      }
    }

    // 周统计
    const wc = $('#weekly-chart'); wc.innerHTML = '';
    if (stats.weekly_stats && stats.weekly_stats.length) {
      const max = Math.max(...stats.weekly_stats.map(s => (s.new_words || 0) + (s.reviewed_words || 0)), 1);
      const days = ['日', '一', '二', '三', '四', '五', '六'];
      stats.weekly_stats.forEach(s => {
        const total = (s.new_words || 0) + (s.reviewed_words || 0);
        const h = Math.round(total / max * 100);
        const d = new Date(s.date + 'T00:00:00');
        wc.innerHTML += `
          <div class="weekly-bar">
            <div class="bar" style="height:${h}%"></div>
            <span class="day-label">${days[d.getDay()]}</span>
          </div>`;
      });
    } else {
      wc.innerHTML = '<div style="color:var(--text-secondary);font-size:13px">暂无数据，开始学习吧！</div>';
    }
  } catch (err) { toast('加载失败: ' + err.message); }

  $('#action-learn').addEventListener('click', () => route('learn'));
  $('#action-review').addEventListener('click', () => route('review'));
  $('#action-wordlist').addEventListener('click', () => route('wordlist'));
}

// ============ 学习页 ============
let learnWords = [];
let learnIndex = 0;
let learnedInSession = new Set();

async function renderLearn() {
  const t = document.getElementById('page-learn');
  document.getElementById('app').innerHTML = t.innerHTML;
  showPage('learn');

  learnWords = []; learnIndex = 0;

  try {
    const res = await api.getLearnWords(15);
    if (res.daily_done) {
      $('#learn-content').innerHTML = '<div class="empty-state">📚 今天的新词已学完（最多20个）<br>去复习巩固吧！</div>';
      return;
    }
    if (!res.words || res.words.length === 0) {
      $('#learn-content').innerHTML = '<div class="empty-state">🎉 所有单词已学完！<br>太棒了！</div>';
      return;
    }
    learnWords = res.words;
    showLearnCard(0);
  } catch (err) { toast('加载失败: ' + err.message); }

  $('#learn-back').addEventListener('click', () => route('home'));
  $('#learn-next').addEventListener('click', nextLearnCard);
  $('#learn-prev').addEventListener('click', prevLearnCard);
}

let cardsRevealed = new Set();

function showLearnCard(idx) {
  if (idx < 0 || idx >= learnWords.length) return;
  learnIndex = idx;
  const w = learnWords[idx];
  const cc = $('#learn-card-container');

  const revealed = cardsRevealed.has(idx);
  const translationHtml = revealed ? `<div class="translation">${w.translation}</div>` : '';
  const exampleHtml = (revealed && w.example_sentence) ? `
    <div class="example">${w.example_sentence}</div>
    <div class="example-trans">${w.example_translation || ''}</div>
  ` : '';
  const soundHtml = revealed ? `<button class="sound-btn" data-word="${w.word}">🔊 发音</button>` : '';

  cc.innerHTML = `
    <div class="word-card">
      <div class="word">${w.word}</div>
      <div class="phonetic">${w.phonetic || ''}</div>
      ${translationHtml}
      ${exampleHtml}
      ${soundHtml}
      ${!revealed ? `<button class="btn secondary" id="reveal-btn" style="margin-top:20px">点击显示答案</button>` : ''}
    </div>
  `;

  // 显示答案按钮
  const revealBtn = $('#reveal-btn');
  if (revealBtn) revealBtn.addEventListener('click', () => {
    cardsRevealed.add(idx);
    showLearnCard(idx);
  });

  // 发音按钮
  const soundBtn = cc.querySelector('.sound-btn');
  if (soundBtn) soundBtn.addEventListener('click', () => speak(soundBtn.dataset.word));

  $('#learn-progress').textContent = `${idx + 1}/${learnWords.length}`;
  $('#learn-prev').disabled = idx === 0;
  $('#learn-next').textContent = idx === learnWords.length - 1 ? '完成' : '下一个';
}

function nextLearnCard() {
  if (learnIndex < learnWords.length - 1) {
    showLearnCard(learnIndex + 1);
  } else {
    // 完成学习
    finishLearning();
  }
}

function prevLearnCard() {
  if (learnIndex > 0) showLearnCard(learnIndex - 1);
}

async function finishLearning() {
  // 标记所有单词已学习（作为新词）
  for (const w of learnWords) {
    if (!learnedInSession.has(w.id)) {
      try {
        await api.markLearned(w.id, true);
        learnedInSession.add(w.id);
      } catch (e) {}
    }
  }
  const sessionIds = learnWords.map(w => w.id);
  toast(`✅ 学习了 ${learnWords.length} 个新词！`);
  route('review', sessionIds);
}

// ============ 复习页 ============
let reviewWords = [];
let reviewIndex = 0;
let answerRevealed = false;

async function renderReview(sessionIds) {
  const t = document.getElementById('page-review');
  document.getElementById('app').innerHTML = t.innerHTML;
  showPage('review');

  reviewWords = []; reviewIndex = 0; answerRevealed = false;

  try {
    if (sessionIds && sessionIds.length > 0) {
      // 学习后复习: 15 个刚学的 + 15 个之前的重点单词
      const [oldRes, sessionRes] = await Promise.all([
        api.getReviewWords(15, sessionIds),
        api.getReviewByIds(sessionIds)
      ]);
      const sessionWords = sessionRes.words || [];
      const oldWords = oldRes.words || [];
      // 按学习顺序排列刚学的词
      const idOrder = new Map(sessionIds.map((id, i) => [id, i]));
      sessionWords.sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999));
      reviewWords = [...sessionWords, ...oldWords];
    } else {
      // 从主页直接复习: 取 30 个待复习单词
      const res = await api.getReviewWords(30);
      reviewWords = res.words || [];
    }

    if (reviewWords.length === 0) {
      $('#review-content').style.display = 'none';
      $('#review-empty').style.display = 'block';
      return;
    }
    showReviewCard(0);
  } catch (err) { toast('加载失败: ' + err.message); }

  $('#review-back').addEventListener('click', () => route('home'));
  $('#show-answer').addEventListener('click', showReviewAnswer);
  $('#review-forgot').addEventListener('click', () => submitReviewResult(0));
  $('#review-hard').addEventListener('click', () => submitReviewResult(0.5));
  $('#review-good').addEventListener('click', () => submitReviewResult(1));
  $('#review-easy').addEventListener('click', () => submitReviewResult(1));
  $('#review-go-learn').addEventListener('click', () => route('learn'));
}

function showReviewCard(idx) {
  if (idx < 0 || idx >= reviewWords.length) return;
  reviewIndex = idx; answerRevealed = false;
  const w = reviewWords[idx];

  $('#review-word-text').textContent = w.word;
  $('#review-phonetic').textContent = w.phonetic || '';
  $('#review-translation').textContent = w.translation;
  $('#review-example').textContent = w.example_sentence ? `${w.example_sentence} — ${w.example_translation || ''}` : '';
  $('#review-answer').style.display = 'none';
  $('#review-actions').style.display = 'none';
  $('#show-answer').style.display = 'block';
  $('#review-progress').textContent = `${idx + 1}/${reviewWords.length}`;
}

function showReviewAnswer() {
  answerRevealed = true;
  $('#review-answer').style.display = 'block';
  $('#review-actions').style.display = 'grid';
  $('#show-answer').style.display = 'none';
  speak(reviewWords[reviewIndex].word);
}

async function submitReviewResult(correct) {
  if (!answerRevealed) return;
  const w = reviewWords[reviewIndex];
  try {
    await api.submitReview(w.id, correct >= 1);
    if (reviewIndex < reviewWords.length - 1) {
      showReviewCard(reviewIndex + 1);
    } else {
      toast('🎉 复习完成！');
      route('home');
    }
  } catch (err) { toast('提交失败: ' + err.message); }
}

// ============ 单词本 ============
let wordlistPage = 1;
let wordlistTotal = 0;
let wordlistFilter = '';

async function renderWordlist(page = 1) {
  const t = document.getElementById('page-wordlist');
  document.getElementById('app').innerHTML = t.innerHTML;
  showPage('wordlist');
  wordlistPage = page;

  $('#wordlist-back').addEventListener('click', () => route('home'));

  $('#wordlist-filter').addEventListener('change', (e) => {
    wordlistFilter = e.target.value;
    renderWordlist(1);
  });

  let searchTimer;
  $('#wordlist-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderWordlist(1), 300);
  });

  await loadWordlist(page);
}

async function loadWordlist(page) {
  const q = $('#wordlist-search').value.trim();
  try {
    let data;
    if (q) {
      data = await api.searchWords(q);
      data.words = data.words || [];
      data.total = data.words.length;
    } else {
      data = await api.getLearnedWords({ page, limit: 20, list_type: wordlistFilter });
    }

    wordlistTotal = data.total || 0;
    const container = $('#wordlist-items');
    container.innerHTML = '';

    if (!data.words || data.words.length === 0) {
      container.innerHTML = '<div class="empty-state">还没有学过单词，去学习吧！</div>';
      return;
    }

    const stageLabels = ['刚学', '复习1', '复习2', '复习3', '复习4', '已掌握'];
    for (const w of data.words) {
      container.innerHTML += `
        <div class="word-item">
          <div class="word-main">
            <div class="en">${w.word}</div>
            <div class="cn">${w.translation}</div>
          </div>
          <span class="word-status stage-${w.stage || 0}">${stageLabels[w.stage] || '刚学'}</span>
        </div>`;
    }

    // 分页
    const totalPages = Math.ceil(data.total / 20);
    const pg = $('#wordlist-pagination'); pg.innerHTML = '';
    if (totalPages > 1 && !q) {
      for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === page) btn.className = 'active';
        btn.addEventListener('click', () => renderWordlist(i));
        pg.appendChild(btn);
      }
    }
  } catch (err) { toast('加载失败: ' + err.message); }
}

// ============ 启动 ============
(function init() {
  if (api.isLoggedIn()) {
    route('home');
  } else {
    route('login');
  }
})();
