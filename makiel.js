const puppet = require('puppeteer');
const fs = require('fs');
const fsp = require('fs/promises');
const TurndownService = require('turndown')
const turndown = new TurndownService()

const outputDir = 'reports/';
const events = [
    "https://www.abidanarchive.com/events/1-cradle/",
     "https://www.abidanarchive.com/events/2-general-lore/",
     "https://www.abidanarchive.com/events/3-asylum/",
     "https://www.abidanarchive.com/events/4-amalgam/",
     "https://www.abidanarchive.com/events/5-wills-life/",
     "https://www.abidanarchive.com/events/6-writing-advice/",
     "https://www.abidanarchive.com/events/7-september-2018-december-2018/",
     "https://www.abidanarchive.com/events/8-january-2019-february-2019-pre-underlord/",
     "https://www.abidanarchive.com/events/9-march-2019-may-2019/",
     "https://www.abidanarchive.com/events/10-september-2019-december-2019/",
     "https://www.abidanarchive.com/events/11-june-2019-august-2019/",
     "https://www.abidanarchive.com/events/12-underlord-release-qa/",
     "https://www.abidanarchive.com/events/13-interview-with-ac-cobble/",
     "https://www.abidanarchive.com/events/14-uncrowned-release-stream/",
     "https://www.abidanarchive.com/events/15-jan-to-jun-2020/",
     "https://www.abidanarchive.com/events/16-indie-fantasy-addicts-facebook-qa/",
     "https://www.abidanarchive.com/events/17-ya-buzz-book-club-qa/",
     "https://www.abidanarchive.com/events/18-july-december-2020/",
     "https://www.abidanarchive.com/events/19-denver-pop-culture-con-making-audiobook-magic/",
     "https://www.abidanarchive.com/events/20-wintersteel-release-stream/",
     "https://www.abidanarchive.com/events/21-10-reviews-10-answers/",
     "https://www.abidanarchive.com/events/22-december-2020-december-2021/",
     "https://www.abidanarchive.com/events/23-dreadgod-audio-excerpt/",
     "https://www.abidanarchive.com/events/24-bloodline-release-stream/",
     "https://www.abidanarchive.com/events/25-reaper-spoiler-stream/",
     "https://www.abidanarchive.com/events/26-reaper-release-stream/",
     "https://www.abidanarchive.com/events/27-january-2022-december-2022/",
     "https://www.abidanarchive.com/events/28-kickstarter-spoiler-stream/",
     "https://www.abidanarchive.com/events/29-dummy-test-event/",
     "https://www.abidanarchive.com/events/30-dreadgod-release-stream/",
     "https://www.abidanarchive.com/events/31-dragoncon-2022-qa/",
     "https://www.abidanarchive.com/events/32-2023/",
]

async function scrapeEventPage(page, url) {
    // Some pages the entries don't load immedeately or show up at all via puppeteer, waiting for network idle just in case...
    await page.goto(url, {waitUntil: 'networkidle0'});

    process.stdout.write('Processing: '+url);

    // Screenshot if something is fishy
    // await page.screenshot({path: 'screenshot.png', fullPage: true});

    const event = await page.evaluate(() => {
        // Get the Event data from the event details table
        const {name, date, location} = Array.from(document.querySelectorAll('.eventDetails tbody tr:not(.w3-hide-large)'))
                .reduce((out, tr) =>
                    !!tr.querySelector('th') ?
                    Object.assign(out, {[tr.querySelector('th').innerText.toLowerCase()]:tr.querySelector('td').innerText}) : out, {})
        // Get all the entries on the page
        const reports = Array.from(document.querySelectorAll('article.entry-article')).map(art => {
            const id = art.getAttribute('data-entry-id');
            const source = (a=art.querySelector('.urls > a'), !!a ? ({label: a.innerText, href: a.getAttribute('href')}) : {label: undefined, href: undefined});
            const dt = art.querySelector('time').innerText;
            const footnote = (f=art.querySelector('.footnote'), !!f ? f.innerText.startsWith('Footnote: ') ? f.innerText.substring(10) : f.innerText : undefined);

            // Get the speaker and line tag siblings (why1?!)
            let flf = true; // first line flag
            const dia = [];
            Array.from(art.querySelector('.entry-content').childNodes)
                .filter(el => !!el.innerText)
                .forEach(el => {
                    // H4
                    if(el.nodeName == 'H4') return dia.push({speaker: el.innerText, line: ''}) && (flf = true);
                    // P
                    if (dia.length < 1) dia.push({speaker: undefined, line: ''});
                    dia[dia.length-1].line += (!flf ? '\n':'') + el.innerHTML
                    flf = false;
                });

            // Tag
            const tags = Array.from(art.querySelectorAll('.tag')).map(tag => tag.innerText.substring(1));

            return {id, source_label: source.label,source_href: source.href, date: dt, dialogues: dia, tags, footnote};
        });
        return {name, date, location, reports};
    }).catch(async err => {
        console.error('\nVorshir Interference Detected! Generating Screenshot.\n');
        console.error(err);

        await page.screenshot({path: 'screenshot_parse_error.png', fullPage: true});

        process.exit(1);
    });

    // Translate each line of the entry into markdown rather than html
    // This cannot be done within the evaluate since we don't have the lib in the headless browser
    for (let i = 0; i < event.reports.length; i++)
        for (let n = 0; n < event.reports[i].dialogues.length; n++)
            event.reports[i].dialogues[n].line = turndown.turndown(event.reports[i].dialogues[n].line);



    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(event.name.replaceAll(' ', '_')+'\n');

    // const filename = event.name.replaceAll(' ', '_').toLowerCase() + '.json';
    // await fsp.writeFile(outputDir + filename, JSON.stringify(event, null, 2));

    return event;
}

async function login(page, username, pass) {
    await page.goto('https://abidanarchive.com/auth/login/', {waitUntil: 'networkidle0'});
    await page.type('#id_username', username);
    await page.type('#id_password', pass);
    await page.click('input[type=submit]');
    await page.waitForNavigation({waitUntil: 'networkidle2'});

    if (page.url() !== 'https://abidanarchive.com/') {
        console.error('Authorization rejected. Check screenshot for additional information.');
        await page.screenshot({path: 'screenshot_login_error.png', fullPage: true});
        return false;
    }

    console.error('Authorization Accepted.\nSynchronization set to 100%');
    return true;
}


const [ADMIN_USERNAME, ADMIN_PASS] = process.argv.slice(2);
(async () => {
    console.log('Synchronizing with Sector Control...');
    const browser = await puppet.launch();
    const page = await browser.newPage();

    if (!(ADMIN_USERNAME && ADMIN_PASS))
        console.log('Authorization Restricted. Synchronization set to 80%')
    else if (!await login(page, ADMIN_USERNAME, ADMIN_PASS)){
        await browser.close();
        process.exit(1);
    }

    // Make output directory should it not exist
    !fs.existsSync(outputDir) && fs.mkdirSync(outputDir, {recursive: true});
    const fullReport = [];

    console.log('\nBeginning Report...\n')

    // Start scraping!
    for(let i = 0; i < events.length; i++) fullReport.push(await scrapeEventPage(page, events[i]));

    // Write the final accumulation
    const now = (new Date()).toLocaleString('en-UK').replace(',','').replaceAll('/','-').replaceAll(' ','_');
    await fsp.writeFile(outputDir+`report_${now}.json`, JSON.stringify(fullReport, null, 2));

    console.log('\nReport Complete.')
    await browser.close();
})();

