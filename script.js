const firebaseConfig = {
    apiKey: "AIzaSyCWL3DohN_BVmwlDjLYP_UohoKqnw4ylzU",
    authDomain: "chessroom-ca23f.firebaseapp.com",
    databaseURL: "https://chessroom-ca23f-default-rtdb.firebaseio.com/",
    projectId: "chessroom-ca23f",
    storageBucket: "chessroom-ca23f.firebasestorage.app"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

$(document).ready(function() {
    var game = new Chess(), board = null;
    var whiteSeconds = 0, blackSeconds = 0, incrementSeconds = 0;
    var timerInterval = null, selectedSquare = null, gameStarted = false;
    var premove = null; // البري موف أصبح نقلة واحدة صارمة ومستقرة لمنع اللاق
    var currentRoomId = null, myPlayerColor = 'white', activeRoomRef = null;

    const sfx = {
        move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
        capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
        gameEnd: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3'),
        start: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3')
    };

    var currentLang = localStorage.getItem('chessLang') || 'en';
    var translations = {
        ar: { lobbyTitle: "إعدادات المباراة", labelRoom: "رقم الغرفة", labelMinutes: "الوقت (دقائق)", labelIncrement: "الزيادة (ثواني)", labelColor: "اختر لونك", colorRandom: "عشوائي", colorWhite: "أبيض", colorBlack: "أسود", btnEnter: "دخول الغرفة", playerOpponent: "الخصم", playerYou: "أنت", btnResign: "انسحاب", btnCopy: "نسخ PGN", btnDraw: "طلب تعادل", btnCancel: "إلغاء المباراة", btnRematch: "إعادة التحدي", btnHome: "الرئيسية", msgCountdownStart: "ابدأ!", msgWaiting: "بانتظار الخصم...", msgRematchOffer: "الخصم يطلب إعادة التحدي", msgDrawOffer: "الخصم يعرض التعادل", btnAccept: "موافق", btnDecline: "رفض", msgCopySuccess: "تم النسخ", labelMoves: "نقلة", titleWin: "انتصار ملكي ♚", titleLoss: "هزيمة المشرف ♔", titleDraw: "تعادل نبيل 🤝", rsnCheckmate: "بكش مات", rsnResign: "بالانسحاب", rsnTimeout: "بانتهاء الوقت", rsnStalemate: "بالخنق (Stalemate)", rsnAgreed: "بالاتفاق" },
        en: { lobbyTitle: "Match Setup", labelRoom: "Room ID", labelMinutes: "Minutes", labelIncrement: "Increment", labelColor: "Your Color", colorRandom: "Random", colorWhite: "White", colorBlack: "Black", btnEnter: "Enter Room", playerOpponent: "Opponent", playerYou: "You", btnResign: "Resign", btnCopy: "Copy PGN", btnDraw: "Offer Draw", btnCancel: "Cancel Match", btnRematch: "Rematch", btnHome: "Main Menu", msgCountdownStart: "Start!", msgWaiting: "Waiting for opponent...", msgRematchOffer: "Opponent offered a rematch", msgDrawOffer: "Opponent offered a draw", btnAccept: "Accept", btnDecline: "Decline", msgCopySuccess: "Copied", labelMoves: "Moves", titleWin: "Royal Victory ♚", titleLoss: "Honorable Defeat ♔", titleDraw: "Noble Draw 🤝", rsnCheckmate: "by Checkmate", rsnResign: "by Resignation", rsnTimeout: "by Timeout", rsnStalemate: "by Stalemate", rsnAgreed: "by Agreement" }
    };

    function applyLanguage(lang) {
        currentLang = lang; localStorage.setItem('chessLang', lang);
        $('html').attr('dir', lang === 'ar' ? 'rtl' : 'ltr').attr('lang', lang);
        $('#langToggleBtn').text(lang === 'ar' ? 'English' : 'العربية');
        $('[data-key]').each(function() {
            var key = $(this).data('key');
            if(translations[lang][key]) { if($(this).is('option')) $(this).text(translations[lang][key]); else $(this).html(translations[lang][key]); }
        });
        if(board) board.resize();
    }

    $('#langToggleBtn').click(function() { applyLanguage(currentLang === 'en' ? 'ar' : 'en'); });
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
        $('#waitingOverlay').hide(); $('#interactiveOverlay').hide();
        let count = 3; $('#countdownOverlay').text(count).show();
        let countInt = setInterval(() => {
            count--;
            if(count > 0) $('#countdownOverlay').text(count);
            else if (count === 0) $('#countdownOverlay').text(translations[currentLang].msgCountdownStart);
            else { clearInterval(countInt); $('#countdownOverlay').hide(); sfx.start.play().catch(()=>{}); gameStarted = true; updateActiveTimerStyle(); startTimer(); }
        }, 1000);
    }

    // --- منطق الدخول الآمن وتنظيف الجلسات السابقة ---
    $('#createBtn').click(function() { 
        currentRoomId = $('#roomId').val().trim();
        if (!currentRoomId) return;
        
        $(this).prop('disabled', true);
        if (activeRoomRef) activeRoomRef.off(); // تنظيف أي استماع قديم
        
        activeRoomRef = db.ref('rooms/' + currentRoomId);
        
        activeRoomRef.once('value').then(function(snapshot) {
            let data = snapshot.val();
            let minutes = parseInt($('#timeMinutes').val()) || 3; 
            incrementSeconds = parseInt($('#timeIncrement').val()) || 0;
            
            let isCreator = false;
            let savedRole = localStorage.getItem('chess_role_' + currentRoomId);

            if (savedRole && data && data.status === 'playing') {
                // إعادة دخول لغرفة شغالة
                myPlayerColor = savedRole;
                game.load_pgn(data.pgn || '');
                whiteSeconds = data.whiteSeconds; blackSeconds = data.blackSeconds; incrementSeconds = data.increment;
            } else if (!snapshot.exists() || (data && data.status !== 'waiting' && data.status !== 'playing')) {
                // إنشاء غرفة جديدة
                isCreator = true;
                let colorsArr = ['white', 'black'];
                let selectedColor = $('#colorChoice').val();
                myPlayerColor = selectedColor === 'random' ? colorsArr[Math.floor(Math.random() * colorsArr.length)] : selectedColor;
                game.reset(); 
                whiteSeconds = minutes * 60; blackSeconds = minutes * 60;
                activeRoomRef.set({
                    fen: game.fen(), pgn: game.pgn(), lastMove: null,
                    whiteSeconds: whiteSeconds, blackSeconds: blackSeconds, increment: incrementSeconds,
                    creatorColor: myPlayerColor, playersCount: 1, status: 'waiting', action: 'none'
                });
                localStorage.setItem('chess_role_' + currentRoomId, myPlayerColor); 
            } else if (data.playersCount === 1) {
                // دخول كلاعب ثاني
                myPlayerColor = data.creatorColor === 'white' ? 'black' : 'white'; 
                game.load_pgn(data.pgn || '');
                whiteSeconds = data.whiteSeconds; blackSeconds = data.blackSeconds; incrementSeconds = data.increment;
                activeRoomRef.update({ playersCount: 2, status: 'playing' });
                localStorage.setItem('chess_role_' + currentRoomId, myPlayerColor); 
            } else {
                alert(currentLang === 'ar' ? "الغرفة ممتلئة أو غير متاحة!" : "Room is full or unavailable!"); 
                $('#createBtn').prop('disabled', false); return;
            }

            $('#lobby').hide(); $('#endGameModal').hide(); $('#gameArea').fadeIn(); 
            
            if (!board) {
                var config = { draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd, moveSpeed: 100, snapbackSpeed: 100, pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png' };
                board = Chessboard('board', config); 
                $(window).resize(board.resize);
            }
            
            board.orientation(myPlayerColor); board.position(game.fen(), false);
            $('#movesHistory').text(game.pgn()); clearHighlights(); cancelPremove();
            updateTimersDisplay(); $('#resignBtn').show(); $('#drawOfferBtn').show(); $('.timer').removeClass('active');
            gameStarted = false; 
            
            if (isCreator) { $('#waitingOverlay').show(); } else if (data && data.status !== 'playing') { runCountdown(); }

            // المستمع اللحظي (مفرد وخفيف)
            activeRoomRef.on('value', function(snap) {
                let d = snap.val(); if (!d) return;

                if (d.status === 'waiting' && d.playersCount === 2) { runCountdown(); }

                // معالجة الأكشنات (عرض تعادل أو إعادة لعب)
                if (d.action && d.action.type && d.action.by !== myPlayerColor) {
                    if (d.action.state === 'offered') {
                        $('#interactiveOverlay').show().data('actionType', d.action.type);
                        let msg = d.action.type === 'rematch' ? translations[currentLang].msgRematchOffer : translations[currentLang].msgDrawOffer;
                        $('#interactiveMsg').text(msg);
                    } else if (d.action.state === 'declined') {
                        $('#interactiveOverlay').hide();
                        $('#drawOfferBtn').prop('disabled', false).text(translations[currentLang].btnDraw);
                        $('#modalRematchBtn').prop('disabled', false).text(translations[currentLang].btnRematch);
                    }
                }

                // تنفيذ قبول الأكشن
                if (d.action && d.action.state === 'accepted') {
                    $('#interactiveOverlay').hide();
                    if (d.action.type === 'draw' && gameStarted) {
                        handleServerGameEnd(null, translations[currentLang].rsnAgreed);
                    } else if (d.action.type === 'rematch') {
                        $('#endGameModal').hide(); game.reset(); board.position(game.fen());
                        whiteSeconds = d.whiteSeconds; blackSeconds = d.blackSeconds; incrementSeconds = d.increment;
                        $('#movesHistory').text(''); clearHighlights(); cancelPremove(); 
                        $('#resignBtn').show(); $('#drawOfferBtn').show(); $('.timer').removeClass('active');
                        gameStarted = false; runCountdown();
                    }
                    if (d.action.by !== myPlayerColor) { activeRoomRef.update({ action: null }); } // تنظيف
                }

                // استقبال النقلات
                if (d.lastMove && d.status === 'playing' && d.fen !== game.fen()) {
                    let m = game.move({ from: d.lastMove.from, to: d.lastMove.to, promotion: d.lastMove.promotion });
                    if (!m) { game.load_pgn(d.pgn); } 
                    board.position(game.fen());
                    if (m && m.captured) sfx.capture.play().catch(()=>{}); else sfx.move.play().catch(()=>{});
                    
                    whiteSeconds = d.whiteSeconds; blackSeconds = d.blackSeconds;
                    updateTimersDisplay(); updateActiveTimerStyle();
                    $('#movesHistory').text(game.pgn());
                    var movesBox = document.getElementById("movesHistory"); movesBox.scrollTop = movesBox.scrollHeight;
                    
                    checkEndGameConditions();
                    executePremove();
                }

                // نهايات السيرفر (استسلام أو وقت)
                if (gameStarted) {
                    if (d.status === 'resigned_w') { handleServerGameEnd('b', translations[currentLang].rsnResign); } 
                    else if (d.status === 'resigned_b') { handleServerGameEnd('w', translations[currentLang].rsnResign); } 
                    else if (d.status === 'timeout_w') { handleServerGameEnd('b', translations[currentLang].rsnTimeout); } 
                    else if (d.status === 'timeout_b') { handleServerGameEnd('w', translations[currentLang].rsnTimeout); }
                }
            });
            $('#createBtn').prop('disabled', false); 
        });
    });

    // --- أزرار التحكم اللحظية ---
    $('#cancelMatchBtn').click(function() {
        if (activeRoomRef) { activeRoomRef.remove(); activeRoomRef.off(); }
        location.reload();
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
        let actionType = $('#interactiveOverlay').data('actionType');
        let updateData = { action: { type: actionType, state: 'accepted', by: myPlayerColor } };
        
        if (actionType === 'rematch') {
            let minutes = parseInt($('#timeMinutes').val()) || 3;
            updateData.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            updateData.pgn = ''; updateData.lastMove = null;
            updateData.whiteSeconds = minutes * 60; updateData.blackSeconds = minutes * 60;
            updateData.status = 'waiting'; // يغير الحالة لكي يبدأ العد
        }
        activeRoomRef.update(updateData);
    });

    $('#declineActionBtn').click(function() {
        let actionType = $('#interactiveOverlay').data('actionType');
        activeRoomRef.update({ action: { type: actionType, state: 'declined', by: myPlayerColor } });
    });

    $('#modalHomeBtn').click(function() { 
        stopTimer(); $('#gameArea').hide(); $('#endGameModal').hide(); $('#lobby').fadeIn(); 
        localStorage.removeItem('chess_role_' + currentRoomId); 
        if (activeRoomRef) activeRoomRef.off(); 
    });

    $('#copyPgnBtn').click(function() { 
        let pgnData = game.pgn(); if (!pgnData) return; 
        if (navigator.clipboard) { navigator.clipboard.writeText(pgnData).catch(() => { fallbackCopy(pgnData); }); } else { fallbackCopy(pgnData); }
    });
    function fallbackCopy(text) { var textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select(); try { document.execCommand('copy'); } catch(e){} document.body.removeChild(textArea); }

    // --- الشطرنج والـ Premove الخفيف ---
    function checkEndGameConditions() {
        if (!gameStarted) return; 
        if (game.in_checkmate()) {
            let winnerColor = game.turn() === 'w' ? 'b' : 'w';
            handleServerGameEnd(winnerColor, translations[currentLang].rsnCheckmate);
        } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
            if (game.history().length > 4) { handleServerGameEnd(null, translations[currentLang].rsnStalemate); }
        }
    }

    function handleServerGameEnd(winnerColor, reasonTxt) { 
        gameStarted = false; stopTimer(); $('#resignBtn').hide(); $('#drawOfferBtn').hide(); $('#interactiveOverlay').hide();
        sfx.gameEnd.play().catch(()=>{}); 
        
        let titleTxt = translations[currentLang].titleDraw;
        if (winnerColor) { titleTxt = (winnerColor === myPlayerColor.charAt(0)) ? translations[currentLang].titleWin : translations[currentLang].titleLoss; }

        $('#endGameTitle').text(titleTxt); $('#endGameReason').text(reasonTxt);
        $('#endGameMoves').text(Math.ceil(game.history().length / 2));
        
        setTimeout(() => { $('#endGameModal').fadeIn(); }, 300); 
    }

    function cancelPremove() { premove = null; $('.square-55d63').removeClass('premove-highlight'); }
    function clearHighlights () { $('#board .square-55d63').removeClass('highlight legal-move legal-move-capture'); }
    
    function highlightLegalMoves(square) { 
        clearHighlights(); var moves = game.moves({ square: square, verbose: true }); 
        if (moves.length === 0) return; 
        $('#board .square-' + square).addClass('highlight'); 
        for (var i = 0; i < moves.length; i++) { var ts = $('#board .square-' + moves[i].to); if(moves[i].captured) ts.addClass('legal-move-capture'); else ts.addClass('legal-move'); } 
    }

    function processLocalMove(move) {
        if (move.captured) sfx.capture.play().catch(()=>{}); else sfx.move.play().catch(()=>{});
        if (move.color === 'w') whiteSeconds += incrementSeconds; else blackSeconds += incrementSeconds;
        updateTimersDisplay(); updateActiveTimerStyle(); startTimer();
        $('#movesHistory').text(game.pgn()); var movesBox = document.getElementById("movesHistory"); movesBox.scrollTop = movesBox.scrollHeight;
        
        activeRoomRef.update({ fen: game.fen(), pgn: game.pgn(), lastMove: { from: move.from, to: move.to, promotion: move.promotion || '' }, whiteSeconds: whiteSeconds, blackSeconds: blackSeconds });
        checkEndGameConditions();
    }

    function executePremove() { 
        if (premove && game.turn() === myPlayerColor.charAt(0) && !game.game_over()) { 
            let move = game.move({ from: premove.from, to: premove.to, promotion: 'q' }); 
            cancelPremove();
            if (move) { board.position(game.fen()); processLocalMove(move); } 
        } else { cancelPremove(); }
    }

    $(document).on('click', '#board .square-55d63', function() {
        if (!gameStarted || game.game_over()) return;
        var square = $(this).attr('data-square'); var myColorCode = myPlayerColor.charAt(0);
        
        if (selectedSquare) {
            if (game.turn() === myColorCode) {
                var move = game.move({ from: selectedSquare, to: square, promotion: 'q' }); 
                if (move) { board.position(game.fen()); clearHighlights(); selectedSquare = null; processLocalMove(move); return; }
            } else {
                // تسجيل نقلة مسبقة صارمة (Premove)
                premove = { from: selectedSquare, to: square };
                clearHighlights(); $('.square-' + selectedSquare).addClass('premove-highlight'); $('.square-' + square).addClass('premove-highlight');
                selectedSquare = null; return;
            }
            cancelPremove(); clearHighlights(); selectedSquare = null;
        }
        
        var piece = game.get(square); 
        if (piece && piece.color === myColorCode) { 
            selectedSquare = square; 
            if (game.turn() === myColorCode) highlightLegalMoves(square); 
        } else { cancelPremove(); clearHighlights(); selectedSquare = null; }
    });

    function onDragStart (source, pieceStr) { 
        if (!gameStarted || game.game_over()) return false; 
        var myColorCode = myPlayerColor.charAt(0); 
        if (pieceStr.charAt(0) !== myColorCode) return false; 
        selectedSquare = source; 
        if(game.turn() === myColorCode) highlightLegalMoves(source); 
        return true; 
    }
    
    function onDrop (source, target) { 
        if (source === target) return 'snapback'; 
        clearHighlights(); var myColorCode = myPlayerColor.charAt(0); 
        if (game.turn() === myColorCode) {
            var move = game.move({ from: source, to: target, promotion: 'q' }); 
            if (move === null) { selectedSquare = null; return 'snapback'; } 
            selectedSquare = null; processLocalMove(move); return; 
        } else {
            premove = { from: source, to: target };
            $('.square-' + source).addClass('premove-highlight'); $('.square-' + target).addClass('premove-highlight');
            selectedSquare = null; return 'snapback';
        }
    }
    function onSnapEnd () { board.position(game.fen()); }
    applyLanguage(currentLang);
});
