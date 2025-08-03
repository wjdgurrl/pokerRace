// 설정
const GAME_CONFIG = {
    MAX_TRACK_LEVEL: 8,  // 최대 트랙 레벨 (승리 조건)
    PENALTY_CARDS_COUNT: 7,  // 패널티 카드 수 (MAX_TRACK_LEVEL - 1)
    INITIAL_GOLD: 0,     // 초기 골드
    TOTAL_ROUNDS: 5       // 총 라운드 수
};

// 플레이어
const playerState = {
    gold: 0,
    currentRound: 1,
    selectedHorse: null
};

// 게임 상태
const gameState = {
    allCards: {
        '♥': ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'],
        '♦': ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'],
        '♠': ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'],
        '♣': ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
    },
    usedCardsBySuit: {
        '♥': [],
        '♦': [],
        '♠': [],
        '♣': []
    },
    horses: [
        { suit: '♥', level: 0, element: null },
        { suit: '♦', level: 0, element: null },
        { suit: '♠', level: 0, element: null },
        { suit: '♣', level: 0, element: null }
    ], //말
    rewardTable: { 1: 10, 2: 7, 3: 5, 4: 3 }, //
    penaltyCards: [],
    deck: [], //덱 잔여 카드
    gameOver: false, //게임 종료
    penaltyTriggered: {}, // 패널티 카드
    jokers: [], // 보유 중인 조커 카드
    shopJokers: [] // 상점에 표시될 조커 카드
};

// 조커들
const JOKER_TYPES = {
    GOLD_FOOT: {
        id: 1,
        name: "황금발",
        effect: "이동 시 20%확률로 1골드 획득",
        price: 4,
        isConsumable: false,
        onDraw: function(card) {
            if (card.suit === playerState.selectedHorse && Math.random() < 0.2) {
                playerState.gold++;
                updateScoreboard();
                return { gold: 1 };
            }
            return null;
        }
    },
    DASH: {
        id: 2,
        name: "질주",
        effect: "선택한 말 1칸 즉시 이동 (1회성)",
        price: 5,
        isConsumable: true,
        trigger: 'onHorseSelect',
        onHorseSelect: function(horse) {
            horse.level++;
            updateHorsePosition(horse);
            return { used: true, message: "질주 조커 발동! +1칸" };
        }
    },
    TRAP: {
        id: 3,
        name: "함정 카드",
        effect: "패널티 카드 발동 1회 무시 (1회성)",
        price: 2,
        isConsumable: true,
        trigger: 'onPenalty',
        onPenalty: function() {
            return { cancel: true, message: "패널티 건너뛰기!" };
        }
    },
    FIRST: {
        id: 4,
        name: "1등은 최고야",
        effect: "선택한 말 1등 시 +5골드",
        price: 3,
        isConsumable: false,
        onRoundEnd: function(rank) {
            if (rank === 1) {
                playerState.gold += 5;
                return { gold: 5 };
            }
            return null;
        }
    },
    HOLD: {
        id: 5,
        name: "얼음!",
        effect: "패널티 발동 시 다른 모든 말 1칸 뒤로 (1회성)",
        price: 7,
        isConsumable: true,
        trigger: 'onPenalty',
        onPenalty: function() {
            gameState.horses.forEach(horse => {
                if (horse.suit !== playerState.selectedHorse && horse.level > 0) {
                    horse.level--;
                    updateHorsePosition(horse);
                }
            });
            return { used: true, message: "나 빼고 전부 뒤로!" };
        }
    }, //내 문양 말이 걸렸을 때 조건 추가
    REVERSE_BET: {
        id: 6,
        name: "인버스",
        effect: "선택한 말 4등 시 +12골드",
        price: 4,
        isConsumable: false,
        onRoundEnd: function(rank) {
            if (rank === 4) {
                playerState.gold += 12;
                return { gold: 12 };
            }
            return null;
        }
    },
    EVEN_LOVE: {
        id: 7,
        name: "짝수 좋아",
        effect: "짝수: +2칸, 홀수: -2칸",
        price: 6,
        isConsumable: false,
        onDraw: function(card) {
            if (card.suit === playerState.selectedHorse) {
                const value = parseInt(card.value) ||
                    (card.value === 'A' ? 1 :
                        card.value === 'J' ? 11 :
                            card.value === 'Q' ? 12 :
                                card.value === 'K' ? 13 : 0);

                const isEven = value % 2 === 0;
                return {
                    overrideBaseMove: true, // 기본 이동(1칸) 무시
                    move: isEven ? 2 : -2,
                    message: isEven ?
                        "짝수 좋아! +2칸 이동!" :
                        "홀수 싫어! -2칸 이동!"
                };
            }
            return null;
        }
    }
};



