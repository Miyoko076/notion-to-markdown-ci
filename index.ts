import fs from 'fs/promises';
import path from 'path';
import { Client } from '@notionhq/client';
import { NotionConverter } from 'notion-to-md';
import { PageReferenceManifestManager } from 'notion-to-md/utils';
import { PageReferenceEntryType } from 'notion-to-md/types';
import { MDXRenderer } from 'notion-to-md/plugins/renderer';
import prettier from 'prettier';
import * as core from '@actions/core';

import {
  fetchNotionTree,
  flattenTree,
  NotionTreeNode,
  withRetry,
  getOptionalString,
  getOptionalBoolean,
  getOptionalNumber
} from './modules.js';

import { 
  customAnnotationTransformers, 
  customPropertyTransformers, 
  customBlockTransformers 
} from './transformer.js';

import { resolveConfig } from './config.js';

async function run(): Promise<void> {
  try {
    const config = resolveConfig({
      maxRetries: getOptionalNumber('maxRetries'),
      outputDir: getOptionalString('outputDir'),
      mediaDirName: getOptionalString('mediaDirName'),
      frontmatter: getOptionalBoolean('frontmatter'),
      enableDefaultFrontmatterMetadata: getOptionalBoolean('enableDefaultFrontmatterMetadata'),
      embedMedia: getOptionalBoolean('embedMedia'),
      enableKramdownTogglePatch: getOptionalBoolean('enableKramdownTogglePatch'),
    });

    const token = core.getInput('NOTION-TOKEN', { required: true });

    const notionClient = new Client({ auth: token });

    core.info('Fetching Notion workspace...');
    const notionTree = await fetchNotionTree(notionClient, config.maxRetries);

    core.info('Building page reference manifest...');
    const manager = new PageReferenceManifestManager();
    await manager.initialize();
    function BuildManifest(nodes: NotionTreeNode[]) {
      for (const node of nodes) {
        manager.updateEntry(node.id, {
          url: node.filePath,
          source: PageReferenceEntryType.PROPERTY,
          lastUpdated: node.last_edited_time,
        });
        BuildManifest(node.children);
      }
    }
    BuildManifest(notionTree);
    await manager.save();

    const notionArray = flattenTree(notionTree);

    const blockTransformers = { ...customBlockTransformers };
    if (!config.embedMedia) {
      delete blockTransformers.video;
      delete blockTransformers.embed;
    }
    if (!config.enableKramdownTogglePatch) {
      delete blockTransformers.toggle;
      delete blockTransformers.heading_1;
      delete blockTransformers.heading_2;
      delete blockTransformers.heading_3;
      // @ts-ignore
      delete blockTransformers.heading_4;
    }

    core.info('Starting Notion workspace conversion...');
    for (const node of notionArray) {
      if (node.type === 'page') {
        await core.group(`Converting Page: ${node.filePath} ...`, async () => {
          core.info(`Converting Page: ${node.filePath} ...`);
          const renderer = new MDXRenderer({
            frontmatter: config.frontmatter && {
              defaults: config.enableDefaultFrontmatterMetadata
                ? {
                    id: node.id,
                    created: node.created_time,
                    updated: node.last_edited_time,
                  }
                : {}
            }})
            .createAnnotationTransformers(customAnnotationTransformers)
            .createPropertyTransformers(customPropertyTransformers)
            .createBlockTransformers(blockTransformers);

          const converter = new NotionConverter(notionClient)
            .configureFetcher({ fetchPageProperties: true, maxRequestsPerSecond: 3 })
            .withRenderer(renderer)
            .withPageReferences({
              // urlPropertyNameNotion is required by the API but not used here
              urlPropertyNameNotion: '__dummy__',
              // Skip URL parsing
              transformUrl: (url) => url,
            })
            .downloadMediaTo({
              outputDir: path.join(config.outputDir, config.mediaDirName),
              preserveExternalUrls: true,
              transformPath: (localPath) => `/${config.mediaDirName}/${path.basename(localPath)}`,
            });
        
          const { content: rawConvertedPage } = await withRetry(() => converter.convert(node.id), config.maxRetries);
          const convertedPage = await prettier.format(rawConvertedPage, { parser: 'markdown' });
          const outPath = path.join(config.outputDir, `${node.filePath}.md`);

          await fs.mkdir(path.dirname(outPath), { recursive: true });
          await fs.writeFile(outPath, convertedPage, 'utf-8');
        });
      }
    }
    core.info('Notion workspace conversion completed.');

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${message}`);
    return;
  }
}

run();