
// ═══════════════════════════════════════════
//  State
// ═══════════════════════════════════════════
let STATE = {
  token: localStorage.getItem('token') || null,
  username: localStorage.getItem('username') || null,
  name: localStorage.getItem('name') || null,
  currentStore: null,
  selectedStar: 0,
  rouletteMenu: null,
  uploadedImageUrl: null,
};

// ═══════════════════════════════════════════
//  API Helper
// ═══════════════════════════════════════════
async function api(method, url, body=null, isForm=false) {
  const opts = {
    method,
    headers: STATE.token ? {'X-Auth-Token': STATE.token} : {},
  };
  if (body && !isForm) { opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(body); }
  if (isForm) opts.body = body;
  try {
    const res = await fetch(url, opts);
    const data = await res.json();
    return {ok: res.ok, status: res.status, data};
  } catch(e) { return {ok:false, data:{error:'네트워크 오류'}}; }
}

// ═══════════════════════════════════════════
//  Page Navigation
// ═══════════════════════════════════════════
function go(pageId) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  if(pageId==='page-main') { loadStores(); updateHeader(); }
  if(pageId==='page-main' && document.getElementById('tab-fav').classList.contains('active')) loadFavorites();
}

function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
  if(tabId==='tab-fav') loadFavorites();
  if(tabId==='tab-list') loadStoreList();
}

// ═══════════════════════════════════════════
//  Toast
// ═══════════════════════════════════════════
function toast(msg, duration=2200) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>el.classList.add('hidden'), duration);
}

// ═══════════════════════════════════════════
//  Auth
// ═══════════════════════════════════════════
async function doLogin() {
  const u=document.getElementById('login-id').value.trim();
  const p=document.getElementById('login-pw').value;
  const errEl=document.getElementById('login-err');
  errEl.textContent='';
  if(!u||!p){errEl.textContent='아이디와 비밀번호를 입력하세요.';return;}
  const r = await api('POST','/api/auth/login',{username:u,password:p});
  if(r.ok){
    STATE.token=r.data.token; STATE.username=r.data.username; STATE.name=r.data.name;
    localStorage.setItem('token',STATE.token);
    localStorage.setItem('username',STATE.username);
    localStorage.setItem('name',STATE.name);
    go('page-main');
  } else { errEl.textContent=r.data.error; }
}

async function doRegister() {
  const u=document.getElementById('reg-id').value.trim();
  const p=document.getElementById('reg-pw').value;
  const n=document.getElementById('reg-name').value.trim();
  const e=document.getElementById('reg-email').value.trim();
  const errEl=document.getElementById('reg-err');
  errEl.textContent='';
  if(!u||!p){errEl.textContent='아이디와 비밀번호는 필수입니다.';return;}
  const r=await api('POST','/api/auth/register',{username:u,password:p,name:n,email:e});
  if(r.ok){toast('✅ 회원가입 완료! 로그인해주세요.');go('page-login');}
  else{errEl.textContent=r.data.error;}
}

async function doLogout() {
  await api('POST','/api/auth/logout');
  STATE.token=STATE.username=STATE.name=null;
  localStorage.clear();
  go('page-login');
}

function updateHeader() {
  document.getElementById('header-user').textContent = STATE.name ? `👤 ${STATE.name}` : '';
}

// ═══════════════════════════════════════════
//  Roulette  [UC-03]
// ═══════════════════════════════════════════
async function startRoulette() {
  const btn = document.getElementById('roulette-btn');
  const ring = document.getElementById('roulette-ring');
  const emoji = document.getElementById('roulette-emoji');
  const label = document.getElementById('roulette-label');
  const resultEl = document.getElementById('roulette-result');
  const findBtn = document.getElementById('find-store-btn');

  btn.disabled = true; ring.classList.add('spinning');
  resultEl.classList.add('hidden'); findBtn.classList.add('hidden');

  // 룰렛 애니메이션 (0.8초)
  const emojis=['🍜','🍔','🥩','🍣','🍗','🍕','🍲','🌶️'];
  let i=0;
  const anim=setInterval(()=>{emoji.textContent=emojis[i%emojis.length];i++;},120);

  const cat=document.getElementById('flt-category').value;
  const wx=document.getElementById('flt-weather').value;
  const pr=document.getElementById('flt-price').value;

  let url='/api/menus/random?';
  if(cat) url+=`category=${cat}&`;
  if(wx)  url+=`weather=${wx}&`;
  if(pr)  url+=`max_price=${pr}&`;

  const r=await api('GET',url);
  await new Promise(res=>setTimeout(res,800));
  clearInterval(anim);
  ring.classList.remove('spinning');
  btn.disabled=false;

  if(r.ok){
    const m=r.data; STATE.rouletteMenu=m;
    emoji.textContent=m.img; label.textContent=m.name;
    resultEl.innerHTML=`<span class="menu-emoji">${m.img}</span>${m.name} 어때요?<br><small style="opacity:.85;font-weight:400">${m.category} · 약 ${m.price.toLocaleString()}원</small>`;
    resultEl.classList.remove('hidden');
    findBtn.classList.remove('hidden');
  } else {
    emoji.textContent='😢'; label.textContent='없음';
    toast('⚠️ '+r.data.error);
  }
}

