"use strict";
const prettier_1 = require("prettier");
const phpPlugin = require("@prettier/plugin-php");
function newlineOrSpace(tag) {
    return tag.includes("\n") ? "\n" : " ";
}
function formatMixedPhp(text, options) {
    text = text.replace(/<\?(?!php|=)/g, "<?php");
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
        let i = 0;
        let shortTag = false;
        let betweenPhp = [];
        return (0, prettier_1.format)((0, prettier_1.format)("<?php" +
            text.replace(/(^|\s*\?>)(.*?)(<\?(?:php|=)\s*|$)/gs, (_match, closeTag, between, openTag) => {
                let replacement = "";
                if (shortTag) {
                    replacement += ";";
                }
                replacement += "\n//__MIXED_PHP_" + i++ + "__\n";
                shortTag = openTag.startsWith("<?=");
                if (shortTag) {
                    replacement += "echo ";
                }
                betweenPhp.push({ closeTag, between, openTag });
                return replacement;
            }), { ...options, parser: "php" })
            .slice("<?php".length)
            .replace(/\n\s*\/\/__MIXED_PHP_(\d+)__\n/gs, (_match, i) => {
            let replacement = "";
            const { closeTag, between, openTag } = betweenPhp[i];
            if (i != 0) {
                replacement += newlineOrSpace(closeTag) + "?>";
            }
            replacement += between;
            if (i != betweenPhp.length - 1) {
                replacement += (openTag.startsWith("<?=") ? "<?=" : "<?php") + newlineOrSpace(openTag);
            }
            return replacement;
        }), { ...options, parser: "html" }).replace(/<\?(php|=)[ \t]+/g, "<?$1 ");
    }
    else {
        return (0, prettier_1.format)(text, { ...options, parser: "php" });
    }
}
function getBaseOptions(options) {
    const baseOptions = {};
    for (const plugin of options.plugins) {
        if (plugin.options === undefined)
            continue;
        for (const key in plugin.options) {
            baseOptions[key] = options[key];
        }
        if (plugin.defaultOptions === undefined)
            continue;
        for (const key in plugin.defaultOptions) {
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
            print(path, options) {
                const text = path.getValue();
                const baseOptions = getBaseOptions(options);
                return formatMixedPhp(text, baseOptions);
            },
        },
    },
};
//# sourceMappingURL=index.js.map