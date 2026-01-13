/**
 * Extension Build Template Pipeline
 *
 * The goal is to have a single distribution file.
 *
 * 1. Compile and minify assets (css, js)
 * 2. Inject assets into html template file
 * 3. Inject html template into lua script
 *
 * Variable format {{ x }} has been chosen, so that a JavaScript error is thrown in case that variable has not been replaced
 * and tests will fail.
 */

import { replaceInFile } from 'replace-in-file'
import { readFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url)));
const version = execFileSync('git', ['describe', '--tags', '--abbrev=0'], { encoding: 'utf8' }).trim().replace(/^v/, "").split('.').slice(0, -1).join('.'); // extract major.minor version; // major.minor

const assertReplacedCount = (results, expectedCount) => {
    results.every(result => (! result.hasChanged || result.numReplacements < expectedCount) && (() => {
        throw new Error('error during build: ' + result.numReplacements + ' replacements performed in file "' + result.file + '" while expecting ' + expectedCount)
    })())
}

const createNonce = () => crypto.randomBytes(16).toString('base64');

const isDev = process.argv.includes("--dev");
const outputDir = pkg.config.outputDir;

function injectPlaceholdersPlugin() {
  return {
    name: "post-build-inject-placeholders",
    setup(build) {
      build.onEnd(async (result) => {
        if (!result.outputFiles) return;

        // Note: do NOT modify these contents as sourcemaps won't work then
        const jsContents = result.outputFiles.find(f => f.path.endsWith(".js"))?.text ?? "";
        const cssContents = result.outputFiles.find(f => f.path.endsWith(".css"))?.text ?? "";

        const nonce = createNonce();
        let htmlTemplateContents = '';

        // using function-based replacements to avoid interpreting javascript texts like $&, $1, etc.
        // @see https://www.npmjs.com/package/replace-in-file#using-callbacks-for-to
        const options = {
          files: pkg.config.templateFile,
          from: [/{{ nonce }}/g, /{{ version }}/g, '{{ inline_css }}', '{{ inline_js }}'],
          to: [
              () => nonce,
              () => version,
              () => cssContents,
              () => jsContents,
          ],
          countMatches: true,
          fs: {
              readFile: fs.promises.readFile,
              writeFile: async (file, newContents, encoding) => htmlTemplateContents = newContents,
          },
        };

        await replaceInFile(options).then(results => assertReplacedCount(results, options.from.length));

        await replaceInFile({
          files: outputDir + "/*.lua",
          from: [/{{ version }}/g, '{{ html_template }}'],
          to: [() => version, () => htmlTemplateContents],
          countMatches: true,
        }).then(results => assertReplacedCount(results, 2));

        console.log("🔁 Placeholders updated after build");
      });
    },
  };
}

function buildTestOutputPlugin() {
  return {
    name: "post-build-test-output",
    setup(build) {
      build.onEnd(async () => {
        // test output is always (re)generated (in case of production build to validate html output)
        const output = execFileSync('lua', ['./tests/sankey_test.lua'], { encoding: 'utf8' });
        fs.writeFileSync(pkg.config.testOutputFile, output);
        console.log("▶️ Test HTML file created after build: ", pkg.config.testOutputFile);
      });
    },
  };
}

const esbuildOptions = {
    entryPoints: ['src/app.ts'],
    bundle: true,
    minify: !isDev,
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    outdir: outputDir, /** @see https://github.com/evanw/esbuild/issues/2890 */
    format: 'iife', /** = immediately-invoked function expression, @see https://esbuild.github.io/api/#format */
    globalName: 'viaSankey',
    tsconfig: path.resolve('./tsconfig.json'),
    loader: { '.css': 'css' },
    write: false, // required to access outputFiles
    plugins: [
        copy({
            resolveFrom: 'cwd',
            assets: { from: ['./src/sankey.lua'], to: [outputDir + 'SankeyChart.lua'] },
            watch: isDev,
          }),
        injectPlaceholdersPlugin(),
        buildTestOutputPlugin(),
    ],
};

(async () => {
  console.log(`Fabricating ${process.env.npm_package_name} v${version}..`);

  if (isDev) {
    const ctx = await esbuild.context(esbuildOptions);
    await ctx.watch();
    await ctx.serve({
      servedir: '.',
      port: 3000,
    });

    console.log("✅ Dev server running at http://localhost:3000");
    console.log("👀 Watching for changes...");
  } else {
    await esbuild.build(esbuildOptions);
    console.log("🎉 Build complete");
  }
})();