async function findStores() {
  if(!STATE.rouletteMenu) return;
  // 메뉴명으로 가게 검색
  let url=`/api/stores?menu=${STATE.rouletteMenu.name}`;
  const r=await api('GET',url);
  if(r.ok && r.data.length>0){
    // 지도 탭으로 이동
    document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById('tab-map').classList.add('active');
    document.querySelector('.tab-btn').classList.add('active');
    renderMap(r.data);
    toast(`📍 ${r.data.length}곳의 맛집을 찾았어요!`);
  } else {
    toast('😢 주변에 해당 메뉴 가게가 없어요.');
  }
}

// ═══════════════════════════════════════════
//  Store Loader  [UC-05, UC-08]
// ═══════════════════════════════════════════
async function loadStores() {
  const onlyOpen=document.getElementById('chk-open')?.checked||false;
  const sort=document.getElementById('srt-by')?.value||'distance';
  let url=`/api/stores?sort=${sort}${onlyOpen?'&only_open=true':''}`;
  const r=await api('GET',url);
  if(r.ok){ renderMap(r.data); renderStoreList(r.data, 'store-list'); }
}

async function loadStoreList() {
  const sort=document.getElementById('srt-by')?.value||'distance';
  const url=`/api/stores?sort=${sort}`;
  const r=await api('GET',url);
  if(r.ok) renderStoreList(r.data,'store-list');
}

// ═══════════════════════════════════════════
//  Map Render  [UC-06, UC-08]
// ═══════════════════════════════════════════
// 위도/경도 → 지도 픽셀 변환 (목업 기준)
function latLngToXY(lat,lng){
  const BASE_LAT=35.860, BASE_LNG=128.615;
  const x=50+(lng-BASE_LNG)*2200;
  const y=50-(lat-BASE_LAT)*2200;
  return {x:Math.min(Math.max(x,5),95), y:Math.min(Math.max(y,5),95)};
}

const CATEGORY_ICON={'한식':'🍚','중식':'🥢','일식':'🍱','양식':'🍝'};

function renderMap(stores){
  const container=document.getElementById('map-markers');
  container.innerHTML='';
  stores.forEach(s=>{
    const {x,y}=latLngToXY(s.lat,s.lng);
    const div=document.createElement('div');
    div.className='map-marker';
    div.style.cssText=`left:${x}%;top:${y}%`;
    const icon=CATEGORY_ICON[s.category]||'📍';
    div.innerHTML=`
      <span class="marker-pin${s.is_open?'':' muted'}">${icon}</span>
      <span class="marker-name${s.is_open?'':' muted'}">${s.name}</span>`;
    div.onclick=()=>showMapPopup(s);
    container.appendChild(div);
  });
}

function showMapPopup(store){
  const popup=document.getElementById('map-info-popup');
  const statusHtml=store.is_open
    ?`<span class="popup-status open">● 영업중</span>`
    :`<span class="popup-status closed">● 영업종료</span>`;
  popup.innerHTML=`
    <div class="popup-head">
      <span class="popup-name">${CATEGORY_ICON[store.category]||'🏠'} ${store.name}</span>
      <button class="popup-close" onclick="document.getElementById('map-info-popup').classList.add('hidden')">✕</button>
    </div>
    <div class="popup-meta">⭐${store.rating} · ${store.distance}km · ${store.price_range}</div>
    <div>${statusHtml} ${store.open_time}~${store.close_time}</div>
    ${!store.is_open?'<div style="font-size:.75rem;color:#e53935;margin-top:4px">현재 영업시간 외입니다.</div>':''}
    <button class="popup-detail-btn" onclick="openDetail('${store.id}')">상세 정보 보기</button>`;
  popup.classList.remove('hidden');
}

