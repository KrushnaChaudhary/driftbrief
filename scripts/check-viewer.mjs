import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  await page.route(/^https?:/,route=>route.abort());
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(pathToFileURL(path.resolve('docs/demo/evidence.html')).href);
  await page.locator('h1').waitFor();
  assert.equal(await page.locator('.receipt:not([hidden]) .evidence').count(),2);
  assert.equal(await page.locator('.receipt:not([hidden]) .invalidation p').count(),2);
  await page.screenshot({path:'docs/demo/evidence.png',fullPage:true});
  await page.locator('[data-receipt="r0"]').click();
  assert.equal(await page.locator('#r0').isVisible(),true);
  assert.equal(await page.locator('#r1').isVisible(),false);
  assert.ok((await page.locator('#r0').innerText()).includes('Source unavailable'));
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:'docs/demo/evidence-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Viewer desktop/mobile layout, receipt navigation and offline loading passed.');
}finally{await browser.close();}
