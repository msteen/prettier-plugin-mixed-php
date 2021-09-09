import * as phpPlugin from "@prettier/plugin-php"
import * as prettier from "prettier"

function newlineOrSpace(tag: string): string {
  return tag.includes("\n") ? "\n" : " "
}

function formatPhpContainingHtml(text: string, options: object): string {
  let replaced: { closeTag: string; between: string; openTag: string }[] = []
  text =
    "<?php" +
    text.replace(/(^|;?\s*\?>)(.*?)(<\?(?:php|=)\s*|$)/gs, (_match, closeTag, between, openTag) => {
      let replacement = ""
      if (closeTag) replacement += ";"
      replacement += "\necho __HTML_" + replaced.length + "__;\n"
      if (openTag.startsWith("<?=")) {
        replacement += "echo "
      }
      replaced.push({ closeTag, between, openTag })
      return replacement
    })
  text = prettier.format(text, { ...options, parser: "php" })
  text = text
    .slice("<?php".length)
    .replace(/\n[ \t]*echo __HTML_(\d+)__;\n/gs, (_match, i) => {
      let replacement = ""
      const { closeTag, between, openTag } = replaced[i]
      if (i != 0) {
        replacement += newlineOrSpace(closeTag) + "?>"
      }
      replacement += between
      if (i != replaced.length - 1) {
        replacement += (openTag.startsWith("<?=") ? "<?=" : "<?php") + newlineOrSpace(openTag)
      }
      return replacement
    })
    .replace(/<\?(php|=)[ \t]+/g, "<?$1 ")
    .replace(/<\?= echo /g, "<?= ")
  return text
}

function formatHtmlContainingPhp(text: string, options: object): string {
  let replaced: string[] = []
  text = text.replace(/<\?(?:php|=).*?(?:\?>|$)/gs, (match) => {
    const replacement = "{{PHP_" + replaced.length + "}}"
    replaced.push(match)
    return replacement
  })
  text = prettier.format(text, { ...options, parser: "html" })
  text = text.replace(/{{PHP_(\d+)}}/g, (_match, i) => {
    return replaced[i]
  })
  return text
}

function formatMixedPhp(text: string, options: object): string {
  text = text
    .replace(/<\?(?!php|=)/g, "<?php")
    .replace(/<\?(php|=)\s*/gs, (match, tagType) => "<?" + tagType + newlineOrSpace(match))
  const tags = Array.from(text.matchAll(/<\?(?:php|=)|\?>/g))
  const trailingCloseTag = text.match(/\?>\s*$/)
  let unbalancedTags = 0
  for (const tag of tags) {
    unbalancedTags += tag[0][0] === "<" ? 1 : -1
  }
  if (unbalancedTags !== 0 && !(unbalancedTags === 1 && !trailingCloseTag)) {
    throw new Error("Encountered unbalanced PHP tags")
  }
  if (trailingCloseTag) {
    text = text.slice(0, trailingCloseTag.index)
  }
  const mixedPHP = Math.ceil(tags.length / 2) > 1
  if (mixedPHP) {
    return formatHtmlContainingPhp(formatPhpContainingHtml(text, options), options)
  } else {
    return prettier.format(text, { ...options, parser: "php" })
  }
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
