const firebaseConfig = {
    apiKey: "AIzaSyCWL3DohN_BVmwlDjLYP_UohoKqnw4ylzU",
    authDomain: "chessroom-ca23f.firebaseapp.com",
    databaseURL: "https://chessroom-ca23f-default-rtdb.firebaseio.com/",
    projectId: "chessroom-ca23f",
    storageBucket: "chessroom-ca23f.firebasestorage.app",
    messagingSenderId: "1030607242972",
    appId: "1:1030607242972:web:dfcdb53525a354dc991619"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

$(document).ready(function() {
    var game = new Chess();
    var board = null;
    var whiteSeconds = 0, blackSeconds = 0, incrementSeconds = 0;
    var timerInterval = null, selectedSquare = null, gameStarted = false, isWaiting = false;
    var premoveQueue = []; 
    var currentRoomId = null;
    var myPlayerColor = 'white';

    const sfx = {
        move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
        capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
        castle: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/castle.mp3'),
        check: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3'),
        gameEnd: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3'),
        start: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-start.mp3')
    };

    var currentLang = localStorage.getItem('chessLang') || 'en';
    var currentTheme = localStorage.getItem('chessTheme') || 'silver';

    // تحديث الترجمة لتناسب اللوحة العصرية
    var translations = {
        ar: { lobbyTitle: "تخصيص المباراة", labelRoom: "رقم الغرفة", labelMinutes: "الوقت بالدقائق", labelIncrement: "الزيادة بالثواني", labelColor: "اختر لونك", colorRandom: "عشوائي", colorWhite: "أبيض", colorBlack: "أسود", labelTheme: "ثيم الموقع", themeChesscom: "كلاسيكي", themeSilver: "النيلي والفضي الاحترافي", btnEnter: "دخول الغرفة", playerOpponent: "الخصم", playerYou: "أنت", btnResign: "انسحاب", btnCopy: "نسخ PGN", btnRematch: "إعادة التحدي", btnHome: "القائمة الرئيسية", msgCountdownStart: "ابدأ", msgWaiting: "جاري البحث عن الخصم...", msgRematchOffer: "الخصم يطلب إعادة التحدي!", btnAccept: "موافق", btnDecline: "رفض", msgCopySuccess: "تم النسخ", labelMoves: "نقلة", 
        titleWin: "انتصرت! 🏆", titleLoss: "خسرت 😔", titleDraw: "تعادل 🤝",
        rsnCheckmate: "بكش مات", rsnResign: "بالانسحاب", rsnTimeout: "بانتهاء الوقت", rsnStalemate: "بالخنق (Stalemate)" },
        
        en: { lobbyTitle: "Match Setup", labelRoom: "Room ID", labelMinutes: "Minutes", labelIncrement: "Increment (Sec)", labelColor: "Your Color", colorRandom: "Random", colorWhite: "White", colorBlack: "Black", labelTheme: "Site Theme", themeChesscom: "Classic", themeSilver: "Navy & Silver Pro", btnEnter: "Enter Room", playerOpponent: "Opponent", playerYou: "You", btnResign: "Resign", btnCopy: "Copy PGN", btnRematch: "Rematch", btnHome: "Main Menu", msgCountdownStart: "Start", msgWaiting: "Waiting for opponent...", msgRematchOffer: "Opponent offered a rematch!", btnAccept: "Accept", btnDecline: "Decline", msgCopySuccess: "Copied", labelMoves: "Moves",
        titleWin: "You Won! 🏆", titleLoss: "You Lost 😔", titleDraw: "Draw 🤝",
        rsnCheckmate: "by Checkmate", rsnResign: "by Resignation", rsnTimeout: "by Timeout", rsnStalemate: "by Stalemate" }
    };

    function applyLanguage(lang) {
        currentLang = lang; localStorage.setItem('chessLang', lang);
        if(lang === 'ar') { $('html').attr('dir', 'rtl').attr('lang', 'ar'); $('#langToggleBtn').text('English'); } else { $('html').attr('dir', 'ltr').attr('lang', 'en'); $('#langToggleBtn').text('العربية'); }
        $('[data-key]').each(function() { var key = $(this).data('key'); if(translations[lang][key]) { if($(this).is('option')) $(this).text(translations[lang][key]); else $(this).html(translations[lang][key]); } });
    }

    function applyTheme(theme) { $('body').removeClass('theme-silver theme-chesscom').addClass('theme-' + theme); localStorage.setItem('chessTheme', theme); $('#themeChoice').val(theme); }
    $('#langToggleBtn').click(function() { applyLanguage(currentLang === 'en' ? 'ar' : 'en'); if(board) board.resize(); });
    $('#themeChoice').change(function() { applyTheme($(this).val()); });
    document.getElementById('board').addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    $(document).on('contextmenu', '#board', function(e) { e.preventDefault(); cancelPremoves(); });

    function formatTime(totalSeconds) { let m = Math.floor(totalSeconds / 60); let s = totalSeconds % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
    
    function updateTimersDisplay() {
        let oppColor = myPlayerColor === 'white' ? 'black' : 'white';
        let mySeconds = myPlayerColor === 'white' ? whiteSeconds : blackSeconds; 
        let oppSeconds = oppColor === 'white' ? whiteSeconds : blackSeconds;
        $('#bottomTimer').text(formatTime(mySeconds)); $('#topTimer').text(formatTime(oppSeconds));
        if(mySeconds <= 20) $('#bottomTimer').addClass('danger'); else $('#bottomTimer').removeClass('danger');
        if(oppSeconds <= 20) $('#topTimer').addClass('danger'); else $('#topTimer').removeClass('danger');
    }

    function startTimer() {
        if(timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(function() {
            if (!gameStarted || game.game_over()) return;
            if (game.turn() === 'w') { 
                whiteSeconds--; 
                if (whiteSeconds <= 0 && myPlayerColor === 'white') { db.ref('rooms/' + currentRoomId).update({ status: 'timeout_w' }); }
            } else { 
                blackSeconds--; 
                if (blackSeconds <= 0 && myPlayerColor === 'black') { db.ref('rooms/' + currentRoomId).update({ status: 'timeout_b' }); }
            }
            updateTimersDisplay();
        }, 1000);
    }

    function updateActiveTimerStyle() { 
        let turn = game.turn(); 
        if (turn === myPlayerColor.charAt(0)) { $('#bottomTimer').addClass('active'); $('#topTimer').removeClass('active'); } 
        else { $('#topTimer').addClass('active'); $('#bottomTimer').removeClass('active'); } 
    }
    
    function stopTimer() { if(timerInterval) clearInterval(timerInterval); $('.timer').removeClass('active'); }

    function runCountdown() {
        $('#waitingOverlay').hide();
        let count = 3; $('#countdownOverlay').text(count).show();
        let countInt = setInterval(() => {
            count--;
            if(count > 0) $('#countdownOverlay').text(count);
            else if (count === 0) $('#countdownOverlay').text(translations[currentLang].msgCountdownStart);
            else { 
                clearInterval(countInt); 
                $('#countdownOverlay').hide(); 
                sfx.start.play().catch(()=>{}); 
                gameStarted = true; 
                updateActiveTimerStyle(); 
                startTimer(); 
            }
        }, 1000);
    }

    // ألوان ألعاب نارية أنيقة وراقية تناسب الثيم
    function triggerWinEffects(winnerColor) {
        if (winnerColor === myPlayerColor.charAt(0)) {
            var duration = 3000; var end = Date.now() + duration;
            var modernColors = ['#81b64c', '#ffffff', '#cbd5e1', '#f8fafc'];
            (function frame() {
                confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: modernColors });
                confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: modernColors });
                if (Date.now() < end) requestAnimationFrame(frame);
            }());
        }
    }

    $('#createBtn').click(function() { 
        currentRoomId = $('#roomId').val().trim();
        if (!currentRoomId) { return; }
        
        let selectedColor = $('#colorChoice').val();
        $(this).prop('disabled', true);
        const roomRef = db.ref('rooms/' + currentRoomId);
        
        let savedRole = localStorage.getItem('chess_role_' + currentRoomId);
        
        roomRef.once('value').then(function(snapshot) {
            let data = snapshot.val();
            let minutes = parseInt($('#timeMinutes').val()) || 3; 
            incrementSeconds = parseInt($('#timeIncrement').val()) || 0;
            whiteSeconds = minutes * 60; blackSeconds = minutes * 60;

            if (savedRole && data && data.status === 'playing') {
                myPlayerColor = savedRole;
                game.load_pgn(data.pgn || '');
                whiteSeconds = data.whiteSeconds; blackSeconds = data.blackSeconds; incrementSeconds = data.increment;
                isWaiting = false;
            } else if (!snapshot.exists() || (data && data.status !== 'waiting' && data.status !== 'playing')) {
                let colorsArr = ['white', 'black'];
                myPlayerColor = selectedColor === 'random' ? colorsArr[Math.floor(Math.random() * colorsArr.length)] : selectedColor;
                game.reset(); 
                roomRef.set({
                    fen: game.fen(), pgn: game.pgn(), lastMove: null,
                    whiteSeconds: whiteSeconds, blackSeconds: blackSeconds,
                    increment: incrementSeconds, creatorColor: myPlayerColor,
                    playersCount: 1, status: 'waiting', rematch: 'none'
                });
                localStorage.setItem('chess_role_' + currentRoomId, myPlayerColor); 
                isWaiting = true;
            } else if (data.playersCount === 1) {
                myPlayerColor = data.creatorColor === 'white' ? 'black' : 'white'; 
                if (data.pgn) { game.load_pgn(data.pgn); } else { game.load(data.fen); }
                whiteSeconds = data.whiteSeconds; blackSeconds = data.blackSeconds; incrementSeconds = data.increment;
                roomRef.update({ playersCount: 2, status: 'playing' });
                localStorage.setItem('chess_role_' + currentRoomId, myPlayerColor); 
                isWaiting = false;
            } else {
                $('#createBtn').prop('disabled', false); return;
            }

            $('#lobby').hide(); $('#endGameModal').hide(); $('#gameArea').fadeIn(); board.resize(); 
            board.orientation(myPlayerColor); board.start(false);
            if(game.fen() !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') board.position(game.fen());

            $('#movesHistory').text(game.pgn()); clearHighlights(); premoveQueue = [];
            updateTimersDisplay(); $('#resignBtn').show(); $('.timer').removeClass('active');
            gameStarted = false; 
            
            if (isWaiting) { $('#waitingOverlay').show(); } else { runCountdown(); }

            roomRef.off();

            roomRef.on('value', function(snap) {
                let d = snap.val(); if (!d) return;

                if (isWaiting && d.playersCount === 2 && d.status === 'playing') {
                    isWaiting = false; runCountdown();
                }

                if (d.rematch === 'offered' && d.rematchBy !== myPlayerColor && d.status !== 'playing') {
                    $('#rematchOfferOverlay').show();
                }

                if (d.rematch === 'declined') {
                    $('#rematchOfferOverlay').hide();
                    $('#modalRematchBtn').prop('disabled', false).text(translations[currentLang].btnRematch);
                }

                if (d.rematch === 'accepted' || (d.status === 'playing' && game.game_over())) {
                    $('#rematchOfferOverlay').hide(); $('#endGameModal').hide(); game.reset(); board.position(game.fen());
                    whiteSeconds = d.whiteSeconds; blackSeconds = d.blackSeconds; incrementSeconds = d.increment;
                    $('#movesHistory').text(''); clearHighlights(); premoveQueue = []; 
                    $('#resignBtn').show(); $('.timer').removeClass('active');
                    gameStarted = false; runCountdown();
                    if(d.rematch === 'accepted') roomRef.update({ rematch: 'none' }); 
                }

                if (d.lastMove && d.status === 'playing' && d.fen !== game.fen()) {
                    let m = game.move({ from: d.lastMove.from, to: d.lastMove.to, promotion: d.lastMove.promotion });
                    if (!m) { game.load_pgn(d.pgn); } 
                    board.position(game.fen());
                    sfx.move.play().catch(()=>{});
                    whiteSeconds = d.whiteSeconds; blackSeconds = d.blackSeconds;
                    updateTimersDisplay(); updateActiveTimerStyle();
                    $('#movesHistory').text(game.pgn());
                    var movesBox = document.getElementById("movesHistory"); movesBox.scrollTop = movesBox.scrollHeight;
                    
                    if (game.in_checkmate() || game.in_draw() || game.in_stalemate()) { handleGameEndScenarios(); return; } 
                    else if (game.in_check()) { sfx.check.play().catch(()=>{}); if (navigator.vibrate) navigator.vibrate([50, 50, 100]); }
                    executeNextPremove();
                }

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

    $('#resignBtn').click(function() { 
        if (!gameStarted || game.game_over()) return; 
        let statusVal = myPlayerColor === 'white' ? 'resigned_w' : 'resigned_b';
        db.ref('rooms/' + currentRoomId).update({ status: statusVal });
    });
    
    // زر الإعادة الآن موجود داخل اللوحة الجديدة Modal
    $('#modalRematchBtn').click(function() {
        db.ref('rooms/' + currentRoomId).update({ rematch: 'offered', rematchBy: myPlayerColor });
        let btn = $(this);
        btn.text(currentLang === 'ar' ? 'انتظار...' : 'Waiting...').prop('disabled', true);
    });

    $('#acceptRematchBtn').click(function() {
        let minutes = parseInt($('#timeMinutes').val()) || 3;
        db.ref('rooms/' + currentRoomId).update({
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', pgn: '', lastMove: null,
            whiteSeconds: minutes * 60, blackSeconds: minutes * 60,
            status: 'playing', rematch: 'accepted'
        });
    });

    $('#declineRematchBtn').click(function() {
        $('#rematchOfferOverlay').hide();
        db.ref('rooms/' + currentRoomId).update({ rematch: 'declined' });
    });

    // زر العودة للرئيسية موجود داخل اللوحة أيضاً
    $('#modalHomeBtn').click(function() { 
        stopTimer(); $('#gameArea').hide(); $('#endGameModal').hide(); $('#lobby').fadeIn(); 
        localStorage.removeItem('chess_role_' + currentRoomId); 
        db.ref('rooms/' + currentRoomId).off(); 
    });

    $('#copyPgnBtn').click(function() { 
        let pgnData = game.pgn(); if (!pgnData) return; 
        if (navigator.clipboard) { navigator.clipboard.writeText(pgnData).catch(() => { fallbackCopy(pgnData); }); } else { fallbackCopy(pgnData); }
    });
    function fallbackCopy(text) { var textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select(); try { document.execCommand('copy'); } catch(e){} document.body.removeChild(textArea); }

        function handleGameEndScenarios() {
        // إضافة شرط: لا ننهي اللعبة إلا إذا كانت قد بدأت فعلياً وتجاوزنا النقلات الافتتاحية
        if (!gameStarted) return; 

        if (game.in_checkmate()) {
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]); 
            let winnerColor = game.turn() === 'w' ? 'b' : 'w';
            let winnerText = winnerColor === 'b' ? (currentLang === 'ar' ? 'الأسود' : 'Black') : (currentLang === 'ar' ? 'الأبيض' : 'White');
            endGame(translations[currentLang].msgCheckmateWin + winnerText, winnerColor);
        } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
            // إضافة شرط لعدم اعتبار المباراة تعادلاً إلا في حالات معينة
            if (game.history().length > 5) {
                endGame(translations[currentLang].msgDraw, null);
            }
        }
    }

        showEndGameModal(winnerColor, reason);
    }

    function handleServerGameEnd(winnerColor, reason) {
        showEndGameModal(winnerColor, reason);
    }

    // الدالة المسؤولة عن عرض اللوحة العصرية
    function showEndGameModal(winnerColor, reasonTxt) { 
        gameStarted = false; stopTimer(); $('#resignBtn').hide(); 
        sfx.gameEnd.play().catch(()=>{}); 
        
        let titleTxt = '';
        if (winnerColor) {
            triggerWinEffects(winnerColor);
            titleTxt = (winnerColor === myPlayerColor.charAt(0)) ? translations[currentLang].titleWin : translations[currentLang].titleLoss;
        } else {
            titleTxt = translations[currentLang].titleDraw;
        }

        // حساب عدد النقلات الكاملة
        let fullMoves = Math.ceil(game.history().length / 2);

        $('#endGameTitle').text(titleTxt);
        $('#endGameReason').text(reasonTxt);
        $('#endGameMoves').text(fullMoves);
        
        setTimeout(() => { $('#endGameModal').fadeIn(); }, 400); 
    }

    function getVirtualGame() {
        let vGame = new Chess(game.fen());
        for (let i = 0; i < premoveQueue.length; i++) {
            let p = premoveQueue[i]; let tokens = vGame.fen().split(' '); tokens[1] = myPlayerColor.charAt(0); tokens[3] = '-'; vGame.load(tokens.join(' '));
            vGame.move({from: p.from, to: p.to, promotion: 'q'});
        }
        let tokens = vGame.fen().split(' '); tokens[1] = myPlayerColor.charAt(0); tokens[3] = '-'; vGame.load(tokens.join(' '));
        return vGame;
    }

    function updateBoardVisuals() {
        if (premoveQueue.length > 0) { let vGame = getVirtualGame(); board.position(vGame.fen(), false); } else { board.position(game.fen(), false); }
        drawPremoveQueue();
    }
    function drawPremoveQueue() { $('.square-55d63').removeClass('premove-highlight'); premoveQueue.forEach(p => { $('.square-' + p.from).addClass('premove-highlight'); $('.square-' + p.to).addClass('premove-highlight'); }); }
    function cancelPremoves() { premoveQueue = []; updateBoardVisuals(); }
    function clearHighlights () { $('#board .square-55d63').removeClass('highlight legal-move legal-move-capture'); }
    function highlightLegalMoves(square, gameInstance) { clearHighlights(); var moves = gameInstance.moves({ square: square, verbose: true }); if (moves.length === 0) return; $('#board .square-' + square).addClass('highlight'); for (var i = 0; i < moves.length; i++) { var targetSquare = $('#board .square-' + moves[i].to); if(moves[i].captured) targetSquare.addClass('legal-move-capture'); else targetSquare.addClass('legal-move'); } }

    function handleMoveCompleted(move, isMyLocalMove) {
        if (move.captured) sfx.capture.play().catch(()=>{}); else sfx.move.play().catch(()=>{});
        if (move.color === 'w') whiteSeconds += incrementSeconds; else blackSeconds += incrementSeconds;
        updateTimersDisplay(); updateActiveTimerStyle(); startTimer();
        $('#movesHistory').text(game.pgn()); var movesBox = document.getElementById("movesHistory"); movesBox.scrollTop = movesBox.scrollHeight;
        if (isMyLocalMove) { db.ref('rooms/' + currentRoomId).update({ fen: game.fen(), pgn: game.pgn(), lastMove: { from: move.from, to: move.to, promotion: move.promotion || '' }, whiteSeconds: whiteSeconds, blackSeconds: blackSeconds }); }
        handleGameEndScenarios();
        if (game.in_check() && !game.game_over()) { sfx.check.play().catch(()=>{}); if (navigator.vibrate) navigator.vibrate([50, 50, 100]); }
        executeNextPremove();
    }

    function executeNextPremove() { if (premoveQueue.length > 0 && game.turn() === myPlayerColor.charAt(0) && !game.game_over()) { let p = premoveQueue.shift(); let move = game.move({ from: p.from, to: p.to, promotion: 'q' }); if (move) { setTimeout(function() { updateBoardVisuals(); handleMoveCompleted(move, true); }, 50); } else { cancelPremoves(); } } }

    $(document).on('click', '#board .square-55d63', function() {
        if (!gameStarted || game.game_over()) return;
        var square = $(this).attr('data-square'); var myColorCode = myPlayerColor.charAt(0); var vGame = getVirtualGame();
        if (selectedSquare) {
            let selectedPiece = vGame.get(selectedSquare);
            if (selectedPiece && selectedPiece.color === myColorCode) {
                if (premoveQueue.length === 0 && game.turn() === myColorCode) { var move = game.move({ from: selectedSquare, to: square, promotion: 'q' }); if (move) { board.position(game.fen()); clearHighlights(); selectedSquare = null; handleMoveCompleted(move, true); return; } } 
                else { let moves = vGame.moves({square: selectedSquare, verbose: true}); if (moves.some(m => m.to === square)) { premoveQueue.push({ from: selectedSquare, to: square }); clearHighlights(); updateBoardVisuals(); selectedSquare = null; return; } }
            }
            cancelPremoves(); clearHighlights(); selectedSquare = null;
        }
        var vPiece = vGame.get(square); if (vPiece && vPiece.color === myColorCode) { selectedSquare = square; highlightLegalMoves(square, vGame); } else { cancelPremoves(); clearHighlights(); selectedSquare = null; }
    });

    function onDragStart (source, piece) { if (!gameStarted || game.game_over()) return false; var myColorCode = myPlayerColor.charAt(0); var vGame = getVirtualGame(); var vPiece = vGame.get(source); if (!vPiece || vPiece.color !== myColorCode) return false; selectedSquare = source; highlightLegalMoves(source, vGame); return true; }
    function onDrop (source, target) { if (source === target) return 'snapback'; clearHighlights(); var myColorCode = myPlayerColor.charAt(0); var vGame = getVirtualGame(); var piece = vGame.get(source); if (!piece || piece.color !== myColorCode) return 'snapback'; if (premoveQueue.length === 0 && game.turn() === myColorCode) { var move = game.move({ from: source, to: target, promotion: 'q' }); if (move === null) { selectedSquare = null; return 'snapback'; } selectedSquare = null; handleMoveCompleted(move, true); return; } else { let moves = vGame.moves({square: source, verbose: true}); if (moves.some(m => m.to === target)) { premoveQueue.push({from: source, to: target}); updateBoardVisuals(); selectedSquare = null; return 'snapback'; } } cancelPremoves(); selectedSquare = null; return 'snapback'; }
    function onSnapEnd () { board.position(game.fen()); }
    var config = { draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd, moveSpeed: 100, snapbackSpeed: 100, snapSpeed: 50, pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png' };
    board = Chessboard('board', config); $(window).resize(board.resize); applyLanguage(currentLang); applyTheme(currentTheme);
});
