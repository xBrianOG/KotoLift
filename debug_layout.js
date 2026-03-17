import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport large enough
  await page.setViewport({ width: 1280, height: 1024 });
  
  // Navigate
  await page.goto('http://localhost:5173');
  
  console.log('Waiting for Import button...');
  // Click Import
  await page.waitForSelector('text/Import');
  const importBtns = await page.$$('button');
  for (const btn of importBtns) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Import')) {
      await btn.click();
      break;
    }
  }
  
  console.log('Waiting for URL input...');
  // Type URL
  await page.waitForSelector('input[type="text"]');
  await page.type('input[type="text"]', 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
  
  console.log('Waiting for Analyze button...');
  // Click Analyze
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const analyzeBtn = btns.find(b => b.textContent && b.textContent.includes('Analyze'));
    if (analyzeBtn) analyzeBtn.click();
  });
  
  console.log('Waiting for elephants text...');
  // Wait for results
  await page.waitForFunction(() => {
    return document.body.innerText.includes('elephants');
  }, { timeout: 15000 });
  
  console.log('Analyzing Computed CSS...');
  
  // get the checkbox
  const checkboxInfo = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    if (inputs.length === 0) return 'No checkboxes found';
    
    // Get the first one in the list (not the 'select all' one if it exists, but close enough)
    const targetInput = inputs[inputs.length - 1]; // Usually the last one is the list item
    
    const computed = window.getComputedStyle(targetInput);
    const parent = targetInput.parentElement;
    const parentComputed = parent ? window.getComputedStyle(parent) : null;
    
    return {
      inputClasses: targetInput.className,
      inputDisplay: computed.display,
      inputPosition: computed.position,
      inputMargin: computed.margin,
      parentHtml: parent ? parent.outerHTML : 'no parent',
      parentDisplay: parentComputed ? parentComputed.display : 'none',
      parentFlexDirection: parentComputed ? parentComputed.flexDirection : 'none'
    };
  });
  
  console.log(JSON.stringify(checkboxInfo, null, 2));
  
  await browser.close();
})();
