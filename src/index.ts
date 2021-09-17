import * as phpPlugin from "@prettier/plugin-php"
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

function newlineOrSpace(tag: string): string {
  return tag.includes("\n") ? "\n" : " "
}

function indent(options: any) {
  return options.useTabs ? "\t" : " ".repeat(options.tabWidth)
}

const replaceFragment = (fragments: any[], i: number): any => {
  const fragment = fragments[i]
  delete fragments[i]
  return fragment
}

function formatPhpContainingHtml(text: string, options: object): string {
  const htmlFragments: { closeTag: string; between: string; openTag: string }[] = []
  text =
    "<?php" +
    text.replace(/(^|\s*\?>)(.*?)(<\?(?:php|=)\s*|$)/gs, (_match, closeTag, between, openTag) => {
      let replacement = "\necho __HTML_" + htmlFragments.length + "__;\n"
      if (openTag.startsWith("<?=")) {
        replacement += "echo "
      }
      htmlFragments.push({ closeTag, between, openTag })
      return replacement
    })
  const trailingCloseTag = text.match(/\?>\s*$/)
  if (trailingCloseTag) text = text.slice(0, trailingCloseTag.index)
  text = prettier.format(text, { ...options, parser: "php" })
  text = text
    .slice("<?php".length)
    .replace(/\n[ \t]*echo __HTML_(\d+)__;\n/gs, (_match, i) => {
      let replacement = ""
      const { closeTag, between, openTag } = replaceFragment(htmlFragments, i)
      delete htmlFragments[i]
      if (closeTag) {
        replacement += newlineOrSpace(closeTag) + "?>"
      }
      replacement += between
      if (openTag) {
        replacement += (openTag.startsWith("<?=") ? "<?=" : "<?php") + newlineOrSpace(openTag)
      }
      return replacement
    })
    .replace(/<\?php[ \t]+/g, "<?php ")
    .replace(
      /<\?=[ \t]+echo (.*?); \?>/gs,
      (_match, between) => "<?= " + between.replace(/^[ \t]+/gm, indent(options)) + " ?>"
    )
  if (htmlFragments.some((item) => item !== undefined)) {
    throw new Error("Not all HTML fragments were replaced back.")
  }
  return text
}

const returnPhpRegex = /(?:{{PHP_|<PHP_)(\d+).*?(?:}}|\/>)/gs

function formatHtmlContainingPhp(text: string, options: object): string {
  const phpFragments: string[] = []

  text = text.replace(/<\?(?:php|=).*?(?:\?>|$)/gs, (match) => {
    const i = match.indexOf("\n")
    const firstLine = i !== -1 ? match.slice(0, i) : match
    let replacement = "{{PHP_" + phpFragments.length
    let template = ""
    for (const c of firstLine.slice(replacement.length + "}}".length)) {
      template += c.trim() === "" ? c : "_"
    }
    replacement += template + "}}"
    phpFragments.push(match)
    return replacement
  })
  text = text.replace(/(?:^|>).*?(?:<|$)/gs, (match) =>
    match.replace(/{{PHP_(\d+.*?)}}/gs, (_match, between) => "<PHP_" + between + "/>")
  )
  text = prettier.format(text, { ...options, parser: "html" })
  text = text
    .replace(
      /^([ \t]*)(.*$)/gm,
      (_match, leadingSpace, rest) =>
        leadingSpace +
        rest.replace(returnPhpRegex, (_match, i) =>
          replaceFragment(phpFragments, i)
            .split("\n")
            .map((line, i) => (i === 0 ? "" : leadingSpace) + line)
            .join("\n")
        )
    )
    .replace(returnPhpRegex, (_match, i) => replaceFragment(phpFragments, i))
  if (phpFragments.some((item) => item !== undefined)) {
    throw new Error("Not all PHP fragments were replaced back.")
  }
  return text
}

function formatMixedPhp(text: string, options: object): string {
  const xmlHeaderFragments: string[] = []
  text = text.replace(/<\?xml.*?\?>/g, (match) => {
    const replacement = "{{XML_HEADER_" + xmlHeaderFragments.length + "}}"
    xmlHeaderFragments.push(match)
    return replacement
  })
  text = text
    .replace(/<\?(?!php|=|xml)/g, "<?php")
    .replace(
      /<\?(php|=)(\s*)(.*?);?(\s*)\?>/gs,
      (_match, tagType, openSpace, between, closeSpace) =>
        "<?" + tagType + newlineOrSpace(openSpace) + between + ";" + newlineOrSpace(closeSpace) + "?>"
    )
  const phpOpenCount = (text.match(/<\?(php|=)/g) || []).length
  if (phpOpenCount > 1) {
    text = formatHtmlContainingPhp(formatPhpContainingHtml(text, options), options)
  } else if (phpOpenCount === 1) {
    text = prettier.format(text, { ...options, parser: "php" })
  } else {
    text = prettier.format(text, { ...options, parser: "html" })
  }
  if (xmlHeaderFragments.length) {
    text = text.replace(/{{XML_HEADER_(\d+)}}/g, (_match, i) => {
      return replaceFragment(xmlHeaderFragments, i)
    })
  }
  if (xmlHeaderFragments.some((item) => item !== undefined)) {
    throw new Error("Not all XML header fragments were replaced back.")
  }
  return text
}

function getBaseOptions(options) {
  const baseOptions = {}
  for (const key in prettier.__internal.coreOptions.options) {
    if (["cursorOffset", "rangeStart", "rangeEnd"].includes(key)) continue
    baseOptions[key] = options[key]
  }
  for (const plugin of options.plugins) {
    if (plugin.options === undefined) continue
    for (const key in plugin.options) {
      baseOptions[key] = options[key]
    }
  }
  return baseOptions
}

export = {
  languages: phpPlugin.languages.map((language) => ({ ...language, parsers: ["mixed-php"] })),
  parsers: {
    "mixed-php": {
      parse: (text) => text,
      astFormat: "mixed-php-ast",
    },
  },
  printers: {
    "mixed-php-ast": {
      print: (path, options) => formatMixedPhp(path.getValue(), getBaseOptions(options)),
    },
  },
}