// ═══════════════════════════════════════════
//  Store List Render
// ═══════════════════════════════════════════
function renderStoreList(stores, containerId){
  const el=document.getElementById(containerId);
  if(!el) return;
  if(!stores.length){el.innerHTML='<div class="empty-msg">표시할 가게가 없습니다.</div>';return;}
  el.innerHTML=stores.map(s=>`
    <div class="store-card${s.is_open?'':' muted'}" onclick="openDetail('${s.id}')">
      <div class="store-icon">${CATEGORY_ICON[s.category]||'🏠'}</div>
      <div class="store-info">
        <div class="store-name">
          ${s.name}
          ${s.is_open?'<span class="open-badge">영업중</span>':'<span class="closed-badge">영업종료</span>'}
        </div>
        <div class="store-meta">${s.category} · ${s.distance}km · ${s.price_range}</div>
        <div class="store-meta">${s.open_time}~${s.close_time}</div>
      </div>
      <div class="store-rating">⭐${s.rating}</div>
    </div>`).join('');
}

// ═══════════════════════════════════════════
//  Favorites  [UC-04]
// ═══════════════════════════════════════════
async function loadFavorites(){
  if(!STATE.token){document.getElementById('fav-list').innerHTML='<div class="empty-msg">로그인이 필요합니다.</div>';return;}
  const r=await api('GET','/api/favorites');
  if(r.ok) renderStoreList(r.data,'fav-list');
  else document.getElementById('fav-list').innerHTML='<div class="empty-msg">즐겨찾기가 없습니다.</div>';
}

async function toggleFavorite(){
  if(!STATE.currentStore) return;
  const sid=STATE.currentStore;
  const btn=document.getElementById('fav-btn');
  const isFav=btn.classList.contains('active');
  const method=isFav?'DELETE':'POST';
  const r=await api(method,`/api/favorites/${sid}`);
  if(r.ok){
    btn.classList.toggle('active');
    btn.textContent=isFav?'☆':'★';
    toast(isFav?'즐겨찾기 해제':'⭐ 즐겨찾기 추가');
  }
}

