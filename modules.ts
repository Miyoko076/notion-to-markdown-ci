import { Client, isFullPageOrDatabase, APIErrorCode, APIResponseError } from "@notionhq/client";
import { PageObjectResponse, DatabaseObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { collectPaginatedAPI } from "@notionhq/client/build/src/helpers";
import * as core from '@actions/core';
import Bottleneck from 'bottleneck';
import slugify from '@sindresorhus/slugify'

const limiter = new Bottleneck({
  maxConcurrent: 3,
  minTime: 333,
});

export interface NotionTreeNode {
  id: string;
  type: "page" | "database";
  title: string;
  title_slug: string;
  created_time: string;
  last_edited_time: string;
  filePath: string;
  parentId: string | null;
  children: NotionTreeNode[];
}

export async function withRetry<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxRetries - 1) throw error;

      const jitter = Math.random() * 1000;

      if (APIResponseError.isAPIResponseError(error) && error.code === APIErrorCode.RateLimited) {
        const headers = error.headers as Record<string, string>;
        const retryAfter = parseInt(headers['retry-after'] ?? '5');
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000 + jitter));
      } else {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise(resolve => setTimeout(resolve, backoffDelay + jitter));
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export function flattenTree(nodes: NotionTreeNode[]): (NotionTreeNode & { hasChildren: boolean })[] {
  return nodes.flatMap(node => [
    { ...node, hasChildren: node.children.length > 0 },
    ...flattenTree(node.children)
  ]);
}

function getTitle(page: PageObjectResponse | DatabaseObjectResponse): string {
  let plain_title = "";
  if (page.object === "page") {
    const titleProp = Object.values(page.properties).find(p => p.type === "title");
    plain_title = titleProp?.title.map(t => t.plain_text).join("") || "";
  } else {
    plain_title = page.title.map(t => t.plain_text).join("");
  }
  return plain_title || `untitled-${page.id.slice(0, 8)}`;
}

function assignFilePaths(nodes: NotionTreeNode[], parentPath = "") {
  for (const node of nodes) {
    const slug = node.title_slug;
    node.filePath = parentPath ? `${parentPath}/${slug}` : `/${slug}`;
    assignFilePaths(node.children, node.filePath);
  }
}

export async function fetchNotionTree(notion: Client, maxRetries: number): Promise<NotionTreeNode[]> {
  const AncestorCache = new Map<string, string | null>();

  async function resolveAncestor(parentId: string, parentType: string): Promise<string | null> {
    if (parentType === "page_id" || parentType === "database_id") {
      return parentId;
    }

    if (parentType === "workspace") {
      return null;
    }

    if (parentType === "block_id") {
      if (AncestorCache.has(parentId)) {
        return AncestorCache.get(parentId)!;
      }

      try {
        const block = await limiter.schedule(async () => {
          return await withRetry(() => notion.blocks.retrieve({ block_id: parentId }), maxRetries);
        });

        if (!("parent" in block)) {
          AncestorCache.set(parentId, null);
          return null;
        }

        const ancestorId = await resolveAncestor(
          // @ts-ignore
          block.parent[block.parent.type],
          block.parent.type
        );

        AncestorCache.set(parentId, ancestorId);
        return ancestorId;
      } catch (error) {
        if (APIResponseError.isAPIResponseError(error) && [APIErrorCode.ObjectNotFound, APIErrorCode.RestrictedResource].includes(error.code)) {
          AncestorCache.set(parentId, null);
          return null;
        } else {
          throw error;
        }
      }
    }

    if (parentType === "data_source_id") {
      if (AncestorCache.has(parentId)) {
        return AncestorCache.get(parentId)!;
      }

      try {
        // Remove 'any' once @notionhq/client types are updated
        const dataSource = await limiter.schedule(async () => {
          // @ts-ignore
          return await withRetry(() => notion.dataSources.retrieve({ data_source_id: parentId }), maxRetries);
        }) as any;

        if (!("parent" in dataSource)) {
          AncestorCache.set(parentId, null);
          return null;
        }

        const ancestorId = await resolveAncestor(
          // @ts-ignore
          dataSource.parent[dataSource.parent.type],
          dataSource.parent.type
        );

        AncestorCache.set(parentId, ancestorId);
        return ancestorId;
      } catch (error) {
        if (APIResponseError.isAPIResponseError(error) && [APIErrorCode.ObjectNotFound, APIErrorCode.RestrictedResource].includes(error.code)) {
          AncestorCache.set(parentId, null);
          return null;
        } else {
          throw error;
        }
      }
    }

    return null;
  }

  const rawResults = await collectPaginatedAPI(
    async (args) => {
      return await withRetry(() => notion.search(args), maxRetries);
    },
    {}
  );

  const pages = rawResults.filter(isFullPageOrDatabase);

  const nodeMap = new Map<string, NotionTreeNode>();

  for (const page of pages) {
    const title = getTitle(page);
    const title_slug = slugify(title, { lowercase: true, separator: '-', transliterate: false, preserveLeadingUnderscore: true });

    nodeMap.set(page.id, {
      id: page.id,
      type: page.object as "page" | "database",
      title: title,
      title_slug: title_slug,
      filePath: "",
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      parentId: null,
      children: [],
    });
  }

  await Promise.all(pages.map(async (page) => {
    // @ts-ignore
    const rawParentId = page.parent[page.parent.type];
    const parentType = page.parent.type;

    const resolvedParentId = await resolveAncestor(rawParentId, parentType);

    nodeMap.set(page.id, {
      ...nodeMap.get(page.id)!,
      parentId: resolvedParentId,
    });
  }));

  const rootNodes: NotionTreeNode[] = [];

  for (const node of Array.from(nodeMap.values())) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parentNode = nodeMap.get(node.parentId)!;
      parentNode.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  assignFilePaths(rootNodes);
  return rootNodes;
}

export function getOptionalString(name: string) {
  const val = core.getInput(name);
  return val !== '' ? val : undefined;
}

export function getOptionalBoolean(name: string): boolean | undefined {
  const val = core.getInput(name);
  return val ? core.getBooleanInput(name) : undefined;
}

export function getOptionalNumber(name: string) {
  const val = core.getInput(name);
  return val !== '' ? parseInt(val, 10) : undefined;
}