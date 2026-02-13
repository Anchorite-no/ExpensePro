
import fs from 'fs';

const apiKey = 'AIzaSyCIG9zusLPYfaZ5GTc4y0km1m2o184zTdE';
const model = 'gemini-2.0-flash'; 
const imagePath = 'D:/Code/img/5.jpg';

async function test() {
  try {
    console.log('Reading image...');
    if (!fs.existsSync(imagePath)) {
        console.error('Image not found at ' + imagePath);
        return;
    }
    const b64 = fs.readFileSync(imagePath).toString('base64');
    console.log(`Image size: ${b64.length} chars (base64)`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const body = {
      contents: [{
        parts: [
          { text: "Identify receipt items. Return JSON: {items: [{title, amount, category, date}]}" },
          { inline_data: { mime_type: "image/jpeg", data: b64 } }
        ]
      }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    };

    console.log('Sending request to Google...');
    const startTime = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const duration = Date.now() - startTime;
    console.log(`Request took ${duration}ms`);

    if (!res.ok) {
      console.error('Error Status:', res.status);
      console.error('Error Body:', await res.text());
    } else {
      const data = await res.json();
      console.log('Success:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Script Error:', err);
  }
}

test();
