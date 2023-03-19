import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import parcelFS from '@parcel/fs';
const { NodeFS, MemoryFS, OverlayFS } = parcelFS;
import { Parcel, createWorkerFarm } from '@parcel/core';
import parcelUtils from "@parcel/utils";
const { normalizeSeparators } = parcelUtils;
import vm from "vm";
import assert from "assert";

export const workerFarm = createWorkerFarm();
export const inputFS = new NodeFS();
export let outputFS = new MemoryFS(workerFarm);
export let overlayFS = new OverlayFS(outputFS, inputFS);

beforeEach(() => {
  outputFS = new MemoryFS(workerFarm);
  overlayFS = new OverlayFS(outputFS, inputFS);
});

function getDirname(importMetaUrl) {
  return dirname(fileURLToPath(importMetaUrl));
}

const distDir = join(getDirname(import.meta.url), 'dist');

export async function removeDistDirectory() {
  await outputFS.rimraf(distDir);
}

/**
 * @param {import("@parcel/types").FilePath | import("@parcel/types").FilePath[]} entries 
 * @returns {import("@parcel/types").InitialParcelOptions}
 */
function getParcelOptions(entries) {
  return {
    entries,
    shouldDisableCache: true,
    logLevel: 'none',
    shouldBundleIncrementally: true,
    defaultConfig: join(getDirname(import.meta.url), '.parcelrc-no-reporters'),
    inputFS,
    outputFS,
    workerFarm,
    shouldContentHash: true,
    defaultTargetOptions: {
      distDir,
      engines: {
        browsers: ['last 1 Chrome version'],
        node: '8',
      },
      shouldScopeHoist: true,
      sourceMaps: false
    }
  }
}

/**
 * @param {import("@parcel/types").FilePath | import("@parcel/types").FilePath[]} entries 
 */
async function bundle(entries) {
  return (await (new Parcel(getParcelOptions(entries)).run())).bundleGraph;
}

/**
 * @param {import("@parcel/types").PackagedBundle} bundle 
 */
async function runServiceWorker(
  bundle,
  globals,
) {
  let code = overlayFS.readFileSync(bundle.filePath, 'utf8');  
  let ctx = vm.createContext(globals);  
  // A utility to prevent optimizers from removing side-effect-free code needed for testing
  ctx.sideEffectNoop = v => v;
  
  new vm.Script(code, {
    filename: normalizeSeparators(relative(distDir, bundle.filePath))
  }).runInContext(ctx);
  return ctx.output;
}

/**
 * @param {string[]} entryFiles 
 */
async function getServiceWorkerManifestFiles(entryFiles) {
  const bundleGraph = await bundle(entryFiles);
  const swBundle = bundleGraph.getBundles().find(b => b.env.isWorker());
  /** @type {string[]} */
  let manifest;
  await runServiceWorker(swBundle, {  output: m => manifest = m });
  return { manifest, bundleGraph };
}

/**
 * Parcel the entryFiles and make sure the service worker only caches the bundles which include at least one of the assets specified
 * @param {string} folderName The folder which contains the src directory with the entry files and assets
 * @param {string[]} entryFilenames The entry files to bundle, relative to the src directory
 * @param {string[]} assetFilenames The expected assets to be cached, relative to the src directory
 */
export async function assertCachedFileContents(folderName, entryFilenames, assetFilenames) {
  const srcDir = join(getDirname(import.meta.url), folderName, "src");
  const entryFiles = entryFilenames.map(f => join(srcDir, f));
  const { manifest, bundleGraph } = await getServiceWorkerManifestFiles(entryFiles);

  const relativeManifest = manifest.map(f => join(".", f)); // remove the leading slash
  const cachedBundles = bundleGraph.getBundles().filter(b => relativeManifest.includes(relative(distDir, b.filePath))); // filter out bundles which are not cached
  
  const usedAssets = [];
  const assetFilenameRegex = new RegExp(`^${assetFilenames.map(f => f.replaceAll(".", "\\.")).join("|")}$`, 'i');
  for (const bundle of cachedBundles) {
    bundle.traverseAssets(asset => {
      let relativeFilename = relative(srcDir, asset.filePath);
      if (normalizeSeparators(relativeFilename).match(assetFilenameRegex)) // if it's expected to be cached
        usedAssets.push(normalizeSeparators(relativeFilename));
      else assert.fail(`Asset ${relativeFilename} in ${relative(distDir, bundle.filePath)} is not expected to be cached`);
    });
  }
  const uncachedAssets = assetFilenames.filter(f => !usedAssets.find(a => a.match(f)));
  if (uncachedAssets.length > 0)
    assert.fail(`The following assets are expected to be cached but are not: ${uncachedAssets.join(", ")}`);
}