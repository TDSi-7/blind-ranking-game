class MimiMemoryChess {
    constructor() {
        this.circles = [];
        this.circleCount = 25;
        this.playerMode = 1;
        this.computerDifficulty = 'easy';
        this.gameMode = 'all';
        this.targetCircles = null;
        this.player1Name = '';
        this.player2Name = '';
        this.currentPlayer = 1;
        this.player1Score = 0;
        this.player2Score = 0;
        this.currentAnswer = null;
        this.currentColor = null;
        this.gameActive = false;
        this.waitingForCirclePick = false;
        this.computerMemory = {}; // Track revealed colors for AI
        
        // Color ranges
        this.colorRanges = [
            { name: 'yellow', min: 0, max: 24, color: '#FFD700' },
            { name: 'green', min: 25, max: 50, color: '#4CAF50' },
            { name: 'blue', min: 51, max: 75, color: '#2196F3' },
            { name: 'black', min: 76, max: 100, color: '#212121' },
            { name: 'red', min: 101, max: 125, color: '#F44336' },
            { name: 'orange', min: 126, max: 150, color: '#FF9800' }
        ];
        
        this.initializeElements();
        this.attachEventListeners();
        const Hub = window.FunGamesHubProfiles;
        if (Hub && this.player1NameInput) {
            const profile = Hub.getCurrentProfile();
            if (profile && profile.name) {
                this.player1NameInput.value = profile.name;
                this.validateStartButton();
            }
        }
    }

    initializeElements() {
        this.startScreen = document.getElementById('startScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.player1NameInput = document.getElementById('player1Name');
        this.player2NameInput = document.getElementById('player2Name');
        this.player2Group = document.getElementById('player2Group');
        this.computerDifficultyGroup = document.getElementById('computerDifficultyGroup');
        this.circleGrid = document.getElementById('circleGrid');
        this.questionText = document.getElementById('questionText');
        this.answerInput = document.getElementById('answerInput');
        this.submitAnswerBtn = document.getElementById('submitAnswerBtn');
        this.answerResult = document.getElementById('answerResult');
        this.answerValue = document.getElementById('answerValue');
        this.answerColor = document.getElementById('answerColor');
        this.pickCirclePrompt = document.getElementById('pickCirclePrompt');
        this.currentPlayerName = document.getElementById('currentPlayerName');
        this.player1ScoreEl = document.getElementById('player1Score');
        this.player2ScoreEl = document.getElementById('player2Score');
        this.player1ScoreLabel = document.getElementById('player1ScoreLabel');
        this.player2ScoreLabel = document.getElementById('player2ScoreLabel');
        this.gameTitle = document.getElementById('gameTitle');
        this.gameOverTitle = document.getElementById('gameOverTitle');
        this.winnerName = document.getElementById('winnerName');
        this.finalPlayer1Name = document.getElementById('finalPlayer1Name');
        this.finalPlayer2Name = document.getElementById('finalPlayer2Name');
        this.finalPlayer1Score = document.getElementById('finalPlayer1Score');
        this.finalPlayer2Score = document.getElementById('finalPlayer2Score');
    }

    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.restartBtn.addEventListener('click', () => this.restartGame());
        this.submitAnswerBtn.addEventListener('click', () => this.submitAnswer());
        this.answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.submitAnswerBtn.disabled) {
                this.submitAnswer();
            }
        });

        // Option button listeners
        document.querySelectorAll('.btn-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                const value = btn.dataset.option;
                
                // Remove selected from siblings
                document.querySelectorAll(`[data-type="${type}"]`).forEach(b => {
                    b.classList.remove('selected');
                });
                btn.classList.add('selected');
                
                if (type === 'circles') {
                    this.circleCount = parseInt(value);
                } else if (type === 'players') {
                    this.playerMode = parseInt(value);
                    this.player2Group.style.display = this.playerMode === 2 ? 'block' : 'none';
                    this.computerDifficultyGroup.style.display = this.playerMode === 1 ? 'block' : 'none';
                } else if (type === 'difficulty') {
                    this.computerDifficulty = value;
                } else if (type === 'gamemode') {
                    this.gameMode = value;
                    this.targetCircles = value === 'all' ? null : parseInt(value);
                }
                
                this.validateStartButton();
            });
        });

        // Name input listeners
        this.player1NameInput.addEventListener('input', () => this.validateStartButton());
        this.player2NameInput.addEventListener('input', () => this.validateStartButton());
    }

    validateStartButton() {
        const player1NameEntered = this.player1NameInput.value.trim().length > 0;
        const player2NameEntered = this.playerMode === 1 || this.player2NameInput.value.trim().length > 0;
        const circlesSelected = document.querySelector('[data-type="circles"].selected') !== null;
        const playersSelected = document.querySelector('[data-type="players"].selected') !== null;
        const difficultySelected = this.playerMode === 2 || document.querySelector('[data-type="difficulty"].selected') !== null;
        const gamemodeSelected = document.querySelector('[data-type="gamemode"].selected') !== null;
        
        this.startBtn.disabled = !(player1NameEntered && player2NameEntered && circlesSelected && playersSelected && difficultySelected && gamemodeSelected);
    }

    startGame() {
        this.player1Name = this.player1NameInput.value.trim() || 'Player 1';
        this.player2Name = this.playerMode === 2 
            ? (this.player2NameInput.value.trim() || 'Player 2')
            : 'Computer';
        
        // Update labels
        this.player1ScoreLabel.textContent = `${this.player1Name}:`;
        this.player2ScoreLabel.textContent = `${this.player2Name}:`;
        this.finalPlayer1Name.textContent = this.player1Name;
        this.finalPlayer2Name.textContent = this.player2Name;
        
        this.resetGame();
        this.generateCircles();
        this.showScreen('gameScreen');
        this.generateQuestion();
    }

    resetGame() {
        this.circles = [];
        this.currentPlayer = 1;
        this.player1Score = 0;
        this.player2Score = 0;
        this.currentAnswer = null;
        this.currentColor = null;
        this.currentCorrectAnswer = null;
        this.gameActive = true;
        this.waitingForCirclePick = false;
        this.computerMemory = {};
        this.updateScores();
        this.updateCurrentPlayer();
        this.answerResult.style.display = 'none';
        this.answerInput.value = '';
        this.answerInput.disabled = false;
        this.submitAnswerBtn.disabled = false;
    }

    generateCircles() {
        this.circleGrid.innerHTML = '';
        this.circleGrid.className = `circle-grid grid-${this.circleCount}`;
        
        // Calculate distribution
        const colorsPerRange = Math.floor(this.circleCount / 6);
        const remainder = this.circleCount % 6;
        const colorDistribution = [];
        
        this.colorRanges.forEach((range, index) => {
            const count = colorsPerRange + (index < remainder ? 1 : 0);
            for (let i = 0; i < count; i++) {
                colorDistribution.push(range);
            }
        });
        
        // Shuffle distribution
        for (let i = colorDistribution.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [colorDistribution[i], colorDistribution[j]] = [colorDistribution[j], colorDistribution[i]];
        }
        
        // Create circles
        this.circles = colorDistribution.map((range, index) => ({
            id: index,
            color: range.name,
            colorCode: range.color,
            revealed: false,
            claimed: false,
            claimedBy: null
        }));
        
        // Render circles
        this.circles.forEach(circle => {
            const circleEl = document.createElement('div');
            circleEl.className = 'circle';
            circleEl.dataset.circleId = circle.id;
            circleEl.textContent = '?';
            circleEl.addEventListener('click', () => this.pickCircle(circle.id));
            this.circleGrid.appendChild(circleEl);
        });
    }

    generateQuestion() {
        if (!this.gameActive) return;
        
        // Get remaining unclaimed circles by color
        const remainingByColor = {};
        this.colorRanges.forEach(range => {
            remainingByColor[range.name] = this.circles.filter(c => 
                c.color === range.name && !c.claimed
            ).length;
        });
        
        // Prioritize colors with fewer remaining circles (adaptive)
        const totalRemaining = Object.values(remainingByColor).reduce((a, b) => a + b, 0);
        if (totalRemaining === 0) {
            this.endGame();
            return;
        }
        
        // Generate question that maps to a color with remaining circles
        let question = null;
        let answer = null;
        let attempts = 0;
        
        while (attempts < 50) {
            question = this.createQuestion();
            answer = question.answer;
            const color = this.getColorForAnswer(answer);
            
            if (remainingByColor[color] > 0) {
                break;
            }
            attempts++;
        }
        
        // If we couldn't find a good match, just generate any question
        if (!question) {
            question = this.createQuestion();
            answer = question.answer;
        }
        
        this.questionText.textContent = question.text;
        this.currentCorrectAnswer = answer; // Store the correct answer
        this.answerInput.focus();
    }

    createQuestion() {
        const operations = ['addition', 'subtraction', 'multiplication', 'division'];
        const operation = operations[Math.floor(Math.random() * operations.length)];
        let a, b, answer, text;
        
        switch (operation) {
            case 'addition':
                // Numbers up to 100, answer 0-150
                a = Math.floor(Math.random() * 100) + 1;
                const maxB = Math.min(150 - a, 100);
                b = Math.floor(Math.random() * maxB) + 1;
                answer = a + b;
                text = `${a} + ${b} = ?`;
                break;
                
            case 'subtraction':
                // Answer 0-150, so a can be up to 150, b is difference
                answer = Math.floor(Math.random() * 150) + 1;
                b = Math.floor(Math.random() * Math.min(answer, 100)) + 1;
                a = answer + b;
                text = `${a} - ${b} = ?`;
                break;
                
            case 'multiplication':
                // Times tables 2-12, answer 0-150
                a = Math.floor(Math.random() * 11) + 2; // 2-12
                const maxMultiplier = Math.floor(150 / a);
                b = Math.floor(Math.random() * maxMultiplier) + 1;
                answer = a * b;
                text = `${a} × ${b} = ?`;
                break;
                
            case 'division':
                // Related to multiplication, answer 0-150
                a = Math.floor(Math.random() * 11) + 2; // 2-12
                b = Math.floor(Math.random() * Math.floor(150 / a)) + 1;
                const dividend = a * b;
                answer = b;
                text = `${dividend} ÷ ${a} = ?`;
                break;
        }
        
        // Ensure answer is in valid range
        answer = Math.max(0, Math.min(150, answer));
        
        return { text, answer };
    }

    getColorForAnswer(answer) {
        for (const range of this.colorRanges) {
            if (answer >= range.min && answer <= range.max) {
                return range.name;
            }
        }
        return 'yellow'; // Fallback
    }

    submitAnswer() {
        if (!this.gameActive || this.waitingForCirclePick) return;
        
        const userAnswer = parseInt(this.answerInput.value);
        if (isNaN(userAnswer)) {
            alert('Please enter a valid number!');
            return;
        }
        
        // Use the stored correct answer
        const correctAnswer = this.currentCorrectAnswer;
        
        if (userAnswer !== correctAnswer) {
            alert(`Incorrect! The answer is ${correctAnswer}. Try again!`);
            this.answerInput.value = '';
            this.answerInput.focus();
            return;
        }
        
        // Correct answer!
        this.currentAnswer = correctAnswer;
        this.currentColor = this.getColorForAnswer(correctAnswer);
        const colorRange = this.colorRanges.find(r => r.name === this.currentColor);
        
        // Show result
        this.answerValue.textContent = `Answer: ${correctAnswer}`;
        this.answerColor.textContent = colorRange.name.toUpperCase();
        this.answerColor.style.background = colorRange.color;
        this.answerColor.style.color = colorRange.name === 'black' ? 'white' : 'black';
        this.answerResult.style.display = 'block';
        this.pickCirclePrompt.textContent = 'Now pick a circle!';
        
        // Disable answer input
        this.answerInput.disabled = true;
        this.submitAnswerBtn.disabled = true;
        this.waitingForCirclePick = true;
        
        // If computer's turn, auto-pick
        if (this.currentPlayer === 2 && this.playerMode === 1) {
            setTimeout(() => this.computerPickCircle(), 1000);
        }
    }

    pickCircle(circleId) {
        if (!this.gameActive || !this.waitingForCirclePick) return;
        if (this.currentPlayer === 2 && this.playerMode === 1) return; // Computer picks automatically
        
        const circle = this.circles[circleId];
        if (circle.revealed || circle.claimed) return;
        
        this.revealCircle(circleId);
    }

    revealCircle(circleId) {
        const circle = this.circles[circleId];
        const circleEl = document.querySelector(`[data-circle-id="${circleId}"]`);
        
        circle.revealed = true;
        circleEl.classList.add('revealed');
        circleEl.style.background = circle.colorCode;
        circleEl.textContent = '';
        circleEl.style.color = circle.color === 'black' ? 'white' : 'black';
        
        // Update computer memory
        if (this.playerMode === 1) {
            if (!this.computerMemory[circleId]) {
                this.computerMemory[circleId] = circle.color;
            }
        }
        
        // Check for match
        if (circle.color === this.currentColor) {
            // Match! Player wins circle
            this.claimCircle(circleId, true);
        } else {
            // No match
            circleEl.classList.add('no-match');
            setTimeout(() => {
                this.hideCircle(circleId);
                this.nextTurn(false);
            }, 2000);
        }
    }

    claimCircle(circleId, isMatch) {
        const circle = this.circles[circleId];
        const circleEl = document.querySelector(`[data-circle-id="${circleId}"]`);
        
        circle.claimed = true;
        circle.claimedBy = this.currentPlayer;
        circleEl.classList.add('claimed', `player${this.currentPlayer}`);
        if (isMatch) {
            circleEl.classList.add('match');
        }
        
        // Update score
        if (this.currentPlayer === 1) {
            this.player1Score++;
        } else {
            this.player2Score++;
        }
        this.updateScores();
        
        // Check win condition
        if (this.checkWinCondition()) {
            this.endGame();
            return;
        }
        
        if (isMatch) {
            // Player gets another turn
            setTimeout(() => {
                this.resetForNextQuestion();
                this.generateQuestion();
            }, 1500);
        }
    }

    hideCircle(circleId) {
        const circle = this.circles[circleId];
        const circleEl = document.querySelector(`[data-circle-id="${circleId}"]`);
        
        circle.revealed = false;
        circleEl.classList.remove('revealed', 'no-match');
        circleEl.style.background = '#e0e0e0';
        circleEl.textContent = '?';
        circleEl.style.color = '#333';
    }

    resetForNextQuestion() {
        this.currentAnswer = null;
        this.currentColor = null;
        this.currentCorrectAnswer = null;
        this.waitingForCirclePick = false;
        this.answerResult.style.display = 'none';
        this.answerInput.value = '';
        this.answerInput.disabled = false;
        this.submitAnswerBtn.disabled = false;
        this.answerInput.focus();
    }

    nextTurn(keepTurn) {
        if (!keepTurn) {
            this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
            this.updateCurrentPlayer();
        }
        this.resetForNextQuestion();
        this.generateQuestion();
    }

    updateCurrentPlayer() {
        const playerName = this.currentPlayer === 1 ? this.player1Name : this.player2Name;
        this.currentPlayerName.textContent = playerName;
    }

    updateScores() {
        this.player1ScoreEl.textContent = this.player1Score;
        this.player2ScoreEl.textContent = this.player2Score;
    }

    checkWinCondition() {
        if (this.gameMode === 'all') {
            // Check if all circles are claimed
            const allClaimed = this.circles.every(c => c.claimed);
            return allClaimed;
        } else {
            // First to X circles
            return this.player1Score >= this.targetCircles || this.player2Score >= this.targetCircles;
        }
    }

    computerPickCircle() {
        if (!this.waitingForCirclePick || this.currentPlayer !== 2) return;
        
        let circleId = null;
        
        if (this.computerDifficulty === 'easy') {
            // Random pick from unclaimed circles
            const available = this.circles
                .map((c, i) => ({ ...c, id: i }))
                .filter(c => !c.claimed);
            if (available.length > 0) {
                const random = available[Math.floor(Math.random() * available.length)];
                circleId = random.id;
            }
        } else if (this.computerDifficulty === 'medium') {
            // Remember some revealed colors, prefer matching
            const matching = this.circles
                .map((c, i) => ({ ...c, id: i }))
                .filter(c => !c.claimed && this.computerMemory[c.id] === this.currentColor);
            
            if (matching.length > 0 && Math.random() < 0.7) {
                // 70% chance to pick a known match
                const random = matching[Math.floor(Math.random() * matching.length)];
                circleId = random.id;
            } else {
                // Otherwise random
                const available = this.circles
                    .map((c, i) => ({ ...c, id: i }))
                    .filter(c => !c.claimed);
                if (available.length > 0) {
                    const random = available[Math.floor(Math.random() * available.length)];
                    circleId = random.id;
                }
            }
        } else if (this.computerDifficulty === 'hard') {
            // 80-90% accuracy using memory
            const matching = this.circles
                .map((c, i) => ({ ...c, id: i }))
                .filter(c => !c.claimed && this.computerMemory[c.id] === this.currentColor);
            
            const unknown = this.circles
                .map((c, i) => ({ ...c, id: i }))
                .filter(c => !c.claimed && !this.computerMemory[c.id]);
            
            const accuracy = 0.85; // 85% accuracy
            if (matching.length > 0 && Math.random() < accuracy) {
                // Pick a known match
                const random = matching[Math.floor(Math.random() * matching.length)];
                circleId = random.id;
            } else if (unknown.length > 0) {
                // Pick from unknown (exploration)
                const random = unknown[Math.floor(Math.random() * unknown.length)];
                circleId = random.id;
            } else {
                // Fallback to any available
                const available = this.circles
                    .map((c, i) => ({ ...c, id: i }))
                    .filter(c => !c.claimed);
                if (available.length > 0) {
                    const random = available[Math.floor(Math.random() * available.length)];
                    circleId = random.id;
                }
            }
        }
        
        if (circleId !== null) {
            this.revealCircle(circleId);
        }
    }

    endGame() {
        this.gameActive = false;
        
        // Determine winner
        let winner = '';
        if (this.player1Score > this.player2Score) {
            winner = this.player1Name;
        } else if (this.player2Score > this.player1Score) {
            winner = this.player2Name;
        } else {
            winner = "It's a tie!";
        }
        
        this.winnerName.textContent = winner;
        this.finalPlayer1Score.textContent = this.player1Score;
        this.finalPlayer2Score.textContent = this.player2Score;
        this.gameOverTitle.textContent = winner === "It's a tie!" ? "It's a Tie!" : `${winner} Wins!`;

        const Hub = window.FunGamesHubProfiles;
        if (Hub) {
            const profileId = Hub.getCurrentProfileId();
            if (profileId) {
                const data = Hub.getStatsForGame(profileId, 'mimi-memory-chess') || {};
                const gamesPlayed = (data.gamesPlayed || 0) + 1;
                const wins = (data.wins || 0) + (this.player1Score > this.player2Score ? 1 : 0);
                const circlesWon = (data.circlesWon || 0) + this.player1Score;
                Hub.setStatsForGame(profileId, 'mimi-memory-chess', { gamesPlayed, wins, circlesWon });
            }
        }

        this.showScreen('gameOverScreen');
    }

    showScreen(screenName) {
        this.startScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        
        document.getElementById(screenName).classList.add('active');
    }

    restartGame() {
        // Reset form selections
        document.querySelectorAll('.btn-option').forEach(btn => {
            btn.classList.remove('selected');
        });
        this.player1NameInput.value = '';
        this.player2NameInput.value = '';
        this.player2Group.style.display = 'none';
        this.computerDifficultyGroup.style.display = 'none';
        this.startBtn.disabled = true;
        
        this.showScreen('startScreen');
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new MimiMemoryChess();
});
