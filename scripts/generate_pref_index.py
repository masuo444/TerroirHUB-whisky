#!/usr/bin/env python3
"""
各県の蒸留所一覧ページ（index.html）を生成。
JSONデータから蒸留所リストをインライン埋め込みし、JSで動的フィルタリング。
"""

import json
import glob
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMAIN = 'whisky.terroirhub.com'

PREF_NAMES = {
    'hokkaido':'北海道','aomori':'青森県','iwate':'岩手県','miyagi':'宮城県','akita':'秋田県',
    'yamagata':'山形県','fukushima':'福島県','ibaraki':'茨城県','tochigi':'栃木県','gunma':'群馬県',
    'saitama':'埼玉県','chiba':'千葉県','tokyo':'東京都','kanagawa':'神奈川県','niigata':'新潟県',
    'toyama':'富山県','ishikawa':'石川県','fukui':'福井県','yamanashi':'山梨県','nagano':'長野県',
    'gifu':'岐阜県','shizuoka':'静岡県','aichi':'愛知県','mie':'三重県','shiga':'滋賀県',
    'kyoto':'京都府','osaka':'大阪府','hyogo':'兵庫県','nara':'奈良県','wakayama':'和歌山県',
    'tottori':'鳥取県','shimane':'島根県','okayama':'岡山県','hiroshima':'広島県','yamaguchi':'山口県',
    'tokushima':'徳島県','kagawa':'香川県','ehime':'愛媛県','kochi':'高知県','fukuoka':'福岡県',
    'saga':'佐賀県','nagasaki':'長崎県','kumamoto':'熊本県','oita':'大分県','miyazaki':'宮崎県',
    'kagoshima':'鹿児島県','okinawa':'沖縄県'
}

WHISKY_TYPE_LABELS = {
    'malt': 'モルト', 'grain': 'グレーン', 'blended': 'ブレンデッド',
    'blended_malt': 'ブレンデッドモルト', 'single_cask': 'シングルカスク',
}

def esc(s):
    if not s: return ''
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;').replace("'","&#39;")

