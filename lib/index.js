"use strict";
const phpPlugin = require("@prettier/plugin-php");
const prettier = require("prettier");
function newlineOrSpace(tag) {
    return tag.includes("\n") ? "\n" : " ";
}
function formatPhpContainingHtml(text, options) {
    const replaced = [];
    text =
        "<?php" +
            text.replace(/(^|\s*\?>)(.*?)(<\?(?:php|=)\s*|$)/gs, (_match, closeTag, between, openTag) => {
                let replacement = "\necho __HTML_" + replaced.length + "__;\n";
                if (openTag.startsWith("<?=")) {
                    replacement += "echo ";
                }
                replaced.push({ closeTag, between, openTag });
                return replacement;
            });
    text = prettier.format(text, { ...options, parser: "php" });
    text = text
        .slice("<?php".length)
        .replace(/\n[ \t]*echo __HTML_(\d+)__;\n/gs, (_match, i) => {
        let replacement = "";
        const { closeTag, between, openTag } = replaced[i];
        if (closeTag) {
            replacement += newlineOrSpace(closeTag) + "?>";
        }
        replacement += between;
        if (openTag) {
            replacement += (openTag.startsWith("<?=") ? "<?=" : "<?php") + newlineOrSpace(openTag);
        }
        return replacement;
    })
        .replace(/<\?(php|=)[ \t]+/g, "<?$1 ")
        .replace(/<\?= echo (.*?); \?>/gs, "<?= $1 ?>");
    return text;
}
function formatHtmlContainingPhp(text, options) {
    const replaced = [];
    text = text.replace(/<\?(?:php|=).*?(?:\?>|$)/gs, (match) => {
        const replacement = "{{PHP_" + replaced.length + "}}";
        replaced.push(match);
        return replacement;
    });
    text = prettier.format(text, { ...options, parser: "html" });
    text = text.replace(/{{PHP_(\d+)}}/g, (_match, i) => {
        return replaced[i];
    });
    return text;
}
function formatMixedPhp(text, options) {
    text = text
        .replace(/<\?(?!php|=|xml)/g, "<?php")
        .replace(/<\?=(.*?)(?!;)\s*\?>/gs, "<?=$1;?>")
        .replace(/<\?(php|=)\s*/gs, (match, tagType) => "<?" + tagType + newlineOrSpace(match));
    const replaced = [];
    text = text.replace(/<\?xml.*?\?>/g, (match) => {
        const replacement = "{{XML_HEADER_" + replaced.length + "}}";
        replaced.push(match);
        return replacement;
    });
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
    const tagPairs = Math.ceil(tags.length / 2);
    const mixedPHP = tagPairs > 1;
    if (mixedPHP) {
        text = formatHtmlContainingPhp(formatPhpContainingHtml(text, options), options);
    }
    else if (tagPairs === 1) {
        text = prettier.format(text, { ...options, parser: "php" });
    }
    else {
        text = prettier.format(text, { ...options, parser: "html" });
    }
    if (replaced.length) {
        text = text.replace(/{{XML_HEADER_(\d+)}}/g, (_match, i) => {
            return replaced[i];
        });
    }
    return text;
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