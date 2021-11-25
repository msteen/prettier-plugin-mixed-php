"use strict";
const phpPlugin = require("@prettier/plugin-php");
const util_1 = require("util");
const prettier = require("prettier");
function log(...args) {
    console.log(...args.map(prettyprint));
}
function prettyprint(arg) {
    return (0, util_1.inspect)(arg, {
        depth: null,
        colors: true,
    });
}
function newlineOrSpace(tag) {
    return tag.includes("\n") ? "\n" : " ";
}
function indent(options) {
    return options.useTabs ? "\t" : " ".repeat(options.tabWidth);
}
const replaceFragment = (fragments, i) => {
    if (!fragments[i]) {
        throw new Error("Replacement " + i + " not found.");
    }
    const fragment = fragments[i];
    delete fragments[i];
    return fragment;
};
function checkUnreplacedFragments(label, fragments, text) {
    if (fragments.some((fragment) => fragment !== undefined)) {
        log(fragments.filter((fragment) => fragment !== undefined));
        console.log(text);
        throw new Error("Not all " + label + " fragments were replaced back.");
    }
}
function formatPhpContainingHtml(text, options) {
    const htmlFragments = [];
    text =
        "<?php" +
            text.replace(/(^|\s*\?>)(.*?)(<\?(?:php|=)\s*|$)/gs, (_match, closeTag, between, openTag) => {
                let replacement = "\necho __HTML_" + htmlFragments.length + "__;\n";
                if (openTag.startsWith("<?=")) {
                    replacement += "echo ";
                }
                htmlFragments.push({ closeTag, between, openTag });
                return replacement;
            });
    for (const string of text
        .replace(/^\s*?\/\/.*$/gm, "")
        .match(/\/\*.*?\*\/|'(?:[^']|\\')*?'|"(?:[^"]|\\")*?"/gs) || []) {
        if (string.includes("\n")) {
            throw new Error("Mixed PHP with multiline comments or string literals aren't supported: " + prettyprint(string) + ".");
        }
    }
    text = prettier.format(text, { ...options, parser: "php" });
    text = text.slice("<?php".length);
    let found = true;
    while (found) {
        found = false;
        text = text.replace(/(?:\n[ \t]*| )echo __HTML_(\d+)__;(?:\n| )/gs, (_match, i) => {
            found = true;
            let replacement = "";
            const { closeTag, between, openTag } = replaceFragment(htmlFragments, i);
            delete htmlFragments[i];
            if (closeTag) {
                replacement += newlineOrSpace(closeTag) + "?>";
            }
            replacement += between;
            if (openTag) {
                replacement += (openTag.startsWith("<?=") ? "<?=" : "<?php") + newlineOrSpace(openTag);
            }
            return replacement;
        });
    }
    text = text
        .replace(/<\?php[ \t]+/g, "<?php ")
        .replace(/<\?=[ \t]+echo (.*?); \?>/gs, (_match, between) => "<?= " + between.replace(/^[ \t]+/gm, indent(options)) + " ?>");
    checkUnreplacedFragments("HTML", htmlFragments, text);
    return text;
}
const returnPhpRegex = /(?:{{PHP_|<PHP_)(\d+).*?(?:}}|\/>)/gs;
function formatHtmlContainingPhp(text, options) {
    const phpFragments = [];
    text = text.replace(/<\?(?:php|=).*?(?:\?>|$)/gs, (match) => {
        // Due to the HTML formatter there will be a trailing newline after a <PHP_.../> tag,
        // so the already existing trailing newline has to be removed to prevent doubling them.
        match = match.trimEnd();
        const i = match.indexOf("\n");
        const firstLine = i !== -1 ? match.slice(0, i) : match;
        let replacement = "{{PHP_" + phpFragments.length;
        let template = "";
        for (const c of firstLine.slice(replacement.length + "}}".length)) {
            template += c.trim() === "" ? c : "_";
        }
        replacement += template + "}}";
        phpFragments.push(match);
        return replacement;
    });
    text = text.replace(/(?:^|>).*?(?:<|$)/gs, (match) => match.replace(/{{PHP_(\d+.*?)}}/gs, (_match, between) => "<PHP_" + between + "/>"));
    text = prettier.format(text, { ...options, parser: "html" });
    text = text
        .replace(/^([ \t]*)(.*$)/gm, (_match, leadingSpace, rest) => leadingSpace +
        rest.replace(returnPhpRegex, (_match, i) => replaceFragment(phpFragments, i)
            .split("\n")
            .map((line, i) => (i === 0 ? "" : leadingSpace) + line)
            .join("\n")))
        .replace(returnPhpRegex, (_match, i) => replaceFragment(phpFragments, i));
    checkUnreplacedFragments("PHP", phpFragments, text);
    return text;
}
function maxStringLength(strings) {
    let maxLength = 0;
    for (const string of strings) {
        if (string.length > maxLength)
            maxLength = string.length;
    }
    return maxLength;
}
function filterNullables(nullables) {
    const items = [];
    for (const nullable of nullables)
        if (nullable != null)
            items.push(nullable);
    return items;
}
function formatDocBlocks(text, options) {
    text = text.replace(/\/\*\*[ \t]*((?:\n[ \t]*\*.*?)*?)\n?[ \t]*\*\//gs, (match, between) => {
        let replacer = "";
        const lines = between
            .trimStart()
            .split("\n")
            .map((line) => line.trimStart().slice(1).trim());
        let descLines;
        let tagLines;
        const firstTagIndex = lines.findIndex((line) => line.startsWith("@"));
        if (firstTagIndex !== -1) {
            descLines = lines.slice(0, firstTagIndex);
            tagLines = lines.slice(firstTagIndex);
        }
        else {
            descLines = lines.slice();
            tagLines = [];
        }
        const desc = descLines.join("\n");
        if (desc)
            replacer += desc + "\n";
        const tagLineGroups = [];
        let tagLineGroup = [];
        for (const line of tagLines) {
            if (line.startsWith("@")) {
                if (tagLineGroup.length) {
                    tagLineGroups.push(tagLineGroup);
                }
                tagLineGroup = [line];
            }
            else {
                tagLineGroup.push(line);
            }
        }
        if (tagLineGroup.length) {
            tagLineGroups.push(tagLineGroup);
        }
        const tags = [];
        for (const tagLineGroup of tagLineGroups) {
            const tag = tagLineGroup.join("\n");
            if (!tag.startsWith("@")) {
                throw new Error("Expected the first line to contain a docblock tag, e.g. @author: " + tag);
            }
            const match = tag.match(/@(\S+)[ \t]*(.*)/s);
            const name = match[1];
            let value = match[2];
            tags.push({ name, value });
        }
        const maxNameLength = maxStringLength(tags.map(({ name }) => name));
        const params = [];
        for (const tag of tags) {
            const { name, value } = tag;
            if (name === "param") {
                const match = value.match(/(\S+)[ \t]+(\$?\S+)(?:[ \t]+(.*))?/s);
                if (match) {
                    let [_whole, type, variable, description] = match;
                    if (!variable.startsWith("$"))
                        variable = "$" + variable;
                    params.push({ type, variable, description });
                }
                else {
                    params.push(null);
                }
            }
            else if (name === "license") {
                const match = value.match(/(.*?)[ \t]+(.*)/);
                if (match) {
                    tag.value = match[1] + indent(options) + match[2];
                }
            }
        }
        const items = filterNullables(params);
        const maxTypeLength = maxStringLength(items.map(({ type }) => type));
        const maxVariableLength = maxStringLength(items.map(({ variable }) => variable));
        for (let { name, value } of tags) {
            value = value.split("\n").join("\n" + " ".repeat("@".length + maxNameLength + indent(options).length));
            if (name === "param") {
                const param = params.shift();
                if (param) {
                    const { type, variable, description } = param;
                    value = `${type.padEnd(maxTypeLength, " ")}${indent(options)}`;
                    if (description) {
                        value += variable.padEnd(maxVariableLength, " ") + indent(options) + description;
                    }
                    else {
                        value += variable;
                    }
                }
            }
            replacer += `@${name.padEnd(maxNameLength, " ")}${indent(options)}${value}\n`;
        }
        return `/**\n${replacer
            .trimEnd()
            .split("\n")
            .map((line) => (" * " + line).trimEnd())
            .join("\n")}\n */`;
    });
    return text;
}
function formatPhpExtra(text, options) {
    const xmlHeaderFragments = [];
    text = text.replace(/<\?xml.*?\?>/g, (match) => {
        const replacement = "{{XML_HEADER_" + xmlHeaderFragments.length + "}}";
        xmlHeaderFragments.push(match);
        return replacement;
    });
    text = text
        .replace(/<\?(?!php|=|xml)/g, "<?php")
        .replace(/<\?(php|=)\s*/gs, (match, tagType) => "<?" + tagType + newlineOrSpace(match))
        .replace(/(<\?(?:php|=)[\n ])(.*?);?(\s*)\?>/gs, (_match, start, between, closeSpace) => start + between + ";" + newlineOrSpace(closeSpace) + "?>");
    // .replace(
    //   /(<\?(?:php|=)[\n ])(.*?)(\s*)\?>/gs,
    //   (_match, start, between, closeSpace) => {
    //     const parts = between.split(/(\s*\/\/[^\n]*(?:\n\s*|$)|\s*\/\*.*?\*\/\s*)/gs)
    //     for (let i = parts.length - 1; i >= 0; i--) {
    //       const part = parts[i].trim()
    //       if (!(part === '' || part.startsWith('//') || part.startsWith('/*') && part.endsWith('*/'))) {
    //         between = parts.slice(0, i + 1).join("") + ";" + parts.slice(i + 1).join("")
    //         break
    //       }
    //     }
    //     return start + between + "?>"
    //   }
    // )
    const phpOpenTags = text.match(/<\?(?:php|=)/g) || [];
    if (phpOpenTags.length > 0 && phpOpenTags[phpOpenTags.length - 1] === "<?php") {
        const match = text.match(/\?>\s*$/s);
        if (match) {
            text = text.slice(0, text.length - match[0].length);
        }
    }
    if (phpOpenTags.length > 1) {
        text = formatDocBlocks(text, options);
        text = formatHtmlContainingPhp(formatPhpContainingHtml(text, options), options);
    }
    else if (phpOpenTags.length === 1) {
        text = formatDocBlocks(text, options);
        text = prettier.format(text, { ...options, parser: "php" });
    }
    else {
        text = prettier.format(text, { ...options, parser: "html" });
    }
    if (xmlHeaderFragments.length) {
        text = text.replace(/{{XML_HEADER_(\d+)}}/g, (_match, i) => {
            return replaceFragment(xmlHeaderFragments, i);
        });
    }
    checkUnreplacedFragments("XML header", xmlHeaderFragments, text);
    return text;
}
function formatTsExtra(text, options) {
    return prettier.format(formatDocBlocks(text, options), { ...options, parser: "typescript" });
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
    delete baseOptions["jsxBracketSameLine"]; // deprecated
    return baseOptions;
}
const typeScriptLanguage = prettier.getSupportInfo().languages.find(({ name }) => name === "TypeScript");
module.exports = {
    languages: [
        ...phpPlugin.languages.map((language) => ({ ...language, parsers: ["php-extra"] })),
        { ...typeScriptLanguage, parsers: ["ts-extra"] },
    ],
    parsers: {
        "php-extra": {
            parse: (text) => text,
            astFormat: "php-extra-ast",
        },
        "ts-extra": {
            parse: (text) => text,
            astFormat: "ts-extra-ast",
        },
    },
    printers: {
        "php-extra-ast": {
            print: (path, options) => formatPhpExtra(path.getValue(), getBaseOptions(options)),
        },
        "ts-extra-ast": {
            print: (path, options) => formatTsExtra(path.getValue(), getBaseOptions(options)),
        },
    },
};
//# sourceMappingURL=index.js.map