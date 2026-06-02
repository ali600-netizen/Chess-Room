
$(document).ready(function() {
    var game = new Chess();
    var board = null;
    var whiteSeconds = 0, blackSeconds = 0, incrementSeconds = 0;
    var timerInterval = null, selectedSquare = null, gameStarted = false;
    var userColorSelection = 'random';
    var premoveQueue = []; 

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

    var translations = {
        ar: { lobbyTitle: "تخصيص المباراة", labelMinutes: "الوقت بالدقائق", labelIncrement: "الزيادة بالثواني", labelColor: "اختيار اللون", colorRandom: "عشوائي", colorWhite: "أبيض", colorBlack: "أسود", labelTheme: "ثيم الموقع", themeChesscom: "كلاسيكي", themeSilver: "النيلي والفضي الاحترافي", btnEnter: "دخول المباراة", playerOpponent: "الخصم", playerYou: "أنت", btnResign: "انسحاب", btnCopy: "نسخ PGN", btnRematch: "إعادة التحدي", btnHome: "القائمة الرئيسية", msgCountdownStart: "ابدأ", msgWhiteWinTime: "انتهى الوقت، فوز اللاعب الأسود", msgBlackWinTime: "انتهى الوقت، فوز اللاعب الأبيض", msgResignWin: "انسحاب، فوز اللاعب ", msgCheckmateWin: "كش مات، فوز اللاعب ", msgDraw: "تعادل", msgStalemate: "تعادل بسبب وضع الخنق", msgConfirmResign: "تأكيد الانسحاب؟", msgNoMoves: "لا توجد نقلات لنسخها", msgCopySuccess: "تم نسخ النقلات بنجاح" },
        en: { lobbyTitle: "Match Setup", labelMinutes: "Minutes", labelIncrement: "Increment (Sec)", labelColor: "Color", colorRandom: "Random", colorWhite: "White", colorBlack: "Black", labelTheme: "Site Theme", themeChesscom: "Classic", themeSilver: "Navy & Silver Pro", btnEnter: "Enter Match", playerOpponent: "Opponent", playerYou: "You", btnResign: "Resign", btnCopy: "Copy PGN", btnRematch: "Rematch", btnHome: "Main Menu", msgCountdownStart: "Start", msgWhiteWinTime: "Time out, Black wins", msgBlackWinTime: "Time out, White wins", msgResignWin: "Resignation, victory for ", msgCheckmateWin: "Checkmate, victory for ", msgDraw: "Draw", msgStalemate: "Draw by stalemate", msgConfirmResign: "Confirm resignation?", msgNoMoves: "No moves to copy", msgCopySuccess: "Moves copied successfully" }
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

    function formatTime(totalSeconds) { let m = Math.floor(totalSeconds / 60); let s = totalSeconds % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
    function updateTimersDisplay() {
        let myColor = board.orientation(); let oppColor = myColor === 'white' ? 'black' : 'white';
        let mySeconds = myColor === 'white' ? whiteSeconds : blackSeconds; let oppSeconds = oppColor === 'white' ? whiteSeconds : blackSeconds;
        $('#bottomTimer').text(formatTime(mySeconds)); $('#topTimer').text(formatTime(oppSeconds));
        if(mySeconds <= 20) $('#bottomTimer').addClass('danger'); else $('#bottomTimer').removeClass('danger');
        if(oppSeconds <= 20) $('#topTimer').addClass('danger'); else $('#topTimer').removeClass('danger');
    }

    function startTimer() {
        if(timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(function() {
            if (!gameStarted || game.game_over()) return;
            if (game.turn() === 'w') { whiteSeconds--; if (whiteSeconds <= 0) endGame(translations[currentLang].msgWhiteWinTime); } else { blackSeconds--; if (blackSeconds <= 0) endGame(translations[currentLang].msgBlackWinTime); }
            updateTimersDisplay();
        }, 1000);
    }

    function updateActiveTimerStyle() { let turn = game.turn(); let myColor = board.orientation(); if ( (turn === 'w' && myColor === 'white') || (turn === 'b' && myColor === 'black') ) { $('#bottomTimer').addClass('active'); $('#topTimer').removeClass('active'); } else { $('#topTimer').addClass('active'); $('#bottomTimer').removeClass('active'); } }
    function stopTimer() { if(timerInterval) clearInterval(timerInterval); $('.timer').removeClass('active'); }

    function runCountdown(callback) {
        let count = 3; $('#countdownOverlay').text(count).show();
        let countInt = setInterval(() => {
            count--;
            if(count > 0) $('#countdownOverlay').text(count);
            else if (count === 0) $('#countdownOverlay').text(translations[currentLang].msgCountdownStart);
            else { clearInterval(countInt); $('#countdownOverlay').hide(); sfx.start.play().catch(()=>{}); callback(); }
        }, 1000);
    }

    function startMatch() {
        game.reset(); board.start(false);
        if(userColorSelection === 'random') board.orientation(Math.random() >= 0.5 ? 'white' : 'black'); else board.orientation(userColorSelection);
        $('#movesHistory').text(''); clearHighlights(); selectedSquare = null; premoveQueue = [];
        let minutes = parseInt($('#timeMinutes').val()) || 3; incrementSeconds = parseInt($('#timeIncrement').val()) || 0;
        whiteSeconds = minutes * 60; blackSeconds = minutes * 60;
        updateTimersDisplay(); $('#endGameActions').hide(); $('#resignBtn').show(); $('.timer').removeClass('active');
        gameStarted = false; runCountdown(() => { gameStarted = true; updateActiveTimerStyle(); startTimer(); });
    }

    $('#createBtn').click(function() { userColorSelection = $('#colorChoice').val(); $('#lobby').hide(); $('#gameArea').fadeIn(); board.resize(); startMatch(); });
    $('#resignBtn').click(function() { if (!gameStarted || game.game_over()) return; let winnerText = board.orientation() === 'white' ? (currentLang === 'ar' ? 'الأسود' : 'Black') : (currentLang === 'ar' ? 'الأبيض' : 'White'); if(confirm(translations[currentLang].msgConfirmResign)) endGame(translations[currentLang].msgResignWin + winnerText); });
    $('#rematchBtn').click(function() { startMatch(); });
    $('#homeBtn').click(function() { stopTimer(); $('#gameArea').hide(); $('#lobby').fadeIn(); });
    $('#copyPgnBtn').click(function() { let pgnData = game.pgn(); if (!pgnData) { alert(translations[currentLang].msgNoMoves); return; } var textArea = document.createElement("textarea"); textArea.value = pgnData; document.body.appendChild(textArea); textArea.select(); document.execCommand('copy'); alert(translations[currentLang].msgCopySuccess); document.body.removeChild(textArea); });

    function endGame(message) { gameStarted = false; stopTimer(); $('#resignBtn').hide(); $('#endGameActions').css('display', 'flex').hide().fadeIn(); sfx.gameEnd.play().catch(()=>{}); setTimeout(() => { alert(message); }, 50); }

    function getVirtualGame() {
        let vGame = new Chess(game.fen());
        let myColor = board.orientation().charAt(0);
        for (let i = 0; i < premoveQueue.length; i++) {
            let p = premoveQueue[i];
            let tokens = vGame.fen().split(' ');
            tokens[1] = myColor; tokens[3] = '-'; vGame.load(tokens.join(' '));
            vGame.move({from: p.from, to: p.to, promotion: 'q'});
        }
        let tokens = vGame.fen().split(' ');
        tokens[1] = myColor; tokens[3] = '-'; vGame.load(tokens.join(' '));
        return vGame;
    }

    function updateBoardVisuals() {
        if (premoveQueue.length > 0) { let vGame = getVirtualGame(); board.position(vGame.fen(), false); } else { board.position(game.fen(), false); }
        drawPremoveQueue();
    }

    function drawPremoveQueue() {
        $('.square-55d63').removeClass('premove-highlight');
        premoveQueue.forEach(p => { $('.square-' + p.from).addClass('premove-highlight'); $('.square-' + p.to).addClass('premove-highlight'); });
    }

    function cancelPremoves() { premoveQueue = []; updateBoardVisuals(); }
    function clearHighlights () { $('#board .square-55d63').removeClass('highlight legal-move legal-move-capture'); }

    function highlightLegalMoves(square, gameInstance) {
        clearHighlights();
        var moves = gameInstance.moves({ square: square, verbose: true });
        if (moves.length === 0) return;
        $('#board .square-' + square).addClass('highlight');
        for (var i = 0; i < moves.length; i++) {
            var targetSquare = $('#board .square-' + moves[i].to);
            if(moves[i].captured) targetSquare.addClass('legal-move-capture'); else targetSquare.addClass('legal-move');
        }
    }

    function handleMoveCompleted(move) {
        if (move.captured) sfx.capture.play().catch(()=>{}); else sfx.move.play().catch(()=>{});
        if (move.color === 'w') whiteSeconds += incrementSeconds; else blackSeconds += incrementSeconds;
        
        updateTimersDisplay(); updateActiveTimerStyle(); startTimer();
        $('#movesHistory').text(game.pgn()); var movesBox = document.getElementById("movesHistory"); movesBox.scrollTop = movesBox.scrollHeight;

        if (game.in_checkmate()) {
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]); 
            let winnerText = game.turn() === 'w' ? (currentLang === 'ar' ? 'الأسود' : 'Black') : (currentLang === 'ar' ? 'الأبيض' : 'White');
            endGame(translations[currentLang].msgCheckmateWin + winnerText); return;
        } else if (game.in_draw()) { endGame(translations[currentLang].msgDraw); return; } 
        else if (game.in_stalemate()) { endGame(translations[currentLang].msgStalemate); return; } 
        else if (game.in_check()) { sfx.check.play().catch(()=>{}); if (navigator.vibrate) navigator.vibrate([50, 50, 100]); }

        executeNextPremove();
    }

    function executeNextPremove() {
        let myColor = board.orientation().charAt(0);
        if (premoveQueue.length > 0 && game.turn() === myColor && !game.game_over()) {
            let p = premoveQueue.shift();
            let move = game.move({ from: p.from, to: p.to, promotion: 'q' });
            if (move) { setTimeout(function() { updateBoardVisuals(); handleMoveCompleted(move); }, 50); } 
            else { cancelPremoves(); }
        }
    }

    $(document).on('click', '#board .square-55d63', function() {
        if (!gameStarted || game.game_over()) return;
        var square = $(this).attr('data-square');
        var myColor = board.orientation().charAt(0);
        var vGame = getVirtualGame();

        if (selectedSquare) {
            if (premoveQueue.length === 0 && game.turn() === vGame.get(selectedSquare).color) {
                var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
                if (move) { board.position(game.fen()); clearHighlights(); selectedSquare = null; handleMoveCompleted(move); return; }
            } 
            else if (vGame.get(selectedSquare).color === myColor) {
                let moves = vGame.moves({square: selectedSquare, verbose: true});
                if (moves.some(m => m.to === square)) {
                    premoveQueue.push({ from: selectedSquare, to: square });
                    clearHighlights(); updateBoardVisuals(); selectedSquare = null; return;
                }
            }
            cancelPremoves(); clearHighlights(); selectedSquare = null;
        }
        
        var vPiece = vGame.get(square);
        if (vPiece) {
            if (premoveQueue.length === 0 && vPiece.color === game.turn()) { selectedSquare = square; highlightLegalMoves(square, vGame); } 
            else if (vPiece.color === myColor) { selectedSquare = square; highlightLegalMoves(square, vGame); } 
            else { cancelPremoves(); clearHighlights(); }
        } else { cancelPremoves(); clearHighlights(); }
    });

    function onDragStart (source, piece) {
        if (!gameStarted || game.game_over()) return false;
        var myColor = board.orientation().charAt(0);
        var vGame = getVirtualGame();
        var vPiece = vGame.get(source);
        if (!vPiece) return false;

        if (premoveQueue.length === 0 && vPiece.color === game.turn()) { selectedSquare = source; highlightLegalMoves(source, vGame); return true; }
        if (vPiece.color === myColor) { selectedSquare = source; highlightLegalMoves(source, vGame); return true; }
        return false;
    }

    function onDrop (source, target) {
        if (source === target) return 'snapback'; 
        clearHighlights();
        var myColor = board.orientation().charAt(0);
        var vGame = getVirtualGame();
        
        if (premoveQueue.length === 0 && game.turn() === vGame.get(source).color) {
            var move = game.move({ from: source, to: target, promotion: 'q' });
            if (move === null) { selectedSquare = null; return 'snapback'; }
            selectedSquare = null; handleMoveCompleted(move); return;
        } 
        else if (vGame.get(source).color === myColor) {
            let moves = vGame.moves({square: source, verbose: true});
            if (moves.some(m => m.to === target)) {
                premoveQueue.push({from: source, to: target});
                updateBoardVisuals(); selectedSquare = null; return;
            }
        }
        cancelPremoves(); selectedSquare = null; return 'snapback';
    }

    function onSnapEnd () { board.position(game.fen()); }

    var config = {
        draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd,
        moveSpeed: 100, snapbackSpeed: 100, snapSpeed: 50, pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    
    board = Chessboard('board', config);
    $(window).resize(board.resize);
    applyLanguage(currentLang); applyTheme(currentTheme);
});
