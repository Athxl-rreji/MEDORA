const Tesseract = require('tesseract.js');

async function run() {
  const imagePath = 'd:\\MEDORA\\tests\\strip 1.jpg';
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
    console.log("=== RAW OCR TEXT ===");
    console.log(text);
    console.log("====================");
  } catch (err) {
    console.error(err);
  }
}

run();
