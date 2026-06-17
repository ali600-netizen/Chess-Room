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

/* =========================================================================
   محرّك الأصوات — مُولَّدة بالكود (Web Audio API)، صفر اعتماد على أي ملف خارجي
   ========================================================================= */
/* =========================================================================
   محرّك الأصوات — مقطوعات Piano من Lichess (مرخّصة AGPLv3+)، مُستضافة محلياً
   ========================================================================= */
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
        try { let a = this._get(type); a.currentTime = 0; a.play().catch(() => {}); }
        catch (e) { /* صوت غير متاح، لا حاجة لإيقاف اللعبة بسبب ذلك */ }
    }
    toggle() { this.enabled = !this.enabled; localStorage.setItem('chessSound', this.enabled ? 'on' : 'off'); return this.enabled; }
}
const sfx = new SoundEngine();

/* =========================================================================
   مولّد رموز القطع — SVG ذاتي الاستضافة، يستبدل الاعتماد على Chess.com
   ========================================================================= */
// قطع RhosGFX (مرخّصة CC0) — مُستضافة ضمن مجلد pieces/ بالمشروع نفسه، لا اعتماد خارجي إطلاقاً
function pieceIconURI(pieceCode) {
    let colorChar = pieceCode.charAt(0).toLowerCase();
    let typeChar = pieceCode.charAt(1).toUpperCase();
    return 'pieces/' + colorChar + typeChar + '.svg';
}

