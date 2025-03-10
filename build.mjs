import { replaceInFile } from 'replace-in-file'
import { readFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
import crypto from 'crypto';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
const version = process.env.npm_package_version.split('.').slice(0, -1).join('.'); // extract major.minor version

function assertReplacedCount(results, count) {
    results.every(result => (! result.hasChanged || result.numReplacements < count) && (() => {
        throw new Error('error during build: ' + result.numReplacements + ' replacements performed in file ' + result.file + ' while expecting ' + count)
    })())
}

function createNonce() {
    return crypto.randomBytes(16).toString('base64');
}

/**
 * Run Build Pipeline
 *
 * The goal is to have a single distribution file.
 *
 * 1. Inject assets (css, js) into template file
 * 2. Inject template into lua script
 *
 * Variable format {{ x }} has been chosen, so that a JavaScript error is thrown in case that variable has not been replaced
 * and tests will fail.
 */
(async() => {
    const result = await esbuild.build({
        entryPoints: ['src/app.ts'],
        bundle: true,
        minifyWhitespace: true,
        minifySyntax: true,
        minifyIdentifiers: false,
        outdir: 'not-relevant-but-needs-to-exist', /** @see https://github.com/evanw/esbuild/issues/2890 */
        format: 'esm',
        tsconfig: path.resolve('./tsconfig.json'),
        loader: { '.css': 'css' },
        write: false,
    });

    // for some reason replaceInFile() substitutes "$&" with the current variable name "{{ inline_js }}"
    const jsContents = result.outputFiles[0].text.replace('&&$&&', '&& $ &&');
    const cssContents = result.outputFiles[1].text;

    return {
        files: pkg.config.outputDir + "/" + pkg.config.templateFile,
        from: [/{{ nonce }}/g, /{{ version }}/g, '{{ inline_css }}', '{{ inline_js }}'],
        to: [createNonce(), version, cssContents, jsContents],
        countMatches: true,
    };
})()
    .then(options => replaceInFile(options).then(results => assertReplacedCount(results, options.from.length)))
    .then(() => replaceInFile({
        files: pkg.config.outputDir + "/*.lua",
        from: [/{{ version }}/g, '{{ html_template }}'],
        to: [version, fs.readFileSync(pkg.config.outputDir + "/" + pkg.config.templateFile, 'utf8')],
        countMatches: true,
    }).then(results => assertReplacedCount(results, 2)))
    .then(() => console.log(`🎉 Build complete`))