let deckClickable = true;
const trackElement = document.getElementById('track');
const horsesElement = document.getElementById('horses');
const deckElement = document.getElementById('deck');
const m_deckElement = document.getElementById("deck-mobile");
const restartButton = document.getElementById('restart');
const roundDisplay = document.getElementById('round-display');
const goldDisplay = document.getElementById('gold-amount');
const selectMessage = document.getElementById('selectMessage');

// 카드 덱 세팅
function initializeDeck() {
    const suits = ['♥', '♦', '♠', '♣'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    let deck = [];
    for (let suit of suits) {
        for (let value of values) {
            deck.push({ suit, value });
        }
    }
    return shuffleDeck(deck);
}

// 덱 섞기
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// 게임 세팅
function initializeGame() {
    // 상태 초기화
    gameState.usedCardsBySuit = { '♥':[], '♦':[], '♠':[], '♣':[] };
    gameState.deck = initializeDeck();
    gameState.usedCards = [];
    gameState.gameOver = false;
    gameState.penaltyTriggered = {};


    // 말 초기화 (레벨만 리셋)
    gameState.horses.forEach(horse => {
        horse.level = 0;
        if (horse.element) {
            updateHorsePosition(horse);
        }
    });

    // 트랙 초기화
    gameState.penaltyCards = [];
    trackElement.innerHTML = '';

    // 패널티 카드 생성 (레벨 1~7에 배치)
    for (let i = 1; i <= GAME_CONFIG.MAX_TRACK_LEVEL - 1; i++) {
        const penaltyCard = gameState.deck.pop();
        gameState.penaltyCards.push({ ...penaltyCard, level: i }); // 레벨 정보 추가

        const levelElement = document.createElement('div');
        levelElement.className = 'track-level';

        const cardElement = document.createElement('div');
        cardElement.className = 'penalty-card';
        cardElement.textContent = '?';
        cardElement.dataset.level = i; // 명시적으로 레벨 저장 (1~7)
        cardElement.dataset.suit = penaltyCard.suit;
        cardElement.dataset.value = penaltyCard.value;

        levelElement.appendChild(cardElement);
        trackElement.appendChild(levelElement);
    }

    // 트랙 높이 동적 조정 (MAX_TRACK_LEVEL-1 기준)
    const trackHeight = (GAME_CONFIG.MAX_TRACK_LEVEL - 1) * 80;
    trackElement.style.height = `${trackHeight}px`;

    // 덱 초기화
    deckElement.textContent = '덱';
    m_deckElement.textContent = "덱";
    deckElement.style.backgroundColor = '#34495e';
    m_deckElement.style.backgroundColor = '#34495e';
    deckElement.onclick = () => {
        if (!deckClickable) return; // 클릭 막기

        deckClickable = false;
        drawCard(); // 원래 실행하던 함수

        setTimeout(() => {
            deckClickable = true;
        }, 500); // 0.5초 쿨타임
    }; //덱 클릭

    // 말 렌더링
    renderHorses();

    // 말 선택 메시지
    selectMessage.style.display = 'block';

    // 전체 카드 트래커 초기화
    initializeCardTracker();

    // 점수판 업
    updateScoreboard();

    //조커 업
    updateJokerInventory();
}

//카드 트래커
function initializeCardTracker() {
    const suits = ['♥', '♦', '♠', '♣'];
    suits.forEach(suit => {
        const elementId = `${suit === '♥' ? 'heart' : suit === '♦' ? 'diamond' : suit === '♠' ? 'spade' : 'club'}Cards`;
        const container = document.getElementById(elementId);
        container.innerHTML = '';

        gameState.allCards[suit].forEach(value => {
            const cardElement = document.createElement('div');
            cardElement.className = `card-indicator value-${value}`;
            cardElement.textContent = `${value}${suit}`;
            cardElement.dataset.suit = suit;
            cardElement.dataset.value = value;
            container.appendChild(cardElement);
        });
    });
}

// 말 선택
function selectPlayerHorse() {
    gameState.horses.forEach(horse => {
        horse.element.onclick = () => {
            if (playerState.selectedHorse) return;

            playerState.selectedHorse = horse.suit;
            // 조커 효과 적용
            applyJokerEffects('onHorseSelect', horse);

            selectMessage.style.display = 'none';
            renderHorses();
        };
    });
}

// 말 렌더링
// 라운드 넘어가면 버그
//클
function renderHorses() {
    horsesElement.innerHTML = '';

    gameState.horses.forEach(horse => {
        const horseElement = document.createElement('div');
        horseElement.className = 'horse';
        horseElement.textContent = horse.suit;

        // 하이라이트
        if (horse.suit === playerState.selectedHorse) {
            horseElement.classList.add('highlight');
        }

        const levelElement = document.createElement('div');
        levelElement.className = 'horse-level';
        levelElement.textContent = `Lv. ${horse.level}`;
        horseElement.appendChild(levelElement);

        horse.element = horseElement;
        horsesElement.appendChild(horseElement);
        updateHorsePosition(horse);
    });

    // 말 선택 이벤트 재설정
    selectPlayerHorse();
}

// 말 위치
function updateHorsePosition(horse) {
    if (!horse.element) return;

    const trackHeight = trackElement.offsetHeight;
    // 레벨 0(시작점) ~ MAX_TRACK_LEVEL
    const levelHeight = trackHeight / GAME_CONFIG.MAX_TRACK_LEVEL;

    horse.element.style.transform = `translateY(-${horse.level * levelHeight}px)`;
    horse.element.querySelector('.horse-level').textContent = `Lv. ${horse.level}`;

}

// 카드 뽑기
function drawCard() {
    if (gameState.gameOver || !playerState.selectedHorse) {
        if (!playerState.selectedHorse) alert('말을 선택하세요!');
        return;
    }

    if (gameState.deck.length === 0) {
        endRound();
        return;
    }

    let additionalMoves = 0;
    const card = gameState.deck.pop();
    const effect = applyJokerEffects('onDraw', card);

    if (effect?.move) {
        additionalMoves += effect.move;
    }


    gameState.usedCardsBySuit[card.suit].push(card.value);
    gameState.usedCards.push(card);

    updateUsedCardDisplay(card.suit, card.value);

    deckElement.textContent = `${card.value}${card.suit}`;
    m_deckElement.textContent = `${card.value}${card.suit}`;
    deckElement.style.backgroundColor = card.suit === '♥' || card.suit === '♦' ? '#e74c3c' : '#34495e';
    m_deckElement.style.backgroundColor = card.suit === '♥' || card.suit === '♦' ? '#e74c3c' : '#34495e';

    const horse = gameState.horses.find(h => h.suit === card.suit);
    if (horse) {
        let moveAmount = 1; // 기본값

        // 조커 효과 처리
        if (effect?.overrideBaseMove) {
            moveAmount = effect.move; // 기본 이동 완전 대체
        } else if (effect?.move) {
            moveAmount += effect.move; // 기본 이동에 추가
        }

        // 실제 이동 계산 (0 미만 방지)
        const originalLevel = horse.level;
        horse.level = Math.max(0, originalLevel + moveAmount);
        const actualMove = horse.level - originalLevel;

        // 메시지 처리
        if (effect?.message) {
            showEffectMessage(
                actualMove === effect.move ?
                    effect.message :
                    `${effect.message} (최소 레벨 도달)`
            );
        }

        updateHorsePosition(horse);

        setTimeout(() => {
            checkPenalty();
            if (horse.level >= GAME_CONFIG.MAX_TRACK_LEVEL){
                deckClickable = false;
                endRound();
            }
        }, 500); // 애니메이션 시간 조정
    }

    if (gameState.deck.length === 0) {
        deckElement.textContent = 'Empty';
        m_deckElement.textContent = 'Empty';
    }
}

// 사용한 카드 표시 업데이트
function updateUsedCardDisplay(suit, value) {
    // [1] 카드 UI 표시
    const cardElements = document.querySelectorAll(`.card-indicator[data-suit="${suit}"]`);
    cardElements.forEach(element => {
        if (element.dataset.value === value) {
            element.classList.add('used-card');
        }
    });

    // [2] 잔여 카드 계산 (콘솔 로그 추가)
    const usedCount = gameState.usedCardsBySuit[suit].length;
    const remainingCount = 13 - usedCount;

    // [3] 잔여 카드 UI 업데이트
    const countElement = document.getElementById(`${suit}Count`);
    if (countElement) {
        countElement.textContent = remainingCount;
        countElement.classList.toggle('low', remainingCount <= 3);
    } else {
        console.error(`[ERROR] ${suit}Count 요소를 찾을 수 없음!`);
    }
}

//패널티 체크
/**
// MAX_TRACK_LEVEL 따로 ㅃ?>
 */
function checkPenalty() {
    const minLevel = Math.min(...gameState.horses.map(h => h.level));

    // 레벨 1~7에서만 패널티 발동 (8은 결승점이므로 제외)
    if (minLevel < 1 || minLevel >= GAME_CONFIG.MAX_TRACK_LEVEL) return;

    // 해당 레벨의 패널티 카드 찾기 (data-level=1~7)
    const penaltyCardElement = document.querySelector(`.penalty-card[data-level="${minLevel}"]`);
    if (!penaltyCardElement) return;

    //해당 패널티 카드 문양
    const suit = penaltyCardElement.dataset.suit;

    // 조커 효과 먼저 적용 (패널티 무시)
    const penaltyResult = applyJokerEffects('onPenalty');
    if (penaltyResult.cancelled) return; // 패널티 취소된 경우

    // 조커 효과 확인 (패널티 무시)
    const hasShield = gameState.jokers.some(joker =>
        joker.onPenalty && joker.onPenalty() === false
    );
    if (hasShield) return;

    // 이미 발동한 레벨인지 확인
    if (gameState.penaltyTriggered[minLevel]) return;
    gameState.penaltyTriggered[minLevel] = true;


    // 패널티 애니메이션 및 효과 적용
    penaltyCardElement.classList.add('flipped');
    setTimeout(() => {
        penaltyCardElement.textContent = `${penaltyCardElement.dataset.value}${penaltyCardElement.dataset.suit}`;
        const horse = gameState.horses.find(h => h.suit === suit);
        if (horse && horse.level > 0) {
            horse.level--;
            updateHorsePosition(horse);
        }
    }, 250);
}

// 라운드 종료
//5??
function endRound() {
    const sorted = [...gameState.horses].sort((a, b) => b.level - a.level);
    const rank = sorted.findIndex(h => h.suit === playerState.selectedHorse) + 1;
    const reward = gameState.rewardTable[rank] || 0;

    applyJokerEffects('onRoundEnd', rank);

    playerState.gold += reward;
    playerState.currentRound++;

    setTimeout(() => {
        alert(`${playerState.selectedHorse} 말이 ${rank}등을 하여 ${reward}G를 획득했습니다!`);

        if (playerState.currentRound <= 5) {
            openShop(); // 상점 열기
        }

        if (playerState.currentRound > 5) {
            alert(`🏁 게임 종료! 총 획득 골드: ${playerState.gold}G`);
            gameState.gameOver = true;
        } else {
            // 새로운 라운드 시작 시 말 선택 초기화
            playerState.selectedHorse = null;
            deckClickable = true;
            //사용한 카드 초기회
            resetCardTracker();

            initializeGame();
        }
    }, 600);
}

// 카드 트래커 리셋
function resetCardTracker() {
    document.querySelectorAll('.card-indicator').forEach(card => {
        card.classList.remove('used-card');
    });
    const suits = ['♥', '♦', '♠', '♣'];
    suits.forEach(suit => {
        gameState.usedCardsBySuit[suit] = [];
        const countElement = document.getElementById(`${suit}Count`);
        if (countElement) {
            countElement.textContent = 13;
            countElement.classList.remove('low');
        }
    });
}

// 점수판 업데이트
function updateScoreboard() {
    roundDisplay.textContent = playerState.currentRound;
    goldDisplay.textContent = playerState.gold;
    document.getElementById('mobile-round').textContent = playerState.currentRound;
    document.getElementById('mobile-gold').textContent = playerState.gold;
}

// 재시작 버튼
// 클리어시 버그
// 클
restartButton.addEventListener('click', () => {
    playerState.gold = 0;
    playerState.currentRound = 1;
    playerState.selectedHorse = null;
    gameState.jokers = []; // 조커 인벤토리 초기화
    initializeGame();
});

// 상점 열기
function openShop() {
    generateShopItems();
    document.getElementById('shop-gold').textContent = playerState.gold;
    document.getElementById('shopPopup').style.display = 'flex';
}

function closeShop() {
    document.getElementById('shopPopup').style.display = 'none';
}

//상점
/**
상점 근데 3개로 되나?
 */
function generateShopItems() {
    // 1회성이 아닌 조커만 필터링
    const availableJokers = Object.values(JOKER_TYPES).filter(
        joker => !gameState.jokers.some(owned =>
            owned.id === joker.id && !joker.isConsumable
        )
    );

    // 랜덤으로 3개 선택 (중복 없음)
    gameState.shopJokers = [];
    while (gameState.shopJokers.length < 3 && availableJokers.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableJokers.length);
        gameState.shopJokers.push(availableJokers[randomIndex]);
        availableJokers.splice(randomIndex, 1);
    }

    const shopContainer = document.querySelector('.joker-shop');
    shopContainer.innerHTML = '';

    gameState.shopJokers.forEach(joker => {
        const jokerCard = document.createElement('div');
        jokerCard.className = `joker-card shop-item ${joker.isConsumable ? 'consumable' : ''}`;
        jokerCard.dataset.price = joker.price;
        jokerCard.innerHTML = `
            <div class="joker-image" style="background:${getJokerColor(joker.id)}">
                ${joker.isConsumable ? '⏳' : ''}
            </div>
            <div class="joker-info">
                <h4>${joker.name}</h4>
                <p>${joker.effect}</p>
                <p class="price">${joker.price}G</p>
            </div>
        `;
        jokerCard.addEventListener('click', () => buyJoker(joker));
        shopContainer.appendChild(jokerCard);
    });
}

