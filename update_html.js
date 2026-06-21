const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Remove Hosting from nav
content = content.replace(/<a href="#hosting">Hosting<\/a>\s*/, '');

// 2. Remove QuikDB link from footer
content = content.replace(/<a href="https:\/\/www\.quikdb\.com">Hosted on QuikDB<\/a>\s*/, '');

// 3. Remove QuikDB section completely
const quikdbRegex = /<section class="quikdb-section" id="hosting">[\s\S]*?<\/section>/;
content = content.replace(quikdbRegex, '');

// 4. Swap hero-ctas and windows-download-wrapper
const ctasRegex = /(<div class="hero-ctas">[\s\S]*?<\/div>\s*)(<div class="windows-download-wrapper reveal">[\s\S]*?<\/div>)/;
content = content.replace(ctasRegex, '$2\n$1');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('HTML updated successfully!');
