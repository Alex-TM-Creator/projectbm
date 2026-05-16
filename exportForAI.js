const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['node_modules', '.next', '.git', 'dist', 'build', 'public'];
const INCLUDE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.md'];

function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!IGNORE_DIRS.includes(file)) {
        walk(fullPath, fileList);
      }
    } else {
      const ext = path.extname(file);
      if (INCLUDE_EXTS.includes(ext) && file !== 'package-lock.json') {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const allFiles = walk(process.cwd());
let out = '# Projeto Conect 3 - Source Code Context\n\n';
out += 'This file contains the full source code for the Next.js project.\n\n';

for (const file of allFiles) {
  const relativePath = path.relative(process.cwd(), file);
  out += `\n\n--- FILE: ${relativePath} ---\n\n`;
  out += '```' + path.extname(file).slice(1) + '\n';
  try {
    const content = fs.readFileSync(file, 'utf-8');
    out += content + '\n```\n';
  } catch(e) {
    out += '// Could not read file\n```\n';
  }
}

fs.writeFileSync('projeto_conect3_export_ai_studio.txt', out);
console.log('Export generated successfully: projeto_conect3_export_ai_studio.txt');
