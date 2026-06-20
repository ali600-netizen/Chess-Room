
const firebaseConfig = {
    apiKey: "AIzaSyCWL3DohN_BVmwlDjLYP_UohoKqnw4ylzU",
    authDomain: "chessroom-ca23f.firebaseapp.com",
    databaseURL: "https://chessroom-ca23f-default-rtdb.firebaseio.com/",
    projectId: "chessroom-ca23f",
    storageBucket: "chessroom-ca23f.firebasestorage.app"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();
const auth = firebase.auth();

class SoundEngine {
    constructor() {
        this.enabled = localStorage.getItem('chessSound') !== 'off';
        this.files = {
            move: 'sounds/Move.mp3', capture: 'sounds/Capture.mp3', check: 'sounds/Check.mp3',
            victory: 'sounds/Victory.mp3', defeat: 'sounds/Defeat.mp3', draw: 'sounds/Draw.mp3',
            count3: 'sounds/CountDown3.mp3', count2: 'sounds/CountDown2.mp3', count1: 'sounds/CountDown1.mp3'
        };
        this.cache = {};
    }
    _get(type) { if (!this.cache[type]) { this.cache[type] = new Audio(this.files[type]); } return this.cache[type]; }
    play(type) {
        if (!this.enabled || !this.files[type]) return;
        try { let a = this._get(type); a.currentTime = 0; a.play().catch(() => {}); } catch (e) { }
    }
    toggle() { this.enabled = !this.enabled; localStorage.setItem('chessSound', this.enabled ? 'on' : 'off'); return this.enabled; }
}
const sfx = new SoundEngine();

const PIECE_URIS = {
  "wK": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cpath fill='%23fff' stroke='%23000' stroke-width='1.5' d='M22.5 11.63V6M20 8h5M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath fill='%23fff' stroke='%23000' stroke-width='1.5' d='M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10.5 5 10.5v7z' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath fill='none' stroke='%23000' d='M15 30c3.7-3 10.3-3 14 0m-14 3.5c3.7-3 10.3-3 14 0m-14 3.5c3.7-3 10.3-3 14 0'/%3E%3C/svg%3E",
  "wQ": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cpath fill='%23fff' stroke='%23000' stroke-width='1.5' d='M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z'/%3E%3Cpath fill='%23fff' stroke='%23000' stroke-width='1.5' d='M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 1.5 4 .5 2.5.5 2.5 9.5 2.5s9 0 9.5-2.5c.5-3 .5-2.5 1.5-4 1-2 2.5-2 2.5-4-8.5-1.5-21-1.5-27 0z' stroke-linecap='round'/%3E%3Cpath fill='none' stroke='%23000' d='M15 30c2.4-1 12.6-1 15 0M15.5 33.5c4-1 10-1 14 0'/%3E%3C/svg%3E",
  "wR": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cpath fill='%23fff' stroke='%23000' stroke-width='1.5' stroke-linejoin='round' d='M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5'/%3E%3Cpath fill='%23fff' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M34 14l-3 3H14l-3-3'/%3E%3Cpath fill='%23fff' stroke='%23000' stroke-width='1.5' stroke-linejoin='round' d='M31 17v12.5H14V17'/%3E%3Cpath fill='none' stroke='%23000' d='M28 29.5l1.5 2.5h-14l1.5-2.5M14 14h17'/%3E%3C/svg%3E",
  "wB": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cg fill='%23fff' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z'/%3E%3Cpath d='M18.5 26h8M17 30h11m-6.5-14.5v5M20 18h5' fill='none' stroke-linejoin='miter'/%3E%3C/g%3E%3C/svg%3E",
  "wN": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cpath fill='%23fff' stroke='%23000' stroke-width='1.5' d='M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18'/%3E%3Cpath fill='%23fff' stroke='%23000' stroke-width='1.5' d='M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10'/%3E%3Cpath fill='%23fff' stroke='%23000' stroke-width='1.5' d='M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z'/%3E%3Cpath fill='none' stroke='%23000' stroke-width='1.5' stroke-linejoin='round' d='M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z' transform='matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)'/%3E%3C/svg%3E",
  "wP": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cpath d='M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z' fill='%23fff' stroke='%23000' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E",
  "bK": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cpath fill='%23000' stroke='%23000' stroke-width='1.5' d='M22.5 11.63V6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath fill='%23000' d='M20 8h5' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath fill='%23000' stroke='%23000' stroke-width='1.5' d='M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath fill='%23000' stroke='%23000' stroke-width='1.5' d='M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10.5 5 10.5v7z' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath fill='none' stroke='%23fff' d='M15 30c3.7-3 10.3-3 14 0m-14 3.5c3.7-3 10.3-3 14 0m-14 3.5c3.7-3 10.3-3 14 0'/%3E%3C/svg%3E",
  "bQ": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cpath fill='%23000' stroke='%23000' stroke-width='1.5' d='M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z'/%3E%3Cpath fill='%23000' stroke='%23000' stroke-width='1.5' d='M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 1.5 4 .5 2.5.5 2.5 9.5 2.5s9 0 9.5-2.5c.5-3 .5-2.5 1.5-4 1-2 2.5-2 2.5-4-8.5-1.5-21-1.5-27 0z' stroke-linecap='round'/%3E%3Cpath fill='none' stroke='%23fff' d='M15 30c2.4-1 12.6-1 15 0M15.5 33.5c4-1 10-1 14 0'/%3E%3C/svg%3E",
  "bR": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cpath fill='%23000' stroke='%23000' stroke-width='1.5' stroke-linejoin='round' d='M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5'/%3E%3Cpath fill='%23000' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M34 14l-3 3H14l-3-3'/%3E%3Cpath fill='%23000' stroke='%23000' stroke-width='1.5' stroke-linejoin='round' d='M31 17v12.5H14V17'/%3E%3Cpath fill='none' stroke='%23fff' stroke-linejoin='round' d='M28 29.5l1.5 2.5h-14l1.5-2.5M14 14h17'/%3E%3C/svg%3E",
  "bB": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cg fill='%23000' stroke='%23000' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z'/%3E%3Cpath d='M18.5 26h8M17 30h11m-6.5-14.5v5M20 18h5' fill='none' stroke='%23fff' stroke-linejoin='miter'/%3E%3C/g%3E%3C/svg%3E",
  "bN": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cpath fill='%23000' stroke='%23000' stroke-width='1.5' d='M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18'/%3E%3Cpath fill='%23000' stroke='%23000' stroke-width='1.5' d='M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10'/%3E%3Cpath fill='%23000' stroke='%23fff' stroke-width='1.5' d='M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z'/%3E%3Cpath fill='none' stroke='%23fff' stroke-width='1.5' stroke-linejoin='round' d='M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z' transform='matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)'/%3E%3C/svg%3E",
  "bP": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 45 45'%3E%3Cpath d='M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z' fill='%23000' stroke='%23000' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E"
};



function pieceIconURI(p) {
    if (!p) return PIECE_URIS["wP"];
    let color = p.charAt(0).toLowerCase();
    let type = p.charAt(1).toUpperCase();
    return PIECE_URIS[color + type] || PIECE_URIS["wP"];
}

$(document).ready(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');

    async function suggestAvailableRoomId() {
        for (let i = 0; i < 4; i++) {
            let candidate = String(Math.floor(1000 + Math.random() * 9000));
            try { let snap = await db.ref('rooms/' + candidate).once('value'); if (!snap.exists()) return candidate; }
            catch (e) { return candidate; }
        }
        return String(Math.floor(1000 + Math.random() * 9000));
    }

    if (roomFromUrl) {
        $('#roomId').val(roomFromUrl).prop('readonly', true).css('opacity', '0.6');
        $('#roomLockedBadge').addClass('visible');
    } else {
        suggestAvailableRoomId().then(id => $('#roomId').val(id));
    }

    $('#roomId').on('input', function() {
        if ($(this).prop('readonly')) return;
        let v = $(this).val().replace(/[^0-9]/g, '').slice(0, 6);
        $(this).val(v); $('#roomError').removeClass('visible');
    });

    var myUid = null; var myPresenceRef = null; var connectedRef = db.ref('.info/connected');
    var lastRoomSnapshot = null; var myUserName = localStorage.getItem('chessUserName') || '';
    $('#userName').val(myUserName);

    var game = new Chess(), board = null;
    var whiteSeconds = 0, blackSeconds = 0, incrementSeconds = 0;
    var timerInterval = null, selectedSquare = null, gameStarted = false;
    var isWaiting = false, isCountingDown = false;
    var abandonTimer = null, abandonSeconds = 30;
    var currentRoomId = null, myPlayerColor = 'white', activeRoomRef = null;
    var isGameEndHandled = false; var pendingPromotionMove = null; var materialScore = { w: 0, b: 0 };

    auth.signInAnonymously().catch(e => console.error("Auth:", e));
    auth.onAuthStateChanged(user => {
        if (user) { myUid = user.uid; $('#createBtn').prop('disabled', false).text(translations[currentLang].btnEnter); tryAutoResume(); }
    });

    setTimeout(function() { if (!myUid) { $('#createBtn').hide(); $('#connectionError').addClass('visible'); } }, 8000);
    $('#retryConnBtn').click(function() { location.reload(); });

    var currentLang = localStorage.getItem('chessLang') || 'ar';
    var currentTheme = localStorage.getItem('chessTheme') || 'royal';
    var currentBoardStyle = localStorage.getItem('chessBoardStyle') || 'solid';

    var translations = {
        ar: { siteTitle: "غرفة الشطرنج", phName: "اسمك الكريم...", labelRoom: "رقم الغرفة", labelMinutes: "الوقت", labelIncrement: "الزيادة", labelColor: "اللون", labelTheme: "المظهر", labelBoardStyle: "شكل الرقعة", colorRandom: "عشوائي", colorWhite: "أبيض", colorBlack: "أسود", themeRoyal: "ملكي وفضي", themeModern: "داكن حديث", themeForest: "خشبي أخضر", themeGray: "رصاصي وأسود", themeChesscom: "فاتح كلاسيكي", boardSolid: "مربعات سادة", boardHatched: "مربعات مخططة", btnEnter: "دخول الغرفة", playerOpponent: "الخصم", playerYou: "أنت", btnResign: "انسحاب", btnCopy: "نسخ النقلات", btnDraw: "طلب تعادل", btnCancel: "إلغاء المباراة", btnRematch: "إعادة التحدي", btnHome: "الرئيسية", msgWaiting: "بانتظار الخصم...", msgRematchOffer: "الخصم يطلب إعادة التحدي", msgDrawOffer: "الخصم يعرض التعادل", btnAccept: "موافق", btnDecline: "رفض", msgCopySuccess: "تم النسخ بنجاح", labelMoves: "نقلة", titleWinWhite: "فاز الأبيض", titleWinBlack: "فاز الأسود", titleDraw: "النتيجة تعادل", rsnCheckmate: "بكش مات", rsnResign: "بالانسحاب", rsnTimeout: "لنفاد الوقت", rsnStalemate: "بوضعية خنق", rsnRepetition: "بتكرار النقلات 3 مرات", rsnInsufficientMaterial: "لنقص العتاد", rsnFiftyMove: "بقاعدة الخمسين نقلة", rsnAgreed: "بالاتفاق", msgDisconnected: "انقطع الخصم... استسلام بعد", rsnAbandoned: "لانسحاب الخصم", promptPromotion: "اختر الترقية", msgRoomLocked: "🔒 مقفل من رابط مشترك", msgRoomInvalid: "أرقام فقط، من 3 إلى 6", labelName: "اسمك", msgConnFailed: "تعذّر الاتصال", btnRetry: "إعادة المحاولة", btnCancelPromo: "إلغاء", msgShareCopied: "تم نسخ رابط الغرفة!", msgRoomTaken: "هذا الرقم مستخدم حالياً." },
        en: { siteTitle: "Chess Room", phName: "Your Name...", labelRoom: "Room ID", labelMinutes: "Minutes", labelIncrement: "Increment", labelColor: "Color", labelTheme: "Theme", labelBoardStyle: "Board Style", colorRandom: "Random", colorWhite: "White", colorBlack: "Black", themeRoyal: "Royal Silver", themeModern: "Modern Dark", themeForest: "Forest Green", themeGray: "Gray & Black", themeChesscom: "Classic Light", boardSolid: "Solid Board", boardHatched: "Hatched Board", btnEnter: "Enter Room", playerOpponent: "Opponent", playerYou: "You", btnResign: "Resign", btnCopy: "Copy PGN", btnDraw: "Offer Draw", btnCancel: "Cancel Match", btnRematch: "Rematch", btnHome: "Main Menu", msgWaiting: "Waiting for opponent...", msgRematchOffer: "Opponent offered a rematch", msgDrawOffer: "Opponent offered a draw", btnAccept: "Accept", btnDecline: "Decline", msgCopySuccess: "Copied!", labelMoves: "Moves", titleWinWhite: "White Won", titleWinBlack: "Black Won", titleDraw: "Draw", rsnCheckmate: "by Checkmate", rsnResign: "by Resignation", rsnTimeout: "by Timeout", rsnStalemate: "by Stalemate", rsnRepetition: "by Repetition", rsnInsufficientMaterial: "by Insufficient Material", rsnFiftyMove: "by Fifty-Move Rule", rsnAgreed: "by Agreement", msgDisconnected: "Opponent left... auto-resign in", rsnAbandoned: "by Abandonment", promptPromotion: "Choose Promotion", msgRoomLocked: "🔒 Locked from link", msgRoomInvalid: "Numbers only, 3–6 digits", labelName: "Name", msgConnFailed: "Connection Failed", btnRetry: "Retry", btnCancelPromo: "Cancel", msgShareCopied: "Room link copied!", msgRoomTaken: "Room is in use." }
    };

    function updateMovesHistory() {
        if (!game) return;
        let pgnGame = new Chess(); pgnGame.load_pgn(game.pgn());
        let fullPGN = pgnGame.pgn();
        $('#movesHistory').text(fullPGN || (currentLang === 'ar' ? 'لا توجد نقلات بعد' : 'No moves yet'));
        let movesBox = document.getElementById("movesHistory");
        if (movesBox) { movesBox.scrollTop = movesBox.scrollHeight; }
    }

    function updatePlayerLabels(d) {
        if (!d) return;
        let oppColor = myPlayerColor === 'white' ? 'black' : 'white';
        let oppName = d[oppColor + 'Name']; let myName = d[myPlayerColor + 'Name'];
        $('#oppNameLabel').text(oppName || translations[currentLang].playerOpponent);
        $('#myNameLabel').text(myName || translations[currentLang].playerYou);
    }

    function applyLanguage(lang) {
        currentLang = lang; localStorage.setItem('chessLang', lang);
        $('body').attr('dir', lang === 'ar' ? 'rtl' : 'ltr');
        $('html').attr('lang', lang);
        $('#langToggleBtn').text(lang === 'ar' ? 'English' : 'العربية');
        
        document.title = translations[lang].siteTitle;
        $('#mainTitle').text(translations[lang].siteTitle);
        
        $('[data-key]').each(function() {
            var key = $(this).data('key');
            if (translations[lang][key]) { 
                if ($(this).is('option')) $(this).text(translations[lang][key]); 
                else if ($(this).attr('placeholder')) $(this).attr('placeholder', translations[lang][key]);
                else $(this).html(translations[lang][key]); 
            }
        });
        // إصلاح: بعض متصفحات الموبايل لا تُحدّث النص الظاهر في القائمة المغلقة فوراً
        // بعد تغيير نص الخيار المحدد، فنجبر إعادة الرسم بإعادة ضبط القيمة الحالية
        $('select').each(function() { $(this).val($(this).val()); });
        if (typeof syncAllSelectDisplays === 'function') syncAllSelectDisplays();
        if (typeof syncPickerDisplays === 'function') syncPickerDisplays();
        if (!myUid) { $('#createBtn').text(lang === 'ar' ? 'جاري الاتصال...' : 'Connecting...'); }
        if (lastRoomSnapshot) updatePlayerLabels(lastRoomSnapshot);
        if (board && $('#gameArea').is(':visible')) { setTimeout(function() { if (board) board.resize(); }, 50); }
    }

    function applyTheme(theme) {
        currentTheme = theme;
        $('body').removeClass('theme-modern theme-chesscom theme-royal theme-classic theme-forest theme-grayscale').addClass('theme-' + theme);
        localStorage.setItem('chessTheme', theme); $('#themeChoice').val(theme);
        syncPickerDisplays();
    }
    function applyBoardStyle(style) {
        currentBoardStyle = style;
        $('#board').removeClass('board-style-solid board-style-hatched').addClass('board-style-' + style);
        localStorage.setItem('chessBoardStyle', style); $('#boardStyleChoice').val(style);
        syncPickerDisplays();
    }

    // إصلاح: مزامنة النص الظاهر لكل قائمة منسدلة عند أي تغيير (تبديل لغة، تغيير قيمة، تحميل أولي)
    // لأن العنصر الحقيقي أصبح شفافاً يغطي الصف بالكامل، والنص الظاهر عنصر منفصل يجب تحديثه يدوياً
    function syncSelectDisplay(selectEl) {
        let $sel = $(selectEl);
        let $display = $sel.closest('.form-group').find('.value-text').first();
        $display.text($sel.find('option:selected').text());
    }
    function syncAllSelectDisplays() {
        $('#timeMinutes, #timeIncrement, #colorChoice').each(function() { syncSelectDisplay(this); });
    }

    const THEME_DEFS = [
        { id: 'grayscale', key: 'themeGray', light: '#f1f5f9', dark: '#64748b' },
        { id: 'royal', key: 'themeRoyal', light: '#F4F1EA', dark: '#1A2E73' },
        { id: 'modern', key: 'themeModern', light: '#cbd5e1', dark: '#475569' },
        { id: 'forest', key: 'themeForest', light: '#ebecd0', dark: '#487068' },
        { id: 'classic', key: 'themeChesscom', light: '#ebecd0', dark: '#739552' }
    ];
    const BOARD_STYLE_DEFS = [ { id: 'solid', key: 'boardSolid' }, { id: 'hatched', key: 'boardHatched' } ];

    function miniBoardHTML(light, dark, hatched) {
        let darkStyle = hatched
            ? `background-color:${dark};background-image:repeating-linear-gradient(45deg, rgba(0,0,0,0.35) 0, rgba(0,0,0,0.35) 1.5px, transparent 1.5px, transparent 5px);`
            : `background-color:${dark};`;
        let cells = [light, dark, dark, light];
        return cells.map(c => `<span style="background-color:${c};${c === dark ? darkStyle : ''}"></span>`).join('');
    }

    function syncPickerDisplays() {
        let theme = THEME_DEFS.find(t => t.id === currentTheme) || THEME_DEFS[0];
        $('#themeSwatchPreview').html(miniBoardHTML(theme.light, theme.dark, false));
        $('#themeChoiceDisplay').text(translations[currentLang][theme.key]);

        let isHatched = currentBoardStyle === 'hatched';
        $('#boardStyleSwatchPreview').html(miniBoardHTML(theme.light, theme.dark, isHatched));
        let styleDef = BOARD_STYLE_DEFS.find(s => s.id === currentBoardStyle) || BOARD_STYLE_DEFS[0];
        $('#boardStyleChoiceDisplay').text(translations[currentLang][styleDef.key]);
    }

    function buildThemeGrid() {
        let html = '';
        THEME_DEFS.forEach(t => {
            let active = t.id === currentTheme ? ' active' : '';
            html += `<div class="swatch-card${active}" data-theme="${t.id}">
                <div class="swatch-board">${miniBoardHTML(t.light, t.dark, false)}</div>
                <span class="swatch-name">${translations[currentLang][t.key]}</span>
            </div>`;
        });
        $('#themePickerGrid').html(html);
    }
    function buildBoardStyleGrid() {
        let theme = THEME_DEFS.find(t => t.id === currentTheme) || THEME_DEFS[0];
        let html = '';
        BOARD_STYLE_DEFS.forEach(s => {
            let active = s.id === currentBoardStyle ? ' active' : '';
            html += `<div class="swatch-card${active}" data-style="${s.id}">
                <div class="swatch-board">${miniBoardHTML(theme.light, theme.dark, s.id === 'hatched')}</div>
                <span class="swatch-name">${translations[currentLang][s.key]}</span>
            </div>`;
        });
        $('#boardStylePickerGrid').html(html);
    }

    $('#themePickerBtn').click(function() { buildThemeGrid(); $('#themePickerModal').fadeIn(150); });
    $('#boardStylePickerBtn').click(function() { buildBoardStyleGrid(); $('#boardStylePickerModal').fadeIn(150); });
    $(document).on('click', '#themePickerGrid .swatch-card', function() {
        applyTheme($(this).data('theme')); $('#themePickerModal').fadeOut(150);
    });
    $(document).on('click', '#boardStylePickerGrid .swatch-card', function() {
        applyBoardStyle($(this).data('style')); $('#boardStylePickerModal').fadeOut(150);
    });
    $('.picker-close').click(function() { $('.picker-overlay').fadeOut(150); });
    $('.picker-overlay').click(function(e) { if (e.target === this) $(this).fadeOut(150); });

    $('#langToggleBtn').click(function() { applyLanguage(currentLang === 'en' ? 'ar' : 'en'); });
    $('#timeMinutes, #timeIncrement, #colorChoice').change(function() { syncSelectDisplay(this); });

    $('#soundOffIcon').toggle(!sfx.enabled); $('#soundOnIcon').toggle(sfx.enabled);
    $('#soundToggleBtn').click(function() {
        let isOn = sfx.toggle(); $('#soundOnIcon').toggle(isOn); $('#soundOffIcon').toggle(!isOn); sfx._ensureCtx();
    });

    applyLanguage(currentLang); applyTheme(currentTheme); applyBoardStyle(currentBoardStyle);
    syncAllSelectDisplays(); syncPickerDisplays();

    document.getElementById('board') && document.getElementById('board').addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    $(document).on('contextmenu', '#board', function(e) { e.preventDefault(); });

    function formatTime(totalSeconds) { totalSeconds = Math.max(0, totalSeconds); let m = Math.floor(totalSeconds / 60); let s = totalSeconds % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }

    function updateTimersDisplay() {
        let oppColor = myPlayerColor === 'white' ? 'black' : 'white';
        let mySeconds = myPlayerColor === 'white' ? whiteSeconds : blackSeconds; let oppSeconds = oppColor === 'white' ? whiteSeconds : blackSeconds;
        $('#bottomTimer').text(formatTime(mySeconds)); $('#topTimer').text(formatTime(oppSeconds));
        $('#bottomTimer').toggleClass('danger', mySeconds <= 20); $('#topTimer').toggleClass('danger', oppSeconds <= 20);
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(function() {
            if (!gameStarted || game.game_over()) return;
            if (game.turn() === 'w') { whiteSeconds--; if (whiteSeconds <= 0) { activeRoomRef.update({ status: 'timeout_w' }); } } 
            else { blackSeconds--; if (blackSeconds <= 0) { activeRoomRef.update({ status: 'timeout_b' }); } }
            updateTimersDisplay();
        }, 1000);
    }

    function updateActiveTimerStyle() {
        let turn = game.turn();
        $('#bottomTimer').toggleClass('active', turn === myPlayerColor.charAt(0));
        $('#topTimer').toggleClass('active', turn !== myPlayerColor.charAt(0));
    }

    function stopTimer() { if (timerInterval) clearInterval(timerInterval); $('.timer').removeClass('active'); }

    function runCountdown() {
        isCountingDown = true;
        if (!lastRoomSnapshot || lastRoomSnapshot.playersCount !== 2) { isCountingDown = false; return; }
        $('#waitingOverlay').fadeOut(200); $('#interactiveOverlay').fadeOut(200);
        let count = 3; $('#countdownOverlay').text(count).fadeIn(200); sfx.play('count3');
        let countInt = setInterval(() => {
            count--;
            if (count > 0) { $('#countdownOverlay').text(count); sfx.play('count' + count); }
            else if (count === 0) { $('#countdownOverlay').text("GO!"); }
            else {
                clearInterval(countInt); $('#countdownOverlay').fadeOut(200);
                gameStarted = true; isCountingDown = false;
                updateActiveTimerStyle(); startTimer();
                let isMyTurn = (game.turn() === myPlayerColor.charAt(0));
                if (board) board.draggable(isMyTurn);
            }
        }, 1000);
    }

    var heartbeatInterval = null;
    function startHeartbeat() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        function beat() { if (activeRoomRef && myPlayerColor) { activeRoomRef.update({ [myPlayerColor + 'LastSeen']: firebase.database.ServerValue.TIMESTAMP }).catch(() => {}); } }
        beat(); heartbeatInterval = setInterval(beat, 4000);
    }
    function stopHeartbeat() { if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; } }

    function setupPresence() {
        if (!currentRoomId || !myPlayerColor) return;
        if (myPresenceRef) { myPresenceRef.onDisconnect().cancel(); }
        myPresenceRef = db.ref('rooms/' + currentRoomId + '/' + myPlayerColor + 'Online');
        connectedRef.on('value', function(snap) {
            if (snap.val() === true && myPresenceRef) {
                myPresenceRef.onDisconnect().set(false).catch(() => {}); myPresenceRef.set(true).catch(() => {});
            }
        });
        startHeartbeat();
    }

    /* إصلاح جلب القطع المأكولة بدقة */
    function updateCapturedPieces() {
        if (!game) return;
        const pVals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        const initC = { p: 8, n: 2, b: 2, r: 2, q: 1 };
        let curC = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
        let score = { w: 0, b: 0 };
        
        let brd = game.board();
        for (let r = 0; r < 8; r++) { 
            for (let c = 0; c < 8; c++) { 
                let pc = brd[r][c]; 
                if (pc) { curC[pc.color][pc.type]++; score[pc.color] += pVals[pc.type]; } 
            } 
        }
        
        let capByW = []; // قطع الخصم الأسود التي أكلها الأبيض
        let capByB = []; // قطع الخصم الأبيض التي أكلها الأسود
        
        ['q', 'r', 'b', 'n', 'p'].forEach(type => {
            let wLost = initC[type] - curC.w[type];
            let bLost = initC[type] - curC.b[type];
            for (let i = 0; i < bLost; i++) capByW.push({ color: 'b', type: type });
            for (let i = 0; i < wLost; i++) capByB.push({ color: 'w', type: type });
        });
        
        let wAdv = score.w - score.b; let bAdv = score.b - score.w;
        materialScore.w = score.w; materialScore.b = score.b;
        renderCaptured('w', capByW, wAdv); renderCaptured('b', capByB, bAdv);
    }

    function renderCaptured(color, pieces, adv) {
        let containerId = (color === myPlayerColor.charAt(0)) ? '#bottomCaptured' : '#topCaptured';
        let html = '';
        pieces.forEach(p => { 
            html += `<div class="captured-piece" style="background-image: url('${pieceIconURI(p.color + p.type)}');"></div>`; 
        });
        if (adv > 0) { html += `<span class="score-adv">+${adv}</span>`; }
        $(containerId).html(html);
    }

    function highlightLastMove(from, to) {
        $('#board .square-55d63').removeClass('highlight-last-move');
        if (from && to) { $('#board .square-' + from).addClass('highlight-last-move'); $('#board .square-' + to).addClass('highlight-last-move'); }
    }

    function clearHighlights() { $('#board .square-55d63').removeClass('highlight legal-move legal-move-capture'); }

    function highlightLegalMoves(square) {
        clearHighlights(); var moves = game.moves({ square: square, verbose: true });
        if (moves.length === 0) return;
        $('#board .square-' + square).addClass('highlight');
        for (var i = 0; i < moves.length; i++) {
            var ts = $('#board .square-' + moves[i].to);
            if (moves[i].captured) ts.addClass('legal-move-capture'); else ts.addClass('legal-move');
        }
    }

    function processLocalMove(move) {
        if (game.in_check()) sfx.play('check'); else if (move.captured) sfx.play('capture'); else sfx.play('move');
        if (move.color === 'w') whiteSeconds += incrementSeconds; else blackSeconds += incrementSeconds;
        updateTimersDisplay(); updateActiveTimerStyle(); updateCapturedPieces(); updateMovesHistory();
        activeRoomRef.update({
            fen: game.fen(), pgn: game.pgn(),
            lastMove: { from: move.from, to: move.to, promotion: move.promotion || '' },
            whiteSeconds: whiteSeconds, blackSeconds: blackSeconds
        });
        clearHighlights(); selectedSquare = null; highlightLastMove(move.from, move.to); checkEndGameConditions();
    }

    function isPromotion(source, target) {
        var moves = game.moves({ verbose: true });
        for (var i = 0; i < moves.length; i++) { if (moves[i].from === source && moves[i].to === target && moves[i].promotion) return true; }
        return false;
    }

    function executeMoveOrPromo(source, target) {
        if (isPromotion(source, target)) {
            pendingPromotionMove = { from: source, to: target }; let colorPrefix = myPlayerColor.charAt(0);
            $('.promo-piece[data-piece="q"] img').attr('src', pieceIconURI(colorPrefix + 'q'));
            $('.promo-piece[data-piece="n"] img').attr('src', pieceIconURI(colorPrefix + 'n'));
            $('.promo-piece[data-piece="r"] img').attr('src', pieceIconURI(colorPrefix + 'r'));
            $('.promo-piece[data-piece="b"] img').attr('src', pieceIconURI(colorPrefix + 'b'));
            $('#promotionModal').fadeIn(200); return 'pending';
        } else {
            var move = game.move({ from: source, to: target });
            if (move) { board.position(game.fen(), false); processLocalMove(move); return 'success'; }
            return 'invalid';
        }
    }

    $('#cancelPromoBtn').click(function() { $('#promotionModal').fadeOut(200); pendingPromotionMove = null; board.position(game.fen(), false); clearHighlights(); });

    $('.promo-piece').click(function() {
        if (!pendingPromotionMove) return;
        let promoPiece = $(this).data('piece');
        var move = game.move({ from: pendingPromotionMove.from, to: pendingPromotionMove.to, promotion: promoPiece });
        if (move) { board.position(game.fen(), false); processLocalMove(move); } else { board.position(game.fen(), false); }
        $('#promotionModal').fadeOut(200); pendingPromotionMove = null; clearHighlights();
    });

    function resetActionButtons() { 
        $('#drawOfferBtn').prop('disabled', false).text(translations[currentLang].btnDraw); 
        $('#modalRematchBtn').prop('disabled', false).text(translations[currentLang].btnRematch); 
    }

    async function enterRoom(rawRoom) {
        if (!/^\d{3,6}$/.test(rawRoom)) { $('#roomError').addClass('visible'); return; }
        $('#roomError').removeClass('visible'); currentRoomId = rawRoom;
        let btn = $('#createBtn'); let originalText = translations[currentLang].btnEnter;
        btn.prop('disabled', true).text(currentLang === 'ar' ? 'جاري الاتصال...' : 'Connecting...');

        if (!myUid) { alert(translations[currentLang].msgConnFailed); btn.prop('disabled', false).text(originalText); return; }

        $('#lobby').hide(); $('#endGameModal').hide(); $('#disconnectBanner').hide(); $('#gameArea').fadeIn(300);

        if (!board) {
            var config = {
                draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd,
                moveSpeed: 40, snapbackSpeed: 40, snapSpeed: 20, pieceTheme: function(piece) { return pieceIconURI(piece); }
            };
            board = Chessboard('board', config); $(window).resize(function() { if (board) board.resize(); });
        }

        if (activeRoomRef) activeRoomRef.off();
        activeRoomRef = db.ref('rooms/' + currentRoomId);
        let minutes = parseInt($('#timeMinutes').val()) || 3; let incrementSeconds = parseInt($('#timeIncrement').val()) || 0;
        isGameEndHandled = false; let selectedColor = $('#colorChoice').val(); let outcome = null;

        try {
            let txResult = await activeRoomRef.transaction(function(data) {
                if (data === null) {
                    let assignedColor = (selectedColor === 'random') ? ((Date.now() % 2 === 0) ? 'white' : 'black') : selectedColor;
                    outcome = 'created';
                    let fresh = {
                        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', pgn: '', lastMove: null,
                        whiteSeconds: minutes * 60, blackSeconds: minutes * 60, increment: incrementSeconds,
                        creatorColor: assignedColor, playersCount: 1, status: 'waiting', action: null
                    };
                    fresh[assignedColor + 'Uid'] = myUid; fresh[assignedColor + 'Online'] = true;
                    if (myUserName) fresh[assignedColor + 'Name'] = myUserName;
                    return fresh;
                }
                if (data.whiteUid === myUid || data.blackUid === myUid) { outcome = 'rejoined'; return data; }
                if (data.status === 'waiting' && data.playersCount === 1 && (!data.whiteUid || !data.blackUid)) {
                    let joinColor = data.creatorColor === 'white' ? 'black' : 'white';
                    outcome = 'joined'; data.playersCount = 2; data.status = 'playing';
                    data[joinColor + 'Uid'] = myUid; data[joinColor + 'Online'] = true;
                    if (myUserName) data[joinColor + 'Name'] = myUserName;
                    return data;
                }
                outcome = 'blocked'; return undefined;
            });

            if (outcome === 'blocked' || !txResult || !txResult.committed) {
                alert(translations[currentLang].msgRoomTaken); btn.prop('disabled', false).text(originalText); $('#gameArea').hide(); $('#lobby').fadeIn(300); return;
            }

            let finalData = txResult.snapshot.val();
            myPlayerColor = (finalData.whiteUid === myUid) ? 'white' : 'black';
            lastRoomSnapshot = finalData;

            if (outcome === 'rejoined') {
                game.load_pgn(finalData.pgn || '');
                whiteSeconds = finalData.whiteSeconds; blackSeconds = finalData.blackSeconds; incrementSeconds = finalData.increment;
                let nameUpdate = { [myPlayerColor + 'Online']: true }; if (myUserName) nameUpdate[myPlayerColor + 'Name'] = myUserName;
                await activeRoomRef.update(nameUpdate);
                isWaiting = (finalData.status === 'waiting');
            } else if (outcome === 'created') { game.reset(); whiteSeconds = minutes * 60; blackSeconds = minutes * 60; isWaiting = true;
            } else if (outcome === 'joined') {
                game.load_pgn(finalData.pgn || '');
                whiteSeconds = finalData.whiteSeconds; blackSeconds = finalData.blackSeconds; incrementSeconds = finalData.increment;
                isWaiting = false;
            }
            localStorage.setItem('chessActiveRoom', currentRoomId); setupPresence(); updatePlayerLabels(finalData);
        } catch (error) { btn.prop('disabled', false).text(originalText); $('#gameArea').hide(); $('#lobby').fadeIn(300); return; }

        btn.prop('disabled', false).text(originalText); resetActionButtons();
        board.orientation(myPlayerColor); board.position(game.fen(), false);
        updateMovesHistory(); clearHighlights(); updateCapturedPieces(); updateTimersDisplay();
        $('#resignBtn').show(); $('#drawOfferBtn').show(); $('.timer').removeClass('active');

        if (isWaiting) { $('#waitingOverlay').fadeIn(200); } 
        else if (game.history().length > 0 && !game.game_over()) { gameStarted = true; updateActiveTimerStyle(); startTimer(); } 
        else if (!game.game_over()) { if (!isCountingDown) { isCountingDown = true; runCountdown(); } }

        activeRoomRef.on('value', function(snap) {
            let d = snap.val(); if (!d) return; lastRoomSnapshot = d; updatePlayerLabels(d);

            if (d.status === 'playing' && !gameStarted && game.history().length === 0 && !isCountingDown) { isCountingDown = true; runCountdown(); }

            if (d.playersCount === 2) {
                let oppColor = myPlayerColor === 'white' ? 'black' : 'white';
                let isOppOnline = d[oppColor + 'Online']; let oppLastSeen = d[oppColor + 'LastSeen'] || 0;
                let isStale = oppLastSeen > 0 && (Date.now() - oppLastSeen) > 12000;

                if (isOppOnline === false || isStale) {
                    $('#oppPresence').addClass('presence-offline').removeClass('presence-online');
                    if (d.status === 'playing' && gameStarted && game.history().length > 0 && !game.game_over()) {
                        if (!abandonTimer) {
                            abandonSeconds = 30; $('#abandonSec').text(abandonSeconds); $('#disconnectBanner').fadeIn(200);
                            abandonTimer = setInterval(() => {
                                abandonSeconds--; $('#abandonSec').text(abandonSeconds);
                                if (abandonSeconds <= 0) {
                                    clearInterval(abandonTimer); abandonTimer = null;
                                    activeRoomRef.update({ status: myPlayerColor === 'white' ? 'abandoned_b' : 'abandoned_w' });
                                }
                            }, 1000);
                        }
                    }
                } else {
                    $('#oppPresence').addClass('presence-online').removeClass('presence-offline');
                    if (abandonTimer) { clearInterval(abandonTimer); abandonTimer = null; }
                    $('#disconnectBanner').fadeOut(200);
                }
            }

            if (d.lastMove && d.status === 'playing' && d.fen !== game.fen()) {
                if (d.pgn) { game.load_pgn(d.pgn); } else { game.load(d.fen); }
                board.position(d.fen, false); highlightLastMove(d.lastMove.from, d.lastMove.to);
                updateMovesHistory(); updateCapturedPieces(); updateActiveTimerStyle(); clearHighlights(); selectedSquare = null;
                let isMyTurn = (game.turn() === myPlayerColor.charAt(0));
                if (board) board.draggable(gameStarted && isMyTurn);
            } else if (d.lastMove && d.status === 'playing') { highlightLastMove(d.lastMove.from, d.lastMove.to); }

            /* دمج وتوجيه أزرار الرفض والموافقة لإعادة التحدي داخل النافذة النهائية */
            if (d.action && d.action.type) {
                if (d.action.state === 'offered') {
                    if (d.action.type === 'rematch' && d.action.by !== myPlayerColor) {
                        $('#modalNormalActions').hide();
                        $('#modalRematchOfferActions').show();
                    } else if (d.action.type === 'draw' && d.action.by !== myPlayerColor) {
                        let msg = translations[currentLang].msgDrawOffer;
                        $('#interactiveMsg').text(msg); 
                        $('#acceptActionBtn').data('actionType', 'draw'); 
                        $('#declineActionBtn').data('actionType', 'draw');
                        $('#interactiveOverlay').stop(true, true).fadeIn(200);
                    }
                } else if (d.action.state === 'declined') {
                    $('#interactiveOverlay').fadeOut(200); 
                    resetActionButtons(); 
                    $('#modalNormalActions').show();
                    $('#modalRematchOfferActions').hide();
                    setTimeout(() => activeRoomRef.update({ action: null }), 500);
                }
            }

            if (d.action && d.action.state === 'accepted') {
                $('#interactiveOverlay').fadeOut(200);
                $('#modalNormalActions').show();
                $('#modalRematchOfferActions').hide();

                if (d.action.type === 'draw') { activeRoomRef.update({ status: 'draw_agreed', action: null }); }
                else if (d.action.type === 'rematch') {
                    isGameEndHandled = false; if (abandonTimer) { clearInterval(abandonTimer); abandonTimer = null; }
                    $('#endGameModal').fadeOut(200); $('#disconnectBanner').hide(); game.reset(); board.position(game.fen());
                    whiteSeconds = d.whiteSeconds; blackSeconds = d.blackSeconds; incrementSeconds = d.increment;
                    updateMovesHistory(); clearHighlights(); highlightLastMove(null, null); updateCapturedPieces();
                    $('#resignBtn').show(); $('#drawOfferBtn').show(); resetActionButtons(); $('.timer').removeClass('active');
                    gameStarted = false; isCountingDown = false; runCountdown();
                }
                if (d.action.by !== myPlayerColor && d.action.type === 'rematch') { setTimeout(() => activeRoomRef.update({ action: null }), 2000); }
            }

            if (['resigned_w', 'resigned_b', 'timeout_w', 'timeout_b', 'draw_agreed', 'checkmate_w', 'checkmate_b', 'draw_auto', 'abandoned_w', 'abandoned_b'].includes(d.status)) {
                if (abandonTimer) { clearInterval(abandonTimer); abandonTimer = null; $('#disconnectBanner').fadeOut(); }
                let rsn = translations[currentLang];
                if (d.status === 'resigned_w') { handleServerGameEnd('b', rsn.rsnResign); }
                else if (d.status === 'resigned_b') { handleServerGameEnd('w', rsn.rsnResign); }
                else if (d.status === 'timeout_w') { handleServerGameEnd('b', rsn.rsnTimeout); }
                else if (d.status === 'timeout_b') { handleServerGameEnd('w', rsn.rsnTimeout); }
                else if (d.status === 'abandoned_w') { handleServerGameEnd('b', rsn.rsnAbandoned); }
                else if (d.status === 'abandoned_b') { handleServerGameEnd('w', rsn.rsnAbandoned); }
                else if (d.status === 'draw_agreed') { handleServerGameEnd(null, rsn.rsnAgreed); }
                else if (d.status === 'checkmate_w') { handleServerGameEnd('w', rsn.rsnCheckmate); }
                else if (d.status === 'checkmate_b') { handleServerGameEnd('b', rsn.rsnCheckmate); }
                else if (d.status === 'draw_auto') {
                    let map = { stalemate: 'rsnStalemate', repetition: 'rsnRepetition', insufficient: 'rsnInsufficientMaterial', fifty: 'rsnFiftyMove' };
                    handleServerGameEnd(null, rsn[map[d.drawReason] || 'rsnStalemate']);
                }
            }
        });
    }

    $('#createBtn').click(async function() { myUserName = ($('#userName').val() || '').trim().slice(0, 16); localStorage.setItem('chessUserName', myUserName); await enterRoom($('#roomId').val().trim()); });
    var autoResumeDone = false;
    function tryAutoResume() { if (autoResumeDone) return; autoResumeDone = true; let savedRoom = localStorage.getItem('chessActiveRoom'); if (savedRoom && /^\d{3,6}$/.test(savedRoom) && !roomFromUrl) { $('#roomId').val(savedRoom); enterRoom(savedRoom); } }

    $('#cancelMatchBtn').click(function() { localStorage.removeItem('chessActiveRoom'); if (activeRoomRef) { activeRoomRef.remove(); activeRoomRef.off(); } location.reload(); });
    $('#resignBtn').click(function() { if (!gameStarted || game.game_over()) return; activeRoomRef.update({ status: myPlayerColor === 'white' ? 'resigned_w' : 'resigned_b' }); });
    $('#drawOfferBtn').click(function() { if (!gameStarted) return; activeRoomRef.update({ action: { type: 'draw', state: 'offered', by: myPlayerColor } }); $(this).prop('disabled', true).text('...'); });
    $('#modalRematchBtn').click(function() { activeRoomRef.update({ action: { type: 'rematch', state: 'offered', by: myPlayerColor } }); $(this).prop('disabled', true).text('...'); });

    /* ربط أزرار الرد على التحدي داخل النافذة */
    $('#acceptRematchBtn, #acceptActionBtn').click(function() {
        let actionType = $(this).data('actionType') || 'rematch'; 
        let updateData = { action: { type: actionType, state: 'accepted', by: myPlayerColor } };
        if (actionType === 'rematch') {
            let minutes = parseInt($('#timeMinutes').val()) || 3;
            updateData.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; updateData.pgn = ''; updateData.lastMove = null;
            updateData.whiteSeconds = minutes * 60; updateData.blackSeconds = minutes * 60; updateData.status = 'playing';
        } else if (actionType === 'draw') { updateData.status = 'draw_agreed'; }
        $('#interactiveOverlay').fadeOut(200); activeRoomRef.update(updateData);
    });

    $('#declineRematchBtn, #declineActionBtn').click(function() { 
        let actionType = $(this).data('actionType') || 'rematch'; 
        $('#interactiveOverlay').fadeOut(200); 
        activeRoomRef.update({ action: { type: actionType, state: 'declined', by: myPlayerColor } }); 
    });

    $('#modalHomeBtn').click(function() { stopTimer(); stopHeartbeat(); $('#gameArea').hide(); $('#endGameModal').hide(); $('#disconnectBanner').hide(); $('#lobby').fadeIn(300); localStorage.removeItem('chessActiveRoom'); if (activeRoomRef) activeRoomRef.off(); if (myPresenceRef) myPresenceRef.onDisconnect().cancel(); });

    $('#modalCopyPgnBtn, #copyPgnBtn').click(function() {
        let fullPGN = $('#movesHistory').text(); if (!fullPGN || fullPGN.includes('لا توجد') || fullPGN.includes('No moves')) { alert(currentLang === 'ar' ? 'لا توجد نقلات' : 'No moves'); return; }
        if (navigator.clipboard) { navigator.clipboard.writeText(fullPGN).then(() => alert(translations[currentLang].msgCopySuccess)).catch(() => { fallbackCopy(fullPGN); }); } else { fallbackCopy(fullPGN); }
    });

    function fallbackCopy(text) { var textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select(); try { document.execCommand('copy'); alert(translations[currentLang].msgCopySuccess); } catch (e) {} document.body.removeChild(textArea); }

    function showToast(msg) { let t = $('#toast'); t.text(msg).addClass('visible'); clearTimeout(t.data('hideTimer')); let handle = setTimeout(() => t.removeClass('visible'), 2500); t.data('hideTimer', handle); }

    $('#lobbyShareBtn, #shareRoomBtn').click(async function() {
        let roomVal = $('#roomId').val().trim();
        if (!roomVal) { showToast(translations[currentLang].msgRoomInvalid); return;}
        let shareUrl = window.location.href.split('?')[0] + '?room=' + roomVal;
        try { await navigator.clipboard.writeText(shareUrl); showToast(translations[currentLang].msgShareCopied); } 
        catch(err) { fallbackCopy(shareUrl); }
    });

    function checkEndGameConditions() {
        if (!gameStarted) return;
        if (game.in_checkmate()) { let w = game.turn() === 'w' ? 'b' : 'w'; activeRoomRef.update({ status: w === 'w' ? 'checkmate_w' : 'checkmate_b' }); }
        else if (game.in_stalemate()) { activeRoomRef.update({ status: 'draw_auto', drawReason: 'stalemate' }); }
        else if (game.in_threefold_repetition()) { if (game.history().length > 4) activeRoomRef.update({ status: 'draw_auto', drawReason: 'repetition' }); }
        else if (game.insufficient_material()) { activeRoomRef.update({ status: 'draw_auto', drawReason: 'insufficient' }); }
        else if (game.in_draw()) { if (game.history().length > 4) activeRoomRef.update({ status: 'draw_auto', drawReason: 'fifty' }); }
    }

    function handleServerGameEnd(winnerColor, reasonTxt) {
        if (isGameEndHandled) return;
        isGameEndHandled = true; gameStarted = false; stopTimer(); $('#resignBtn').hide(); $('#drawOfferBtn').hide(); $('#disconnectBanner').fadeOut(200);
        if (!winnerColor) { sfx.play('draw'); } else if (winnerColor === myPlayerColor.charAt(0)) { sfx.play('victory'); } else { sfx.play('defeat'); }
        let titleTxt = translations[currentLang].titleDraw;
        if (winnerColor === 'w') { titleTxt = translations[currentLang].titleWinWhite; } else if (winnerColor === 'b') { titleTxt = translations[currentLang].titleWinBlack; }
        $('#endGameTitle').text(titleTxt); $('#endGameReason').text(reasonTxt);

        // إصلاح: عرض أفضلية الفائز المادية واسمه بدل رقم النقلات العشوائي بلا سياق،
        // ويُحتفظ بعرض عدد النقلات فقط في حالة التعادل أو فوز بلا أفضلية مادية فعلية
        let loserColor = winnerColor === 'w' ? 'b' : 'w';
        let winnerAdv = winnerColor ? (materialScore[winnerColor] - materialScore[loserColor]) : 0;
        if (winnerColor && winnerAdv > 0) {
            let winnerName = (lastRoomSnapshot && lastRoomSnapshot[winnerColor + 'Name'])
                || (winnerColor === myPlayerColor.charAt(0) ? translations[currentLang].playerYou : translations[currentLang].playerOpponent);
            $('#endGameMoves').text('+' + winnerAdv);
            $('#endGameStatLabel').text(winnerName).show();
        } else {
            $('#endGameMoves').text(Math.ceil(game.history().length / 2));
            $('#endGameStatLabel').text(translations[currentLang].labelMoves).show();
        }

        $('#modalNormalActions').show();
        $('#modalRematchOfferActions').hide();
        setTimeout(() => { $('#endGameModal').fadeIn(300); }, 300);
    }

    $(document).on('click', '#board .square-55d63', function() {
        if (!gameStarted || game.game_over()) return;
        var square = $(this).attr('data-square'); var myColorCode = myPlayerColor.charAt(0);
        if (selectedSquare) {
            if (game.turn() === myColorCode) {
                let result = executeMoveOrPromo(selectedSquare, square);
                if (result === 'success' || result === 'pending') { selectedSquare = null; return; }
            }
            clearHighlights(); selectedSquare = null;
        }
        var piece = game.get(square);
        if (piece && piece.color === myColorCode && game.turn() === myColorCode) { selectedSquare = square; highlightLegalMoves(square); } 
        else { clearHighlights(); selectedSquare = null; }
    });

    function onDragStart(source, pieceStr) {
        if (!gameStarted || game.game_over()) return false;
        var myColorCode = myPlayerColor.charAt(0);
        if (pieceStr.charAt(0) !== myColorCode || game.turn() !== myColorCode) return false;
        clearHighlights(); selectedSquare = source; highlightLegalMoves(source); return true;
    }

    function onDrop(source, target) {
        if (source === target) { clearHighlights(); selectedSquare = null; return 'snapback'; }
        if (game.turn() !== myPlayerColor.charAt(0)) { clearHighlights(); selectedSquare = null; return 'snapback'; }
        let result = executeMoveOrPromo(source, target);
        if (result === 'invalid') { clearHighlights(); selectedSquare = null; return 'snapback'; } else if (result === 'pending') { return; } return;
    }

    function onSnapEnd() { if (board) board.position(game.fen(), false); }
});