def generate_pref_index(pref_slug, distilleries):
    pref_name = PREF_NAMES.get(pref_slug, pref_slug)
    count = len(distilleries)

    if count == 0:
        return None

    inline_data = []
    for d in distilleries:
        inline_data.append({
            'id': d.get('id',''),
            'name': d.get('name',''),
            'brand': d.get('brand',''),
            'type': d.get('type',''),
            'area': d.get('area',''),
            'founded': d.get('founded',''),
            'founded_era': d.get('founded_era',''),
            'desc': (d.get('desc','')[:100] + '…') if len(d.get('desc','')) > 100 else d.get('desc',''),
            'whisky_type': d.get('whisky_type',''),
            'cask_type': d.get('cask_type',''),
            'age_statement': d.get('age_statement',''),
        })

    json_str = json.dumps(inline_data, ensure_ascii=False)

    # ── SSR 初期グリッド（クローラー/AI向け。フィルターJSは既存のまま動作）──
    cards_html = ''
    for _d in inline_data:
        _tags = []
        _wl = {'single_malt':'シングルモルト','grain':'グレーン','blended':'ブレンデッド','craft':'クラフト','world':'ワールド'}
        if _d.get('whisky_type') and _wl.get(_d['whisky_type']):
            _tags.append(_wl[_d['whisky_type']])
        if _d.get('cask_type'):
            _tags.append(str(_d['cask_type']).split('・')[0])
        if _d.get('age_statement') and _d.get('age_statement') != 'NAS':
            _tags.append(str(_d['age_statement']) + '年')
        _meta = esc(_d.get('area', ''))
        if _d.get('founded'):
            _meta += ' ・ 創業' + esc(str(_d['founded'])) + '年'
        _c = '<a class="card" href="/whisky/' + pref_slug + '/' + esc(_d['id']) + '.html">'
        _c += '<div class="card-name">' + esc(_d['name']) + '</div>'
        if _d.get('brand'):
            _c += '<div class="card-brand">' + esc(_d['brand']) + '</div>'
        _c += '<div class="card-meta">' + _meta + '</div>'
        if _d.get('desc'):
            _c += '<div class="card-desc">' + esc(_d['desc']) + '</div>'
        if _tags:
            _c += '<div class="card-tags">' + ''.join('<span class="tag">' + esc(str(_t)) + '</span>' for _t in _tags) + '</div>'
        _c += '</a>'
        cards_html += _c

    # ── 県ガイド本文（検索で「{県} ウイスキー」を探す人向け。データにある事実だけを出す）──
    _furusato_exists = os.path.exists(os.path.join(BASE, 'whisky', 'furusato', f'{pref_slug}.html'))
    _visitable = [d for d in distilleries if (d.get('visit') or '').strip() and '不可' not in d.get('visit', '')]
    _closed = [d for d in distilleries if '不可' in (d.get('visit') or '')]
    guide_items = ''
    for d in distilleries:
        rows = []
        if d.get('company') and d.get('company') != d.get('name'):
            rows.append(('運営', esc(d['company'])))
        if d.get('address'):
            rows.append(('所在地', esc(d['address'])))
        if d.get('founded'):
            rows.append(('創業', esc(str(d['founded'])) + '年'))
        _brands = [(b.get('name') if isinstance(b, dict) else str(b)) for b in (d.get('brands') or [])]
        _brands = [b for b in _brands if b] or ([d['brand']] if d.get('brand') else [])
        if _brands:
            rows.append(('代表銘柄', '、'.join(esc(b) for b in _brands[:3])))
        if (d.get('visit') or '').strip():
            rows.append(('見学', esc(d['visit'])))
        if d.get('nearest_station'):
            rows.append(('最寄駅', esc(d['nearest_station'])))
        elif d.get('nearest_station_calc'):
            _c = d['nearest_station_calc']
            if isinstance(_c, dict) and _c.get('station'):
                _t = f"{_c.get('line','')} {_c['station']}駅".strip()
                if _c.get('distance_m'):
                    _t += f"（直線で約{_c['distance_m']:,}m）"
                rows.append(('最寄駅', esc(_t) + '<span class="calc">※座標からの算出</span>'))
        _rows = ''.join(f'<tr><th>{k}</th><td>{v}</td></tr>' for k, v in rows)
        def _ftext(x):
            if isinstance(x, dict):
                return next((str(v) for k, v in x.items() if isinstance(v, str) and v.strip()), '')
            return str(x or '')
        _feat = ''.join(f'<li>{esc(t)}</li>' for t in (_ftext(x) for x in (d.get('features') or [])[:3]) if t)
        _links = f'<a href="/whisky/{pref_slug}/{esc(d["id"])}.html">詳しく見る →</a>'
        if d.get('url'):
            _links += f' <a href="{esc(d["url"])}" target="_blank" rel="noopener">公式サイト</a>'
        _src = f'<p class="gsrc">出典：<a href="{esc(d["source"])}" target="_blank" rel="noopener">{esc(d["source"])}</a></p>' if d.get('source') else ''
        guide_items += (f'<article class="gitem"><h3>{esc(d.get("name",""))}</h3>'
                        + (f'<p>{esc(d["desc"])}</p>' if d.get('desc') else '')
                        + (f'<table class="gtable">{_rows}</table>' if _rows else '')
                        + (f'<ul class="gfeat">{_feat}</ul>' if _feat else '')
                        + f'<p class="glinks">{_links}</p>{_src}</article>')

    _names = '、'.join(d.get('name', '') for d in distilleries)
    faq = [(f'{pref_name}にウイスキー蒸留所はいくつありますか？',
            f'Terroir HUB では{pref_name}のウイスキー蒸留所を{count}か所収録しています（{_names}）。')]
    if _visitable:
        faq.append((f'{pref_name}で見学できるウイスキー蒸留所は？',
                    '公式情報で見学に関する案内が確認できるのは、' + '、'.join(d['name'] for d in _visitable)
                    + 'です。受付状況や予約の要否は変わることがあるため、各公式サイトでご確認ください。'))
    elif _closed:
        faq.append((f'{pref_name}のウイスキー蒸留所は見学できますか？',
                    '、'.join(d['name'] for d in _closed) + 'は、公式情報で一般見学を受け付けていないとされています。'
                    'その他の蒸留所は、見学の可否を当サイトでは確認できていません。各公式サイトでご確認ください。'))
    faq_html = ''.join(f'<div class="gfaq"><h3>{esc(q)}</h3><p>{esc(a)}</p></div>' for q, a in faq)
    faq_schema = json.dumps({"@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]},
        ensure_ascii=False)
    _fz = (f'<p class="gfz">{esc(pref_name)}のウイスキーは、ふるさと納税の返礼品としても提供されています。'
           f'<a href="/whisky/furusato/{pref_slug}.html">{esc(pref_name)}のウイスキー返礼品を見る →</a></p>') if _furusato_exists else ''
    guide_html = (f'<section class="guide"><h2>{esc(pref_name)}のウイスキー蒸留所ガイド</h2>'
                  f'<p class="glead">{esc(pref_name)}で Terroir HUB が収録しているウイスキー蒸留所は{count}か所です。'
                  '掲載は各蒸留所の公式情報などにもとづき、確認できない項目は載せていません。</p>'
                  f'{guide_items}{_fz}<h2>よくある質問</h2>{faq_html}</section>')

    items_schema = []
    for i, d in enumerate(distilleries):
        items_schema.append({
            "@type": "ListItem",
            "position": i + 1,
            "url": f"https://{DOMAIN}/whisky/{pref_slug}/{d['id']}.html",
            "name": d.get('name','')
        })

    schema = json.dumps({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": f"{pref_name}のウイスキー蒸留所一覧",
        "numberOfItems": count,
        "itemListElement": items_schema
    }, ensure_ascii=False)

    title_text = f"{pref_name}のウイスキー蒸留所{count}か所｜銘柄・見学情報まとめ — Terroir HUB"

    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title_text)}</title>
