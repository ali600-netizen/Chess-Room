          // مفاتيح الربط الخاصة بمشروعك مع رابط قاعدة البيانات الصحيح
const firebaseConfig = {
    apiKey: "AIzaSyCWL3DohN_BVmwlDjLYP_UohoKqnw4ylzU",
    authDomain: "chessroom-ca23f.firebaseapp.com",
    databaseURL: "https://chessroom-ca23f-default-rtdb.firebaseio.com/", // تم وضع رابطك هنا بنجاح
    projectId: "chessroom-ca23f",
    storageBucket: "chessroom-ca23f.firebasestorage.app",
    messagingSenderId: "1030607242972",
    appId: "1:1030607242972:web:dfcdb53525a354dc991619"
};

// تشغيل السيرفر بالطريقة الكلاسيكية الآمنة للمتصفحات
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

$(document).ready(function() {
    var game = new Chess();
    var board = null;
    var whiteSeconds = 0, blackSeconds = 0, incrementSeconds = 0;
    var timerInterval = null, selectedSquare = null, gameStarted = false;
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

    var translations = {
        ar: { lobbyTitle: "تخصيص المباراة", labelRoom: "رقم الغرفة", labelMinutes: "الوقت بالدقائق", labelIncrement: "الزيادة بالثواني", labelColor: "اختر لونك", colorRandom: "عشوائي", colorWhite: "أبيض", colorBlack: "أسود", labelTheme: "ثيم الموقع", themeChesscom: "كلاسيكي", themeSilver: "النيلي والفضي الاحترافي", btnEnter: "دخول الغرفة", playerOpponent: "الخصم", playerYou: "أنت", btnResign: "انسحاب", btnCopy: "نسخ PGN", btnHome: "القائمة الرئيسية", msgCountdownStart: "ابدأ", msgWhiteWinTime: "انتهى الوقت، فوز اللاعب الأسود", msgBlackWinTime: "انتهى الوقت، فوز اللاعب الأبيض", msgResignWin: "انسحاب، فوز اللاعب ", msgCheckmateWin: "كش مات، فوز اللاعب ", msgDraw: "تعادل", msgStalemate: "تعادل بسبب وضع الخنق", msgConfirmResign: "تأكيد الانسحاب؟", msgNoMoves: "لا توجد نقلات لنسخها", msgCopySuccess: "تم نسخ النقلات بنجاح" },
        en: { lobbyTitle: "Match Setup", labelRoom: "Room ID", labelMinutes: "Minutes", labelIncrement: "Increment (Sec)", labelColor: "Your Color", colorRandom: "Random", colorWhite: "White", colorBlack: "Black", labelTheme: "Site Theme", themeChesscom: "Classic", themeSilver: "Navy & Silver Pro", btnEnter: "Enter Room", playerOpponent: "Opponent", playerYou: "You", btnResign: "Resign", btnCopy: "Copy PGN", btnHome: "Main Menu", msgCountdownStart: "Start", msgWhiteWinTime: "Time out, Black wins", msgBlackWinTime: "Time out, White wins", msgResignWin: "Resignation, victory for ", msgCheckmateWin: "Checkmate, victory for ", msgDraw: "Draw", msgStalemate: "Draw by stalemate", msgConfirmResign: "Confirm resignation?", msgNoMoves: "No moves to copy", msgCopySuccess: "Moves copied successfully" }
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
            if (game.turn() === 'w') { whiteSeconds--; if (whiteSeconds <= 0) endGame(translations[currentLang].msgWhiteWinTime); } 
            else { blackSeconds--; if (blackSeconds <= 0) endGame(translations[currentLang].msgBlackWinTime); }
            updateTimersDisplay();
        }, 1000);
    }

    function updateActiveTimerStyle() { 
        let turn = game.turn(); 
        if (turn === myPlayerColor.charAt(0)) { $('#bottomTimer').addClass('active'); $('#topTimer').removeClass('active'); } 
        else { $('#topTimer').addClass('active'); $('#bottomTimer').removeClass('active'); } 
    }
    
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

    $('#createBtn').click(function() { 
        currentRoomId = $('#roomId').val().trim();
        if (!currentRoomId) { alert(currentLang === 'ar' ? 'أدخل رقم الغرفة أولاً!' : 'Please enter a Room ID!'); return; }
        
        let selectedColor = $('#colorChoice').val();
        
        let btn = $(this);
        let originalText = btn.text();
        btn.text(currentLang === 'ar' ? 'جاري الاتصال بالسيرفر...' : 'Connecting...').prop('disabled', true);
        
        const roomRef = db.ref('rooms/' + currentRoomId);
        
        roomRef.once('value').then(function(snapshot) {
            if (!snapshot.exists()) {
                if (selectedColor === 'random') {
                    myPlayerColor = Math.random() >= 0.5 ? 'white' : 'black';
                } else {
                    myPlayerColor = selectedColor;
                }
                
                game.reset();
                let minutes = parseInt($('#timeMinutes').val()) || 3; 
                incrementSeconds = parseInt($('#timeIncrement').val()) || 0;
                whiteSeconds = minutes * 60; blackSeconds = minutes * 60;
                
                roomRef.set({
                    fen: game.fen(), pgn: game.pgn(),
                    whiteSeconds: whiteSeconds, blackSeconds: blackSeconds,
                    increment: incrementSeconds, creatorColor: myPlayerColor
                });
            } else {
                let data = snapshot.val();
                myPlayerColor = data.creatorColor === 'white' ? 'black' : 'white'; 
                
                game.load(data.fen);
                whiteSeconds = data.whiteSeconds;
                blackSeconds = data.blackSeconds;
                incrementSeconds = data.increment;
            }

            $('#lobby').hide(); $('#gameArea').fadeIn(); board.resize(); 
            board.orientation(myPlayerColor);
            board.start(false);
            if(game.fen() !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') board.position(game.fen());

            $('#movesHistory').text(game.pgn()); clearHighlights(); selectedSquare = null; premoveQueue = [];
            updateTimersDisplay(); $('#endGameActions').hide(); $('#resignBtn').show(); $('.timer').removeClass('active');
            gameStarted = false; 
            
            runCountdown(() => { gameStarted = true; updateActiveTimerStyle(); startTimer(); });

            roomRef.on('value', function(snap) {
                let data = snap.val();
                if (data && data.fen !== game.fen()) {
                    game.load(data.fen); board.position(data.fen);
                    sfx.move.play().catch(()=>{});
                    whiteSeconds = data.whiteSeconds; blackSeconds = data.blackSeconds;
                    updateTimersDisplay(); updateActiveTimerStyle();
                    $('#movesHistory').text(data.pgn);
                    var movesBox = document.getElementById("movesHistory"); movesBox.scrollTop = movesBox.scrollHeight;
                    
                    if (game.in_checkmate() || game.in_draw() || game.in_stalemate()) { handleGameEndScenarios(); return; } 
                    else if (game.in_check()) { sfx.check.play().catch(()=>{}); if (navigator.vibrate) navigator.vibrate([50, 50, 100]); }
                    
                    executeNextPremove();
                }
            });
            
            btn.text(originalText).prop('disabled', false); 
        }).catch(function(error) {
            alert((currentLang === 'ar' ? "فشل الاتصال بالسيرفر! السبب: " : "Connection Failed! Reason: ") + error.message);
            btn.text(originalText).prop('disabled', false);
        });
    });

    $('#resignBtn').click(function() { 
        if (!gameStarted || game.game_over()) return; 
        let winnerText = myPlayerColor === 'white' ? (currentLang === 'ar' ? 'الأسود' : 'Black') : (currentLang === 'ar' ? 'الأبيض' : 'White'); 
        if(confirm(translations[currentLang].msgConfirmResign)) endGame(translations[currentLang].msgResignWin + winnerText); 
    });
    
    $('#homeBtn').click(function() { stopTimer(); $('#gameArea').hide(); $('#lobby').fadeIn(); db.ref('rooms/' + currentRoomId).off(); });

    function handleGameEndScenarios() {
        if (game.in_checkmate()) {
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]); 
            let winnerText = game.turn() === 'w' ? (currentLang === 'ar' ? 'الأسود' : 'Black') : (currentLang === 'ar' ? 'الأبيض' : 'White');
            endGame(translations[currentLang].msgCheckmateWin + winnerText);
        } else if (game.in_draw()) { endGame(translations[currentLang].msgDraw); } 
        else if (game.in_stalemate()) { endGame(translations[currentLang].msgStalemate); }
    }

    function endGame(message) { gameStarted = false; stopTimer(); $('#resignBtn').hide(); $('#endGameActions').css('display', 'flex').hide().fadeIn(); sfx.gameEnd.play().catch(()=>{}); setTimeout(() => { alert(message); }, 50); }

    function getVirtualGame() {
        let vGame = new Chess(game.fen());
        for (let i = 0; i < premoveQueue.length; i++) {
            let p = premoveQueue[i];
            let tokens = vGame.fen().split(' '); tokens[1] = myPlayerColor.charAt(0); tokens[3] = '-'; vGame.load(tokens.join(' '));
            vGame.move({from: p.from, to: p.to, promotion: 'q'});
        }
        let tokens = vGame.fen().split(' '); tokens[1] = myPlayerColor.charAt(0); tokens[3] = '-'; vGame.load(tokens.join(' '));
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
        clearHighlights(); var moves = gameInstance.moves({ square: square, verbose: true });
        if (moves.length === 0) return;
        $('#board .square-' + square).addClass('highlight');
        for (var i = 0; i < moves.length; i++) { var targetSquare = $('#board .square-' + moves[i].to); if(moves[i].captured) targetSquare.addClass('legal-move-capture'); else targetSquare.addClass('legal-move'); }
    }

    function handleMoveCompleted(move, isMyLocalMove) {
        if (move.captured) sfx.capture.play().catch(()=>{}); else sfx.move.play().catch(()=>{});
        if (move.color === 'w') whiteSeconds += incrementSeconds; else blackSeconds += incrementSeconds;
        
        updateTimersDisplay(); updateActiveTimerStyle(); startTimer();
        $('#movesHistory').text(game.pgn()); var movesBox = document.getElementById("movesHistory"); movesBox.scrollTop = movesBox.scrollHeight;

        if (isMyLocalMove) {
            db.ref('rooms/' + currentRoomId).update({
                fen: game.fen(), pgn: game.pgn(),
                whiteSeconds: whiteSeconds, blackSeconds: blackSeconds
            });
        }

        handleGameEndScenarios();
        if (game.in_check() && !game.game_over()) { sfx.check.play().catch(()=>{}); if (navigator.vibrate) navigator.vibrate([50, 50, 100]); }
        executeNextPremove();
    }

    function executeNextPremove() {
        if (premoveQueue.length > 0 && game.turn() === myPlayerColor.charAt(0) && !game.game_over()) {
            let p = premoveQueue.shift();
            let move = game.move({ from: p.from, to: p.to, promotion: 'q' });
            if (move) { setTimeout(function() { updateBoardVisuals(); handleMoveCompleted(move, true); }, 50); } 
            else { cancelPremoves(); }
        }
    }

    $(document).on('click', '#board .square-55d63', function() {
        if (!gameStarted || game.game_over()) return;
        var square = $(this).attr('data-square');
        var myColorCode = myPlayerColor.charAt(0);
        var vGame = getVirtualGame();

        if (selectedSquare) {
            let selectedPiece = vGame.get(selectedSquare);
            if (selectedPiece && selectedPiece.color === myColorCode) {
                if (premoveQueue.length === 0 && game.turn() === myColorCode) {
                    var move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
                    if (move) { board.position(game.fen()); clearHighlights(); selectedSquare = null; handleMoveCompleted(move, true); return; }
                } else {
                    let moves = vGame.moves({square: selectedSquare, verbose: true});
                    if (moves.some(m => m.to === square)) {
                        premoveQueue.push({ from: selectedSquare, to: square });
                        clearHighlights(); updateBoardVisuals(); selectedSquare = null; return;
                    }
                }
            }
            cancelPremoves(); clearHighlights(); selectedSquare = null;
        }
        
        var vPiece = vGame.get(square);
        if (vPiece && vPiece.color === myColorCode) {
            selectedSquare = square; highlightLegalMoves(square, vGame);
        } else { cancelPremoves(); clearHighlights(); selectedSquare = null; }
    });

    function onDragStart (source, piece) {
        if (!gameStarted || game.game_over()) return false;
        var myColorCode = myPlayerColor.charAt(0);
        var vGame = getVirtualGame();
        var vPiece = vGame.get(source);
        
        if (!vPiece || vPiece.color !== myColorCode) return false; 

        selectedSquare = source; highlightLegalMoves(source, vGame); return true;
    }

    function onDrop (source, target) {
        if (source === target) return 'snapback'; 
        clearHighlights();
        var myColorCode = myPlayerColor.charAt(0);
        var vGame = getVirtualGame();
        var piece = vGame.get(source);
        
        if (!piece || piece.color !== myColorCode) return 'snapback';

        if (premoveQueue.length === 0 && game.turn() === myColorCode) {
            var move = game.move({ from: source, to: target, promotion: 'q' });
            if (move === null) { selectedSquare = null; return 'snapback'; }
            selectedSquare = null; handleMoveCompleted(move, true); return;
        } else {
            let moves = vGame.moves({square: source, verbose: true});
            if (moves.some(m => m.to === target)) {
                premoveQueue.push({from: source, to: target});
                updateBoardVisuals(); selectedSquare = null; return 'snapback';
            }
        }
        cancelPremoves(); selectedSquare = null; return 'snapback';
    }

    function onSnapEnd () { board.position(game.fen()); }

    var config = {
        draggable: true, position: 'start', onDragStart: onDragStart, onDrop: onDrop, onSnapEnd: onSnapEnd,
        moveSpeed: 100, snapbackSpeed: 100, snapSpeed: 50, pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    
    board = Chessboard('board', config); $(window).resize(board.resize);
    applyLanguage(currentLang); applyTheme(currentTheme);
});
  
