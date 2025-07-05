
const searchBtn = document.getElementById("search-button");
const loadBtn = document.getElementById("load-lyrics-button");
const select = document.getElementById("song-select");
const display = document.getElementById("lyric-display");
const practiceArea = document.getElementById("practice-area");

const GENIUS_TOKEN = "Bearer jz-Esy5WZjyg3D8CtRh_3sgcrUWPcBNiHbzWVe69pidWRYsON5VLIcrGjtaRb4WB";

searchBtn.onclick = async () => {
  const keyword = document.getElementById("search-input").value.trim();
  if (!keyword) return alert("請輸入內容");
  display.textContent = "搜尋中...";
  select.innerHTML = "";
  practiceArea.innerHTML = "";
  loadBtn.hidden = true;

  const url = `https://api.genius.com/search?q=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, {
    headers: { Authorization: GENIUS_TOKEN }
  });
  const data = await res.json();

  if (!data.response.hits.length) {
    display.textContent = "找不到歌曲";
    return;
  }

  data.response.hits.forEach((hit, i) => {
    const option = document.createElement("option");
    option.value = hit.result.url;
    option.textContent = `${hit.result.full_title}`;
    select.appendChild(option);
  });

  select.hidden = false;
  loadBtn.hidden = false;
  display.textContent = "請選擇歌曲";
};

loadBtn.onclick = async () => {
  const songUrl = select.value;
  display.textContent = "載入歌詞中...";
  practiceArea.innerHTML = "";

  try {
    const proxy = "https://cors-anywhere.herokuapp.com/";
    const res = await fetch(proxy + songUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    const lyricsEl = doc.querySelector(".lyrics") || doc.querySelector('[data-lyrics-container]');
    if (!lyricsEl) throw new Error("無法解析歌詞");

    let lyrics = "";
    if (lyricsEl.getAttribute("data-lyrics-container") !== null) {
      lyrics = Array.from(lyricsEl.querySelectorAll("div")).map(d => d.textContent).join("\n");
    } else {
      lyrics = lyricsEl.textContent;
    }

    const lines = lyrics.split(/\r?\n/).filter(l => l.trim());
    display.textContent = `共 ${lines.length} 句，開始練習！`;
    lines.forEach((line, index) => {
      const card = createPracticeCard(line, index);
      practiceArea.appendChild(card);
    });
    focusCard(0);
  } catch (e) {
    console.error(e);
    display.textContent = "載入失敗，可能無法存取 Genius 或需要開啟 CORS Proxy。";
  }
};

function createPracticeCard(sentence, index) {
  const card = document.createElement("div");
  card.className = "practice-card";

  const inputWrapper = document.createElement("div");
  inputWrapper.className = "input-wrapper";

  const displayLayer = document.createElement("div");
  displayLayer.className = "display-layer";

  const inputLayer = document.createElement("div");
  inputLayer.className = "input-layer";
  inputLayer.contentEditable = true;

  inputLayer.addEventListener("input", () => {
    const user = inputLayer.innerText.trim();
    let result = "", correct = true;
    for (let i = 0; i < user.length; i++) {
      const u = user[i], c = sentence[i];
      if (u === c) result += `<span class='correct'>${u}</span>`;
      else result += `<span class='incorrect'>${u}</span>`, correct = false;
    }
    displayLayer.innerHTML = result;

    if (user === sentence) {
      inputLayer.setAttribute("contenteditable", "false");
      inputLayer.style.caretColor = "transparent";
      setTimeout(() => {
        const all = Array.from(document.querySelectorAll(".input-layer"));
        const idx = all.indexOf(inputLayer);
        if (idx + 1 < all.length) focusCard(idx + 1);
      }, 300);
    }
  });

  inputWrapper.appendChild(displayLayer);
  inputWrapper.appendChild(inputLayer);
  card.appendChild(inputWrapper);
  return card;
}

function focusCard(index) {
  const all = document.querySelectorAll(".input-layer");
  if (all[index]) all[index].focus();
}
