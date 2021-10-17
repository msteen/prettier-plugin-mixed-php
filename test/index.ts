import * as fs from "fs"
import { inspect } from "util"
import * as prettier from "prettier"

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
  let contents = ""
  try {
    contents = fs.readFileSync(`examples/${name}.php`, "utf-8")
  } catch (_) {}
  return contents
}

// let text = readExample("bad")
// let text = readExample("trailing")
// let text = readExample("mixed")
// let text = readExample("unbalanced")
let text = readExample("tpl") || readExample("mixed")

prettier.resolveConfig(process.cwd()).then((options) => {
  console.log(
    prettier.format(text, {
      ...options,
      parser: "mixed-php",
      plugins: ["."],
    })
  )
})

// formatDocBlocks(`<?php
// /**
//  * Creates or update files
//  *
//  * @author        Lars Meeuwsen <lars@safira.nl>
//  * @category    modules\\foo
//  *              bla die bla
//  * @url         /order/createOrUpdateOrderFile
//  * @method      POST
//  * @param   int      $orderId
//  * @param string   $name
//  * @param    int    $fileId
//  * @param array  $file
//  * @return   array
//  * @throws Exception
//  */
// `)
