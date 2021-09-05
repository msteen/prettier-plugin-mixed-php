import * as fs from "fs"
import { format } from "prettier"

function readExample(name: string): string {
  return fs.readFileSync(`examples/${name}.php`, "utf-8")
}
// let text = readExample("bad")
// let text = readExample("trailing")
let text = readExample("mixed")
// let text = readExample("unbalanced")

console.log(
  format(text, {
    printWidth: 110,
    tabWidth: 4,
    useTabs: false,
    semi: true,
    singleQuote: false,
    quoteProps: "consistent",
    jsxSingleQuote: false,
    trailingComma: "es5",
    bracketSpacing: true,
    jsxBracketSameLine: false,
    arrowParens: "always",
    requirePragma: false,
    insertPragma: false,
    htmlWhitespaceSensitivity: "css",
    endOfLine: "lf",
    braceStyle: "1tbs",
    parser: "mixed-php",
    plugins: ["."],
  })
)
