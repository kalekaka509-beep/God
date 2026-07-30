const TWELVE_API_KEY = "a46c1cab01014657848de0c9b2096090"; // CHANGE GAR
const GROQ_API_KEY = "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"; // CHANGE GAR

let selectedTF = "1min";
let uploadedImage = null;

document.addEventListener('DOMContentLoaded', function() {
  
  // TIMEFRAME BUTTON
  document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.onclick = function() {
      document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      selectedTF = this.dataset.tf;
      console.log("Selected TF:", selectedTF);
    };
  });

  // IMAGE UPLOAD
  document.getElementById('chartUpload').onchange = function(e) {
    const file = e.target.files[0];
    if(file){
      const reader = new FileReader();
      reader.onload = function(ev) {
        uploadedImage = ev.target.result.split(',')[1];
        document.getElementById('preview').src = ev.target.result;
        document.getElementById('preview').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  };

  document.getElementById('scanBtn').onclick = runScan;
});


// ===== 50 INDICATORS SMC =====
function calcIndicators(candles){
  let close = candles.map(c=>c.close);
  let high = candles.map(c=>c.high);
  let low = candles.map(c=>c.low);
  let last = candles[candles.length-1];

  const SMA = (arr, p) => arr.slice(-p).reduce((a,b)=>a+b,0)/p;
  const MAX = (arr,p) => Math.max(...arr.slice(-p)); 
  const MIN = (arr,p) => Math.min(...arr.slice(-p));

  return {
    "BOS": last.close > MAX(high,5)? "BULLISH_BOS" : "BEARISH_BOS",
    "BULLISH_OB": `${MIN(low,3).toFixed(5)} - ${MAX(high,3).toFixed(5)}`,
    "RSI_14": "55.20",
    "NOTE": "Demo Data"
  };
}


async function runScan() {
  let pair = document.getElementById('pair').value;
  const btn = document.getElementById('scanBtn');
  const resultDiv = document.getElementById('resultBox');
  btn.disabled = true;
  resultDiv.innerHTML = `<div class="loading">⏳ Live Price + ${selectedTF} Data liyadai...</div>`;

  try {
    // 1. LIVE PRICE
    const quoteRes = await fetch(`https://api.twelvedata.com/price?symbol=${pair}&apikey=${TWELVE_API_KEY}`);
    const quoteData = await quoteRes.json();
    if (quoteData.code) throw new Error("TwelveData: " + quoteData.message);
    let currentPrice = parseFloat(quoteData.price).toFixed(5);

    // 2. CANDLE DATA
    const res = await fetch(`https://api.twelvedata.com/time_series?symbol=${pair}&interval=${selectedTF}&outputsize=20&apikey=${TWELVE_API_KEY}`);
    const data = await res.json();
    if (data.status === "error") throw new Error("TwelveData: " + data.message);

    let lastCandleTime = data.values[0].datetime;
    let candles = data.values.map(v => ({
      close: parseFloat(v.close), high: parseFloat(v.high),
      low: parseFloat(v.low), volume: parseFloat(v.volume)
    })).reverse();

    let ind = calcIndicators(candles);

    resultDiv.innerHTML = `<div class="loading">🧠 AI Analyzing...</div>`;

    // 3. AI CALL
    const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: `Pair: ${pair} TF: ${selectedTF} Price: ${currentPrice}. Give SIGNAL: BUY/SELL/HOLD with ENTRY TP SL` }]
      })
    });
    const aiData = await aiRes.json();
    if (aiData.error) throw new Error("Groq: " + aiData.error.message);

    let aiText = aiData.choices[0].message.content;
    let signalType = aiText.includes("BUY")? "BUY" : aiText.includes("SELL")? "SELL" : "HOLD";

    resultDiv.innerHTML = `
      <div class="signal ${signalType}">${signalType}</div>
      <div class="detail">
        <b>Pair:</b> ${pair} | <b>TF:</b> ${selectedTF}<br>
        <b>Live Price:</b> <span style="color:#00D4FF">${currentPrice}</span><br>
        <b>Last Candle:</b> ${lastCandleTime}<br><br>
        <pre style="white-space:pre-wrap">${aiText}</pre>
      </div>
    `;

  } catch (e) {
    console.error("FULL ERROR:", e);
    resultDiv.innerHTML = `<div class="error">❌ ERROR: ${e.message}</div>`;
  }
  btn.disabled = false;
}
