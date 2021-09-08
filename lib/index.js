"use strict";
const phpPlugin = require("@prettier/plugin-php");
const prettier = require("prettier");
function newlineOrSpace(tag) {
    return tag.includes("\n") ? "\n" : " ";
}
function formatPhpContainingHtml(text, options) {
    let shortTag = false;
    let replaced = [];
    return prettier
        .format("<?php" +
        text.replace(/(^|\s*\?>)(.*?)(<\?(?:php|=)\s*|$)/gs, (_match, closeTag, between, openTag) => {
            let replacement = "";
            if (shortTag) {
                replacement += ";";
            }
            replacement += "\n//__MIXED_PHP_" + replaced.length + "__\n";
            shortTag = openTag.startsWith("<?=");
            if (shortTag) {
                replacement += "echo ";
            }
            replaced.push({ closeTag, between, openTag });
            return replacement;
        }), { ...options, parser: "php" })
        .slice("<?php".length)
        .replace(/\n[ \t]*\/\/__MIXED_PHP_(\d+)__\n/gs, (_match, i) => {
        let replacement = "";
        const { closeTag, between, openTag } = replaced[i];
        if (i != 0) {
            replacement += newlineOrSpace(closeTag) + "?>";
        }
        replacement += between;
        if (i != replaced.length - 1) {
            replacement += (openTag.startsWith("<?=") ? "<?=" : "<?php") + newlineOrSpace(openTag);
        }
        return replacement;
    })
        .replace(/<\?(php|=)[ \t]+/g, "<?$1 ")
        .replace(/<\?= echo /g, "<?= ");
}
function formatHtmlContainingPhp(text, options) {
    let replaced = [];
    return prettier
        .format(text.replace(/<\?(?:php|=).*?(?:\?>|$)/, (match) => {
        const replacement = "<mixed-php>" + replaced.length + "</mixed-php>";
        replaced.push(match);
        return replacement;
    }), { ...options, parser: "html" })
        .replace(/<mixed-php>(\d+)<\/mixed-php>/g, (_match, i) => {
        return replaced[i];
    });
}
function formatMixedPhp(text, options) {
    text = text
        .replace(/<\?(?!php|=)/g, "<?php")
        .replace(/<\?(php|=)\s*/gs, (match, tagType) => "<?" + tagType + newlineOrSpace(match));
    const tags = Array.from(text.matchAll(/<\?(?:php|=)|\?>/g));
    const trailingCloseTag = text.match(/\?>\s*$/);
    let unbalancedTags = 0;
    for (const tag of tags) {
        unbalancedTags += tag[0][0] === "<" ? 1 : -1;
    }
    if (unbalancedTags !== 0 && !(unbalancedTags === 1 && !trailingCloseTag)) {
        throw new Error("Encountered unbalanced PHP tags");
    }
    if (trailingCloseTag) {
        text = text.slice(0, trailingCloseTag.index);
    }
    const mixedPHP = Math.ceil(tags.length / 2) > 1;
    if (mixedPHP) {
        return formatHtmlContainingPhp(formatPhpContainingHtml(text, options), options);
    }
    else {
        return prettier.format(text, { ...options, parser: "php" });
    }
}
function getBaseOptions(options) {
    const baseOptions = {};
    for (const key in prettier.__internal.coreOptions.options) {
        if (["cursorOffset", "rangeStart", "rangeEnd"].includes(key))
            continue;
        baseOptions[key] = options[key];
    }
    for (const plugin of options.plugins) {
        if (plugin.options === undefined)
            continue;
        for (const key in plugin.options) {
            baseOptions[key] = options[key];
        }
    }
    return baseOptions;
}
module.exports = {
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
};
//# sourceMappingURL=index.js.map