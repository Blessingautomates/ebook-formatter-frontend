/**
 * Tests for lib/editorContent.ts — the Markdown ⇄ HTML bridge.
 *
 * No test runner and no new dependency: Node strips the TypeScript itself from
 * v22.6 on, so this imports the real module and runs it directly.
 *
 *   npm test
 *
 * `htmlToMarkdown` is the one export not covered here — it needs a DOM, which
 * Node does not have and this repo has no jsdom to supply. It is exercised by
 * the manual pass in the README instead. Everything else, including the
 * block-splitting rules that have to agree with services/exporter.py in the
 * other repo, is pure and is covered below.
 */

import {
  chaptersFromMarkdown,
  countChapters,
  countWords,
  joinChapters,
  markdownToHtml,
  splitIntoChapters,
} from "../lib/editorContent.ts";

let fails = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${a}${ok ? "" : `  WANT ${e}`}`);
}

/*
 * A scene break is tested before a bullet, here and in the exporter, because
 * "* * *" also matches the bullet pattern. Getting that order wrong turns every
 * scene break in every book into a one-item list.
 */
check("scene break is an hr", markdownToHtml("* * *"), "<hr>");
check("spaced asterisks", markdownToHtml("*  *  *"), "<hr>");
check("asterisk break", markdownToHtml("***"), "<hr>");
check("dash break", markdownToHtml("---"), "<hr>");
check("underscore break", markdownToHtml("___"), "<hr>");
check("a lone star is a bullet", markdownToHtml("* item"), "<ul><li>item</li></ul>");

check("heading", markdownToHtml("# Chapter One"), "<h1>Chapter One</h1>");
check("deep heading clamps at 6", markdownToHtml("####### x"), "<p>####### x</p>");
check("bullet run", markdownToHtml("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
check("quote run joins", markdownToHtml("> a\n> b"), "<blockquote><p>a b</p></blockquote>");
check("blank line keeps a list open", markdownToHtml("- a\n\n- b"), "<ul><li>a</li><li>b</li></ul>");
check("prose closes a list", markdownToHtml("- a\nprose"),
  "<ul><li>a</li></ul><p>prose</p>");
check("emphasis", markdownToHtml("**b** and *i*"), "<p><strong>b</strong> and <em>i</em></p>");
check("html in the text is escaped", markdownToHtml("<script>x</script>"),
  "<p>&lt;script&gt;x&lt;/script&gt;</p>");

/*
 * `chaptersFromMarkdown` is what gets stored with a saved project once the text
 * has been edited, and the stored breakdown is what `splitIntoChapters` later
 * slices the stored text by. So the invariant that matters is the last one:
 * splitting by these line numbers has to reproduce exactly these sections.
 */
const md = "Title page.\n\n# One\n\nA b c.\n\n# Two\n\nD e.\n";
const derived = chaptersFromMarkdown(md);
check("front matter is its own section", derived.map((c) => c.title),
  ["Front Matter", "One", "Two"]);
check("line numbers point at the headings", derived.map((c) => c.line_number), [1, 3, 7]);
check("chapter count excludes front matter", countChapters(derived), 2);
check("re-splitting by derived lines reproduces each section",
  splitIntoChapters(md, derived).map((c) => c.markdown),
  ["Title page.", "# One\n\nA b c.", "# Two\n\nD e."]);
check("no heading at all is one section",
  chaptersFromMarkdown("just prose").map((c) => c.title), ["Front Matter"]);
check("empty text has no sections", chaptersFromMarkdown("   "), []);
check("empty text yields no editable chapters", splitIntoChapters("   ", []), []);

check("join drops empty chapters", joinChapters([
  { title: "a", lineNumber: 1, markdown: "one", wordCount: 1 },
  { title: "b", lineNumber: 2, markdown: "  ", wordCount: 0 },
  { title: "c", lineNumber: 3, markdown: "two", wordCount: 1 },
]), "one\n\ntwo");
check("join round-trips through parse", markdownToHtml(joinChapters([
  { title: "a", lineNumber: 1, markdown: "# One\n\nA b.", wordCount: 3 },
  { title: "b", lineNumber: 5, markdown: "# Two\n\nC d.", wordCount: 3 },
])), "<h1>One</h1><p>A b.</p><h1>Two</h1><p>C d.</p>");

check("markers are not words", countWords("# One\n\n- a b\n\n> c"), 4);

console.log(`\n${fails} failure(s)`);
process.exit(fails ? 1 : 0);