// ═══════════════════════════════════════════
//  Store Detail  [UC-07]
// ═══════════════════════════════════════════
async function openDetail(sid){
  STATE.currentStore=sid; STATE.selectedStar=0; STATE.uploadedImageUrl=null;
  document.getElementById('img-preview').classList.add('hidden');
  document.getElementById('review-img').value='';
  document.getElementById('review-err').textContent='';
  document.getElementById('review-text').value='';
  setStar(0);

  const r=await api('GET',`/api/stores/${sid}`);
  if(!r.ok){toast('가게 정보를 불러올 수 없어요.');return;}
  const s=r.data;
  const statusHtml=s.is_open
    ?'<span class="open-badge" style="font-size:.85rem">● 영업중</span>'
    :'<span class="closed-badge" style="font-size:.85rem">● 영업종료</span>';

  document.getElementById('detail-content').innerHTML=`
    <div class="detail-hero">
      <span class="detail-hero-emoji">${CATEGORY_ICON[s.category]||'🏠'}</span>
      <h2>${s.name}</h2>
      <div class="detail-hero-meta">⭐${s.avg_rating} · ${s.distance}km · ${statusHtml}</div>
    </div>
    <div class="detail-section">
      <h3>📋 기본 정보</h3>
      <div class="detail-row"><span class="detail-label">카테고리</span><span class="detail-val">${s.category}</span></div>
      <div class="detail-row"><span class="detail-label">대표 메뉴</span><span class="detail-val">${s.menu}</span></div>
      <div class="detail-row"><span class="detail-label">가격대</span><span class="detail-val">${s.price_range}</span></div>
      <div class="detail-row"><span class="detail-label">영업시간</span><span class="detail-val">${s.open_time} ~ ${s.close_time}</span></div>
      <div class="detail-row"><span class="detail-label">전화</span><span class="detail-val">${s.phone}</span></div>
      <div class="detail-row"><span class="detail-label">주소</span><span class="detail-val">${s.address}</span></div>
    </div>
    <div class="detail-section">
      <h3>💬 설명</h3>
      <p style="font-size:.88rem;color:#444;line-height:1.6">${s.description}</p>
      <div class="tag-list">${s.tags.map(t=>`<span class="tag">#${t}</span>`).join('')}</div>
    </div>`;

  // 즐겨찾기 상태 확인
  const favBtn=document.getElementById('fav-btn');
  favBtn.textContent='☆'; favBtn.classList.remove('active');
  if(STATE.token){
    const fr=await api('GET',`/api/favorites/${sid}/check`);
    if(fr.ok && fr.data.is_favorite){ favBtn.textContent='★'; favBtn.classList.add('active'); }
  }

  renderReviews(s.reviews);
  go('page-detail');
}

function renderReviews(reviews){
  const el=document.getElementById('review-list');
  if(!reviews||!reviews.length){el.innerHTML='<div class="empty-msg" style="padding:20px">아직 리뷰가 없습니다.</div>';return;}
  el.innerHTML=reviews.map(rv=>`
    <div class="review-card">
      <div class="rv-head">
        <span class="rv-user">👤 ${rv.username}</span>
        <span class="rv-stars">${'★'.repeat(rv.rating)}${'☆'.repeat(5-rv.rating)}</span>
        ${STATE.username===rv.username?`<button class="rv-del" onclick="deleteReview('${rv.id}')">삭제</button>`:''}
      </div>
      <div class="rv-date">${rv.created_at}</div>
      <div class="rv-text">${rv.text||''}</div>
      ${rv.image?`<img src="${rv.image}" class="rv-img">`:''}
    </div>`).join('');
}

// ─── 별점 ───
function setStar(n){
  STATE.selectedStar=n;
  document.querySelectorAll('#star-select span').forEach((s,i)=>{
    s.classList.toggle('active',i<n);
  });
}

// ─── 이미지 미리보기 + 업로드  [UC-12] ───
async function previewImg(input){
  const file=input.files[0]; if(!file) return;
  const prev=document.getElementById('img-preview');
  prev.src=URL.createObjectURL(file); prev.classList.remove('hidden');

  if(!STATE.token){toast('로그인이 필요합니다.');return;}
  const fd=new FormData(); fd.append('image',file);
  const r=await api('POST','/api/upload',fd,true);
  if(r.ok) STATE.uploadedImageUrl=r.data.url;
  else toast('이미지 업로드 실패: '+r.data.error);
}

// ─── 리뷰 등록  [UC-09] ───
async function submitReview(){
  if(!STATE.token){toast('로그인이 필요합니다.');return;}
  const text=document.getElementById('review-text').value.trim();
  const errEl=document.getElementById('review-err');
  errEl.textContent='';
  if(!STATE.selectedStar){errEl.textContent='별점을 선택해주세요.';return;}
  if(!text){errEl.textContent='리뷰 내용을 입력해주세요.';return;}
  const r=await api('POST',`/api/stores/${STATE.currentStore}/reviews`,{
    rating:STATE.selectedStar, text, image:STATE.uploadedImageUrl||''
  });
  if(r.ok){
    toast('✅ 리뷰가 등록되었습니다!');
    document.getElementById('review-text').value='';
    document.getElementById('img-preview').classList.add('hidden');
    STATE.selectedStar=0; STATE.uploadedImageUrl=null; setStar(0);
    const sr=await api('GET',`/api/stores/${STATE.currentStore}`);
    if(sr.ok) renderReviews(sr.data.reviews);
  } else { errEl.textContent=r.data.error; }
}

// ─── 리뷰 삭제  [UC-10] ───
async function deleteReview(rid){
  if(!confirm('리뷰를 삭제하시겠습니까?')) return;
  const r=await api('DELETE',`/api/stores/${STATE.currentStore}/reviews/${rid}`);
  if(r.ok){
    toast('🗑 리뷰가 삭제되었습니다.');
    const sr=await api('GET',`/api/stores/${STATE.currentStore}`);
    if(sr.ok) renderReviews(sr.data.reviews);
  } else { toast(r.data.error); }
}

// ═══════════════════════════════════════════
//  Identity Verify  [UC-11]
// ═══════════════════════════════════════════
function sendVerifyCode(){
  const name=document.getElementById('verify-name').value.trim();
  const birth=document.getElementById('verify-birth').value.trim();
  if(!name||!birth){toast('이름과 생년월일을 입력해주세요.');return;}
  document.getElementById('verify-code-area').classList.remove('hidden');
  toast('📱 인증번호를 전송했습니다. (테스트: 123456)');
}

async function submitVerify(){
  const code=document.getElementById('verify-code').value.trim();
  const errEl=document.getElementById('verify-err');
  errEl.textContent='';
  const r=await api('POST','/api/auth/verify',{code});
  if(r.ok){toast('✅ 본인인증 완료!');go('page-main');}
  else{errEl.textContent=r.data.error;}
}

// ═══════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════
window.addEventListener('load',()=>{
  setTimeout(()=>{
    if(STATE.token) go('page-main');
    else go('page-login');
  }, 1200);
});
