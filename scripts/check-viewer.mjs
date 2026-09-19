import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  let requests=0;await page.route(/^https?:/,route=>{requests++;return route.abort();});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(path.resolve('docs/demo/map.html')).href);
  assert.equal(await page.locator('#engines button').count(),4);
  assert.equal(await page.locator('.edge').count(),2);
  await page.screenshot({path:'docs/demo/map.png',fullPage:true});
  const counts=[2,1,3,1];
  for(let i=0;i<4;i++){await page.locator('#engines button').nth(i).click();assert.equal(await page.locator('.edge').count(),counts[i]);}
  await page.setViewportSize({width:390,height:844});
  for(let i=0;i<4;i++){await page.locator('#engines button').nth(i).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);}
  await page.locator('#engines button').first().click();
  await page.screenshot({path:'docs/demo/map-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);assert.equal(requests,0);
  console.log('Game map demo: four navigation examples, desktop/mobile layout and offline loading passed.');
} finally {await browser.close();}