// 조커 색상 함수
function getJokerColor(id) {
    const colors = {1: '#f1c40f', 2: '#e74c3c', 3: '#3498db', 4: '#f39c12'};
    return colors[id] || '#9b59b6';
}

/**
 * 조커 카드 구매
 */
function buyJoker(joker) {
    if (playerState.gold >= joker.price) {
        playerState.gold -= joker.price;
        gameState.jokers.push(joker);
        updateJokerInventory();
        updateScoreboard();
        closeShop();
        initializeGame(); // 다음 라운드 시작
    } else {
        alert('골드가 부족합니다!');
    }
}

function rerollShop() {
    if (playerState.gold >= 2) {
        playerState.gold -= 2;
        updateScoreboard();

        // 애니메이션 효과
        const shopItems = document.querySelectorAll('.joker-card');
        shopItems.forEach(item => {
            item.style.transform = 'rotateY(90deg)';
            item.style.opacity = '0';
        });

        setTimeout(() => {
            generateShopItems();
        }, 300);
    } else {
        alert('리롤에 필요한 골드가 부족합니다!');
    }
}


/**
 * 조커 인벤토리 UI
 */
function updateJokerInventory() {
    const slots = document.querySelectorAll('.joker-slot');
    slots.forEach((slot, index) => {
        slot.innerHTML = '';
        if (gameState.jokers[index]) {
            const joker = gameState.jokers[index];
            slot.innerHTML = `
                <div class="joker-image" style="background:${getJokerColor(joker.id)}">
                    ${joker.isConsumable ? '⏳' : ''}
                </div>
                <div class="joker-name" style="align-self: center">${joker.name}</div>
            `;
        }
    });
}


