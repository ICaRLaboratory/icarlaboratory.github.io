import assert from 'node:assert/strict';
export async function runSimulatorRouteChecks(browser, base) {
 const results=[];
 for(const [requested,selected] of [['contact','contact'],['track','track'],['unknown','track']]) {
  const page=await browser.newPage();
  try {
   await page.goto(`${base}/research.html?sim=${requested}&lang=en#interactive`);
   await page.waitForSelector('#simtab-contact');
   assert.equal(await page.locator(`#simtab-${selected}`).getAttribute('aria-selected'),'true');
   assert.equal(await page.locator(`#simpanel-${selected}`).isVisible(),true);
   assert.equal(await page.locator('html').getAttribute('lang'),'en');
   const other=selected==='contact'?'track':'contact';
   await page.locator(`#simtab-${other}`).click();
   assert.equal(await page.locator(`#simtab-${other}`).getAttribute('aria-selected'),'true');
   results.push({requested,pass:true});
  } catch(e) {results.push({requested,pass:false,error:e.message});}
  await page.close();
 }
 return results;
}
