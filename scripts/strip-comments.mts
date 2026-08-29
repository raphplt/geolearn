import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import ts from 'typescript';

const ROOT = join(import.meta.dirname, '..');
const TARGETS = ['src', 'app', 'scripts'];
const EXTS = new Set(['.ts', '.tsx', '.mts']);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(path);
    return EXTS.has(extname(entry.name)) ? [path] : [];
  });
}

type Range = { pos: number; end: number };

function commentRanges(source: ts.SourceFile, text: string): Range[] {
  const ranges: Range[] = [];
  const seen = new Set<string>();

  const add = (list: ts.CommentRange[] | undefined): void => {
    for (const range of list ?? []) {
      const key = `${range.pos}:${range.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ranges.push({ pos: range.pos, end: range.end });
    }
  };

  const visit = (node: ts.Node): void => {
    if (node.getFullStart() !== node.getStart(source, true) || ts.isSourceFile(node)) {
      add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    }
    add(ts.getTrailingCommentRanges(text, node.getEnd()));

    if (ts.isJsxExpression(node) && node.expression === undefined) {
      ranges.push({ pos: node.getStart(source), end: node.getEnd() });
    }

    for (const child of node.getChildren(source)) visit(child);
  };

  visit(source);
  add(ts.getLeadingCommentRanges(text, source.endOfFileToken.getFullStart()));
  return ranges;
}

function strip(text: string, source: ts.SourceFile): string {
  const ranges = commentRanges(source, text).sort((a, b) => b.pos - a.pos);

  let out = text;
  for (const range of ranges) {
    const before = out.slice(0, range.pos);
    let after = out.slice(range.end);
    const lineStart = before.lastIndexOf('\n') + 1;
    const aloneOnLine = before.slice(lineStart).trim() === '';
    if (aloneOnLine && after.startsWith('\n')) {
      out = before.slice(0, lineStart) + after.slice(1);
    } else {
      if (aloneOnLine) after = after.replace(/^[ \t]*/, '');
      out = before.replace(/[ \t]+$/, '') + after;
    }
  }

  return out.replace(/\n{3,}/g, '\n\n').replace(/\{\s*\n\s*\n/g, '{\n');
}

let touched = 0;
let removed = 0;

for (const target of TARGETS) {
  for (const file of walk(join(ROOT, target))) {
    if (file.endsWith('strip-comments.mts')) continue;
    const text = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const next = strip(text, source);
    if (next === text) continue;
    writeFileSync(file, next);
    touched++;
    removed += text.length - next.length;
  }
}

console.log(
  `${touched} fichiers nettoyés, ${(removed / 1024).toFixed(0)} Ko de commentaires retirés`,
);