// 조커 효과 적용
function applyJokerEffects(context, ...args) {
    const results = [];
    const jokersToRemove = [];

    gameState.jokers.forEach(joker => {
        if ((joker.isConsumable && joker.trigger === context) ||
            (!joker.isConsumable && joker[context])) {

            const result = joker[context](...args);
            if (result) {
                results.push(result);
                if (joker.isConsumable) {
                    jokersToRemove.push(joker);
                }
            }
        }
    });

    gameState.jokers = gameState.jokers.filter(joker => !jokersToRemove.includes(joker));

    if (jokersToRemove.length > 0) {
        updateJokerInventory();
    }

    // 효과 메시지 처리 (수정된 부분)
    results.forEach(result => {
        if (result.message) {
            showEffectMessage(result.message);
        } else if (result.gold) {
            showEffectMessage(`🎉 골드 +${result.gold} 획득!`);
        } else if (result.move) {
            showEffectMessage(`⚡ ${result.move > 0 ? '앞으로' : '뒤로'} ${Math.abs(result.move)}칸 이동!`);
        } else if (result.cancel) {
            showEffectMessage(`🛡️ 패널티가 무효화되었습니다!`);
        }
    });

    if (results.some(r => r.cancel)) return { cancelled: true };
    if (results.some(r => r.used)) return { used: true };
    return results[0] || {};
}

