
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

        hintBtn.addEventListener("click", () => {
            hintText.style.display = "block";
            hintBtn.style.display = "none";
        });

        controls.appendChild(playBtn);
        controls.appendChild(hintBtn);

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

            for (let i = 0; i < userInput.length; i++) {
                const typedChar = userInput[i];
                const correctChar = correctAnswer[i];

                if (typedChar === '\n') {
                    resultHTML += '<br>';
                    continue;
                }

                if (i < correctAnswer.length && typedChar === correctChar
                    ||(typedChar === ' ' && correctChar === '　') 
                    ||(typedChar === '　' && correctChar === ' ')) 
                {
                    resultHTML += `<span class="correct">${typedChar}</span>`;
                } else {
                    resultHTML += `<span class="incorrect">${typedChar}</span>`;
                }
            }

            displayArea.innerHTML = resultHTML;

            if (userInput === correctAnswer) {
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