<meta name="description" content="{esc(pref_name)}のウイスキー蒸留所{count}か所（{esc(_names[:80])}）の所在地・代表銘柄・見学情報を、公式情報にもとづいてまとめました。">
<link rel="canonical" href="https://{DOMAIN}/whisky/{pref_slug}/">
<link rel="alternate" hreflang="ja" href="https://{DOMAIN}/whisky/{pref_slug}/">
<link rel="alternate" hreflang="en" href="https://{DOMAIN}/whisky/en/{pref_slug}/">
<link rel="alternate" hreflang="x-default" href="https://{DOMAIN}/whisky/en/{pref_slug}/">
<script type="application/ld+json">{schema}</script>
<script type="application/ld+json">{faq_schema}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;600;700&family=Noto+Sans+JP:wght@300;400;500;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{background:#FAF8F5;color:#1A1814;font-family:'Noto Sans JP','DM Sans',sans-serif;font-size:16px;line-height:1.85;}}
.nav{{position:fixed;top:0;left:0;right:0;z-index:100;height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:rgba(250,248,245,0.96);backdrop-filter:blur(20px);border-bottom:1px solid #E5DDD5;}}
.nav-brand{{display:flex;align-items:center;gap:9px;text-decoration:none;}}
.nav-logo{{font-family:'Shippori Mincho',serif;font-size:18px;font-weight:700;letter-spacing:0.06em;color:#1A1814;}}
.nav-logo-sub{{font-size:10px;color:#8A8070;letter-spacing:0.06em;margin-left:8px;}}
.nav-r{{display:flex;gap:12px;}}
.nav-r a{{font-size:13px;color:#6B4423;text-decoration:none;font-weight:500;}}
.nav-r a:hover{{opacity:0.7;}}
.main{{max-width:1100px;margin:0 auto;padding:78px 24px 48px;}}
.breadcrumb{{font-size:13px;color:#8A8070;margin-bottom:24px;}}
.guide{{margin-top:48px;border-top:1px solid #E5DDD5;padding-top:36px;}}
.guide h2{{font-family:'Shippori Mincho',serif;font-size:clamp(20px,3vw,26px);margin:28px 0 12px;}}
.glead{{color:#3D3830;margin-bottom:20px;}}
.gitem{{background:#fff;border:1px solid #E5DDD5;border-radius:10px;padding:22px 24px;margin-bottom:16px;}}
.gitem h3{{font-family:'Shippori Mincho',serif;font-size:19px;margin-bottom:8px;}}
.gitem p{{font-size:15px;color:#3D3830;}}
.gtable{{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;}}
.gtable th{{text-align:left;width:6.5em;color:#8A8070;font-weight:500;padding:5px 0;vertical-align:top;}}
.gtable td{{padding:5px 0;}}
.calc{{font-size:12px;color:#8A8070;}}
.gfeat{{margin:8px 0 0 1.2em;font-size:14px;color:#3D3830;}}
.glinks{{margin-top:10px;font-size:14px;}}
.glinks a{{color:#6B4423;margin-right:12px;}}
.gsrc{{font-size:12px!important;color:#8A8070!important;margin-top:6px;word-break:break-all;}}
.gsrc a{{color:#8A8070;}}
.gfz{{background:#fff;border:1px solid #E5DDD5;border-radius:10px;padding:16px 20px;margin:8px 0 16px;font-size:15px;}}
.gfz a{{color:#6B4423;font-weight:500;}}
.gfaq{{background:#fff;border:1px solid #E5DDD5;border-radius:10px;padding:16px 20px;margin-bottom:10px;}}
.gfaq h3{{font-size:15px;margin-bottom:4px;}}
.gfaq p{{font-size:14px;color:#3D3830;}}
.breadcrumb a{{color:#6B4423;text-decoration:none;}}
.breadcrumb a:hover{{text-decoration:underline;}}
.header{{margin-bottom:32px;}}
.header h1{{font-family:'Shippori Mincho',serif;font-size:clamp(26px,4vw,36px);font-weight:700;color:#1A1814;margin-bottom:6px;}}
.header .count{{font-size:14px;color:#8A8070;}}
.filters{{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;}}
.filter-btn{{background:#fff;border:1px solid #E5DDD5;color:#3D3830;font-size:13px;padding:6px 14px;border-radius:6px;cursor:pointer;transition:all 0.15s;font-family:'Noto Sans JP',sans-serif;}}
.filter-btn:hover,.filter-btn.active{{border-color:#6B4423;color:#6B4423;background:rgba(107,68,35,0.06);}}
.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}}
@media(max-width:900px){{.grid{{grid-template-columns:repeat(2,1fr);}}}}
@media(max-width:560px){{.grid{{grid-template-columns:1fr;}}}}
.card{{background:#fff;border:1px solid #E5DDD5;border-radius:10px;padding:20px;transition:all 0.2s;text-decoration:none;display:block;color:inherit;}}
.card:hover{{border-color:#6B4423;box-shadow:0 4px 16px rgba(0,0,0,0.04);transform:translateY(-2px);}}
.card-name{{font-family:'Shippori Mincho',serif;font-size:17px;font-weight:600;color:#1A1814;margin-bottom:2px;}}
.card-brand{{font-size:13px;color:#6B4423;font-weight:500;margin-bottom:4px;}}
.card-meta{{font-size:12px;color:#8A8070;margin-bottom:6px;}}
.card-desc{{font-size:12px;color:#8A8070;line-height:1.7;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}}
.card-tags{{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px;}}
.tag{{font-size:10px;padding:2px 8px;border-radius:3px;background:rgba(107,68,35,0.06);color:#6B4423;border:1px solid rgba(107,68,35,0.12);}}
.empty{{text-align:center;padding:48px;color:#8A8070;font-size:14px;}}
footer{{background:#1A1814;padding:32px 24px;text-align:center;margin-top:48px;}}
footer p{{font-size:12px;color:rgba(255,255,255,0.3);}}
footer a{{color:rgba(255,255,255,0.5);text-decoration:none;}}
</style>
</head>
<body>
<nav class="nav">
  <a class="nav-brand" href="/">
    <span class="nav-logo">Terroir HUB</span>
    <span class="nav-logo-sub">WHISKY</span>
  </a>
  <div class="nav-r">
    <a href="/whisky/guide/">ウイスキーガイド</a>
    <a href="/">蒸留所検索</a>
  </div>
</nav>
<main class="main">
  <div class="breadcrumb">
    <a href="/">ホーム</a> &gt; <a href="/#regions">蒸留所検索</a> &gt; {esc(pref_name)}
  </div>
  <div class="header">
    <h1>{esc(pref_name)}のウイスキー蒸留所</h1>
    <p class="count">{count}蔵</p>
  </div>
  <div class="filters" id="filters"></div>
  <div class="grid" id="grid">{cards_html}</div>
  {guide_html}
</main>
<div style="max-width:1080px;margin:36px auto 0;padding:0 24px;text-align:center;"><a href="https://www.terroirhub.com/terroir/{pref_slug}.html" style="font-size:13px;color:#6B4423;text-decoration:none;letter-spacing:0.03em;">{esc(pref_name)}のテロワールを見る — 日本酒・ワイン・焼酎・ウイスキーを横断 →</a></div>
<footer>
  <p><a href="/">Terroir HUB WHISKY</a> &copy; 2026 合同会社FOMUS</p>
</footer>
<script>
const B={json_str};
const WLABELS={{'malt':'モルト','grain':'グレーン','blended':'ブレンデッド','blended_malt':'BM','single_cask':'シングルカスク'}};
const areas=[...new Set(B.map(b=>b.area).filter(Boolean))].sort();
const types=[...new Set(B.map(b=>b.whisky_type).filter(Boolean))];
let curArea='',curType='';
function renderFilters(){{
  const f=document.getElementById('filters');
  let h='<button class="filter-btn active" onclick="curArea=\\'\\';curType=\\'\\';renderFilters();render()">すべて</button>';
  if(types.length>1)types.forEach(t=>{{h+='<button class="filter-btn'+(curType===t?' active':'')+'" onclick="curType=curType===\\''+t+'\\'?\\'\\':'+JSON.stringify(t)+';curArea=\\'\\';renderFilters();render()">'+((WLABELS[t]||t))+'</button>';}});
  if(areas.length>1)areas.forEach(a=>{{h+='<button class="filter-btn'+(curArea===a?' active':'')+'" onclick="curArea=curArea===\\''+a.replace(/'/g,"\\\\'")+'\\' ?\\'\\':'+JSON.stringify(a)+';curType=\\'\\';renderFilters();render()">'+a+'</button>';}});
  f.innerHTML=h;
}}
function render(){{
  const g=document.getElementById('grid');
  const filtered=B.filter(b=>(!curArea||b.area===curArea)&&(!curType||b.whisky_type===curType));
  if(!filtered.length){{g.innerHTML='<div class="empty">該当する蒸留所がありません</div>';return;}}
  g.innerHTML=filtered.map(b=>{{
    const tags=[];
    if(b.whisky_type&&WLABELS[b.whisky_type])tags.push(WLABELS[b.whisky_type]);
    if(b.cask_type)tags.push(b.cask_type.split('・')[0]);
    if(b.age_statement&&b.age_statement!=='NAS')tags.push(b.age_statement+'年');
    return '<a class="card" href="/whisky/{pref_slug}/'+b.id+'.html">'+
      '<div class="card-name">'+b.name+'</div>'+
      (b.brand?'<div class="card-brand">'+b.brand+'</div>':'')+
      '<div class="card-meta">'+(b.area||'')+(b.founded?' ・ 創業'+b.founded+'年':'')+'</div>'+
      (b.desc?'<div class="card-desc">'+b.desc+'</div>':'')+
      (tags.length?'<div class="card-tags">'+tags.map(t=>'<span class="tag">'+t+'</span>').join('')+'</div>':'')+
    '</a>';
  }}).join('');
}}
renderFilters();render();
</script>
</body>
</html>'''

# Main
json_files = sorted(glob.glob(os.path.join(BASE, 'data', 'data_*_distilleries.json')))
total = 0

for jf in json_files:
    pref = os.path.basename(jf).replace('data_', '').replace('_distilleries.json', '')
    with open(jf, 'r', encoding='utf-8') as f:
        distilleries = json.load(f)

    if not distilleries:
        print(f"  {pref}: 0 distilleries (skipped)")
        continue

    html = generate_pref_index(pref, distilleries)
    if html:
        out_dir = os.path.join(BASE, 'whisky', pref)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html)
        total += 1
        print(f"  {pref}: {len(distilleries)} distilleries → index.html")

print(f"\nDone: {total} prefecture index pages generated")
