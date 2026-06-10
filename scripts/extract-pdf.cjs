// Quick-and-dirty PDF text extractor (FlateDecode streams + Tj/TJ ops) so the
// buildathon T&Cs are greppable without external tooling.
const fs = require("fs");
const zlib = require("zlib");

const file = process.argv[2];
const data = fs.readFileSync(file);
const out = [];
const re = /stream\r?\n/g;
let m;
while ((m = re.exec(data)) !== null) {
  const end = data.indexOf("endstream", m.index);
  if (end < 0) continue;
  const buf = data.slice(m.index + m[0].length, end);
  try {
    out.push(zlib.inflateSync(buf).toString("latin1"));
  } catch {}
}
const text = out.join(" ");
const chunks = [...text.matchAll(/\((.*?(?<!\\))\)\s*Tj|\[(.*?)\]\s*TJ/gs)].map((c) => {
  let s = c[1] !== undefined ? c[1] : (c[2] || "").replace(/\)\s*-?[\d.]+\s*\(/g, "");
  return s
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\n/g, "\n");
});
const doc = chunks.join("");
fs.writeFileSync(file.replace(/\.pdf$/i, ".extracted.txt"), doc);
console.log("chars:", doc.length);
