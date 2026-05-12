// Terroir HUB — Behavior Tracking Layer v2
// 全イベントをSupabaseに送信 + localStorageにバックアップ

(function(){
  'use strict';

  const HUB_VERSION = '2.0';
  const STORAGE_KEY = 'thub_events';
  const SESSION_KEY = 'thub_session';
  const USER_KEY = 'thub_uid';
  const QUEUE_KEY = 'thub_queue';

  // Supabase
  const SB_URL = 'https://hhwavxavuqqfiehrogwv.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhod2F2eGF2dXFxZmllaHJvZ3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5Njk3MzAsImV4cCI6MjA4OTU0NTczMH0.tHMQ_u51jp69AMUKKtTvxL09Sr11JFPKGRhKMmUzEjg';

  // Session
  function getSession(){
    let s = sessionStorage.getItem(SESSION_KEY);
    if(!s){ s = 'ses_' + Date.now() + '_' + Math.random().toString(36).substr(2,6); sessionStorage.setItem(SESSION_KEY, s); }
    return s;
  }

  // User (anonymous until signup)
  function getUser(){
    let u = localStorage.getItem(USER_KEY);
    if(!u){ u = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2,8); localStorage.setItem(USER_KEY, u); }
    return u;
  }

  // Detect device type
  function getDevice(){
    const w = window.innerWidth;
    if(w <= 640) return 'mobile';
    if(w <= 1024) return 'tablet';
    return 'desktop';
  }

  // Detect language
  function getLang(){
    return (navigator.language || navigator.userLanguage || 'unknown').substring(0,5);
  }

  // Extract brewery info from URL: /whisky/{pref}/{id}.html
  function getBreweryFromURL(){
    const m = window.location.pathname.match(/\/sake\/([a-z]+)\/([a-z0-9_]+)\.html/);
    if(m) return { pref: m[1], brewery_id: m[2] };
    return null;
  }

  // ══════════════════════════════════════
  // CORE TRACK FUNCTION
  // ══════════════════════════════════════
  function track(event, properties){
    const brewery = getBreweryFromURL();
    const payload = {
      event: event,
      properties: properties || {},
      timestamp: new Date().toISOString(),
      session_id: getSession(),
      user_id: getUser(),
      page: window.location.pathname,
      referrer: document.referrer,
      device: getDevice(),
      lang: getLang(),
      screen: window.innerWidth + 'x' + window.innerHeight,
      brewery_id: (properties && properties.brewery_id) || (brewery && brewery.brewery_id) || null,
      pref: (properties && properties.pref) || (brewery && brewery.pref) || null,
      country: userCountry,
      city: userCity,
      timezone: userTimezone,
      v: HUB_VERSION
    };

    // Store locally (backup)
    try {
      const events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      events.push(payload);
      if(events.length > 2000) events.splice(0, events.length - 2000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch(e){}

    // Send to Supabase
    sendToSupabase(payload);

    // Console in dev
    if(location.hostname === 'localhost' || location.protocol === 'file:'){
      console.log('[THUB]', event, properties);
    }
  }

  // ══════════════════════════════════════
  // SUPABASE SENDER (with queue for offline)
  // ══════════════════════════════════════
  function sendToSupabase(payload){
    const row = {
      event: payload.event,
      properties: payload.properties,
      timestamp: payload.timestamp,
      session_id: payload.session_id,
      user_id: payload.user_id,
      page: payload.page,
      referrer: payload.referrer,
      device: payload.device,
      lang: payload.lang,
      screen: payload.screen,
      brewery_id: payload.brewery_id,
      pref: payload.pref,
      country: payload.country,
      city: payload.city,
      timezone: payload.timezone
    };

    fetch(SB_URL + '/rest/v1/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    }).catch(function(){
      // Offline: queue for later
      try {
        const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        q.push(row);
        if(q.length > 500) q.splice(0, q.length - 500);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
      } catch(e){}
    });
  }

  // Flush offline queue when back online
  function flushQueue(){
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      if(q.length === 0) return;
      // Send in batches of 50
      const batch = q.splice(0, 50);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
      fetch(SB_URL + '/rest/v1/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + SB_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(batch)
      }).then(function(){ if(q.length > 0) setTimeout(flushQueue, 1000); });
    } catch(e){}
  }
  window.addEventListener('online', flushQueue);
  setTimeout(flushQueue, 5000); // Try on page load too

  // ══════════════════════════════════════
  // COUNTRY DETECTION (IP-based, cached)
  // ══════════════════════════════════════
  var userCountry = sessionStorage.getItem('thub_country') || null;
  var userCity = sessionStorage.getItem('thub_city') || null;
  var userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;

  // Free IP geolocation (no API key needed, 45 req/min)
  if(!userCountry){
    fetch('https://ipapi.co/json/', { mode: 'cors' }).then(function(r){ return r.json(); }).then(function(d){
      userCountry = d.country_code || null;  // 'JP', 'US', 'CN', etc.
      userCity = d.city || null;
      sessionStorage.setItem('thub_country', userCountry || '');
      sessionStorage.setItem('thub_city', userCity || '');
      // Send enriched identify event
      track('geo_detected', { country: userCountry, city: userCity, region: d.region, timezone: userTimezone });
    }).catch(function(){});
  }

  // ══════════════════════════════════════
  // AUTO-TRACKED EVENTS
  // ══════════════════════════════════════

  // page_view
  var breweryInfo = getBreweryFromURL();
  track('page_view', {
    title: document.title,
    path: window.location.pathname,
    query: window.location.search,
    brewery_id: breweryInfo ? breweryInfo.brewery_id : null,
    pref: breweryInfo ? breweryInfo.pref : null
  });

  // Time on page
  var pageStart = Date.now();
  window.addEventListener('beforeunload', function(){
    track('page_exit', {
      duration_ms: Date.now() - pageStart,
      brewery_id: breweryInfo ? breweryInfo.brewery_id : null
    });
  });

  // Scroll depth
  var maxScroll = 0;
  window.addEventListener('scroll', function(){
    var pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
    if(pct > maxScroll) maxScroll = pct;
  });
  window.addEventListener('beforeunload', function(){
    if(maxScroll > 0) track('scroll_depth', { max_percent: maxScroll });
  });

  // ══════════════════════════════════════
  // MANUAL TRACK API (window.thub.track)
  // ══════════════════════════════════════

  window.thub = {
    track: track,

    search: function(query, results_count){
      track('search', { query: query, results: results_count });
    },

    ai_query: function(query, response_preview, brewery_context){
      track('ai_query', {
        query: query,
        response_preview: (response_preview||'').substring(0,200),
        brewery_context: brewery_context || null
      });
    },

    ai_feedback: function(query, rating){
      track('ai_feedback', { query: query, rating: rating });
    },

    compare: function(brewery_ids){
      track('compare', { breweries: brewery_ids });
    },

    favorite: function(brewery_id, brewery_name, pref){
      track('favorite', { brewery_id: brewery_id, brewery_name: brewery_name, pref: pref });
    },

    unfavorite: function(brewery_id){
      track('unfavorite', { brewery_id: brewery_id });
    },

    tour_click: function(brewery_id, brewery_name){
      track('tour_click', { brewery_id: brewery_id, brewery_name: brewery_name });
    },

    product_click: function(product_name, brewery_name){
      track('product_click', { product: product_name, brewery: brewery_name });
    },

    share: function(brewery_id, method){
      track('share', { brewery_id: brewery_id, method: method });
    },

    signup: function(method){
      track('signup', { method: method || 'email' });
    },

    login: function(method){
      track('login', { method: method || 'email' });
    },

    upgrade: function(plan){
      track('upgrade', { plan: plan });
    },

    purchase: function(item, amount){
      track('purchase', { item: item, amount: amount });
    },

    stamp_checkin: function(brewery_id, brewery_name, pref, distance_m){
      track('stamp_checkin', { brewery_id: brewery_id, brewery_name: brewery_name, pref: pref, distance_m: distance_m });
    },

    report_submit: function(brewery_id, has_photo){
      track('report_submit', { brewery_id: brewery_id, has_photo: has_photo });
    },

    sakura_open: function(brewery_id){
      track('sakura_open', { brewery_id: brewery_id });
    },

    sakura_suggestion_click: function(suggestion_text){
      track('sakura_suggestion_click', { suggestion: suggestion_text });
    },

    lang_switch: function(lang){
      track('lang_switch', { lang: lang });
    },

    filter_use: function(filter_type, value){
      track('filter_use', { filter: filter_type, value: value });
    },

    // Brewery view with history
    addHistory: function(breweryId, breweryName, pref){
      var key = 'thub_history';
      var history = JSON.parse(localStorage.getItem(key) || '[]');
      history = history.filter(function(h){ return h.id !== breweryId; });
      history.unshift({ id: breweryId, name: breweryName, pref: pref, time: new Date().toISOString() });
      if(history.length > 50) history = history.slice(0, 50);
      localStorage.setItem(key, JSON.stringify(history));
      track('brewery_view', { brewery_id: breweryId, brewery_name: breweryName, pref: pref });
    },

    getHistory: function(){
      return JSON.parse(localStorage.getItem('thub_history') || '[]');
    },

    saveTasteProfile: function(profile){
      localStorage.setItem('thub_taste', JSON.stringify(profile));
      track('taste_profile_update', profile);
      if(window.thubAuth && window.thubAuth.supabase && window.thubAuth.user){
        window.thubAuth.supabase.from('profiles')
          .update({ taste_profile: profile })
          .eq('id', window.thubAuth.user.id);
      }
    },

    getTasteProfile: function(){
      return JSON.parse(localStorage.getItem('thub_taste') || '{}');
    },

    getEvents: function(){
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    },

    exportCSV: function(){
      var events = this.getEvents();
      var csv = 'timestamp,event,page,session_id,user_id,brewery_id,pref,device,lang,properties\n' +
        events.map(function(e){
          return '"'+e.timestamp+'","'+e.event+'","'+e.page+'","'+e.session_id+'","'+e.user_id+'","'+(e.brewery_id||'')+'","'+(e.pref||'')+'","'+(e.device||'')+'","'+(e.lang||'')+'","'+JSON.stringify(e.properties).replace(/"/g,'""')+'"';
        }).join('\n');
      var blob = new Blob([csv], {type:'text/csv'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'thub_events_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
    },

    setUser: function(userId){
      localStorage.setItem(USER_KEY, userId);
      track('identify', { user_id: userId });
    }
  };

  // ══════════════════════════════════════
  // AUTO-DETECT CLICKS
  // ══════════════════════════════════════
  document.addEventListener('click', function(e){
    var el = e.target.closest('a, button, [data-track]');
    if(!el) return;

    // External links
    if(el.tagName === 'A' && el.hostname && el.hostname !== location.hostname){
      track('outbound_click', { url: el.href, text: el.textContent.trim().substring(0,50) });
    }

    // data-track attributes
    if(el.dataset && el.dataset.track){
      track(el.dataset.track, { label: el.dataset.trackLabel || el.textContent.trim().substring(0,50) });
    }

    // FAB / Sakura button clicks
    if(el.id === 'fab' || el.classList.contains('btn-p')){
      var bi = getBreweryFromURL();
      if(bi) track('sakura_open', { brewery_id: bi.brewery_id });
    }

    // Suggestion button clicks
    if(el.classList.contains('sug')){
      track('sakura_suggestion_click', { suggestion: el.textContent.trim() });
    }
  });

  // ══════════════════════════════════════
  // AUTO-TRACK BREWERY VIEW
  // ══════════════════════════════════════
  if(breweryInfo){
    window.thub.addHistory(breweryInfo.brewery_id, document.title.split(' — ')[0], breweryInfo.pref);
  }

  // ══════════════════════════════════════
  // UTM PARAMETER TRACKING
  // ══════════════════════════════════════
  (function(){
    var params = new URLSearchParams(window.location.search);
    var utm_source = params.get('utm_source');
    var utm_medium = params.get('utm_medium');
    var utm_campaign = params.get('utm_campaign');
    var utm_term = params.get('utm_term');
    var utm_content = params.get('utm_content');
    if(utm_source){
      track('utm_landing', {
        utm_source: utm_source,
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
        utm_term: utm_term || '',
        utm_content: utm_content || ''
      });
      // セッションに保存（コンバージョン追跡用）
      sessionStorage.setItem('thub_utm', JSON.stringify({
        source: utm_source,
        medium: utm_medium,
        campaign: utm_campaign,
        term: utm_term,
        content: utm_content
      }));
    }
  })();

  // ══════════════════════════════════════
  // MICROSOFT CLARITY (FREE HEATMAP)
  // ══════════════════════════════════════
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window,document,"clarity","script","w00ia7v4xp");

})();



