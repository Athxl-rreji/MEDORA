const Tesseract = require('tesseract.js');
const Jimp = require('jimp');

async function run() {
  const imagePath = 'd:\\MEDORA\\tests\\strip 1.jpg';
  const processedPath = 'd:\\MEDORA\\tests\\strip 1_processed.jpg';
  
  try {
    const image = await Jimp.read(imagePath);
    image
      .greyscale()
      .contrast(0.8) // heavily increase contrast
      .normalize()
      .write(processedPath);
      
    // wait a moment for file write
    await new Promise(r => setTimeout(r, 1000));

    const { data: { text } } = await Tesseract.recognize(processedPath, 'eng');
    console.log("=== RAW OCR TEXT AFTER PREPROCESSING ===");
    console.log(text);
    console.log("====================");
  } catch (err) {
    console.error(err);
  }
}

run();
