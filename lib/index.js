"use strict";
const phpPlugin = require("@prettier/plugin-php");
const util_1 = require("util");
const prettier = require("prettier");
function log(...args) {
    console.log(...args.map((arg) => (0, util_1.inspect)(arg, {
        depth: null,
        colors: true,
    })));
}
function newlineOrSpace(tag) {
    return tag.includes("\n") ? "\n" : " ";
}
function indent(options) {
    return options.useTabs ? "\t" : " ".repeat(options.tabWidth);
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
    const trailingCloseTag = text.match(/\?>\s*$/);
    if (trailingCloseTag)
        text = text.slice(0, trailingCloseTag.index);
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
        .replace(/<\?php[ \t]+/g, "<?php ")
        .replace(/<\?=[ \t]+echo (.*?); \?>/gs, (_match, between) => "<?= " + between.replace(/^[ \t]+/gm, indent(options)) + " ?>");
    return text;
}
const returnPhpRegex = /(?:{{PHP_|<PHP )(\d+).*?(?:}}| \/>)/gs;
function formatHtmlContainingPhp(text, options) {
    const replaced = [];
    text = text.replace(/<\?(?:php|=).*?(?:\?>|$)/gs, (match) => {
        const i = match.indexOf("\n");
        const firstLine = i !== -1 ? match.slice(0, i) : match;
        let replacement = "{{PHP_" + replaced.length;
        let template = "";
        for (const c of firstLine.slice(replacement.length + "}}".length)) {
            template += c.trim() === "" ? c : "_";
        }
        replacement += template + "}}";
        replaced.push(match);
        return replacement;
    });
    text = text.replace(/(?:^|>)(.*?)(?:<|$)/gs, (_match, between) => {
        return (">" +
            between.replace(/{{PHP_(\d+.*?)}}/gs, (_match, between) => {
                return "<PHP " + between + " />";
            }) +
            "<");
    });
    text = prettier.format(text, { ...options, parser: "html" });
    text = text
        .replace(/^([ \t]*)(.*$)/gm, (_match, leadingSpace, rest) => leadingSpace +
        rest.replace(returnPhpRegex, (_match, i) => replaced[i]
            .split("\n")
            .map((line, i) => (i === 0 ? "" : leadingSpace) + line)
            .join("\n")))
        .replace(returnPhpRegex, (_match, i) => replaced[i]);
    return text;
}
function formatMixedPhp(text, options) {
    const replaced = [];
    text = text.replace(/<\?xml.*?\?>/g, (match) => {
        const replacement = "{{XML_HEADER_" + replaced.length + "}}";
        replaced.push(match);
        return replacement;
    });
    text = text
        .replace(/<\?(?!php|=|xml)/g, "<?php")
        .replace(/<\?(php|=)(\s*)(.*?);?(\s*)\?>/gs, (_match, tagType, openSpace, between, closeSpace) => "<?" + tagType + newlineOrSpace(openSpace) + between + ";" + newlineOrSpace(closeSpace) + "?>");
    const phpOpenCount = (text.match(/<\?(php|=)/g) || []).length;
    if (phpOpenCount > 1) {
        text = formatHtmlContainingPhp(formatPhpContainingHtml(text, options), options);
    }
    else if (phpOpenCount === 1) {
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