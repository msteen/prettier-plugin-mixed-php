import * as fs from "fs"
import { format } from "prettier"
import { inspect } from "util"

function log(...args: any[]): void {
  console.log(
    ...args.map((arg) =>
      inspect(arg, {
        depth: null,
        colors: true,
      })
    )
  )
}

function readExample(name: string): string {
  return fs.readFileSync(`examples/${name}.php`, "utf-8")
}

// let text = readExample("bad")
// let text = readExample("trailing")
let text = readExample("mixed")
// let text = readExample("unbalanced")

console.log(
  format(text, {
    parser: "mixed-php",
    plugins: ["."],
  })
)
