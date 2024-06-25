import {replaceInFile} from 'replace-in-file'
import crypto from 'crypto';
import { readFile } from 'fs/promises';

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

(async() => {
    const sris = await calculateSris(Object.values(urls));
    // variable format {{ x }} has been chosen so that a JavaScript error is thrown in case that variable has not been replaced
    let variables = [/{{ version }}/g, /{{ inline_css }}/g, /{{ inline_js }}/g];
    Object.keys(urls).forEach(key => variables.push(new RegExp('{{ ' + key + '_url }}',"g")));
    Object.keys(urls).forEach(key => variables.push(new RegExp('{{ ' + key + '_sri }}',"g")));

    return {
        files: pkg.config.outputDir + "/*.lua", // @todo read from stdin?
        from: variables,
        to: [majorMinorVersion(process.env.npm_package_version), process.env.INLINE_CSS, process.env.INLINE_JS, ...Object.values(urls), ...sris],
        countMatches: true,
    };
})().then(options => replaceInFile(options)
    .then(results => results.every(result => (! result.hasChanged || result.numReplacements !== options.from.length) && (() => { throw new Error('error during build: no replacements done in file ' + result.file) })()))
);