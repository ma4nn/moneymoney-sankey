import { replaceInFile } from 'replace-in-file'
import { readFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));

const majorMinorVersion = version => version.split('.').slice(0, -1).join('.');

function assertReplacedCount(results, count) {
    results.every(result => (! result.hasChanged || result.numReplacements !== count) && (() => {
        throw new Error('error during build: ' + result.numReplacements + ' replacements in file ' + result.file + ' differs from expected ' + count)
    })())
}

(async() => {
    // variable format {{ x }} has been chosen so that a JavaScript error is thrown in case that variable has not been replaced

    const result = await esbuild.build({
        entryPoints: ['src/main.ts'],
        bundle: true,
        // minify: true, @todo
        outdir: 'not-relevant-but-needs-to-exist',
        format: 'esm',
        tsconfig: path.resolve('./tsconfig.json'),
        loader: { '.css': 'css' },
        write: false,
    });

    const jsContents = result.outputFiles[0].text;
    const cssContents = result.outputFiles[1].text;

    return {
        files: pkg.config.outputDir + "/" + pkg.config.templateFile,
        from: [/{{ version }}/g, '{{ inline_css }}', '{{ inline_js }}'],
        to: [majorMinorVersion(process.env.npm_package_version), cssContents, jsContents],
        countMatches: true,
    };
})()
    .then(options => replaceInFile(options).then(results => assertReplacedCount(results, options.from.length)))
    .then(() => replaceInFile({
        files: pkg.config.outputDir + "/*.lua",
        from: [/{{ version }}/g, '{{ html_template }}'],
        to: [majorMinorVersion(process.env.npm_package_version), fs.readFileSync(pkg.config.outputDir + "/" + pkg.config.templateFile, 'utf8')],
        countMatches: true,
    }).then(results => assertReplacedCount(results, 2)))
    .then(() => console.log(`🎉 Build complete`))
