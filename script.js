document.addEventListener("DOMContentLoaded", () => {
    const inputArea = document.getElementById("new-sentence-input");
    const addButton = document.getElementById("add-sentence-button");
    const practiceArea = document.getElementById("practice-area");

    let sentenceList = [];
    let currentIndex = 0;

    addButton.addEventListener("click", () => {
        const text = inputArea.value.trim();
        if (!text) return;

        sentenceList = splitIntoSentences(text);
        currentIndex = 0;
        practiceArea.innerHTML = "";

        sentenceList.forEach((sentence, index) => {
            const card = createPracticeCard(sentence, index);
            practiceArea.appendChild(card);
        });

        focusCard(0);
    });

    function splitIntoSentences(text) {
        const regex = /[^。！？!?\n]+[。！？!?」）]?/g;
        return text.match(regex) || [];
    }

    function createPracticeCard(sentence, index) {
        const card = document.createElement("div");
        card.className = "practice-card";

        const controls = document.createElement("div");
        controls.className = "practice-controls";

        const playBtn = document.createElement("button");
        playBtn.textContent = "🔊 播放";
        playBtn.addEventListener("click", () => speak(sentence));

        const hintBtn = document.createElement("button");
        hintBtn.textContent = "💡 顯示提示";

        const hintText = document.createElement("div");
        hintText.className = "hint-text";
        hintText.textContent = sentence;

        const tickMark = document.createElement("span");
        tickMark.textContent = "✔";
        tickMark.style.display = "none";
        tickMark.style.color = "green";
        tickMark.style.marginLeft = "10px";
        tickMark.style.fontWeight = "bold";

        hintBtn.addEventListener("click", () => {
            createHintRubyText(sentence, html => {
                hintText.innerHTML = html;
                hintText.style.display = "block";
                hintBtn.style.display = "none";
            });
        });

        controls.appendChild(playBtn);
        controls.appendChild(hintBtn);
        controls.appendChild(tickMark);

        const inputWrapper = document.createElement("div");
        inputWrapper.className = "input-wrapper";

        const displayArea = document.createElement("div");
        displayArea.className = "display-layer";

        const editableInput = document.createElement("div");
        editableInput.className = "input-layer";
        editableInput.contentEditable = true;

        editableInput.addEventListener("input", () => {
            const userInput = editableInput.innerText;
            const correctAnswer = sentence;
            let resultHTML = "";
            let isAllCorrect = true;

            for (let i = 0; i < userInput.length; i++) {
                const typedChar = userInput[i];
                const correctChar = correctAnswer[i];

                const isMatch = (
                    typedChar === correctChar ||
                    (typedChar === ' ' && correctChar === '　') ||
                    (typedChar === '　' && correctChar === ' ')
                );

                if (typedChar === '\n') {
                    resultHTML += '<br>';
                    continue;
                }

                if (i < correctAnswer.length && isMatch) {
                    resultHTML += `<span class="correct">${typedChar}</span>`;
                } else {
                    resultHTML += `<span class="incorrect">${typedChar}</span>`;
                    isAllCorrect = false;
                }
            }

            displayArea.innerHTML = resultHTML;

            if (userInput === correctAnswer || isAllCorrect && userInput.length === correctAnswer.length) {
                editableInput.setAttribute("contenteditable", "false");
                editableInput.style.caretColor = "transparent";
                tickMark.style.display = "inline";
                if (index + 1 < sentenceList.length) {
                    focusCard(index + 1);
                }
            }
        });

        inputWrapper.appendChild(displayArea);
        inputWrapper.appendChild(editableInput);

        card.appendChild(controls);
        card.appendChild(hintText);
        card.appendChild(inputWrapper);

        return card;
    }

    function focusCard(index) {
        const cards = practiceArea.querySelectorAll(".practice-card .input-layer");
        if (cards[index]) {
            cards[index].focus();
        }
    }

    function speak(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP';
            utterance.rate = 0.9;
            utterance.pitch = 1;
            window.speechSynthesis.speak(utterance);
        }
    }
});


// === MODIFIED FUNCTION START ===
// 此函式已被修改，以在詞組內部添加空格，同時保持原始的區塊結構和顏色
function createHintRubyText(sentence, callback) {
    kuromoji.builder({ dicPath: './dict/' }).build((err, tokenizer) => {
        if (err) {
            console.error(err);
            callback(sentence); // Fallback to original sentence on error
            return;
        }

        const tokens = tokenizer.tokenize(sentence);
        const container = document.createElement("div");

        // 步驟 1: 將 token 組合成邏輯單位（文節）
        const groupedTokens = [];
        tokens.forEach(token => {
            if (!token.surface_form.trim()) return; 

            const isFunctionWord = token.pos === '助詞' || token.pos === '助動詞';
            
            if (groupedTokens.length === 0 || !isFunctionWord) {
                groupedTokens.push([token]);
            } else {
                groupedTokens[groupedTokens.length - 1].push(token);
            }
        });

        // 步驟 2: 為每個詞組生成 HTML
        groupedTokens.forEach(group => {
            // **核心修改點**：使用 .join(' ') 來在單詞之間加入空格
            const surface = group.map(t => t.surface_form).join(' ');
            const romajiText = group.map(t => getAccurateRomaji(t)).join(' ');
            
            const posClass = mapPosToClass(group[0].pos);

            const block = document.createElement("span");
            block.className = "hint-block " + posClass;

            const word = document.createElement("span");
            word.className = "word";
            word.textContent = surface; // e.g., "僕ら が"

            const underline = document.createElement("span");
            underline.className = "underline";

            const romajiSpan = document.createElement("span");
            romajiSpan.className = "romaji";
            romajiSpan.textContent = romajiText; // e.g., "bokura ga"

            block.appendChild(word);
            block.appendChild(underline);
            block.appendChild(romajiSpan);
            container.appendChild(block);
             
            container.appendChild(document.createTextNode(" "));
        });

        callback(container.innerHTML);
    });
}
// === MODIFIED FUNCTION END ===

function mapPosToClass(pos) {
    switch (pos) {
        case "名詞": return "noun";
        case "動詞": return "verb";
        case "助詞": return "particle";
        case "助動詞": return "auxiliary";
        case "形容詞": return "adjective";
        case "副詞": return "adverb";
        case "記号": return "symbol";
        case "感動詞": return "other"; 
        case "連体詞": return "other"; 
        case "接続詞": return "other"; 
        case "接頭詞": return "other"; 
        default: return "other";
    }
}

function getAccurateRomaji(token) {
    if (token.pos === "助詞" && token.surface_form === "は") return "wa";
    if (token.pos === "助詞" && token.surface_form === "へ") return "e";
    if (token.pos === "助詞" && token.surface_form === "を") return "o";
    
    const reading = token.reading || token.surface_form;
    
    if (reading.endsWith('ッ')) {
         return wanakana.toRomaji(reading.slice(0, -1)) + wanakana.toRomaji(reading.slice(0, -1)).slice(-1);
    }

    return wanakana.toRomaji(reading);
}