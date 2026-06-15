
import os, json, time, random, hashlib, uuid
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, session, send_from_directory, render_template

app = Flask(__name__)
app.secret_key = "오늘뭐먹지_secret_2026"
UPLOAD_FOLDER = "/tmp"

# ═══════════════════════════════════════════════
#  In-Memory DB  (HashMap 구조)
# ═══════════════════════════════════════════════
USERS = {}          # {username: {password_hash, name, email}}
FAVORITES = {}      # {username: set(store_id)}
REVIEWS = {}        # {store_id: [{id, username, rating, text, image, created_at}]}
SESSIONS = {}       # {token: username}

MENUS = [
    {"id":"m1","name":"삼겹살","category":"한식","price":15000,"weather":["맑음","흐림","비","눈"],"img":"🥩"},
    {"id":"m2","name":"짜장면","category":"중식","price":7000,"weather":["맑음","흐림"],"img":"🍜"},
    {"id":"m3","name":"스시","category":"일식","price":20000,"weather":["맑음"],"img":"🍣"},
    {"id":"m4","name":"햄버거","category":"양식","price":8000,"weather":["맑음","흐림","비"],"img":"🍔"},
    {"id":"m5","name":"국밥","category":"한식","price":9000,"weather":["흐림","비","눈"],"img":"🍲"},
    {"id":"m6","name":"파스타","category":"양식","price":14000,"weather":["맑음","흐림"],"img":"🍝"},
    {"id":"m7","name":"치킨","category":"한식","price":20000,"weather":["맑음","흐림","비","눈"],"img":"🍗"},
    {"id":"m8","name":"라멘","category":"일식","price":11000,"weather":["흐림","비","눈"],"img":"🍜"},
    {"id":"m9","name":"피자","category":"양식","price":18000,"weather":["맑음","흐림","비"],"img":"🍕"},
    {"id":"m10","name":"김치찌개","category":"한식","price":8000,"weather":["흐림","비","눈"],"img":"🍲"},
    {"id":"m11","name":"초밥","category":"일식","price":25000,"weather":["맑음"],"img":"🍱"},
    {"id":"m12","name":"떡볶이","category":"한식","price":5000,"weather":["흐림","비","눈"],"img":"🌶️"},
]

# 식당 HashMap: key=store_id
STORES = {
    "s1":{"id":"s1","name":"황금돼지 삼겹살","category":"한식","menu":"삼겹살","rating":4.5,"distance":0.3,
          "address":"대구 수성구 범어동 123","phone":"053-111-1111","price_range":"1~2만원",
          "open_time":"11:00","close_time":"22:00","lat":35.858,"lng":128.630,
          "description":"30년 전통의 숯불 삼겹살 전문점","tags":["주차가능","단체석"]},
    "s2":{"id":"s2","name":"홍콩반점","category":"중식","menu":"짜장면","rating":4.2,"distance":0.5,
          "address":"대구 수성구 만촌동 45","phone":"053-222-2222","price_range":"1만원 이하",
          "open_time":"10:00","close_time":"21:00","lat":35.856,"lng":128.625,
          "description":"정통 중화요리 전문점","tags":["배달가능","포장가능"]},
    "s3":{"id":"s3","name":"스시 오마카세","category":"일식","menu":"스시","rating":4.8,"distance":1.2,
          "address":"대구 중구 동성로 78","phone":"053-333-3333","price_range":"3만원 이상",
          "open_time":"12:00","close_time":"22:00","lat":35.869,"lng":128.598,
          "description":"신선한 제철 재료의 오마카세","tags":["예약필수","주차가능"]},
    "s4":{"id":"s4","name":"버거킹 범어점","category":"양식","menu":"햄버거","rating":3.8,"distance":0.2,
          "address":"대구 수성구 범어동 200","phone":"053-444-4444","price_range":"1만원 이하",
          "open_time":"09:00","close_time":"23:00","lat":35.860,"lng":128.632,
          "description":"화염 직화 버거 전문점","tags":["배달가능","포장가능","주차가능"]},
    "s5":{"id":"s5","name":"할매국밥","category":"한식","menu":"국밥","rating":4.6,"distance":0.8,
          "address":"대구 남구 이천동 34","phone":"053-555-5555","price_range":"1만원 이하",
          "open_time":"06:00","close_time":"15:00","lat":35.848,"lng":128.591,
          "description":"새벽부터 끓인 진한 국밥","tags":["이른아침","포장가능"]},
    "s6":{"id":"s6","name":"파스타빌","category":"양식","menu":"파스타","rating":4.3,"distance":1.5,
          "address":"대구 중구 삼덕동 90","phone":"053-666-6666","price_range":"1~2만원",
          "open_time":"11:30","close_time":"21:30","lat":35.872,"lng":128.601,
          "description":"이탈리안 수제 파스타 전문점","tags":["데이트","분위기좋음"]},
    "s7":{"id":"s7","name":"교촌치킨 수성점","category":"한식","menu":"치킨","rating":4.1,"distance":0.4,
          "address":"대구 수성구 수성동 55","phone":"053-777-7777","price_range":"2~3만원",
          "open_time":"16:00","close_time":"01:00","lat":35.855,"lng":128.618,
          "description":"간장 치킨의 원조","tags":["배달가능","포장가능"]},
    "s8":{"id":"s8","name":"이치란 라멘","category":"일식","menu":"라멘","rating":4.4,"distance":2.0,
          "address":"대구 중구 동성로 112","phone":"053-888-8888","price_range":"1~2만원",
          "open_time":"11:00","close_time":"23:00","lat":35.870,"lng":128.596,
          "description":"일본 정통 돈코츠 라멘","tags":["혼밥가능","웨이팅있음"]},
}

