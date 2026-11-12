const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '..', 'node_modules', 'html2canvas', 'dist', 'html2canvas.esm.js'),
  path.join(__dirname, '..', 'node_modules', 'html2canvas', 'dist', 'html2canvas.js'),
  path.join(__dirname, '..', 'node_modules', 'html2canvas', 'dist', 'lib', 'css', 'types', 'color.js')
];

const packDef = `
function pack(r, g, b, a) {
    return ((r << 24) | (g << 16) | (b << 8) | (Math.round((a !== undefined ? a : 1) * 255) << 0)) >>> 0;
}
`;

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Replace any exports.pack(...) with pack(...)
  code = code.replace(/exports\.pack\(/g, 'pack(');

  // Ensure pack is hoisted at the top or declared before color$1 / exports.color
  if (!code.includes('function pack(r, g, b, a)')) {
    if (code.includes('var color$1 = {')) {
      code = code.replace('var color$1 = {', packDef + '\nvar color$1 = {');
    } else if (code.includes('exports.color = {')) {
      code = code.replace('exports.color = {', packDef + '\nexports.pack = pack;\nexports.color = {');
    }
  }

  // Ensure SUPPORTED_COLOR_FUNCTIONS includes modern colors
  if (code.includes('var SUPPORTED_COLOR_FUNCTIONS = {')) {
    code = code.replace(
      'var SUPPORTED_COLOR_FUNCTIONS = {',
      `var parseModernColor = function (_context, args) {
    try {
        if (typeof document !== 'undefined') {
            var _c = document.createElement('canvas');
            _c.width = 1; _c.height = 1;
            var _ctx = _c.getContext('2d');
            if (_ctx) {
                var _valStr = (args || []).map(function(v){
                    if (!v) return '';
                    if (v.value !== undefined) return v.value;
                    if (v.number !== undefined) return v.unit ? (v.number + v.unit) : v.number;
                    return '';
                }).join(' ');
                _ctx.fillStyle = '#0f172a';
                _ctx.fillStyle = _valStr;
                var _fs = _ctx.fillStyle;
                if (_fs && _fs.startsWith('#')) {
                    var _r = parseInt(_fs.slice(1,3), 16);
                    var _g = parseInt(_fs.slice(3,5), 16);
                    var _b = parseInt(_fs.slice(5,7), 16);
                    return pack(_r, _g, _b, 1);
                } else if (_fs && _fs.startsWith('rgb')) {
                    var _m = _fs.match(/[\\d.]+/g);
                    if (_m && _m.length >= 3) {
                        return pack(Number(_m[0]), Number(_m[1]), Number(_m[2]), _m[3] ? Number(_m[3]) : 1);
                    }
                }
            }
        }
    } catch(e) {}
    return pack(15, 23, 42, 1);
};

var SUPPORTED_COLOR_FUNCTIONS = {
    oklch: parseModernColor,
    oklab: parseModernColor,
    lab: parseModernColor,
    lch: parseModernColor,
    color: parseModernColor,`
    );
  }

  fs.writeFileSync(file, code, 'utf8');
  console.log(`Successfully patched: ${file}`);
}

// Clear Vite cache so prebundler picks up the patched files
const viteCacheDir = path.join(__dirname, '..', 'node_modules', '.vite');
if (fs.existsSync(viteCacheDir)) {
  fs.rmSync(viteCacheDir, { recursive: true, force: true });
  console.log('Removed Vite cache directory to ensure fresh bundle generation.');
}
