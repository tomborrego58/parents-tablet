const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});
for(const v of ['A','B','C']){await p.goto('file://'+__dirname+'/home-mockups.html?v='+v);await p.waitForTimeout(300);await p.screenshot({path:__dirname+'/option-'+v+'.png'});}
await b.close();})();
