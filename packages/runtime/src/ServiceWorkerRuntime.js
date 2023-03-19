import { Runtime } from '@parcel/plugin';
import { urlJoin } from '@parcel/utils';
import { toProjectPath } from "@parcel/core/lib/projectPath";

/**
 * @param {import("@parcel/types").Asset[]} allAssets 
 * @param {string} projectPath
 * @param {string} projectRoot
 */
function findAssetsByProjectPath(allAssets, projectPath, projectRoot) {
  return allAssets.filter(asset => toProjectPath(projectRoot, asset.filePath) === projectPath);
}

function assetAlreadyInArray(assetArray, asset) {
  return assetArray.some(el => el.id === asset.id);
}

export default (new Runtime({
  async loadConfig({ config }) {
    let { contents } = await config.getConfig([".service-worker-rc", ".service-worker-rc.json"]);

    return contents;
  },
  apply({ bundle, bundleGraph, options, config }) {
    if (bundle.env.context !== 'service-worker') {
      return [];
    }

    // Ensure that the service worker is using our plugin
    let asset = bundle.traverse((node, _, actions) => {
      if (
        node.type === 'dependency' &&
        node.value.specifier === 'parcel-plugin-custom-service-worker' &&
        !bundleGraph.isDependencySkipped(node.value)
      ) {
        actions.stop();
        return bundleGraph.getResolvedAsset(node.value, bundle);
      }
    });
    if (!asset) {
      return [];
    }
    
    let manifest = [];
    let allAssets = [];
    /** @type {import("@parcel/types").Asset[]} */
    let includedAssets = [];
    // Get a list of all the assets in the bundle graph
    bundleGraph.traverse(node => {
      if (node.type === 'asset') allAssets.push(node.value);
    });

    // If the user has set up config, use that to determine which assets to cache
    if (config.filesToCache)
      config.filesToCache.forEach(fileConfig => {
        if (typeof fileConfig === "string") {
          // Add just the assets with that file path
          let possibleAssets = findAssetsByProjectPath(allAssets, fileConfig, options.projectRoot);
          possibleAssets
            .filter(asset => !assetAlreadyInArray(includedAssets, asset))
            .forEach(asset => includedAssets.push(asset));
        } else {
          // Add the assets with that file path and all of their children (if includeChildren is true)
          let possibleAssets = findAssetsByProjectPath(allAssets, fileConfig.file, options.projectRoot);
          possibleAssets
            .filter(asset => !assetAlreadyInArray(includedAssets, asset))
            .forEach(asset => {
              includedAssets.push(asset);
              if (fileConfig.includeChildren)
                bundleGraph.traverse(node => {
                  if (node.type === 'asset' && !assetAlreadyInArray(includedAssets, node.value))
                    includedAssets.push(node.value);
                }, asset);
            });
        }
      });
    // If the user hasn't set up config, cache everything
    else includedAssets = allAssets;

    bundleGraph.traverseBundles(b => {
      // Don't include inline bundles or the service worker itself
      if (b.bundleBehavior === 'inline' || b.id === bundle.id) return;

      // Don't include non-shared bundles that don't contain an asset that should be cached
      if (b.getMainEntry()) {
        if (includedAssets.every(asset => b.getMainEntry().id !== asset.id)) return;
      // Don't include shared bundles that don't contain any assets that should be cached
      } else if (includedAssets.every(asset => !bundleGraph.isAssetReferenced(b, asset))) return;
      manifest.push(urlJoin(b.target.publicUrl, b.name));
    }, undefined);

    let code = `import {_register} from 'parcel-plugin-custom-service-worker';
const manifest = ${JSON.stringify(manifest)};
const version = ${JSON.stringify(bundle.hashReference)};
_register(manifest, version);
`;

    return [
      {
        filePath: asset.filePath,
        code,
        isEntry: true,
        env: {sourceType: 'module'},
      },
    ];
  },
}));
