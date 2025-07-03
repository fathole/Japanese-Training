document.addEventListener("DOMContentLoaded", () => {
    // =================================================================
    //  Part 1: 高效能的語音與 Kuromoji 設定
    // =================================================================

    const voiceSelect = document.getElementById("voice-select");
    let voices = [];
    let speechTimeoutId;
    let keepAliveIntervalId;
    let selectedVoiceName = '';

     // --- 效能優化 1：一次性初始化 Kuromoji ---
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


    function populateVoiceList() {
        voices = window.speechSynthesis.getVoices();
        const previouslySelected = voiceSelect.value;
        voiceSelect.innerHTML = ''; // 清空選項

        const japaneseVoices = voices.filter(voice => voice.lang === 'ja-JP');

        if (japaneseVoices.length > 0) {
            japaneseVoices.forEach(voice => {
                const option = document.createElement('option');
                option.textContent = `${voice.name} (${voice.lang})`;
                option.setAttribute('value', voice.name);
                voiceSelect.appendChild(option);
            });
            // 嘗試恢復使用者之前的選擇
            voiceSelect.value = previouslySelected || japaneseVoices[0].name;
        } else {
            const option = document.createElement('option');
            option.textContent = '未找到日語語音';
            option.disabled = true;
            voiceSelect.appendChild(option);
        }
        // 觸發一次 change 事件，以確保 selectedVoiceName 被初始化
        selectedVoiceName = voiceSelect.value;
    }

    function loadAndPopulateVoices() {
        voices = window.speechSynthesis.getVoices();
        populateVoiceList();
    }

    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadAndPopulateVoices;
    }
    loadAndPopulateVoices(); // 初始呼叫

    // 當使用者改變選項時，更新選擇的語音
    voiceSelect.addEventListener('change', () => {selectedVoiceName = voiceSelect.value;});

    function speak(text) {
        if (!('speechSynthesis' in window)) return;

        clearTimeout(speechTimeoutId);
        window.speechSynthesis.cancel();

        speechTimeoutId = setTimeout(() => {
            window.speechSynthesis.resume();
            const utterance = new SpeechSynthesisUtterance(text);

            // --- 核心修改：使用選擇的語音 ---
            let selectedVoice = null;
            if (selectedVoiceName) {
                selectedVoice = voices.find(v => v.name === selectedVoiceName);
            }
            
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            } else {
                // 如果沒有選擇或找不到，則使用備用方案
                const fallbackVoice = voices.find(v => v.lang === 'ja-JP');
                if (fallbackVoice) {
                    utterance.voice = fallbackVoice;
                } else {
                    utterance.lang = 'ja-JP';
                }
            }
            
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.onerror = (event) => console.error('語音合成錯誤:', event.error, event);
            
            window.speechSynthesis.speak(utterance);
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
        hintBtn.style.position = 'relative'; // 為讀取動畫定位

        const hintText = document.createElement("div");
        hintText.className = "hint-text";

        // --- 核心修改點 ---
        hintBtn.addEventListener("click", async () => {
            hintBtn.disabled = true; // 防止重複點擊
            hintBtn.textContent = "分析中...";

            try {
                // 等待非同步的 createHintRubyText 完成
                const hintContainerElement = await createHintRubyText(sentence);
                
                hintText.innerHTML = '';
                hintText.appendChild(hintContainerElement);
                hintText.style.display = "block";
                hintBtn.style.display = "none"; // 成功後隱藏按鈕
            } catch (error) {
                console.error("無法生成提示:", error);
                hintText.textContent = "生成提示失敗，請稍後再試。";
                hintText.style.display = "block";
                hintBtn.textContent = "💡 顯示提示"; // 失敗後恢復按鈕
                hintBtn.disabled = false;
            }
        });
        // --- 修改結束 ---

        // ... 其他 createPracticeCard 的程式碼不變 ...
        const tickMark = document.createElement("span");
        tickMark.textContent = "✔"; tickMark.style.display = "none"; tickMark.style.color = "green"; tickMark.style.marginLeft = "10px"; tickMark.style.fontWeight = "bold";
        controls.appendChild(playBtn); controls.appendChild(hintBtn); controls.appendChild(tickMark);
        const inputWrapper = document.createElement("div"); inputWrapper.className = "input-wrapper";
        const displayArea = document.createElement("div"); displayArea.className = "display-layer";
        const editableInput = document.createElement("div"); editableInput.className = "input-layer"; editableInput.contentEditable = true;
        editableInput.addEventListener("input", () => { /* ... 內容不變 ... */ });
        inputWrapper.appendChild(displayArea); inputWrapper.appendChild(editableInput);
        card.appendChild(controls); card.appendChild(hintText); card.appendChild(inputWrapper);
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