const puppet = require('puppeteer');
const fs = require('fs');
const fsp = require('fs/promises');
const wiki = require('./wiki.json')

const outputDir = 'spoils/';
const {links} = wiki;
const url = "https://wiki.abidanarchive.com/index.php?action=edit&title="

let i = 0;
async function getSource(page, title) {

    process.stdout.write("Proccesing: "+title);
    await page.goto(url+title, {waitUntil: 'networkidle0'});
    const source = await page.evaluate(() => {
        const el = document.querySelector('textarea');
        return !!el ? el.value : '????';
    });


    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    
    return {title, source};
}

(async () => {
    const browser = await puppet.launch();
    const page = await browser.newPage();

    !fs.existsSync(outputDir) && fs.mkdirSync(outputDir, {recursive: true});
    const spoils = [];


    console.log('This is war. Leave no page left standing!');
    for(let i = 0; i < links.length; i++) spoils.push(await getSource(page, links[i]));

    const now = (new Date()).toLocaleString('en-UK').replace(',','').replaceAll('/','-').replaceAll(' ','_');
    await fsp.writeFile(outputDir+`spoils_${now}.json`, JSON.stringify(spoils, null, 2));

    console.log('Salt the earth.');
    await browser.close();
})();
