const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'archive', 'CEO_DASHBOARD.html');
const templatePath = path.join(__dirname, 'dashboard_template.html');

let content = fs.readFileSync(targetPath, 'utf8');
let template = fs.readFileSync(templatePath, 'utf8');

// Extract existing data blocks from CEO_DASHBOARD.html
const scriptMatch = content.match(/(const TASKS = \[[\s\S]+?const PRIORITY_LABELS = [^;]+;)/);
if (!scriptMatch) {
    console.error("Data block not found!");
    process.exit(1);
}
const dataBlock = scriptMatch[1];

// Extract SCREEN_STATUS if present, or use default
let screenStatusBlock;
const screenMatch = content.match(/(const SCREEN_STATUS = \[[\s\S]*?\];)/);
if (screenMatch) {
    screenStatusBlock = screenMatch[1];
} else {
    screenStatusBlock = `const SCREEN_STATUS = [];`;
}

// Extract CEO_DECISIONS if present, or use default
let decisionsBlock;
const decisionsMatch = content.match(/(const CEO_DECISIONS = \[[\s\S]*?\];)/);
if (decisionsMatch) {
    decisionsBlock = decisionsMatch[1];
} else {
    decisionsBlock = `const CEO_DECISIONS = [];`;
}

// Extract CEO_APPROVALS if present, or use default
let approvalsBlock;
const approvalsMatch = content.match(/(const CEO_APPROVALS = \[[\s\S]*?\];)/);
if (approvalsMatch) {
    approvalsBlock = approvalsMatch[1];
} else {
    approvalsBlock = `const CEO_APPROVALS = [];`;
}

// Inject all data blocks into template
let output = template;
output = output.replace('// DATA_BLOCK_PLACEHOLDER', dataBlock);
output = output.replace('// SCREEN_STATUS_PLACEHOLDER', screenStatusBlock);
output = output.replace('// CEO_DECISIONS_PLACEHOLDER', decisionsBlock);
output = output.replace('// CEO_APPROVALS_PLACEHOLDER', approvalsBlock);

fs.writeFileSync(targetPath, output, 'utf8');
console.log("Successfully rebuilt CEO_DASHBOARD.html with CEO view data");
