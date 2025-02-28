import { replaceInFile } from 'replace-in-file'
import crypto from 'crypto';
import { readFile } from 'fs/promises';
import fs from 'fs';
import CleanCSS from 'clean-css';
import path from 'path';
import esbuild from 'esbuild';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
const pkgLock = JSON.parse(await readFile(new URL('./package-lock.json', import.meta.url)));

const simplifyVersion = version => version.replace(/^[=<>~^]/g, '');
const majorMinorVersion = version => version.split('.').slice(0, -1).join('.');

const urls = {
    'bootstrap_js': 'https://cdn.jsdelivr.net/npm/bootstrap@' + simplifyVersion(pkgLock.packages["node_modules/bootstrap"].version) + '/dist/js/bootstrap.bundle.min.js',
    'bootstrap_css': 'https://cdn.jsdelivr.net/npm/bootstrap@' + simplifyVersion(pkgLock.packages["node_modules/bootstrap"].version) + '/dist/css/bootstrap.min.css',
    'highcharts_js': 'https://cdn.jsdelivr.net/npm/highcharts@' + simplifyVersion(pkgLock.packages["node_modules/highcharts"].version) + '/highcharts.js',
    'highcharts_sankey_js': 'https://cdn.jsdelivr.net/npm/highcharts@' + simplifyVersion(pkgLock.packages["node_modules/highcharts"].version) + '/modules/sankey.js',
    'highcharts_css': 'https://cdn.jsdelivr.net/npm/highcharts@' + simplifyVersion(pkgLock.packages["node_modules/highcharts"].version) + '/css/highcharts.css',
};

async function calculateSri(url) {
    return fetch(url)
        .then(response => response.text())
        .then(data => {
            const hash = crypto.createHash('sha384').update(data, 'utf8');
            const hashBase64 = hash.digest('base64');
            return 'sha384-' + hashBase64;
        });
}

async function calculateSris(urls) {
    return await Promise.all(urls.map(calculateSri));
}

function assertReplacedCount(results, count) {
    results.every(result => (! result.hasChanged || result.numReplacements !== count) && (() => {
        throw new Error('error during build: ' + result.numReplacements + ' replacements in file ' + result.file + ' differs from expected ' + count)
    })())
}

(async() => {
    const sris = await calculateSris(Object.values(urls));
    // variable format {{ x }} has been chosen so that a JavaScript error is thrown in case that variable has not been replaced
    let variables = [/{{ version }}/g, /{{ inline_css }}/g, /{{ inline_js }}/g];
    Object.keys(urls).forEach(key => variables.push(new RegExp('{{ ' + key + '_url }}',"g")));
    Object.keys(urls).forEach(key => variables.push(new RegExp('{{ ' + key + '_sri }}',"g")));

    const css = fs.readFileSync(path.resolve('src/style.css'), 'utf-8');
    const minifiedCss = new CleanCSS().minify(css).styles;

    const result = await esbuild.build({
        entryPoints: ['src/main.ts'],
        bundle: true,
        minify: true,
        format: 'esm',
        tsconfig: path.resolve('./tsconfig.json'),
        write: false,
    });
    const minifiedJs = result.outputFiles[0].text;

    return {
        files: pkg.config.outputDir + "/" + pkg.config.templateFile,
        from: variables,
        to: [majorMinorVersion(process.env.npm_package_version), minifiedCss, minifiedJs, ...Object.values(urls), ...sris],
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
