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

$(document).ready(function() {
    var myUid = null;
    var myPresenceRef = null;
    var connectedRef = db.ref('.info/connected');
    
    var game = new Chess(), board = null;
    var whiteSeconds = 0, blackSeconds = 0, incrementSeconds = 0;
    var timerInterval = null, selectedSquare = null, gameStarted = false;
    var premove = null;   // المتغير الخاص بـ Premove
    var isWaiting = false, isCountingDown = false; 
    var abandonTimer = null, abandonSeconds = 30; 
    var currentRoomId = null, myPlayerColor = 'white', activeRoomRef = null;
    var isGameEndHandled = false; 

    auth.signInAnonymously().catch(e => console.error("Auth:", e));
    auth.onAuthStateChanged(user => { 
        if (user) { 
            myUid = user.uid; 
            $('#createBtn').prop('disabled', false).text(translations[currentLang].btnEnter);
        } 
    });

    const sfx = {
        move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
        capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
        check: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3'),
        gameEnd: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3'),
        start: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3')
    };

    var currentLang = localStorage.getItem('chessLang') || 'en';
    var currentTheme = localStorage.getItem('chessTheme') || 'royal';

    var translations = {
        ar: { lobbyTitle: "إعدادات المباراة", labelRoom: "رقم الغرفة", labelMinutes: "الوقت (دقائق)", labelIncrement: "الزيادة (ثواني)", labelColor: "اختر لونك", colorRandom: "عشوائي", colorWhite: "أبيض", colorBlack: "أسود", labelTheme: "المظهر", themeRoyal: "ملكي وفضي", themeModern: "داكن حديث", themeChesscom: "فاتح كلاسيكي", btnEnter: "دخول الغرفة", playerOpponent: "الخصم", playerYou: "أنت", btnResign: "انسحاب", btnCopy: "نسخ النقلات", btnDraw: "طلب تعادل", btnCancel: "إلغاء المباراة", btnRematch: "إعادة التحدي", btnHome: "القائمة الرئيسية", msgCountdownStart: "ابدأ!", msgWaiting: "بانتظار الخصم...", msgRematchOffer: "الخصم يطلب إعادة التحدي", msgDrawOffer: "الخصم يعرض التعادل", btnAccept: "موافق", btnDecline: "رفض", msgCopySuccess: "تم النسخ بنجاح (بالصيغة العالمية)", labelMoves: "نقلة", titleWinWhite: "فاز الأبيض", titleWinBlack: "فاز الأسود", titleDraw: "النتيجة تعادل", rsnCheckmate: "بكش مات", rsnResign: "بالانسحاب", rsnTimeout: "لنفاد الوقت", rsnStalemate: "وضعية خنق", rsnAgreed: "بالاتفاق", msgDisconnected: "انقطع الخصم... استسلام بعد", rsnAbandoned: "لانسحاب الخصم (انقطاع)" },
        en: { lobbyTitle: "Match Setup", labelRoom: "Room ID", labelMinutes: "Minutes", labelIncrement: "Increment", labelColor: "Your Color", colorRandom: "Random", colorWhite: "White", colorBlack: "Black", labelTheme: "Theme", themeRoyal: "Royal Navy & Gold", themeModern: "Modern Dark", themeChesscom: "Classic Light", btnEnter: "Enter Room", playerOpponent: "Opponent", playerYou: "You", btnResign: "Resign", btnCopy: "Copy PGN", btnDraw: "Offer Draw", btnCancel: "Cancel Match", btnRematch: "Rematch", btnHome: "Main Menu", msgCountdownStart: "Start!", msgWaiting: "Waiting for opponent...", msgRematchOffer: "Opponent offered a rematch", msgDrawOffer: "Opponent offered a draw", btnAccept: "Accept", btnDecline: "Decline", msgCopySuccess: "Standard PGN Copied", labelMoves: "Moves", titleWinWhite: "White Won", titleWinBlack: "Black Won", titleDraw: "Draw", rsnCheckmate: "by Checkmate", rsnResign: "by Resignation", rsnTimeout: "by Timeout", rsnStalemate: "by Stalemate", rsnAgreed: "by Agreement", msgDisconnected: "Opponent missing... auto-resign in", rsnAbandoned: "by Abandonment" }
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

    function applyLanguage(lang) {
        currentLang = lang; localStorage.setItem('chessLang', lang);
        $('body').attr('dir', lang === 'ar' ? 'rtl' : 'ltr');
        $('html').attr('lang', lang);
        $('#langToggleBtn').text(lang === 'ar' ? 'English' : 'العربية');
        $('[data-key]').each(function() {
            var key = $(this).data('key');
            if(translations[lang][key]) { if($(this).is('option')) $(this).text(translations[lang][key]); else $(this).html(translations[lang][key]); }
        });
        if (!myUid) { $('#createBtn').text(lang === 'ar' ? 'جاري الاتصال...' : 'Connecting...'); }
        if(board && $('#gameArea').is(':visible')) {
            setTimeout(function(){ if(board) board.resize(); }, 50);
        }
    }

    function applyTheme(theme) { 
        $('body').removeClass('theme-modern theme-chesscom theme-royal').addClass('theme-' + theme); 
        localStorage.setItem('chessTheme', theme); 
        $('#themeChoice').val(theme); 
    }

    $('#langToggleBtn').click(function() { applyLanguage(currentLang === 'en' ? 'ar' : 'en'); });
    $('#themeChoice').change(function() { applyTheme($(this).val()); });

    applyLanguage(currentLang); applyTheme(currentTheme);

    document.getElementById('board').addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    $(document).on('contextmenu', '#board', function(e) { e.preventDefault(); cancelPremove(); });

    function formatTime(totalSeconds) { let m = Math.floor(totalSeconds / 60); let s = totalSeconds % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
    
    function updateTimersDisplay() {
        let oppColor = myPlayerColor === 'white' ? 'black' : 'white';
        let mySeconds = myPlayerColor === 'white' ? whiteSeconds : blackSeconds; 
        let oppSeconds = oppColor === 'white' ? whiteSeconds : blackSeconds;
        $('#bottomTimer').text(formatTime(mySeconds)); $('#topTimer').text(formatTime(oppSeconds));
        $('#bottomTimer').toggleClass('danger', mySeconds <= 20);
        $('#topTimer').toggleClass('danger', oppSeconds <= 20);
    }

    function startTimer() {
        if(timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(function() {
            if (!gameStarted || game.game_over()) return;
            if (game.turn() === 'w') { 
                whiteSeconds--; 
                if (whiteSeconds <= 0 && myPlayerColor === 'white') { activeRoomRef.update({ status: 'timeout_w' }); }
            } else { 
                blackSeconds--; 
                if (blackSeconds <= 0 && myPlayerColor === 'black') { activeRoomRef.update({ status: 'timeout_b' }); }
            }
            updateTimersDisplay();
        }, 1000);
    }

    function updateActiveTimerStyle() { 
        let turn = game.turn(); 
        $('#bottomTimer').toggleClass('active', turn === myPlayerColor.charAt(0));
        $('#topTimer').toggleClass('active', turn !== myPlayerColor.charAt(0));
    }
    
    function stopTimer() { if(timerInterval) clearInterval(timerInterval); $('.timer').removeClass('active'); }

    function runCountdown() {
        $('#waitingOverlay').fadeOut(200); 
        $('#interactiveOverlay').fadeOut(200);
        let count = 3; $('#countdownOverlay').text(count).fadeIn(200);
        let countInt = setInterval(() => {
            count--;
            if(count > 0) $('#countdownOverlay').text(count);
            else if (count === 0) $('#countdownOverlay').text(translations[currentLang].msgCountdownStart);
            else { 
                clearInterval(countInt); 
                $('#countdownOverlay').fadeOut(200); 
                sfx.start.play().catch(()=>{}); 
                gameStarted = true; 
                isCountingDown = false;
                updateActiveTimerStyle(); 
                startTimer(); 
                let isMyTurn = (game.turn() === myPlayerColor.charAt(0));
                if(board) board.draggable(isMyTurn);
            }
        }, 1000);
    }

    function setupPresence() {
        if (!currentRoomId || !myPlayerColor) return;
        if (myPresenceRef) { myPresenceRef.onDisconnect().cancel(); }
        myPresenceRef = db.ref('rooms/' + currentRoomId + '/' + myPlayerColor + 'Online');
        connectedRef.on('value', function(snap) {
            if (snap.val() === true && myPresenceRef) {
                myPresenceRef.onDisconnect().set(false).catch(()=>{});
                myPresenceRef.set(true).catch(()=>{}); 
            }
        });
    }

    function updateCapturedPieces() {
        if (!game) return;
        const pVals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        const initC = { w: {p:8, n:2, b:2, r:2, q:1}, b: {p:8, n:2, b:2, r:2, q:1} };
        let curC = { w: {p:0, n:0, b:0, r:0, q:0}, b: {p:0, n:0, b:0, r:0, q:0} };
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
            for(let i=0; i<wLost; i++) capByB.push({color: 'w', type: type});
            for(let i=0; i<bLost; i++) capByW.push({color: 'b', type: type});
        });

        let wAdv = score.w - score.b; let bAdv = score.b - score.w;
        renderCaptured('w', capByW, wAdv); renderCaptured('b', capByB, bAdv);
    }

    function renderCaptured(color, pieces, adv) {
        let containerId = (color === myPlayerColor.charAt(0)) ? '#bottomCaptured' : '#topCaptured';
        let html = '';
        pieces.forEach(p => { html += `<div class="captured-piece" style="background-image: url('https://images.chesscomfiles.com/chess-themes/pieces/light/150/${p.color}${p.type}.png');"></div>`; });
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

    // ======= دوال Premove المبسطة والمعدلة =======
    function cancelPremove() { 
        if (premove) console.log("❌ Premove cancelled");
        premove = null; 
        $('.square-55d63').removeClass('premove-highlight'); 
    }
    
    function clearHighlights () { 
        $('#board .square-55d63').removeClass('highlight legal-move legal-move-capture'); 
    }
    
    function highlightLegalMoves(square) { 
        clearHighlights(); 
        var moves = game.moves({ square: square, verbose: true }); 
        if (moves.length === 0) return; 
        $('#board .square-' + square).addClass('highlight'); 
        for (var i = 0; i < moves.length; i++) { 
            var ts = $('#board .square-' + moves[i].to); 
            if(moves[i].captured) ts.addClass('legal-move-capture'); 
            else ts.addClass('legal-move'); 
        } 
    }

    // تنفيذ الـ premove مع التحقق من قانونية النقلة بعد التحديث
    function tryExecutePremove() {
        if (!premove) return false;
        
        var move = game.move({ from: premove.from, to: premove.to, promotion: 'q' });
        
        if (move) {
            console.log("✅ Premove executed successfully", move);
            cancelPremove();
            board.position(game.fen(), false);
            processLocalMove(move);
            return true;
        } else {
            console.log("❌ Premove move illegal, clearing");
            cancelPremove();
            return false;
        }
    }

    function processLocalMove(move) {
        if (game.in_check()) sfx.check.play().catch(()=>{});
        else if (move.captured) sfx.capture.play().catch(()=>{}); 
        else sfx.move.play().catch(()=>{});
        
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

    $('#createBtn').click(async function() { 
        currentRoomId = $('#roomId').val().trim();
        if (!currentRoomId) return;
        
        let btn = $(this); let originalText = btn.text();
        btn.prop('disabled', true).text(currentLang === 'ar' ? 'جاري الاتصال...' : 'Connecting...');

        if (!myUid) {
            alert(currentLang === 'ar' ? "فشل الاتصال، انتظر ثانية وحاول مرة أخرى" : "Failed to connect, try again in a sec");
            btn.prop('disabled', false).text(originalText); return;
        }
        
        if (activeRoomRef) activeRoomRef.off();
        activeRoomRef = db.ref('rooms/' + currentRoomId);
        
        try {
            let snapshot = await activeRoomRef.once('value');
            let data = snapshot.val();
            let minutes = parseInt($('#timeMinutes').val()) || 3; 
            incrementSeconds = parseInt($('#timeIncrement').val()) || 0;
            isGameEndHandled = false; 

            let isMySeatWhite = (data && data.whiteUid === myUid);
            let isMySeatBlack = (data && data.blackUid === myUid);

            if (data && (isMySeatWhite || isMySeatBlack)) {
                myPlayerColor = isMySeatWhite ? 'white' : 'black';
                game.load_pgn(data.pgn || '');
                whiteSeconds = data.whiteSeconds; blackSeconds = data.blackSeconds; incrementSeconds = data.increment;
                await activeRoomRef.update({ [myPlayerColor + 'Online']: true });
                isWaiting = (data.status === 'waiting');
                setupPresence();
            } else if (!snapshot.exists() || (data && data.status !== 'waiting' && data.status !== 'playing')) {
                let colorsArr = ['white', 'black']; let selectedColor = $('#colorChoice').val();
                myPlayerColor = selectedColor === 'random' ? colorsArr[Math.floor(Math.random() * colorsArr.length)] : selectedColor;
                game.reset(); whiteSeconds = minutes * 60; blackSeconds = minutes * 60;
                await activeRoomRef.set({
                    fen: game.fen(), pgn: game.pgn(), lastMove: null,
                    whiteSeconds: whiteSeconds, blackSeconds: blackSeconds, increment: incrementSeconds,
                    creatorColor: myPlayerColor, playersCount: 1, status: 'waiting', action: 'none',
                    [myPlayerColor + 'Uid']: myUid, [myPlayerColor + 'Online']: true
                });
                isWaiting = true; setupPresence();
            } else if (data.playersCount === 1) {
                myPlayerColor = data.creatorColor === 'white' ? 'black' : 'white'; 
                game.load_pgn(data.pgn || '');
                whiteSeconds = data.whiteSeconds; blackSeconds = data.blackSeconds; incrementSeconds = data.increment;
                await activeRoomRef.update({ 
                    playersCount: 2, status: 'playing',
                    [myPlayerColor + 'Uid']: myUid, [myPlayerColor + 'Online']: true
                });
                isWaiting = false; setupPresence();
            } else {
                alert(currentLang === 'ar' ? "الغرفة ممتلئة ولا يمكنك الدخول!" : "Room is full and you are not a participant!"); 
                btn.prop('disabled', false).text(originalText); return;
            }
        } catch (error) {
            console.error(error);
            alert(currentLang === 'ar' ? "تزامن لحظي! الغرفة تم إنشاؤها للتو، اضغط (دخول) مرة أخرى للانضمام كلاعب ثانٍ." : "Race condition! Room just created, press Enter again to join.");
            btn.prop('disabled', false).text(originalText); return;
        }

        $('#lobby').hide(); $('#endGameModal').hide(); $('#disconnectBanner').hide(); $('#gameArea').fadeIn(300); 
        btn.prop('disabled', false).text(originalText);

        if (!board) {
            var config = { 
                draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd, 
                moveSpeed: 40, snapbackSpeed: 40, snapSpeed: 20, 
                pieceTheme: function(piece) { return 'https://images.chesscomfiles.com/chess-themes/pieces/light/150/' + piece.toLowerCase() + '.png'; }
            };
            board = Chessboard('board', config); $(window).resize(function() { if(board) board.resize(); });
        }
        
        board.orientation(myPlayerColor); board.position(game.fen(), false);
        updateMovesHistory();
        clearHighlights(); cancelPremove(); updateCapturedPieces();
        updateTimersDisplay(); $('#resignBtn').show(); $('#drawOfferBtn').show(); $('.timer').removeClass('active');
        
        if (isWaiting) { 
            $('#waitingOverlay').fadeIn(200); 
        } else if (game.history().length > 0 && !game.game_over()) {
            gameStarted = true; updateActiveTimerStyle(); startTimer();
        } else {
            if (!isCountingDown) { isCountingDown = true; runCountdown(); }
        }

        activeRoomRef.on('value', function(snap) {
            let d = snap.val(); if (!d) return;

            if (d.status === 'playing' && !gameStarted) {
                $('#waitingOverlay').fadeOut(200);
                if (game.history().length > 0) { gameStarted = true; updateActiveTimerStyle(); startTimer(); } 
                else if (!isCountingDown) { isCountingDown = true; runCountdown(); }
            }

            if (d.playersCount === 2) {
                let oppColor = myPlayerColor === 'white' ? 'black' : 'white';
                let isOppOnline = d[oppColor + 'Online'];
                
                if (isOppOnline === false) {
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

            // ========== معالجة حركة الخصم وتنفيذ premove ==========
            if (d.lastMove && d.status === 'playing' && d.fen !== game.fen()) {
                // تحديث حالة اللعبة من الخادم
                if (d.pgn) {
                    game.load_pgn(d.pgn);
                } else {
                    game.load(d.fen);
                }
                
                board.position(d.fen, false);
                highlightLastMove(d.lastMove.from, d.lastMove.to);
                updateMovesHistory();
                updateCapturedPieces(); 
                updateActiveTimerStyle();
                
                clearHighlights();
                selectedSquare = null;
                
                let isMyTurn = (game.turn() === myPlayerColor.charAt(0));
                if(board) board.draggable(gameStarted && isMyTurn);
                
                // تنفيذ الـ premove بتأخير شبه معدوم (50 ملي ثانية) لضمان نجاحه
                if (isMyTurn && gameStarted && !game.game_over()) {
                    if (premove) {
                        console.log("📌 Opponent moved, attempting premove with micro-delay...");
                        setTimeout(() => {
                            tryExecutePremove();
                        }, 50);
                    }
                } else {
                    if (premove) console.log("⏳ Premove still stored, waiting for my turn");
                }
            } else if (d.lastMove && d.status === 'playing') {
                highlightLastMove(d.lastMove.from, d.lastMove.to);
            }

            // معالجة الأفعال الجانبية (تعادل، إعادة)
            if (d.action && d.action.type && d.action.by !== myPlayerColor) {
                if (d.action.state === 'offered') {
                    let msg = d.action.type === 'rematch' ? translations[currentLang].msgRematchOffer : translations[currentLang].msgDrawOffer;
                    $('#interactiveMsg').text(msg);
                    $('#acceptActionBtn').data('actionType', d.action.type); $('#declineActionBtn').data('actionType', d.action.type);
                    $('#interactiveOverlay').stop(true, true).fadeIn(200);
                } else if (d.action.state === 'declined') {
                    $('#interactiveOverlay').fadeOut(200);
                    $('#drawOfferBtn').prop('disabled', false).text(translations[currentLang].btnDraw);
                    $('#modalRematchBtn').prop('disabled', false).text(translations[currentLang].btnRematch);
                    if (d.action.by === myPlayerColor) { setTimeout(() => activeRoomRef.update({ action: null }), 500); }
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
                    updateMovesHistory(); clearHighlights(); highlightLastMove(null, null); cancelPremove(); updateCapturedPieces();
                    $('#resignBtn').show(); $('#drawOfferBtn').show(); $('.timer').removeClass('active');
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
                else if (d.status === 'draw_auto') { handleServerGameEnd(null, translations[currentLang].rsnStalemate); }
            }
        });
    });

    $('#cancelMatchBtn').click(function() { if (activeRoomRef) { activeRoomRef.remove(); activeRoomRef.off(); } location.reload(); });

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
        stopTimer(); $('#gameArea').hide(); $('#endGameModal').hide(); $('#disconnectBanner').hide(); $('#lobby').fadeIn(300); 
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
            navigator.clipboard.writeText(fullPGN).then(()=>alert(translations[currentLang].msgCopySuccess)).catch(() => { fallbackCopy(fullPGN); }); 
        } else { fallbackCopy(fullPGN); }
    });

    function fallbackCopy(text) { var textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select(); try { document.execCommand('copy'); alert(translations[currentLang].msgCopySuccess); } catch(e){} document.body.removeChild(textArea); }

    function checkEndGameConditions() {
        if (!gameStarted) return; 
        if (game.in_checkmate()) {
            let winnerColor = game.turn() === 'w' ? 'b' : 'w';
            activeRoomRef.update({ status: winnerColor === 'w' ? 'checkmate_w' : 'checkmate_b' });
        } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
            if (game.history().length > 4) { activeRoomRef.update({ status: 'draw_auto' }); }
        }
    }

    function handleServerGameEnd(winnerColor, reasonTxt) { 
        if (isGameEndHandled) return; 
        isGameEndHandled = true;
        gameStarted = false; stopTimer(); $('#resignBtn').hide(); $('#drawOfferBtn').hide(); $('#disconnectBanner').fadeOut(200);
        sfx.gameEnd.play().catch(()=>{}); 
        
        let titleTxt = translations[currentLang].titleDraw;
        if (winnerColor === 'w') { titleTxt = translations[currentLang].titleWinWhite; }
        else if (winnerColor === 'b') { titleTxt = translations[currentLang].titleWinBlack; }

        $('#endGameTitle').text(titleTxt); $('#endGameReason').text(reasonTxt);
        $('#endGameMoves').text(Math.ceil(game.history().length / 2));
        setTimeout(() => { $('#endGameModal').fadeIn(300); }, 300); 
    }

    // ===== أحداث التفاعل =====
    $(document).on('click', '#board .square-55d63', function() {
        if (!gameStarted || game.game_over()) return;
        var square = $(this).attr('data-square'); 
        var myColorCode = myPlayerColor.charAt(0);
        
        if (premove) cancelPremove();
        
        if (selectedSquare) {
            if (game.turn() === myColorCode) {
                var move = game.move({ from: selectedSquare, to: square, promotion: 'q' }); 
                if (move) { 
                    board.position(game.fen(), false); 
                    processLocalMove(move); 
                    return; 
                }
            } else {
                premove = { from: selectedSquare, to: square };
                console.log("📌 Premove stored via click:", premove);
                clearHighlights(); 
                $('.square-' + selectedSquare).addClass('premove-highlight'); 
                $('.square-' + square).addClass('premove-highlight');
                selectedSquare = null;
                return;
            }
            cancelPremove(); 
            clearHighlights(); 
            selectedSquare = null;
        }
        
        var piece = game.get(square); 
        if (piece && piece.color === myColorCode) { 
            selectedSquare = square; 
            if (game.turn() === myColorCode) highlightLegalMoves(square); 
        } else { 
            cancelPremove(); 
            clearHighlights(); 
            selectedSquare = null; 
        }
    });

    function onDragStart (source, pieceStr) { 
        if (!gameStarted || game.game_over()) return false; 
        var myColorCode = myPlayerColor.charAt(0); 
        if (pieceStr.charAt(0) !== myColorCode) return false;
        cancelPremove();  
        clearHighlights();
        selectedSquare = source; 
        if(game.turn() === myColorCode) highlightLegalMoves(source); 
        return true; 
    }
    
    function onDrop (source, target) { 
        if (source === target) {
            clearHighlights();
            selectedSquare = null;
            return 'snapback';
        }
        if (game.turn() !== myPlayerColor.charAt(0)) {
            clearHighlights();
            selectedSquare = null;
            premove = { from: source, to: target };
            console.log("📌 Premove stored via drag:", premove);
            $('.square-' + source).addClass('premove-highlight');
            $('.square-' + target).addClass('premove-highlight');
            return 'snapback';
        }

        var move = game.move({ from: source, to: target, promotion: 'q' }); 
        if (move === null) { 
            clearHighlights();
            selectedSquare = null; 
            return 'snapback'; 
        } 
        
        processLocalMove(move);
        return; 
    }

    function onSnapEnd () { 
        if(board) board.position(game.fen(), false);
    }
});
