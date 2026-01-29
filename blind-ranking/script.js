class BlindRankingGame {
    constructor() {
        this.slots = new Array(11).fill(null); // Index 0 unused, slots 1-10
        this.currentNumber = null;
        this.numbersPlaced = 0;
        this.gameActive = false;
        this.playerName = '';
        this.difficulty = null;
        this.maxNumber = 105; // Default, will be set based on difficulty
        this.blockingNumbersToHighlight = []; // Track blocking numbers for highlighting
        this.usedNumbers = new Set(); // Track numbers already used in this game
        this.currentMovableSlot = null; // Slot index of the last placed (but not yet locked) number
        this.dragSourceSlotIndex = null; // Slot index where a drag started
        
        // Difficulty settings
        this.difficultySettings = {
            easy: { max: 100, name: 'Easy', range: '1-100' },
            medium: { max: 250, name: 'Medium', range: '1-250' },
            hard: { max: 500, name: 'Hard', range: '1-500' }
        };
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadHighScores();
        this.loadPlayerStats();
        const Hub = window.FunGamesHubProfiles;
        if (Hub && this.playerNameInput) {
            const profile = Hub.getCurrentProfile();
            if (profile && profile.name) {
                this.playerNameInput.placeholder = profile.name;
                this.playerNameInput.value = profile.name;
                this.validateStartButton();
            }
        }
    }

    initializeElements() {
        this.startScreen = document.getElementById('startScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.startBtn = document.getElementById('startBtn');
        this.nextNumberBtn = document.getElementById('nextNumberBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.changeDifficultyBtn = document.getElementById('changeDifficultyBtn');
        this.currentNumberDisplay = document.getElementById('currentNumber');
        this.numbersPlacedDisplay = document.getElementById('numbersPlaced');
        this.gameOverMessage = document.getElementById('gameOverMessage');
        this.finalSlots = document.getElementById('finalSlots');
        this.slotElements = document.querySelectorAll('.slot');
        this.playerNameInput = document.getElementById('playerName');
        this.difficultyButtons = document.querySelectorAll('.btn-difficulty');
        this.gameTitle = document.getElementById('gameTitle');
        this.gameOverTitle = document.getElementById('gameOverTitle');
        this.highScoreDisplay = document.getElementById('highScore');
        this.problemNumberDisplay = document.getElementById('problemNumberDisplay');
        this.finalScoreDisplay = document.getElementById('finalScore');
        this.gamesPlayedDisplay = document.getElementById('gamesPlayed');
        this.playerHighScoreDisplay = document.getElementById('playerHighScore');
        this.averageScoreDisplay = document.getElementById('averageScore');
        this.problemNumber = document.getElementById('problemNumber');
        this.blockingNumbers = document.getElementById('blockingNumbers');
        this.fireworksContainer = document.getElementById('fireworksContainer');

        // Home screen difficulty stats
        this.easyHighScoreOverview = document.getElementById('easyHighScore');
        this.mediumHighScoreOverview = document.getElementById('mediumHighScore');
        this.hardHighScoreOverview = document.getElementById('hardHighScore');
        this.easyPerfectsOverview = document.getElementById('easyPerfects');
        this.mediumPerfectsOverview = document.getElementById('mediumPerfects');
        this.hardPerfectsOverview = document.getElementById('hardPerfects');
        this.difficultyBadge = document.getElementById('difficultyBadge');
    }

    attachEventListeners() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.nextNumberBtn.addEventListener('click', () => this.generateNextNumber());
        this.restartBtn.addEventListener('click', () => this.playAgainSameDifficulty());
        if (this.changeDifficultyBtn) this.changeDifficultyBtn.addEventListener('click', () => this.restartGame());
        
        // Name input listener
        this.playerNameInput.addEventListener('input', () => this.validateStartButton());
        
        // Difficulty button listeners
        this.difficultyButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove selected class from all buttons
                this.difficultyButtons.forEach(b => b.classList.remove('selected'));
                // Add selected class to clicked button
                btn.classList.add('selected');
                this.difficulty = btn.dataset.difficulty;
                this.updateHighScoreDisplay();
                this.validateStartButton();
            });
        });
        
        // Add click and drag listeners to slots
        this.slotElements.forEach(slot => {
            // Click to place current number
            slot.addEventListener('click', (e) => {
                if (!this.gameActive) return;
                
                const slotNumber = parseInt(slot.dataset.slot);
                
                // If we have a current number, try to place it
                if (this.currentNumber !== null) {
                    this.placeNumber(slotNumber);
                }
            });

            // Drag-and-drop for the most recently placed (but not yet locked) number
            slot.addEventListener('dragstart', (e) => {
                const slotIndex = parseInt(slot.dataset.slot);
                if (!this.gameActive || slotIndex !== this.currentMovableSlot) {
                    e.preventDefault();
                    return;
                }
                this.dragSourceSlotIndex = slotIndex;
                slot.classList.add('dragging');
            });

            slot.addEventListener('dragover', (e) => {
                if (this.dragSourceSlotIndex === null) return;
                e.preventDefault();
                const slotIndex = parseInt(slot.dataset.slot);
                // Only allow dropping onto empty slots
                if (this.slots[slotIndex] === null) {
                    slot.classList.add('drag-over');
                }
            });

            slot.addEventListener('dragleave', () => {
                slot.classList.remove('drag-over');
            });

            slot.addEventListener('drop', (e) => {
                if (this.dragSourceSlotIndex === null) return;
                e.preventDefault();

                const sourceIndex = this.dragSourceSlotIndex;
                const targetIndex = parseInt(slot.dataset.slot);

                this.slotElements.forEach(s => s.classList.remove('drag-over', 'dragging'));
                this.dragSourceSlotIndex = null;

                if (sourceIndex === targetIndex) return;

                const number = this.slots[sourceIndex];
                if (number === null) return;

                // Temporarily clear the source so we can re-use canPlaceInSlot
                this.slots[sourceIndex] = null;
                const canMove = this.canPlaceInSlot(targetIndex, number);
                if (!canMove) {
                    // Restore and abort
                    this.slots[sourceIndex] = number;
                    return;
                }

                // Move the number in our data model
                this.slots[targetIndex] = number;

                // Update DOM for source
                const sourceSlotEl = this.slotElements[sourceIndex - 1];
                const sourceContent = sourceSlotEl.querySelector('.slot-content');
                sourceContent.textContent = '';
                sourceSlotEl.classList.remove('filled', 'movable');
                sourceSlotEl.setAttribute('draggable', 'false');

                // Update DOM for target
                const targetSlotEl = this.slotElements[targetIndex - 1];
                const targetContent = targetSlotEl.querySelector('.slot-content');
                targetContent.textContent = number;
                targetSlotEl.classList.add('filled', 'movable');
                targetSlotEl.setAttribute('draggable', 'true');

                // Track new movable slot
                this.currentMovableSlot = targetIndex;
            });

            slot.addEventListener('dragend', () => {
                this.dragSourceSlotIndex = null;
                this.slotElements.forEach(s => s.classList.remove('drag-over', 'dragging'));
            });
        });
    }

    validateStartButton() {
        const nameEntered = this.playerNameInput.value.trim().length > 0;
        const difficultySelected = this.difficulty !== null;
        this.startBtn.disabled = !(nameEntered && difficultySelected);
    }

    startGame() {
        // Get player name and difficulty
        this.playerName = this.playerNameInput.value.trim() || 'Player';
        if (!this.difficulty) {
            alert('Please select a difficulty level!');
            return;
        }
        
        // Set max number based on difficulty
        this.maxNumber = this.difficultySettings[this.difficulty].max;
        
        // Update game title with player name
        this.gameTitle.textContent = `Good luck, ${this.playerName}!`;
        // Show current difficulty in the top-right badge
        if (this.difficultyBadge) {
            this.difficultyBadge.className = 'difficulty-badge';
            this.difficultyBadge.classList.add(this.difficulty);

            const setting = this.difficultySettings[this.difficulty];
            const rangeText = setting && setting.range ? setting.range : (
                this.difficulty === 'easy' ? '1-100' :
                this.difficulty === 'medium' ? '1-250' : '1-500'
            );

            this.difficultyBadge.innerHTML = `
                <span class="difficulty-badge-label">${setting.name}</span>
                <span class="difficulty-badge-range">${rangeText}</span>
            `;
        }
        
        // Update high score display
        this.updateHighScoreDisplay();
        
        this.resetGame();
        this.showScreen('gameScreen');
        this.generateNextNumber();
    }

    resetGame() {
        this.slots = new Array(11).fill(null);
        this.currentNumber = null;
        this.numbersPlaced = 0;
        this.gameActive = true;
        this.usedNumbers.clear();
        this.currentMovableSlot = null;
        this.dragSourceSlotIndex = null;
        
        // Clear all slots
        this.slotElements.forEach(slot => {
            const content = slot.querySelector('.slot-content');
            content.textContent = '';
            slot.classList.remove('filled', 'disabled', 'win', 'movable', 'drag-over', 'dragging');
            slot.setAttribute('draggable', 'false');
        });
        
        this.updateDisplay();
    }

    generateNextNumber() {
        if (!this.gameActive) return;

        // Lock the previously placed number so it can no longer be moved
        this.lockCurrentMovableSlot();
        
        // Generate a unique random number between 1 and maxNumber (based on difficulty)
        if (this.usedNumbers.size >= this.maxNumber) {
            // Safety guard: no more unique numbers available
            this.endGame(false);
            return;
        }

        let candidate;
        let attempts = 0;
        do {
            candidate = Math.floor(Math.random() * this.maxNumber) + 1;
            attempts++;
        } while (this.usedNumbers.has(candidate) && attempts < 1000);

        if (this.usedNumbers.has(candidate)) {
            // Could not find a fresh number for some reason
            this.endGame(false);
            return;
        }

        this.usedNumbers.add(candidate);
        this.currentNumber = candidate;
        this.currentNumberDisplay.textContent = this.currentNumber;
        this.nextNumberBtn.disabled = true;
        
        // Check if number can be placed anywhere
        if (!this.canPlaceNumber(this.currentNumber)) {
            // Show the unplaceable number in the box for a short moment
            // before transitioning to the Game Over screen
            this.gameActive = false;
            setTimeout(() => {
                this.endGame(false);
            }, 3000);
            return;
        }
        
        // Enable slots that can accept this number
        this.updateSlotAvailability();
    }

    canPlaceNumber(number) {
        // Check if number can be placed in any valid slot
        for (let i = 1; i <= 10; i++) {
            if (this.canPlaceInSlot(i, number)) {
                return true;
            }
        }
        return false;
    }

    canPlaceInSlot(slotIndex, number) {
        // Slot must be empty
        if (this.slots[slotIndex] !== null) {
            return false;
        }
        
        // Check left boundary
        let leftBound = 0;
        for (let i = slotIndex - 1; i >= 1; i--) {
            if (this.slots[i] !== null) {
                leftBound = this.slots[i];
                break;
            }
        }
        
        // Check right boundary (use maxNumber + 1 based on difficulty)
        let rightBound = this.maxNumber + 1;
        for (let i = slotIndex + 1; i <= 10; i++) {
            if (this.slots[i] !== null) {
                rightBound = this.slots[i];
                break;
            }
        }
        
        // Number must be between left and right bounds
        return number > leftBound && number < rightBound;
    }

    updateSlotAvailability() {
        this.slotElements.forEach(slot => {
            const slotIndex = parseInt(slot.dataset.slot);
            
            if (this.slots[slotIndex] !== null) {
                // Slot is filled
                slot.classList.add('filled');
                slot.classList.remove('disabled');
            } else if (this.currentNumber !== null && this.canPlaceInSlot(slotIndex, this.currentNumber)) {
                // Slot can accept current number
                slot.classList.remove('disabled', 'filled');
            } else {
                // Slot cannot accept current number
                slot.classList.add('disabled');
                slot.classList.remove('filled');
            }
        });
    }

    placeNumber(slotIndex) {
        if (!this.gameActive || this.currentNumber === null) return;
        
        // Validate placement
        if (!this.canPlaceInSlot(slotIndex, this.currentNumber)) {
            return;
        }
        
        // Place the number
        this.slots[slotIndex] = this.currentNumber;
        this.numbersPlaced++;
        
        // Update UI
        const slotElement = this.slotElements[slotIndex - 1];
        const content = slotElement.querySelector('.slot-content');
        content.textContent = this.currentNumber;
        slotElement.classList.add('filled');
        slotElement.classList.add('win');
        setTimeout(() => slotElement.classList.remove('win'), 500);
        
        // Clear current number
        this.currentNumber = null;
        this.currentNumberDisplay.textContent = '-';
        
        // Check for win
        if (this.numbersPlaced === 10) {
            this.endGame(true);
            return;
        }
        
        // Enable next number button
        this.nextNumberBtn.disabled = false;

        // Make this newly placed number movable until the next number is drawn
        this.setMovableSlot(slotIndex);
        
        this.updateSlotAvailability();
        this.updateDisplay();
    }

    updateDisplay() {
        this.numbersPlacedDisplay.textContent = this.numbersPlaced;
    }

    setMovableSlot(slotIndex) {
        // Clear previous movable slot, if any
        if (this.currentMovableSlot !== null) {
            const prevSlotEl = this.slotElements[this.currentMovableSlot - 1];
            prevSlotEl.classList.remove('movable');
            prevSlotEl.setAttribute('draggable', 'false');
        }

        const slotEl = this.slotElements[slotIndex - 1];
        slotEl.classList.add('movable');
        slotEl.setAttribute('draggable', 'true');
        this.currentMovableSlot = slotIndex;
    }

    lockCurrentMovableSlot() {
        if (this.currentMovableSlot === null) return;

        const slotEl = this.slotElements[this.currentMovableSlot - 1];
        slotEl.classList.remove('movable', 'drag-over', 'dragging');
        slotEl.setAttribute('draggable', 'false');
        this.currentMovableSlot = null;
        this.dragSourceSlotIndex = null;
    }

    endGame(won) {
        this.gameActive = false;
        
        const finalScore = this.numbersPlaced;
        
        // Update high score and player statistics
        this.updateHighScore(finalScore);
        this.updatePlayerStats(finalScore);
        
        // Display final score prominently
        this.finalScoreDisplay.textContent = finalScore;
        this.finalScoreDisplay.classList.add('highlighted');
        
        // Update statistics display
        this.updateStatsDisplay();
        
        if (won) {
            this.gameOverTitle.textContent = `Congratulations, ${this.playerName}!`;
            this.gameOverMessage.textContent = `🎉 You got a perfect 10 out of 10 on ${this.difficultySettings[this.difficulty].name} difficulty! 🎉`;
            this.gameOverMessage.style.color = '#4caf50';
            this.problemNumberDisplay.style.display = 'none';
            
            // Trigger celebration (fireworks) for a perfect game
            if (finalScore === 10) {
                this.triggerCelebration();
            }
        } else {
            this.gameOverTitle.textContent = `Game Over, ${this.playerName}!`;
            this.gameOverMessage.textContent = `The number couldn't be placed in any available slot. You placed ${finalScore} number${finalScore !== 1 ? 's' : ''}! Better luck next time!`;
            this.gameOverMessage.style.color = '#f44336';
            
            // Show problem number and blocking numbers
            this.showProblemNumber();
        }
        
        // Show final state
        this.showFinalSlots();
        this.showScreen('gameOverScreen');
    }

    triggerCelebration() {
        if (!this.fireworksContainer) return;

        this.fireworksContainer.innerHTML = '';
        this.gameOverScreen.classList.add('celebration-active');

        const fireworkCount = 8;
        for (let i = 0; i < fireworkCount; i++) {
            const fw = document.createElement('div');
            fw.className = 'firework';
            const left = 10 + Math.random() * 80;
            const delay = Math.random() * 1.5;
            fw.style.left = `${left}%`;
            fw.style.animationDelay = `${delay}s`;
            fw.style.setProperty('--fw-delay', `${delay}s`);
            this.fireworksContainer.appendChild(fw);
        }
    }

    showProblemNumber() {
        if (this.currentNumber === null) return;
        
        // Display the problem number
        this.problemNumber.textContent = this.currentNumber;
        this.problemNumberDisplay.style.display = 'block';
        
        // Find the two numbers that block it
        const blockingNumbers = this.findBlockingNumbers(this.currentNumber);
        this.blockingNumbers.innerHTML = '';
        
        if (blockingNumbers.length > 0) {
            blockingNumbers.forEach(num => {
                const blockingDiv = document.createElement('div');
                blockingDiv.className = 'blocking-number';
                blockingDiv.textContent = num;
                this.blockingNumbers.appendChild(blockingDiv);
            });
            
            // Store blocking numbers for highlighting after slots are rendered
            this.blockingNumbersToHighlight = blockingNumbers;
        } else {
            this.blockingNumbersToHighlight = [];
        }
    }

    findBlockingNumbers(number) {
        // Find which placed numbers logically block this number from ever fitting
        const placed = [];
        for (let i = 1; i <= 10; i++) {
            if (this.slots[i] !== null) {
                placed.push({ value: this.slots[i], index: i });
            }
        }

        if (placed.length === 0) return [];

        // Sort by value so we can reason about smaller/larger neighbours
        placed.sort((a, b) => a.value - b.value);

        const smaller = placed.filter(p => p.value < number);
        const larger = placed.filter(p => p.value > number);

        const blockers = [];

        if (smaller.length === 0) {
            // Number is smaller than all placed numbers – blocked by the smallest number
            blockers.push(larger[0].value);
        } else if (larger.length === 0) {
            // Number is larger than all placed numbers – blocked by the largest number
            blockers.push(smaller[smaller.length - 1].value);
        } else {
            // Number lies between some smaller and larger values – blocked by closest pair
            const left = smaller[smaller.length - 1];
            const right = larger[0];

            blockers.push(left.value, right.value);
        }

        // Ensure lowest value is shown first when there are two blockers
        blockers.sort((a, b) => a - b);

        return blockers;
    }

    highlightBlockingSlots(blockingNumbers) {
        // Clear previous highlights
        const finalSlotElements = this.finalSlots.querySelectorAll('.slot');
        finalSlotElements.forEach(slot => {
            slot.classList.remove('highlight-problem');
        });
        
        // Highlight slots containing blocking numbers in the final display
        blockingNumbers.forEach(blockNum => {
            for (let i = 1; i <= 10; i++) {
                if (this.slots[i] === blockNum) {
                    const slotElement = finalSlotElements[i - 1];
                    if (slotElement) {
                        slotElement.classList.add('highlight-problem');
                    }
                    break;
                }
            }
        });
    }

    showFinalSlots() {
        this.finalSlots.innerHTML = '';
        
        for (let i = 1; i <= 10; i++) {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'slot filled';
            slotDiv.setAttribute('data-slot', i);
            
            const slotNumber = document.createElement('div');
            slotNumber.className = 'slot-number';
            slotNumber.textContent = i;
            
            const slotContent = document.createElement('div');
            slotContent.className = 'slot-content';
            slotContent.textContent = this.slots[i] !== null ? this.slots[i] : '-';
            
            slotDiv.appendChild(slotNumber);
            slotDiv.appendChild(slotContent);
            this.finalSlots.appendChild(slotDiv);
        }
        
        // Highlight blocking slots after rendering
        if (this.blockingNumbersToHighlight && this.blockingNumbersToHighlight.length > 0) {
            this.highlightBlockingSlots(this.blockingNumbersToHighlight);
        }
    }

    showScreen(screenName) {
        this.startScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        
        document.getElementById(screenName).classList.add('active');
    }

    playAgainSameDifficulty() {
        if (!this.difficulty || !this.playerName) {
            this.restartGame();
            return;
        }
        if (this.fireworksContainer) this.fireworksContainer.innerHTML = '';
        if (this.gameOverScreen) this.gameOverScreen.classList.remove('celebration-active');
        this.maxNumber = this.difficultySettings[this.difficulty].max;
        if (this.difficultyBadge) {
            this.difficultyBadge.className = 'difficulty-badge ' + this.difficulty;
            const setting = this.difficultySettings[this.difficulty];
            this.difficultyBadge.innerHTML = '<span class="difficulty-badge-label">' + setting.name + '</span><span class="difficulty-badge-range">' + (setting.range || '') + '</span>';
        }
        this.updateHighScoreDisplay();
        this.gameTitle.textContent = 'Good luck, ' + this.playerName + '!';
        this.resetGame();
        this.showScreen('gameScreen');
        this.generateNextNumber();
    }

    restartGame() {
        this.difficultyButtons.forEach(b => b.classList.remove('selected'));
        this.difficulty = null;
        this.validateStartButton();
        if (this.fireworksContainer) this.fireworksContainer.innerHTML = '';
        if (this.gameOverScreen) this.gameOverScreen.classList.remove('celebration-active');
        this.showScreen('startScreen');
    }

    loadHighScores() {
        const Hub = window.FunGamesHubProfiles;
        const defaultScores = {
            easy: { highScore: 0, perfectGames: 0 },
            medium: { highScore: 0, perfectGames: 0 },
            hard: { highScore: 0, perfectGames: 0 }
        };

        if (Hub) {
            const profileId = Hub.ensureCurrentProfile();
            const data = Hub.getStatsForGame(profileId, 'blind-ranking');
            if (data && data.highScores) {
                this.highScores = { ...defaultScores, ...data.highScores };
            } else {
                // Migrate from old keys once
                const saved = localStorage.getItem('blindRankingHighScores');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        if (typeof parsed.easy === 'number' || typeof parsed.medium === 'number' || typeof parsed.hard === 'number') {
                            this.highScores = {
                                easy: { highScore: parsed.easy || 0, perfectGames: parsed.easy === 10 ? 1 : 0 },
                                medium: { highScore: parsed.medium || 0, perfectGames: parsed.medium === 10 ? 1 : 0 },
                                hard: { highScore: parsed.hard || 0, perfectGames: parsed.hard === 10 ? 1 : 0 }
                            };
                        } else {
                            this.highScores = { ...defaultScores, ...parsed };
                        }
                        Hub.setStatsForGame(profileId, 'blind-ranking', { highScores: this.highScores });
                    } catch (e) {
                        this.highScores = { ...defaultScores };
                    }
                } else {
                    this.highScores = { ...defaultScores };
                }
            }
        } else {
            const saved = localStorage.getItem('blindRankingHighScores');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (typeof parsed.easy === 'number' || typeof parsed.medium === 'number' || typeof parsed.hard === 'number') {
                        this.highScores = {
                            easy: { highScore: parsed.easy || 0, perfectGames: parsed.easy === 10 ? 1 : 0 },
                            medium: { highScore: parsed.medium || 0, perfectGames: parsed.medium === 10 ? 1 : 0 },
                            hard: { highScore: parsed.hard || 0, perfectGames: parsed.hard === 10 ? 1 : 0 }
                        };
                    } else {
                        this.highScores = { ...defaultScores, ...parsed };
                    }
                } catch (e) {
                    this.highScores = { ...defaultScores };
                }
            } else {
                this.highScores = { ...defaultScores };
            }
        }

        ['easy', 'medium', 'hard'].forEach(level => {
            if (!this.highScores[level] || typeof this.highScores[level] !== 'object') {
                this.highScores[level] = { highScore: 0, perfectGames: 0 };
            } else {
                if (typeof this.highScores[level].highScore !== 'number') this.highScores[level].highScore = 0;
                if (typeof this.highScores[level].perfectGames !== 'number') {
                    this.highScores[level].perfectGames = this.highScores[level].highScore === 10 ? 1 : 0;
                }
            }
        });

        this.updateDifficultyStatsOverview();
    }

    saveHighScores() {
        const Hub = window.FunGamesHubProfiles;
        if (Hub) {
            const profileId = Hub.getCurrentProfileId();
            if (profileId) {
                const data = Hub.getStatsForGame(profileId, 'blind-ranking') || {};
                Hub.setStatsForGame(profileId, 'blind-ranking', { ...data, highScores: this.highScores });
            }
        } else {
            localStorage.setItem('blindRankingHighScores', JSON.stringify(this.highScores));
        }
        this.updateDifficultyStatsOverview();
    }

    updateHighScore(score) {
        if (!this.difficulty) return;
        
        const data = this.highScores[this.difficulty];

        // Update stored high score for this difficulty
        if (score > data.highScore) {
            data.highScore = score;
        }

        // Track how many times a perfect 10/10 has been achieved on this difficulty
        if (score === 10) {
            data.perfectGames += 1;
        }

        this.saveHighScores();
    }

    updateHighScoreDisplay() {
        if (!this.difficulty) {
            this.highScoreDisplay.textContent = '-';
            return;
        }
        
        const highScore = (this.highScores[this.difficulty] && this.highScores[this.difficulty].highScore) || 0;
        this.highScoreDisplay.textContent = highScore > 0 ? highScore : '-';
    }

    updateDifficultyStatsOverview() {
        if (!this.highScores) return;

        const setStats = (level, highScoreEl, perfectsEl) => {
            const data = this.highScores[level] || { highScore: 0, perfectGames: 0 };
            if (highScoreEl) {
                highScoreEl.textContent = data.highScore > 0 ? data.highScore : '-';
            }
            if (perfectsEl) {
                perfectsEl.textContent = data.perfectGames || 0;
            }
        };

        setStats('easy', this.easyHighScoreOverview, this.easyPerfectsOverview);
        setStats('medium', this.mediumHighScoreOverview, this.mediumPerfectsOverview);
        setStats('hard', this.hardHighScoreOverview, this.hardPerfectsOverview);
    }

    loadPlayerStats() {
        const Hub = window.FunGamesHubProfiles;
        const defaultStats = { gamesPlayed: 0, totalScore: 0, highScore: 0, scores: [] };

        if (Hub) {
            const profileId = Hub.getCurrentProfileId();
            const data = profileId ? Hub.getStatsForGame(profileId, 'blind-ranking') : null;
            if (data && data.playerStats) {
                this.playerStats = { ...defaultStats, ...data.playerStats };
                if (!Array.isArray(this.playerStats.scores)) this.playerStats.scores = [];
            } else {
                const saved = localStorage.getItem('blindRankingPlayerStats');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        const firstKey = Object.keys(parsed)[0];
                        const migrated = firstKey && typeof parsed[firstKey] === 'object'
                            ? { ...defaultStats, ...parsed[firstKey] }
                            : { ...defaultStats };
                        if (!Array.isArray(migrated.scores)) migrated.scores = [];
                        this.playerStats = migrated;
                        if (profileId) Hub.setStatsForGame(profileId, 'blind-ranking', { playerStats: this.playerStats });
                    } catch (e) {
                        this.playerStats = { ...defaultStats };
                    }
                } else {
                    this.playerStats = { ...defaultStats };
                }
            }
        } else {
            const saved = localStorage.getItem('blindRankingPlayerStats');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (typeof parsed.gamesPlayed === 'number') {
                        this.playerStats = { ...defaultStats, ...parsed };
                    } else {
                        const first = Object.keys(parsed)[0];
                        this.playerStats = first ? { ...defaultStats, ...parsed[first] } : { ...defaultStats };
                    }
                    if (!Array.isArray(this.playerStats.scores)) this.playerStats.scores = [];
                } catch (e) {
                    this.playerStats = { ...defaultStats };
                }
            } else {
                this.playerStats = { ...defaultStats };
            }
        }
    }

    savePlayerStats() {
        const Hub = window.FunGamesHubProfiles;
        if (Hub) {
            const profileId = Hub.getCurrentProfileId();
            if (profileId) {
                const data = Hub.getStatsForGame(profileId, 'blind-ranking') || {};
                Hub.setStatsForGame(profileId, 'blind-ranking', { ...data, playerStats: this.playerStats });
            }
        } else {
            localStorage.setItem('blindRankingPlayerStats', JSON.stringify(this.playerStats));
        }
    }

    updatePlayerStats(score) {
        if (!this.playerStats) this.playerStats = { gamesPlayed: 0, totalScore: 0, highScore: 0, scores: [] };
        this.playerStats.gamesPlayed++;
        this.playerStats.totalScore += score;
        this.playerStats.scores.push(score);
        if (score > this.playerStats.highScore) this.playerStats.highScore = score;
        this.savePlayerStats();
    }

    updateStatsDisplay() {
        if (!this.playerStats) {
            this.gamesPlayedDisplay.textContent = '0';
            this.playerHighScoreDisplay.textContent = '0';
            this.averageScoreDisplay.textContent = '0';
            return;
        }
        this.gamesPlayedDisplay.textContent = this.playerStats.gamesPlayed;
        this.playerHighScoreDisplay.textContent = this.playerStats.highScore;
        const average = this.playerStats.gamesPlayed > 0 ? (this.playerStats.totalScore / this.playerStats.gamesPlayed).toFixed(1) : '0';
        this.averageScoreDisplay.textContent = average;
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new BlindRankingGame();
    // Initialize high score display
    game.updateHighScoreDisplay();
});