// 효과 메시지 표시
function showEffectMessage(message) {
    if (!message) return;

    const msgElement = document.createElement('div');
    msgElement.className = 'effect-message';
    msgElement.textContent = message;
    document.body.appendChild(msgElement);

    // 애니메이션 효과 추가
    msgElement.style.opacity = '1';
    msgElement.style.transform = 'translateY(0)';

    setTimeout(() => {
        msgElement.style.opacity = '0';
        msgElement.style.transform = 'translateY(-20px)';
        setTimeout(() => msgElement.remove(), 300);
    }, 2000);
}



/*모바일*/
// 모바일 인벤토리 토글
document.getElementById('inventory-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('joker-inventory').classList.add('active');
});

// 인벤토리 외부 클릭 시 닫기
document.addEventListener('click', function() {
    document.getElementById('joker-inventory').classList.remove('active');
});

// 인벤토리 내부 클릭 시 이벤트 전파 막기
document.getElementById('joker-inventory').addEventListener('click', function(e) {
    e.stopPropagation();
});


// 모바일 덱 버튼 이벤트 연결
document.getElementById('deck-mobile').addEventListener('click', function () {
    if (!deckClickable) return;

    deckClickable = false;
    drawCard();

    setTimeout(() => {
        deckClickable = true;
    }, 500); // 0.5초 쿨타임
});



// 초기 게임 시작
initializeGame();

document.addEventListener('DOMContentLoaded', function() {
    initializeGame();
});

document.getElementById('rerollBtn').addEventListener('click', rerollShop);
document.getElementById('skipBtn').addEventListener('click', closeShop);