def _hash(pw): return hashlib.sha256(pw.encode()).hexdigest()

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("X-Auth-Token") or session.get("token")
        if not token or token not in SESSIONS:
            return jsonify({"error":"로그인이 필요합니다."}), 401
        request.username = SESSIONS[token]
        return f(*args, **kwargs)
    return decorated

def _is_open(store):
    now = datetime.now().strftime("%H:%M")
    o, c = store["open_time"], store["close_time"]
    if c < o:  # 자정 넘김 (예: 16:00~01:00)
        return now >= o or now <= c
    return o <= now <= c

def merge_sort(arr, key_fn):
    if len(arr) <= 1: return arr
    mid = len(arr) // 2
    L = merge_sort(arr[:mid], key_fn)
    R = merge_sort(arr[mid:], key_fn)
    result, i, j = [], 0, 0
    while i < len(L) and j < len(R):
        if key_fn(L[i]) <= key_fn(R[j]): result.append(L[i]); i+=1
        else: result.append(R[j]); j+=1
    result.extend(L[i:]); result.extend(R[j:])
    return result

# ───────── Routes ─────────
@app.route("/")
def index(): return render_template("index.html")

@app.route("/uploads/<filename>")
def uploaded_file(filename): return send_from_directory(UPLOAD_FOLDER, filename)

# ── Auth ──
@app.route("/api/auth/register", methods=["POST"])
def register():
    d = request.json
    u, pw, name, email = d.get("username",""), d.get("password",""), d.get("name",""), d.get("email","")
    if not u or not pw: return jsonify({"error":"아이디와 비밀번호를 입력하세요."}), 400
    if u in USERS: return jsonify({"error":"이미 존재하는 아이디입니다."}), 409
    USERS[u] = {"password_hash":_hash(pw),"name":name,"email":email,"verified":False}
    return jsonify({"message":"회원가입 완료"})

@app.route("/api/auth/login", methods=["POST"])
def login():
    d = request.json
    u, pw = d.get("username",""), d.get("password","")
    user = USERS.get(u)
    if not user or user["password_hash"] != _hash(pw):
        return jsonify({"error":"아이디 또는 비밀번호가 틀렸습니다."}), 401
    token = str(uuid.uuid4())
    SESSIONS[token] = u
    session["token"] = token
    return jsonify({"token":token,"name":user["name"],"username":u})

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = request.headers.get("X-Auth-Token") or session.get("token")
    if token in SESSIONS: del SESSIONS[token]
    session.clear()
    return jsonify({"message":"로그아웃"})

@app.route("/api/auth/verify", methods=["POST"])
def verify():
    d = request.json
    if d.get("code") == "123456":
        token = request.headers.get("X-Auth-Token") or session.get("token")
        if token and token in SESSIONS:
            USERS[SESSIONS[token]]["verified"] = True
        return jsonify({"message":"본인인증 완료","success":True})
    return jsonify({"error":"인증번호가 틀렸습니다. (테스트 코드: 123456)","success":False}), 400

# ── Menus ──
@app.route("/api/menus/random")
def random_menu():
    filters = request.args
    pool = MENUS
    if filters.get("category"): pool = [m for m in pool if m["category"]==filters["category"]]
    if filters.get("max_price"): pool = [m for m in pool if m["price"]<=int(filters["max_price"])]
    if filters.get("weather"): pool = [m for m in pool if filters["weather"] in m["weather"]]
    if not pool: return jsonify({"error":"조건에 맞는 메뉴가 없습니다."}), 404
    return jsonify(random.choice(pool))