$(document).ready(function() {
    // === قراءة الرابط الذكي القادم من تيليجرام ===
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
        $(this).val(v);
        $('#roomError').removeClass('visible');
    });

    var myUid = null;
    var myPresenceRef = null;
    var connectedRef = db.ref('.info/connected');
    var lastRoomSnapshot = null;
    var myUserName = localStorage.getItem('chessUserName') || '';
    $('#userName').val(myUserName);

    var game = new Chess(), board = null;
    var whiteSeconds = 0, blackSeconds = 0, incrementSeconds = 0;
    var timerInterval = null, selectedSquare = null, gameStarted = false;
    var isWaiting = false, isCountingDown = false;
    var abandonTimer = null, abandonSeconds = 30;
    var currentRoomId = null, myPlayerColor = 'white', activeRoomRef = null;
    var isGameEndHandled = false;
    var pendingPromotionMove = null;

    auth.signInAnonymously().catch(e => console.error("Auth:", e));
    auth.onAuthStateChanged(user => {
        if (user) {
            myUid = user.uid;
            $('#createBtn').prop('disabled', false).text(translations[currentLang].btnEnter);
            tryAutoResume();
        }
    });
    // إصلاح: إذا فشل الاتصال تماماً، أظهر رسالة وخيار إعادة محاولة بدل بقاء الزر معطّلاً للأبد
    setTimeout(function() {
        if (!myUid) { $('#createBtn').hide(); $('#connectionError').addClass('visible'); }
    }, 8000);
    $('#retryConnBtn').click(function() { location.reload(); });

    var currentLang = localStorage.getItem('chessLang') || 'ar';
    var currentTheme = localStorage.getItem('chessTheme') || 'royal';

    var translations = {
        ar: { lobbyTitle: "إعدادات المباراة", labelRoom: "رقم الغرفة", labelMinutes: "الوقت (دقائق)", labelIncrement: "الزيادة (ثواني)", labelColor: "اختر لونك", colorRandom: "عشوائي", colorWhite: "أبيض", colorBlack: "أسود", labelTheme: "المظهر", themeRoyal: "ملكي وفضي", themeModern: "داكن حديث", themeChesscom: "فاتح كلاسيكي", btnEnter: "دخول الغرفة", playerOpponent: "الخصم", playerYou: "أنت", btnResign: "انسحاب", btnCopy: "نسخ النقلات", btnDraw: "طلب تعادل", btnCancel: "إلغاء المباراة", btnRematch: "إعادة التحدي", btnHome: "القائمة الرئيسية", msgCountdownStart: "ابدأ!", msgWaiting: "بانتظار الخصم...", msgRematchOffer: "الخصم يطلب إعادة التحدي", msgDrawOffer: "الخصم يعرض التعادل", btnAccept: "موافق", btnDecline: "رفض", msgCopySuccess: "تم النسخ بنجاح (بالصيغة العالمية)", labelMoves: "نقلة", titleWinWhite: "فاز الأبيض", titleWinBlack: "فاز الأسود", titleDraw: "النتيجة تعادل", rsnCheckmate: "بكش مات", rsnResign: "بالانسحاب", rsnTimeout: "لنفاد الوقت", rsnStalemate: "بوضعية خنق", rsnRepetition: "بتكرار النقلات 3 مرات", rsnInsufficientMaterial: "لنقص العتاد", rsnFiftyMove: "بقاعدة الخمسين نقلة", rsnAgreed: "بالاتفاق", msgDisconnected: "انقطع الخصم... استسلام بعد", rsnAbandoned: "لانسحاب الخصم (انقطاع)", promptPromotion: "اختر الترقية", msgRoomLocked: "🔒 مقفل من رابط مشترك", msgRoomInvalid: "أرقام فقط، من 3 إلى 6 خانات", labelName: "اسمك", msgConnFailed: "تعذّر الاتصال، تحقق من الإنترنت", btnRetry: "إعادة المحاولة", btnCancelPromo: "إلغاء", msgShareCopied: "تم نسخ رابط الغرفة!", msgRoomTaken: "هذا الرقم مستخدم حالياً أو انتهت به مباراة سابقة. جرّب رقماً آخر." },
        en: { lobbyTitle: "Match Setup", labelRoom: "Room ID", labelMinutes: "Minutes", labelIncrement: "Increment", labelColor: "Your Color", colorRandom: "Random", colorWhite: "White", colorBlack: "Black", labelTheme: "Theme", themeRoyal: "Royal Navy & Gold", themeModern: "Modern Dark", themeChesscom: "Classic Light", btnEnter: "Enter Room", playerOpponent: "Opponent", playerYou: "You", btnResign: "Resign", btnCopy: "Copy PGN", btnDraw: "Offer Draw", btnCancel: "Cancel Match", btnRematch: "Rematch", btnHome: "Main Menu", msgCountdownStart: "Start!", msgWaiting: "Waiting for opponent...", msgRematchOffer: "Opponent offered a rematch", msgDrawOffer: "Opponent offered a draw", btnAccept: "Accept", btnDecline: "Decline", msgCopySuccess: "Standard PGN Copied", labelMoves: "Moves", titleWinWhite: "White Won", titleWinBlack: "Black Won", titleDraw: "Draw", rsnCheckmate: "by Checkmate", rsnResign: "by Resignation", rsnTimeout: "by Timeout", rsnStalemate: "by Stalemate", rsnRepetition: "by Threefold Repetition", rsnInsufficientMaterial: "by Insufficient Material", rsnFiftyMove: "by Fifty-Move Rule", rsnAgreed: "by Agreement", msgDisconnected: "Opponent missing... auto-resign in", rsnAbandoned: "by Abandonment", promptPromotion: "Choose Promotion", msgRoomLocked: "🔒 Locked from shared link", msgRoomInvalid: "Numbers only, 3–6 digits", labelName: "Your Name", msgConnFailed: "Couldn't connect. Check your internet.", btnRetry: "Retry", btnCancelPromo: "Cancel", msgShareCopied: "Room link copied!", msgRoomTaken: "This room is in use or was already used. Try another number." }
    };

    function updateMovesHistory() {
        if (!game) return;
        let pgnGame = new Chess();
        pgnGame.load_pgn(game.pgn());
        let d = new Date();
        let dateStr = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
        pgnGame.header('Event', 'ChessRoom Live Game');
        pgnGame.header('Site', 'ChessRoom Server');
        pgnGame.header('Date', dateStr);
        pgnGame.header('Round', '1');
        pgnGame.header('White', myPlayerColor === 'white' ? 'You' : 'Opponent');
        pgnGame.header('Black', myPlayerColor === 'black' ? 'You' : 'Opponent');
        let result = '*';
        if (game.game_over()) {
            if (game.in_checkmate()) result = game.turn() === 'w' ? '0-1' : '1-0';
            else result = '1/2-1/2';
        }
        pgnGame.header('Result', result);
        let fullPGN = pgnGame.pgn();
        $('#movesHistory').text(fullPGN || (currentLang === 'ar' ? 'لا توجد نقلات بعد' : 'No moves yet'));
        let movesBox = document.getElementById("movesHistory");
        if (movesBox) movesBox.scrollTop = movesBox.scrollHeight;
    }

    function updatePlayerLabels(d) {
        if (!d) return;
        let oppColor = myPlayerColor === 'white' ? 'black' : 'white';
        let oppName = d[oppColor + 'Name'];
        let myName = d[myPlayerColor + 'Name'];
        $('#oppNameLabel').text(oppName || translations[currentLang].playerOpponent);
        $('#myNameLabel').text(myName || translations[currentLang].playerYou);
    }

    function applyLanguage(lang) {
        currentLang = lang; localStorage.setItem('chessLang', lang);
        $('body').attr('dir', lang === 'ar' ? 'rtl' : 'ltr');
        $('html').attr('lang', lang).attr('dir', lang === 'ar' ? 'rtl' : 'ltr');
        $('#langToggleBtn').text(lang === 'ar' ? 'English' : 'العربية');
        document.title = lang === 'ar' ? 'غرفة الشطرنج | Chess Room' : 'Chess Room | غرفة الشطرنج';
        $('[data-key]').each(function() {
            var key = $(this).data('key');
            if (translations[lang][key]) { if ($(this).is('option')) $(this).text(translations[lang][key]); else $(this).html(translations[lang][key]); }
        });
        if (!myUid) { $('#createBtn').text(lang === 'ar' ? 'جاري الاتصال...' : 'Connecting...'); }
        if (lastRoomSnapshot) updatePlayerLabels(lastRoomSnapshot);
        if (board && $('#gameArea').is(':visible')) {
            setTimeout(function() { if (board) board.resize(); }, 50);
        }
    }

    function applyTheme(theme) {
        $('body').removeClass('theme-modern theme-chesscom theme-royal theme-classic').addClass('theme-' + theme);
        localStorage.setItem('chessTheme', theme);
        $('#themeChoice').val(theme);
    }

    $('#langToggleBtn').click(function() { applyLanguage(currentLang === 'en' ? 'ar' : 'en'); });
    $('#themeChoice').change(function() { applyTheme($(this).val()); });

    $('#soundOffIcon').toggle(!sfx.enabled);
    $('#soundOnIcon').toggle(sfx.enabled);
    $('#soundToggleBtn').click(function() {
        let isOn = sfx.toggle();
        $('#soundOnIcon').toggle(isOn);
        $('#soundOffIcon').toggle(!isOn);
        sfx._ensureCtx();
    });

    applyLanguage(currentLang); applyTheme(currentTheme);

    document.getElementById('board') && document.getElementById('board').addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    $(document).on('contextmenu', '#board', function(e) { e.preventDefault(); });

    function formatTime(totalSeconds) { totalSeconds = Math.max(0, totalSeconds); let m = Math.floor(totalSeconds / 60); let s = totalSeconds % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }

    function updateTimersDisplay() {
        let oppColor = myPlayerColor === 'white' ? 'black' : 'white';
        let mySeconds = myPlayerColor === 'white' ? whiteSeconds : blackSeconds;
        let oppSeconds = oppColor === 'white' ? whiteSeconds : blackSeconds;
        $('#bottomTimer').text(formatTime(mySeconds)); $('#topTimer').text(formatTime(oppSeconds));
        $('#bottomTimer').toggleClass('danger', mySeconds <= 20);
        $('#topTimer').toggleClass('danger', oppSeconds <= 20);
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(function() {
            if (!gameStarted || game.game_over()) return;
            // إصلاح: كل عميل يراقب المؤقتين معاً، لا فقط مؤقته الخاص — فتزوير الوقت يحتاج تواطؤ الطرفين معاً
            if (game.turn() === 'w') {
                whiteSeconds--;
                if (whiteSeconds <= 0) { activeRoomRef.update({ status: 'timeout_w' }); }
            } else {
                blackSeconds--;
                if (blackSeconds <= 0) { activeRoomRef.update({ status: 'timeout_b' }); }
            }
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
        $('#waitingOverlay').fadeOut(200);
        $('#interactiveOverlay').fadeOut(200);
        let count = 3; $('#countdownOverlay').text(count).fadeIn(200);
        sfx.play('count3');
        let countInt = setInterval(() => {
            count--;
            if (count > 0) { $('#countdownOverlay').text(count); sfx.play('count' + count); }
            else if (count === 0) { $('#countdownOverlay').text(translations[currentLang].msgCountdownStart); }
            else {
                clearInterval(countInt);
                $('#countdownOverlay').fadeOut(200);
                gameStarted = true;
                isCountingDown = false;
                updateActiveTimerStyle();
                startTimer();
                let isMyTurn = (game.turn() === myPlayerColor.charAt(0));
                if (board) board.draggable(isMyTurn);
            }
        }, 1000);
    }

    var heartbeatInterval = null;
    function startHeartbeat() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        function beat() {
            if (activeRoomRef && myPlayerColor) {
                activeRoomRef.update({ [myPlayerColor + 'LastSeen']: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
            }
        }
        beat();
        heartbeatInterval = setInterval(beat, 4000);
    }
    function stopHeartbeat() { if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; } }

    function setupPresence() {
        if (!currentRoomId || !myPlayerColor) return;
        if (myPresenceRef) { myPresenceRef.onDisconnect().cancel(); }
        myPresenceRef = db.ref('rooms/' + currentRoomId + '/' + myPlayerColor + 'Online');
        connectedRef.on('value', function(snap) {
            if (snap.val() === true && myPresenceRef) {
                myPresenceRef.onDisconnect().set(false).catch(() => {});
                myPresenceRef.set(true).catch(() => {});
            }
        });
        startHeartbeat();
    }

    function updateCapturedPieces() {
        if (!game) return;
        const pVals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        const initC = { w: { p: 8, n: 2, b: 2, r: 2, q: 1 }, b: { p: 8, n: 2, b: 2, r: 2, q: 1 } };
        let curC = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
        let score = { w: 0, b: 0 };

        let brd = game.board();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let pc = brd[r][c];
                if (pc) { curC[pc.color][pc.type]++; score[pc.color] += pVals[pc.type]; }
            }
        }

        let capByW = []; let capByB = [];

        ['q', 'r', 'b', 'n', 'p'].forEach(type => {
            let wLost = initC.w[type] - curC.w[type]; let bLost = initC.b[type] - curC.b[type];
            for (let i = 0; i < wLost; i++) capByB.push({ color: 'w', type: type });
            for (let i = 0; i < bLost; i++) capByW.push({ color: 'b', type: type });
        });

        let wAdv = score.w - score.b; let bAdv = score.b - score.w;
        renderCaptured('w', capByW, wAdv); renderCaptured('b', capByB, bAdv);
    }

    function renderCaptured(color, pieces, adv) {
        let containerId = (color === myPlayerColor.charAt(0)) ? '#bottomCaptured' : '#topCaptured';
        let html = '';
        pieces.forEach(p => { html += `<div class="captured-piece" style="background-image: url('${pieceIconURI(p.color + p.type)}');"></div>`; });
        if (adv > 0) { html += `<span class="score-adv">+${adv}</span>`; }
        $(containerId).html(html);
    }

    function highlightLastMove(from, to) {
        $('#board .square-55d63').removeClass('highlight-last-move');
        if (from && to) {
            $('#board .square-' + from).addClass('highlight-last-move');
            $('#board .square-' + to).addClass('highlight-last-move');
        }
    }

    function clearHighlights() {
        $('#board .square-55d63').removeClass('highlight legal-move legal-move-capture');
    }

    function highlightLegalMoves(square) {
        clearHighlights();
        var moves = game.moves({ square: square, verbose: true });
        if (moves.length === 0) return;
        $('#board .square-' + square).addClass('highlight');
        for (var i = 0; i < moves.length; i++) {
            var ts = $('#board .square-' + moves[i].to);
            if (moves[i].captured) ts.addClass('legal-move-capture');
            else ts.addClass('legal-move');
        }
    }

    function processLocalMove(move) {
        if (game.in_check()) sfx.play('check');
        else if (move.captured) sfx.play('capture');
        else sfx.play('move');

        if (move.color === 'w') whiteSeconds += incrementSeconds; else blackSeconds += incrementSeconds;
        updateTimersDisplay(); updateActiveTimerStyle(); updateCapturedPieces();

        updateMovesHistory();

        activeRoomRef.update({
            fen: game.fen(),
            pgn: game.pgn(),
            lastMove: { from: move.from, to: move.to, promotion: move.promotion || '' },
            whiteSeconds: whiteSeconds,
            blackSeconds: blackSeconds
        });

        clearHighlights();
        selectedSquare = null;
        highlightLastMove(move.from, move.to);
        checkEndGameConditions();
    }

    // ======= دوال الترقية =======
    function isPromotion(source, target) {
        var moves = game.moves({ verbose: true });
        for (var i = 0; i < moves.length; i++) {
            if (moves[i].from === source && moves[i].to === target && moves[i].promotion) {
                return true;
            }
        }
        return false;
    }

    function executeMoveOrPromo(source, target) {
        if (isPromotion(source, target)) {
            pendingPromotionMove = { from: source, to: target };
            let colorPrefix = myPlayerColor.charAt(0);

            $('.promo-piece[data-piece="q"] img').attr('src', pieceIconURI(colorPrefix + 'q'));
            $('.promo-piece[data-piece="n"] img').attr('src', pieceIconURI(colorPrefix + 'n'));
            $('.promo-piece[data-piece="r"] img').attr('src', pieceIconURI(colorPrefix + 'r'));
            $('.promo-piece[data-piece="b"] img').attr('src', pieceIconURI(colorPrefix + 'b'));

            $('#promotionModal').fadeIn(200);
            return 'pending';
        } else {
            var move = game.move({ from: source, to: target });
            if (move) {
                board.position(game.fen(), false);
                processLocalMove(move);
                return 'success';
            }
            return 'invalid';
        }
    }

    $('#cancelPromoBtn').click(function() {
        $('#promotionModal').fadeOut(200);
        pendingPromotionMove = null;
        board.position(game.fen(), false);
        clearHighlights();
    });

    $('.promo-piece').click(function() {
        if (!pendingPromotionMove) return;
        let promoPiece = $(this).data('piece');
        var move = game.move({
            from: pendingPromotionMove.from,
            to: pendingPromotionMove.to,
            promotion: promoPiece
        });
        if (move) {
            board.position(game.fen(), false);
            processLocalMove(move);
        } else {
            board.position(game.fen(), false);
        }
        $('#promotionModal').fadeOut(200);
        pendingPromotionMove = null;
        clearHighlights();
    });

    function resetActionButtons() {
        $('#drawOfferBtn').prop('disabled', false).text(translations[currentLang].btnDraw);
        $('#modalRematchBtn').prop('disabled', false).text(translations[currentLang].btnRematch);
    }

    async function enterRoom(rawRoom) {
        // إصلاح: تنظيف وفرض رقم فقط (3-6 خانات) قبل أي اتصال بـ Firebase
        if (!/^\d{3,6}$/.test(rawRoom)) {
            $('#roomError').addClass('visible');
            return;
        }
        $('#roomError').removeClass('visible');
        currentRoomId = rawRoom;

        let btn = $('#createBtn'); let originalText = translations[currentLang].btnEnter;
        btn.prop('disabled', true).text(currentLang === 'ar' ? 'جاري الاتصال...' : 'Connecting...');

        if (!myUid) {
            alert(currentLang === 'ar' ? "فشل الاتصال، انتظر ثانية وحاول مرة أخرى" : "Failed to connect, try again in a sec");
            btn.prop('disabled', false).text(originalText); return;
        }

        if (activeRoomRef) activeRoomRef.off();
        activeRoomRef = db.ref('rooms/' + currentRoomId);

        let minutes = parseInt($('#timeMinutes').val()) || 3;
        incrementSeconds = parseInt($('#timeIncrement').val()) || 0;
        isGameEndHandled = false;
        let selectedColor = $('#colorChoice').val();
        let outcome = null;

        try {
            // إصلاح: استخدام transaction ذرّية تحل مشكلتين معاً:
            // 1) سباق التزامن عند دخول لاعبين بنفس اللحظة (Firebase يعيد المحاولة تلقائياً بأمان)
            // 2) اختطاف الغرف المنتهية (لا نستبدل أي غرفة استُخدمت من قبل بواسطة UID حقيقي)
            let txResult = await activeRoomRef.transaction(function(data) {
                if (data === null) {
                    let assignedColor = (selectedColor === 'random') ? ((Date.now() % 2 === 0) ? 'white' : 'black') : selectedColor;
                    outcome = 'created';
                    let fresh = {
                        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                        pgn: '', lastMove: null,
                        whiteSeconds: minutes * 60, blackSeconds: minutes * 60, increment: incrementSeconds,
                        creatorColor: assignedColor, playersCount: 1, status: 'waiting', action: null
                    };
                    fresh[assignedColor + 'Uid'] = myUid;
                    fresh[assignedColor + 'Online'] = true;
                    if (myUserName) fresh[assignedColor + 'Name'] = myUserName;
                    return fresh;
                }
                if (data.whiteUid === myUid || data.blackUid === myUid) {
                    outcome = 'rejoined';
                    return data;
                }
                if (data.status === 'waiting' && data.playersCount === 1 && (!data.whiteUid || !data.blackUid)) {
                    let joinColor = data.creatorColor === 'white' ? 'black' : 'white';
                    outcome = 'joined';
                    data.playersCount = 2; data.status = 'playing';
                    data[joinColor + 'Uid'] = myUid; data[joinColor + 'Online'] = true;
                    if (myUserName) data[joinColor + 'Name'] = myUserName;
                    return data;
                }
                outcome = 'blocked';
                return undefined;
            });

            if (outcome === 'blocked' || !txResult || !txResult.committed) {
                alert(translations[currentLang].msgRoomTaken);
                btn.prop('disabled', false).text(originalText); return;
            }

            let finalData = txResult.snapshot.val();
            myPlayerColor = (finalData.whiteUid === myUid) ? 'white' : 'black';
            lastRoomSnapshot = finalData;

            if (outcome === 'rejoined') {
                game.load_pgn(finalData.pgn || '');
                whiteSeconds = finalData.whiteSeconds; blackSeconds = finalData.blackSeconds; incrementSeconds = finalData.increment;
                let nameUpdate = { [myPlayerColor + 'Online']: true };
                if (myUserName) nameUpdate[myPlayerColor + 'Name'] = myUserName;
                await activeRoomRef.update(nameUpdate);
                isWaiting = (finalData.status === 'waiting');
            } else if (outcome === 'created') {
                game.reset(); whiteSeconds = minutes * 60; blackSeconds = minutes * 60;
                isWaiting = true;
            } else if (outcome === 'joined') {
                game.load_pgn(finalData.pgn || '');
                whiteSeconds = finalData.whiteSeconds; blackSeconds = finalData.blackSeconds; incrementSeconds = finalData.increment;
                isWaiting = false;
            }
            // إصلاح: حفظ الغرفة النشطة محلياً — تحديث الصفحة لن يُخرجك من الغرفة بعد الآن
            localStorage.setItem('chessActiveRoom', currentRoomId);
            setupPresence();
            updatePlayerLabels(finalData);
        } catch (error) {
            console.error(error);
            alert(currentLang === 'ar' ? "حدث خطأ غير متوقع، حاول مرة أخرى" : "Unexpected error, please try again.");
            btn.prop('disabled', false).text(originalText); return;
        }

        $('#lobby').hide(); $('#endGameModal').hide(); $('#disconnectBanner').hide(); $('#gameArea').fadeIn(300);
        btn.prop('disabled', false).text(originalText);
        resetActionButtons();

        if (!board) {
            var config = {
                draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd,
                moveSpeed: 40, snapbackSpeed: 40, snapSpeed: 20,
                pieceTheme: function(piece) { return pieceIconURI(piece); }
            };
            board = Chessboard('board', config); $(window).resize(function() { if (board) board.resize(); });
        }

        board.orientation(myPlayerColor); board.position(game.fen(), false);
        updateMovesHistory();
        clearHighlights(); updateCapturedPieces();
        updateTimersDisplay(); $('#resignBtn').show(); $('#drawOfferBtn').show(); $('.timer').removeClass('active');

        if (isWaiting) {
            $('#waitingOverlay').fadeIn(200);
        } else if (game.history().length > 0 && !game.game_over()) {
            gameStarted = true; updateActiveTimerStyle(); startTimer();
        } else if (game.game_over()) {
            // إصلاح: استئناف غرفة انتهت أثناء غيابك يعرض نتيجتها الحقيقية بدل تجميد الشاشة
        } else {
            if (!isCountingDown) { isCountingDown = true; runCountdown(); }
        }

        activeRoomRef.on('value', function(snap) {
            let d = snap.val(); if (!d) return;
            lastRoomSnapshot = d;
            updatePlayerLabels(d);

            if (d.status === 'playing' && !gameStarted) {
                $('#waitingOverlay').fadeOut(200);
                if (game.history().length > 0) { gameStarted = true; updateActiveTimerStyle(); startTimer(); }
                else if (!isCountingDown) { isCountingDown = true; runCountdown(); }
            }

            if (d.playersCount === 2) {
                let oppColor = myPlayerColor === 'white' ? 'black' : 'white';
                let isOppOnline = d[oppColor + 'Online'];
                // إصلاح: إشارة ثانية مستقلة عبر نبضة زمنية من الخادم — لا تعتمد فقط على onDisconnect
                let oppLastSeen = d[oppColor + 'LastSeen'] || 0;
                let isStale = oppLastSeen > 0 && (Date.now() - oppLastSeen) > 12000;

                if (isOppOnline === false || isStale) {
                    $('#oppPresence').addClass('presence-offline').removeClass('presence-online');
                    if (d.status === 'playing' && !game.game_over()) {
                        if (!abandonTimer) {
                            abandonSeconds = 30; $('#abandonSec').text(abandonSeconds); $('#disconnectBanner').fadeIn(200);
                            abandonTimer = setInterval(() => {
                                abandonSeconds--; $('#abandonSec').text(abandonSeconds);
                                if (abandonSeconds <= 0) {
                                    clearInterval(abandonTimer); abandonTimer = null;
                                    let abandonStatus = myPlayerColor === 'white' ? 'abandoned_b' : 'abandoned_w';
                                    activeRoomRef.update({ status: abandonStatus });
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
                board.position(d.fen, false);
                highlightLastMove(d.lastMove.from, d.lastMove.to);
                updateMovesHistory();
                updateCapturedPieces();
                updateActiveTimerStyle();
                clearHighlights();
                selectedSquare = null;
                let isMyTurn = (game.turn() === myPlayerColor.charAt(0));
                if (board) board.draggable(gameStarted && isMyTurn);
            } else if (d.lastMove && d.status === 'playing') {
                highlightLastMove(d.lastMove.from, d.lastMove.to);
            }

            if (d.action && d.action.type && d.action.by !== myPlayerColor) {
                if (d.action.state === 'offered') {
                    let msg = d.action.type === 'rematch' ? translations[currentLang].msgRematchOffer : translations[currentLang].msgDrawOffer;
                    $('#interactiveMsg').text(msg);
                    $('#acceptActionBtn').data('actionType', d.action.type); $('#declineActionBtn').data('actionType', d.action.type);
                    $('#interactiveOverlay').stop(true, true).fadeIn(200);
                } else if (d.action.state === 'declined') {
                    // إصلاح: تنظيف الحقل يحدث دوماً الآن (كان شرطاً ميتاً لا يتحقق أبداً بالأصل)
                    $('#interactiveOverlay').fadeOut(200);
                    resetActionButtons();
                    setTimeout(() => activeRoomRef.update({ action: null }), 500);
                }
            }

            if (d.action && d.action.state === 'accepted') {
                $('#interactiveOverlay').fadeOut(200);
                if (d.action.type === 'draw') { activeRoomRef.update({ status: 'draw_agreed', action: null }); }
                else if (d.action.type === 'rematch') {
                    isGameEndHandled = false;
                    if (abandonTimer) { clearInterval(abandonTimer); abandonTimer = null; }
                    $('#endGameModal').fadeOut(200); $('#disconnectBanner').hide(); game.reset(); board.position(game.fen());
                    whiteSeconds = d.whiteSeconds; blackSeconds = d.blackSeconds; incrementSeconds = d.increment;
                    updateMovesHistory(); clearHighlights(); highlightLastMove(null, null); updateCapturedPieces();
                    // إصلاح: إعادة ضبط حالة الأزرار عند كل مباراة جديدة عبر Rematch (كانت سبب تجمّدها)
                    $('#resignBtn').show(); $('#drawOfferBtn').show(); resetActionButtons(); $('.timer').removeClass('active');
                    gameStarted = false; isCountingDown = false; runCountdown();
                }
                if (d.action.by !== myPlayerColor && d.action.type === 'rematch') { setTimeout(() => activeRoomRef.update({ action: null }), 2000); }
            }

            if (['resigned_w', 'resigned_b', 'timeout_w', 'timeout_b', 'draw_agreed', 'checkmate_w', 'checkmate_b', 'draw_auto', 'abandoned_w', 'abandoned_b'].includes(d.status)) {
                if (abandonTimer) { clearInterval(abandonTimer); abandonTimer = null; $('#disconnectBanner').fadeOut(); }
                if (d.status === 'resigned_w') { handleServerGameEnd('b', translations[currentLang].rsnResign); }
                else if (d.status === 'resigned_b') { handleServerGameEnd('w', translations[currentLang].rsnResign); }
                else if (d.status === 'timeout_w') { handleServerGameEnd('b', translations[currentLang].rsnTimeout); }
                else if (d.status === 'timeout_b') { handleServerGameEnd('w', translations[currentLang].rsnTimeout); }
                else if (d.status === 'abandoned_w') { handleServerGameEnd('b', translations[currentLang].rsnAbandoned); }
                else if (d.status === 'abandoned_b') { handleServerGameEnd('w', translations[currentLang].rsnAbandoned); }
                else if (d.status === 'draw_agreed') { handleServerGameEnd(null, translations[currentLang].rsnAgreed); }
                else if (d.status === 'checkmate_w') { handleServerGameEnd('w', translations[currentLang].rsnCheckmate); }
                else if (d.status === 'checkmate_b') { handleServerGameEnd('b', translations[currentLang].rsnCheckmate); }
                else if (d.status === 'draw_auto') {
                    // إصلاح: تمييز السبب الحقيقي للتعادل بدل تسمية الجميع "Stalemate"
                    let reasonMap = { stalemate: 'rsnStalemate', repetition: 'rsnRepetition', insufficient: 'rsnInsufficientMaterial', fifty: 'rsnFiftyMove' };
                    let reasonKey = reasonMap[d.drawReason] || 'rsnStalemate';
                    handleServerGameEnd(null, translations[currentLang][reasonKey]);
                }
            }
        });
    }

    $('#createBtn').click(async function() {
        myUserName = ($('#userName').val() || '').trim().slice(0, 16);
        localStorage.setItem('chessUserName', myUserName);
        await enterRoom($('#roomId').val().trim());
    });

    // إصلاح: استئناف تلقائي للغرفة المحفوظة بعد أي تحديث للصفحة — لا حاجة لإعادة كتابة الرمز
    var autoResumeDone = false;
    function tryAutoResume() {
        if (autoResumeDone) return; autoResumeDone = true;
        let savedRoom = localStorage.getItem('chessActiveRoom');
        if (savedRoom && /^\d{3,6}$/.test(savedRoom) && !roomFromUrl) {
            $('#roomId').val(savedRoom);
            enterRoom(savedRoom);
        }
    }

    $('#cancelMatchBtn').click(function() {
        localStorage.removeItem('chessActiveRoom');
        if (activeRoomRef) { activeRoomRef.remove(); activeRoomRef.off(); } location.reload();
    });

    $('#resignBtn').click(function() {
        if (!gameStarted || game.game_over()) return;
        activeRoomRef.update({ status: myPlayerColor === 'white' ? 'resigned_w' : 'resigned_b' });
    });

    $('#drawOfferBtn').click(function() {
        if (!gameStarted) return;
        activeRoomRef.update({ action: { type: 'draw', state: 'offered', by: myPlayerColor } });
        $(this).prop('disabled', true).text('...');
    });

    $('#modalRematchBtn').click(function() {
        activeRoomRef.update({ action: { type: 'rematch', state: 'offered', by: myPlayerColor } });
        $(this).prop('disabled', true).text('...');
    });

    $('#acceptActionBtn').click(function() {
        let actionType = $(this).data('actionType');
        let updateData = { action: { type: actionType, state: 'accepted', by: myPlayerColor } };

        if (actionType === 'rematch') {
            let minutes = parseInt($('#timeMinutes').val()) || 3;
            updateData.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            updateData.pgn = ''; updateData.lastMove = null;
            updateData.whiteSeconds = minutes * 60; updateData.blackSeconds = minutes * 60;
            updateData.status = 'playing';
        } else if (actionType === 'draw') { updateData.status = 'draw_agreed'; }

        $('#interactiveOverlay').fadeOut(200); activeRoomRef.update(updateData);
    });

    $('#declineActionBtn').click(function() {
        let actionType = $(this).data('actionType');
        $('#interactiveOverlay').fadeOut(200);
        activeRoomRef.update({ action: { type: actionType, state: 'declined', by: myPlayerColor } });
    });

    $('#modalHomeBtn').click(function() {
        stopTimer(); stopHeartbeat(); $('#gameArea').hide(); $('#endGameModal').hide(); $('#disconnectBanner').hide(); $('#lobby').fadeIn(300);
        localStorage.removeItem('chessActiveRoom');
        if (activeRoomRef) activeRoomRef.off();
        if (myPresenceRef) myPresenceRef.onDisconnect().cancel();
    });

    $('#modalCopyPgnBtn, #copyPgnBtn').click(function() {
        let fullPGN = $('#movesHistory').text();
        if (!fullPGN || fullPGN === (currentLang === 'ar' ? 'لا توجد نقلات بعد' : 'No moves yet')) {
            alert(currentLang === 'ar' ? 'لا توجد نقلات لنسخها' : 'No moves to copy');
            return;
        }
        if (navigator.clipboard) {
            navigator.clipboard.writeText(fullPGN).then(() => alert(translations[currentLang].msgCopySuccess)).catch(() => { fallbackCopy(fullPGN); });
        } else { fallbackCopy(fullPGN); }
    });

    function fallbackCopy(text) { var textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select(); try { document.execCommand('copy'); alert(translations[currentLang].msgCopySuccess); } catch (e) {} document.body.removeChild(textArea); }

    function showToast(msg) {
        let t = $('#toast'); t.text(msg).addClass('visible');
        clearTimeout(t.data('hideTimer'));
        let handle = setTimeout(() => t.removeClass('visible'), 2500);
        t.data('hideTimer', handle);
    }

    $('#shareRoomBtn').click(async function() {
        let roomVal = $('#roomId').val().trim();
        if (!roomVal) return;
        let shareUrl = window.location.origin + window.location.pathname + '?room=' + roomVal;
        let shareText = currentLang === 'ar' ? ('تعال نلعب شطرنج! ادخل من هنا: ') : ('Let\'s play chess! Join here: ');
        if (navigator.share) {
            try { await navigator.share({ title: 'Chess Room', text: shareText, url: shareUrl }); return; } catch (e) { /* المستخدم أغلق نافذة المشاركة، لا حاجة لأي إجراء */ }
        }
        if (navigator.clipboard) {
            try { await navigator.clipboard.writeText(shareUrl); showToast(translations[currentLang].msgShareCopied); return; } catch (e) {}
        }
        showToast(shareUrl);
    });

    function checkEndGameConditions() {
        if (!gameStarted) return;
        if (game.in_checkmate()) {
            let winnerColor = game.turn() === 'w' ? 'b' : 'w';
            activeRoomRef.update({ status: winnerColor === 'w' ? 'checkmate_w' : 'checkmate_b' });
        } else if (game.in_stalemate()) {
            activeRoomRef.update({ status: 'draw_auto', drawReason: 'stalemate' });
        } else if (game.in_threefold_repetition()) {
            if (game.history().length > 4) { activeRoomRef.update({ status: 'draw_auto', drawReason: 'repetition' }); }
        } else if (game.insufficient_material()) {
            activeRoomRef.update({ status: 'draw_auto', drawReason: 'insufficient' });
        } else if (game.in_draw()) {
            if (game.history().length > 4) { activeRoomRef.update({ status: 'draw_auto', drawReason: 'fifty' }); }
        }
    }

    function handleServerGameEnd(winnerColor, reasonTxt) {
        if (isGameEndHandled) return;
        isGameEndHandled = true;
        gameStarted = false; stopTimer(); $('#resignBtn').hide(); $('#drawOfferBtn').hide(); $('#disconnectBanner').fadeOut(200);

        if (!winnerColor) { sfx.play('draw'); }
        else if (winnerColor === myPlayerColor.charAt(0)) { sfx.play('victory'); }
        else { sfx.play('defeat'); }

        let titleTxt = translations[currentLang].titleDraw;
        if (winnerColor === 'w') { titleTxt = translations[currentLang].titleWinWhite; }
        else if (winnerColor === 'b') { titleTxt = translations[currentLang].titleWinBlack; }

        $('#endGameTitle').text(titleTxt); $('#endGameReason').text(reasonTxt);
        $('#endGameMoves').text(Math.ceil(game.history().length / 2));
        setTimeout(() => { $('#endGameModal').fadeIn(300); }, 300);
    }

    // ===== أحداث التفاعل مع الرقعة (النقر والسحب مع الترقية الذكية) =====
    $(document).on('click', '#board .square-55d63', function() {
        if (!gameStarted || game.game_over()) return;
        var square = $(this).attr('data-square');
        var myColorCode = myPlayerColor.charAt(0);

        if (selectedSquare) {
            if (game.turn() === myColorCode) {
                let result = executeMoveOrPromo(selectedSquare, square);
                if (result === 'success' || result === 'pending') {
                    selectedSquare = null;
                    return;
                }
            }
            clearHighlights();
            selectedSquare = null;
        }

        var piece = game.get(square);
        if (piece && piece.color === myColorCode && game.turn() === myColorCode) {
            selectedSquare = square;
            highlightLegalMoves(square);
        } else {
            clearHighlights();
            selectedSquare = null;
        }
    });

    function onDragStart(source, pieceStr) {
        if (!gameStarted || game.game_over()) return false;
        var myColorCode = myPlayerColor.charAt(0);
        if (pieceStr.charAt(0) !== myColorCode || game.turn() !== myColorCode) return false;
        clearHighlights();
        selectedSquare = source;
        highlightLegalMoves(source);
        return true;
    }

    function onDrop(source, target) {
        if (source === target) {
            clearHighlights();
            selectedSquare = null;
            return 'snapback';
        }

        if (game.turn() !== myPlayerColor.charAt(0)) {
            clearHighlights();
            selectedSquare = null;
            return 'snapback';
        }

        let result = executeMoveOrPromo(source, target);

        if (result === 'invalid') {
            clearHighlights();
            selectedSquare = null;
            return 'snapback';
        } else if (result === 'pending') {
            return;
        }
        return;
    }

    function onSnapEnd() {
        if (board) board.position(game.fen(), false);
    }
});

