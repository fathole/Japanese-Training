document.addEventListener("DOMContentLoaded", () => {
    // =================================================================
    //  Part 1: 高效能的語音與 Kuromoji 設定
    // =================================================================

    const voiceSelect = document.getElementById("voice-select");
    let voices = [];
    let speechTimeoutId;
    let keepAliveIntervalId;
    let selectedVoiceName = '';

   const noveltyVoiceBlocklist = [
        'Eddy', 'Reed', 'Shelley', 'Grandma', 'Rocko', 'Grandpa', 'Sandy', 'Flo',
        'Albert', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Good News',
        'Jester', 'Organ', 'Trinoids', 'Whisper', 'Zarvox'
    ];

    let tokenizerPromise;
    function initializeTokenizer() {
        console.log("正在初始化 Kuromoji 分詞引擎... (只需一次)");
        tokenizerPromise = new Promise((resolve, reject) => {
            kuromoji.builder({ dicPath: './dict/' }).build((err, tokenizer) => {
                if (err) {
                    console.error("Kuromoji 初始化失敗!", err);
                    reject(err);
                } else {
                    console.log("Kuromoji 初始化完成！");
                    resolve(tokenizer);
                }
            });
        });
    }
    initializeTokenizer(); // 頁面載入時立即開始初始化

    function getNativeVoices() {
        return new Promise(resolve => {
            const getVoices = () => {
                const nativeVoices = window.speechSynthesis.getVoices()
                    .filter(v => v.lang === 'ja-JP' && !noveltyVoiceBlocklist.includes(v.name))
                    .map(v => ({ ...v, source: 'native' })); // 標記來源為 'native'
                
                if (nativeVoices.length > 0) {
                    console.log("成功獲取原生語音:", nativeVoices);
                    resolve(nativeVoices);
                }
            };
            
            // 如果語音已載入，直接執行
            if (window.speechSynthesis.getVoices().length > 0) {
                getVoices();
            } else {
                // 否則等待事件觸發
                window.speechSynthesis.onvoiceschanged = getVoices;
                 // 設定備用輪詢以防萬一
                let voiceLoadInterval = setInterval(() => {
                    if (window.speechSynthesis.getVoices().length > 0) {
                        getVoices();
                        clearInterval(voiceLoadInterval);
                    }
                }, 250);
                setTimeout(() => clearInterval(voiceLoadInterval), 5000);
            }
        });
    }

   function getResponsiveVoices() {
        return new Promise(resolve => {
            // ResponsiveVoice 可能需要一點時間初始化
            const checkRV = () => {
                if (typeof responsiveVoice !== 'undefined' && responsiveVoice.getVoices().length > 0) {
                    const rvVoices = responsiveVoice.getVoices()
                        .filter(v => v.name.startsWith('Japanese'))
                        .map(v => ({ ...v, source: 'responsivevoice' })); // 標記來源
                    console.log("成功獲取 ResponsiveVoice 語音:", rvVoices);
                    resolve(rvVoices);
                } else {
                     // 如果尚未就緒，則稍後再試
                    setTimeout(checkRV, 250);
                }
            };
            checkRV();
        });
    }

  async function loadAndPopulateAllVoices() {
        console.log("正在載入所有語音來源...");
        voiceSelect.innerHTML = '<option value="">正在載入語音...</option>';
        
        try {
            // 並行獲取兩種語音
            const [nativeVoices, responsiveVoices] = await Promise.all([
                getNativeVoices(),
                getResponsiveVoices()
            ]);

            // 合併並去重
            const combined = [...responsiveVoices, ...nativeVoices]; // 讓 RV 語音優先
            const uniqueVoices = [];
            const seenNames = new Set();
            combined.forEach(voice => {
                if (!seenNames.has(voice.name)) {
                    seenNames.add(voice.name);
                    uniqueVoices.push(voice);
                }
            });

            voices = uniqueVoices; // 更新全域的 voices 陣列
            populateVoiceList();

        } catch (error) {
            console.error("載入語音時發生錯誤:", error);
            voiceSelect.innerHTML = '<option value="">語音載入失敗</option>';
        }
    }

   function populateVoiceList() {
        const previouslySelected = localStorage.getItem('preferredJapaneseVoice') || voiceSelect.value;
        voiceSelect.innerHTML = '';

        if (voices.length > 0) {
             voices.forEach(voice => {
                const option = document.createElement('option');
                // 標示語音來源，讓使用者更容易分辨
                const sourceTag = voice.source === 'native' ? '[原生]' : '[RV]';
                option.textContent = `${voice.name} ${sourceTag}`;
                option.setAttribute('value', voice.name);
                voiceSelect.appendChild(option);
            });
            
            const isValidSelection = voices.some(v => v.name === previouslySelected);
            if (isValidSelection) {
                voiceSelect.value = previouslySelected;
            } else {
                voiceSelect.value = voices[0].name; // 預設選擇第一個
            }
        } else {
            const option = document.createElement('option');
            option.textContent = '未找到可用的日語語音';
            option.disabled = true;
            voiceSelect.appendChild(option);
        }
        
        selectedVoiceName = voiceSelect.value;
        localStorage.setItem('preferredJapaneseVoice', selectedVoiceName);
    }

   // 啟動語音載入流程
    if ('speechSynthesis' in window && typeof responsiveVoice !== 'undefined') {
        loadAndPopulateAllVoices();
    } else {
        console.error("瀏覽器不支援 Web Speech API 或 ResponsiveVoice 未載入。");

    }

    // 當使用者改變選項時，更新選擇的語音
     voiceSelect.addEventListener('change', () => {
        selectedVoiceName = voiceSelect.value;
        localStorage.setItem('preferredJapaneseVoice', selectedVoiceName);
        console.log(`使用者選擇並儲存了語音: ${selectedVoiceName}`);
    });

   function speak(text) {
        // 先停止任何正在播放的語音
        window.speechSynthesis.cancel();
        if (typeof responsiveVoice !== 'undefined') {
            responsiveVoice.cancel();
        }
        clearTimeout(speechTimeoutId);

        speechTimeoutId = setTimeout(() => {
            const selectedVoice = voices.find(v => v.name === selectedVoiceName);

            if (!selectedVoice) {
                console.error("找不到選擇的語音:", selectedVoiceName);
                // 增加一個備用播放方案
                if (responsiveVoice.voiceSupport()) {
                   responsiveVoice.speak(text, "Japanese Male");
                }
                return;
            }

            console.log(`使用 ${selectedVoice.source} API 播放:`, text);

            if (selectedVoice.source === 'responsivevoice') {
                // 使用 ResponsiveVoice API
                 responsiveVoice.speak(text, selectedVoice.name, {
                    rate: 0.9,
                    pitch: 1
                });
            } else {
                // 使用原生的 Web Speech API
                window.speechSynthesis.resume();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.voice = selectedVoice;
                utterance.lang = 'ja-JP';
                utterance.rate = 0.9;
                utterance.pitch = 1;
                utterance.onerror = (event) => console.error('原生語音合成錯誤:', event.error, event);
                window.speechSynthesis.speak(utterance);
            }
        }, 50);
    }

    function startSpeechEngineKeepAlive() {
        if (keepAliveIntervalId) return;
        console.log("啟動語音引擎心跳維持功能...");
        keepAliveIntervalId = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
                const dummyUtterance = new SpeechSynthesisUtterance('');
                dummyUtterance.volume = 0;
                window.speechSynthesis.speak(dummyUtterance);
            }
        }, 8000);
    }
    
    // =================================================================
    //  Part 2: 應用程式邏輯
    // =================================================================
    const inputArea = document.getElementById("new-sentence-input");
    const addButton = document.getElementById("add-sentence-button");
    const practiceArea = document.getElementById("practice-area");

    addButton.addEventListener("click", () => {
        startSpeechEngineKeepAlive();
        const text = inputArea.value.trim();
        if (!text) return;
        practiceArea.innerHTML = "";
        splitIntoSentences(text).forEach((sentence, index) => {
            const card = createPracticeCard(sentence, index);
            practiceArea.appendChild(card);
        });
        focusCard(0);
    });

    function splitIntoSentences(text) {
        const regex = /[^。！？!?\n]+[。！？!?」）]?/g;
        return text.match(regex) || [];
    }

    // --- 改造點 1：修改 hintBtn 的事件監聽器以支援 async ---
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
    hintBtn.style.position = 'relative';

    const hintText = document.createElement("div");
    hintText.className = "hint-text";

    hintBtn.addEventListener("click", async () => {
        hintBtn.disabled = true;
        hintBtn.textContent = "分析中...";
        try {
            const hintContainerElement = await createHintRubyText(sentence);
            hintText.innerHTML = '';
            hintText.appendChild(hintContainerElement);
            hintText.style.display = "block";
            hintBtn.style.display = "none";
        } catch (error) {
            console.error("無法生成提示:", error);
            hintText.textContent = "生成提示失敗，請稍後再試。";
            hintText.style.display = "block";
            hintBtn.textContent = "💡 顯示提示";
            hintBtn.disabled = false;
        }
    });

    const tickMark = document.createElement("span");
    tickMark.textContent = "✔";
    tickMark.style.display = "none";
    tickMark.style.color = "green";
    tickMark.style.marginLeft = "10px";
    tickMark.style.fontWeight = "bold";

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

    // --- 這就是遺失並已恢復的關鍵程式碼 ---
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

        // 更新底層的顏色顯示
        displayArea.innerHTML = resultHTML;

        // 檢查是否全部正確
        if (userInput === correctAnswer || (isAllCorrect && userInput.length === correctAnswer.length)) {
            editableInput.setAttribute("contenteditable", "false");
            editableInput.style.caretColor = "transparent";
            tickMark.style.display = "inline";
            
            // 自動跳轉到下一個卡片
            const allCards = Array.from(practiceArea.querySelectorAll(".practice-card .input-layer"));
            const currentCardIndex = allCards.indexOf(editableInput);
            if (currentCardIndex > -1 && currentCardIndex + 1 < allCards.length) {
                focusCard(currentCardIndex + 1);
            }
        }
    });
    // --- 關鍵程式碼結束 ---

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

    // ---  將 createHintRubyText 改造成高效能的 async 函式 ---
    async function createHintRubyText(sentence) {
        // 等待全局唯一的 tokenizer 初始化完成
        const tokenizer = await tokenizerPromise;
        const tokens = tokenizer.tokenize(sentence);

        // 效能優化 2：使用 DocumentFragment 進行離線 DOM 操作
        const fragment = document.createDocumentFragment();

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

        groupedTokens.forEach(group => {
            const surface = group.map(t => t.surface_form).join(' ');
            const romajiText = group.map(t => getAccurateRomaji(t)).join(' ');
            const posClass = mapPosToClass(group[0].pos);
            const block = document.createElement("span");
            block.className = "hint-block " + posClass;
            block.addEventListener("click", () => {
                const textToSpeak = surface.replace(/\s+/g, '');
                console.log('提示文字被點擊！準備朗讀:', textToSpeak);
                speak(textToSpeak);
            });
            const word = document.createElement("span");
            word.className = "word";
            word.textContent = surface;
            const underline = document.createElement("span");
            underline.className = "underline";
            const romajiSpan = document.createElement("span");
            romajiSpan.className = "romaji";
            romajiSpan.textContent = romajiText;
            block.appendChild(word);
            block.appendChild(underline);
            block.appendChild(romajiSpan);
            
            // 將元素加入到 fragment，而不是直接加入 DOM
            fragment.appendChild(block);
            fragment.appendChild(document.createTextNode(" "));
        });

        // 返回包含所有元素的 fragment
        return fragment;
    }
    

    function mapPosToClass(pos) {
        switch (pos) {
            case "名詞": return "noun"; case "動詞": return "verb"; case "助詞": return "particle"; case "助動詞": return "auxiliary"; case "形容詞": return "adjective"; case "副詞": return "adverb"; case "記号": return "symbol"; case "感動詞": return "other"; case "連体詞": return "other"; case "接続詞": return "other"; case "接頭詞": return "other"; default: return "other";
        }
    }
    
    function getAccurateRomaji(token) {
        if (token.pos === "助詞" && token.surface_form === "は") return "wa";
        if (token.pos === "助詞" && token.surface_form === "へ") return "e";
        if (token.pos === "助詞" && token.surface_form === "を") return "o";
        const reading = token.reading || token.surface_form;
        if (reading.endsWith('ッ')) { return wanakana.toRomaji(reading.slice(0, -1)) + wanakana.toRomaji(reading.slice(0, -1)).slice(-1); }
        return wanakana.toRomaji(reading);
    }
});