@app.route("/api/menus/all")
def all_menus(): return jsonify(MENUS)

# ── Stores ──
@app.route("/api/stores")
def get_stores():
    args = request.args
    stores = list(STORES.values())
    # 영업시간 필터 + is_open 상태 추가
    for s in stores: s["is_open"] = _is_open(s)
    if args.get("menu"): stores = [s for s in stores if s.get("menu")==args["menu"]]
    if args.get("category"): stores = [s for s in stores if s["category"]==args["category"]]
    if args.get("only_open")=="true": stores = [s for s in stores if s["is_open"]]
    # Merge Sort 정렬
    sort_by = args.get("sort","distance")
    reverse = args.get("order","asc") == "desc"
    if sort_by == "rating":
        stores = merge_sort(stores, lambda x: -x["rating"] if reverse else x["rating"])
        if reverse: stores = list(reversed(stores))
    else:
        stores = merge_sort(stores, lambda x: x["distance"])
        if reverse: stores = list(reversed(stores))
    return jsonify(stores)

@app.route("/api/stores/<sid>")
def get_store(sid):
    s = STORES.get(sid)
    if not s: return jsonify({"error":"없음"}), 404
    result = dict(s); result["is_open"] = _is_open(s)
    result["reviews"] = REVIEWS.get(sid, [])
    result["avg_rating"] = round(
        sum(r["rating"] for r in result["reviews"])/len(result["reviews"]),1
    ) if result["reviews"] else s["rating"]
    return jsonify(result)

# ── Reviews ──
@app.route("/api/stores/<sid>/reviews", methods=["POST"])
@login_required
def add_review(sid):
    if sid not in STORES: return jsonify({"error":"없음"}), 404
    d = request.json
    review = {
        "id": str(uuid.uuid4())[:8],
        "username": request.username,
        "rating": int(d.get("rating",3)),
        "text": d.get("text",""),
        "image": d.get("image",""),
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    REVIEWS.setdefault(sid,[]).append(review)
    return jsonify(review)

@app.route("/api/stores/<sid>/reviews/<rid>", methods=["DELETE"])
@login_required
def delete_review(sid, rid):
    reviews = REVIEWS.get(sid,[])
    target = next((r for r in reviews if r["id"]==rid),None)
    if not target: return jsonify({"error":"없음"}),404
    if target["username"] != request.username: return jsonify({"error":"권한 없음"}),403
    REVIEWS[sid] = [r for r in reviews if r["id"]!=rid]
    return jsonify({"message":"삭제 완료"})

# ── Favorites ──
@app.route("/api/favorites", methods=["GET"])
@login_required
def get_favorites():
    fav_ids = list(FAVORITES.get(request.username, set()))
    return jsonify([{**STORES[sid],"is_open":_is_open(STORES[sid])} for sid in fav_ids if sid in STORES])

@app.route("/api/favorites/<sid>", methods=["POST","DELETE"])
@login_required
def toggle_favorite(sid):
    u = request.username
    FAVORITES.setdefault(u, set())
    if request.method=="POST":
        FAVORITES[u].add(sid)
        return jsonify({"message":"즐겨찾기 추가","is_favorite":True})
    else:
        FAVORITES[u].discard(sid)
        return jsonify({"message":"즐겨찾기 해제","is_favorite":False})

@app.route("/api/favorites/<sid>/check")
@login_required
def check_favorite(sid):
    return jsonify({"is_favorite": sid in FAVORITES.get(request.username, set())})

# ── Image Upload ──
@app.route("/api/upload", methods=["POST"])
@login_required
def upload_image():
    f = request.files.get("image")
    if not f: return jsonify({"error":"파일 없음"}),400
    ext = f.filename.rsplit(".",1)[-1].lower()
    if ext not in ["jpg","jpeg","png","gif","webp"]:
        return jsonify({"error":"지원하지 않는 형식"}),400
    fname = f"{uuid.uuid4().hex}.{ext}"
    f.save(os.path.join(UPLOAD_FOLDER, fname))
    return jsonify({"url":f"/uploads/{fname}"})

if __name__ == "__main__":
    # 기본 유저 추가
    USERS["admin"] = {"password_hash":_hash("1234"),"name":"관리자","email":"admin@test.com","verified":True}
    USERS["test"] = {"password_hash":_hash("1234"),"name":"테스터","email":"test@test.com","verified":False}
    app.run(debug=True, port=5000)
