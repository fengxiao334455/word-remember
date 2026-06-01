const API_BASE = '/api';

const api = {
  _token: localStorage.getItem('token'),

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this._token) h['Authorization'] = 'Bearer ' + this._token;
    return h;
  },

  async _fetch(path, opts = {}) {
    const res = await fetch(API_BASE + path, { ...opts, headers: { ...this._headers(), ...opts.headers } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '请求失败');
    return data;
  },

  // 认证
  register(username, password) {
    return this._fetch('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
  },
  login(username, password) {
    return this._fetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },
  getProfile() {
    return this._fetch('/auth/profile');
  },

  setToken(token) {
    this._token = token;
    localStorage.setItem('token', token);
  },
  clearToken() {
    this._token = null;
    localStorage.removeItem('token');
  },
  isLoggedIn() { return !!this._token; },

  // 单词
  getWords(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this._fetch('/words?' + q);
  },
  getLearnWords(count = 10) {
    return this._fetch('/words/learn?count=' + count);
  },
  searchWords(q) {
    return this._fetch('/words/search?q=' + encodeURIComponent(q));
  },

  // 进度
  getReviewWords(count = 15) {
    return this._fetch('/progress/review?count=' + count);
  },
  submitReview(wordId, correct) {
    return this._fetch('/progress/review', { method: 'POST', body: JSON.stringify({ wordId, correct }) });
  },
  markLearned(wordId, correct) {
    return this._fetch('/progress/learned', { method: 'POST', body: JSON.stringify({ wordId, correct }) });
  },
  getStats() {
    return this._fetch('/progress/stats');
  },
  getLearnedWords(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this._fetch('/progress/learned-words?' + q);
  }
};
