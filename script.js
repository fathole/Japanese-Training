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


function createHintRubyText(sentence, callback) {
    kuromoji.builder({ dicPath: './dict/' }).build((err, tokenizer) => {
        if (err) {
            console.error(err);
            return;
        }

        const tokens = tokenizer.tokenize(sentence);
        const container = document.createElement("div");

        tokens.forEach(token => {
            const surface = token.surface_form;
            if (surface.trim() === "") {
                container.appendChild(document.createTextNode(" "));
                return;
            }

            const span = document.createElement("span");
            span.className = "token " + mapPosToClass(token.pos);

            const ruby = document.createElement("ruby");
            ruby.textContent = surface;

            const rt = document.createElement("rt");
            rt.textContent = getAccurateRomaji(token);

            ruby.appendChild(rt);
            span.appendChild(ruby);
            container.appendChild(span);
        });

        callback(container.innerHTML);
    });
}

function mapPosToClass(pos) {
    switch (pos) {
        case "名詞": return "noun";
        case "動詞": return "verb";
        case "助詞": return "particle";
        case "助動詞": return "auxiliary";
        case "形容詞": return "adjective";
        case "副詞": return "adverb";
        case "記号": return "symbol";
        default: return "other";
    }
}

function getAccurateRomaji(token) {
    if (token.pos === "助詞" && token.surface_form === "は") return "wa";
    if (token.pos === "助詞" && token.surface_form === "へ") return "e";
    if (token.pos === "助詞" && token.surface_form === "を") return "o";
    return token.reading ? wanakana.toRomaji(token.reading) : "";
}