// ── AIサクラ UI v2（デザイン統一 + チャット本番対応）──
(function(){

  // ── CSS注入 ──
  var CSS=[
    // パネル: フル幅・svh・シャドウ強化
    '.panel{max-width:none!important;height:88svh!important;box-shadow:0 -24px 60px rgba(0,0,0,.5)!important;}',
    // デスクトップ: 右スライドイン
    '@media(min-width:701px){',
    '.overlay{align-items:stretch!important;justify-content:flex-end!important;}',
    '.panel{width:420px!important;height:100%!important;border-radius:0!important;max-width:100vw!important;transform:translateX(100%)!important;box-shadow:-8px 0 40px rgba(0,0,0,.4)!important;}',
    '.overlay.open .panel{transform:translateX(0)!important;}',
    '.p-handle{display:none!important;}',
    '}',
    // iOS safe area
    '.inp-row{padding-bottom:max(16px,env(safe-area-inset-bottom))!important;}',
    // バブル強化
    '.msg.butler .bubble{border-left-width:2px!important;line-height:1.9!important;letter-spacing:.03em!important;}',
    '.msg{animation:_su_in .3s ease both!important;}',
    '@keyframes _su_in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}',
    '.chat::-webkit-scrollbar{width:2px!important;}',
    // 閉じるボタン（見やすく）
    '.mob-close-bar{display:none;padding:8px 16px 10px;flex-shrink:0;border-top:1px solid var(--border);}',
    '.mob-close-bar button{width:100%;padding:12px;background:rgba(0,0,0,.04);border:1.5px solid var(--text-muted,#999);border-radius:8px;color:var(--text,#333);font-size:.85rem;font-weight:500;letter-spacing:.08em;cursor:pointer;font-family:inherit;transition:all .2s;}',
    '.mob-close-bar button:hover,.mob-close-bar button:active{background:rgba(0,0,0,.08);border-color:var(--accent,#888);}',
    '@media(max-width:699px){.mob-close-bar{display:block;}}'
  ].join('');

  // ローカル応答（未ログイン時）
  function _localReply(q) {
    var bn = window.BN || '';
    var bb = window.BB || '';
    var name = bn || 'この蔵';
    var brand = bb ? '「' + bb + '」' : 'こちらのお酒';
    var ql = (q || '').toLowerCase();
    if (/見学|ツアー|体験/.test(ql))
      return name + 'の蔵見学は、ページ下部のお問い合わせ先でご確認いただけます。\n\n🌸 会員登録するとAIサクラが詳しくご案内します（無料）。';
    if (/購入|買|通販|オンライン|店/.test(ql))
      return brand + 'はTerroir HUBや公式サイトでお求めいただけます。\n\n🌸 会員登録でAIサクラがおすすめを提案します。';
    if (/おすすめ|合う|ペアリング|料理|食/.test(ql))
      return brand + 'のペアリングや料理との合わせ方は、会員登録後にAIサクラが詳しくお答えします。\n\n🌸 無料で登録できます。';
    if (/飲み方|温度|燗|冷|ロック/.test(ql))
      return brand + 'のおいしい飲み方は、会員登録後にAIサクラがご案内します。\n\n🌸 無料登録で今すぐ聞けます。';
    if (/歴史|創業|由来|こだわり|特徴/.test(ql))
      return name + 'の歴史や蔵のこだわりは、このページをぜひご覧ください。\n\nさらに詳しくは、会員登録後にAIサクラがお話しします。';
    if (/english|en\b/.test(ql) || /[a-zA-Z]{5,}/.test(q))
      return 'Thank you for your question about ' + name + '.\n\nSign up free to chat with AI Sakura in English! 🌸';
    return name + 'についてのご質問ありがとうございます。\n\n🌸 AIサクラに詳しく聞くには、無料会員登録が必要です。ペアリング・蔵見学・銘柄のご案内まで、何でもお答えします。';
  }

  // ログイン確認
  async function _isLoggedIn() {
    try {
      if (window.thubAuth && window.thubAuth.user) return true;
      if (window.thubAuth && window.thubAuth.supabase) {
        var s = await window.thubAuth.supabase.auth.getSession();
        return !!(s && s.data && s.data.session);
      }
    } catch(e) {}
    return false;
  }

  // API呼び出し
  async function _callAPI(q) {
    var headers = {'Content-Type':'application/json'};
    try {
      var s = await window.thubAuth.supabase.auth.getSession();
      var tok = s && s.data && s.data.session && s.data.session.access_token;
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
    } catch(e) {}
    var ctx = (window.BN || '') + (window.BB ? '（代表銘柄: ' + window.BB + '）' : '');
    var hist = (window.chatHistory || []).slice(-10);
    return fetch('https://sake.terroirhub.com/api/sakura', {
      method:'POST', headers:headers,
      body:JSON.stringify({question:q, history:hist, context:ctx})
    });
  }

  // メインルーター
  async function _route(q) {
    var _rmT = window.removeT || window.hideTyping || function(){var e=document.getElementById('tp')||document.getElementById('sakura-typing');if(e)e.remove();};
    var _addMsg = window.addMsg;
    var _renderSugs = window.renderSugs;

    var loggedIn = await _isLoggedIn();

    if (!loggedIn) {
      _rmT();
      _addMsg && _addMsg('butler', _localReply(q));
      _renderSugs && _renderSugs();
      return;
    }

    try {
      var res = await _callAPI(q);
      _rmT();
      if (res.status === 401) {
        _addMsg && _addMsg('butler', _localReply(q));
      } else if (res.status === 402) {
        _addMsg && _addMsg('butler', '今月のご利用上限に達しました。\n\n🌸 プランをアップグレードするとさらに多くご利用いただけます。');
      } else if (!res.ok) {
        _addMsg && _addMsg('butler', '少し時間をおいて、もう一度お試しください。');
      } else {
        var data = await res.json();
        var ans = data.answer || data.reply || '';
        _addMsg && _addMsg('butler', ans);
        if (window.chatHistory) window.chatHistory.push({role:'user',content:q},{role:'assistant',content:ans});
      }
    } catch(e) {
      _rmT();
      _addMsg && _addMsg('butler', '少し時間をおいて、もう一度お試しください。');
    }
    _renderSugs && _renderSugs();
  }

  // askSug / sendMsg / sendQuestion を上書き
  function _overrideFns() {
    var _showT = window.showT || window.showTyping || function(){};
    window.askSug = function(q) {
      var sugs = document.getElementById('sugs');
      if (sugs) sugs.innerHTML = '';
      window.addMsg && window.addMsg('user', q);
      _showT();
      _route(q);
    };
    window.sendMsg = function() {
      var inp = document.getElementById('chat-inp');
      var q = inp ? inp.value.trim() : '';
      if (!q) return;
      if (inp) inp.value = '';
      var sugs = document.getElementById('sugs');
      if (sugs) sugs.innerHTML = '';
      window.addMsg && window.addMsg('user', q);
      _showT();
      _route(q);
    };
    window.sendQuestion = function(q) {
      _route(q);
    };
  }

  // 閉じるボタン注入
  function _injectCloseBtn(panel) {
    if (panel.querySelector('.mob-close-bar')) return;
    var row = panel.querySelector('.inp-row');
    if (!row) return;
    var bar = document.createElement('div');
    bar.className = 'mob-close-bar';
    bar.innerHTML = '<button onclick="typeof closePanel===\'function\'&&closePanel()">✕ チャットを閉じる</button>';
    row.insertAdjacentElement('afterend', bar);
  }

  // CSS注入
  function _injectCSS() {
    if (document.getElementById('_su_style')) return;
    var s = document.createElement('style');
    s.id = '_su_style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // 初期化
  function init() {
    _injectCSS();
    var panel = document.querySelector('.panel');
    if (panel) _injectCloseBtn(panel);
    _overrideFns();
  }

  // deferスクリプトはDOMContentLoaded前に実行されるが、念のため両対応
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

