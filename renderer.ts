import { MDXRenderer } from 'notion-to-md/plugins/renderer';

// to_do and bulleted share the '- ' marker, so consecutive items of either continue one markdown list.
const LIST_FAMILY: Record<string, string> = {
  bulleted_list_item: 'bullet',
  to_do: 'bullet',
  numbered_list_item: 'ordered',
};

// Blocks whose own text is directly followed by their children in the library output.
const TEXT_WITH_CHILDREN = new Set(['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'callout']);

// Must match the library's list indentation per level (notion-to-md 4.0.0-alpha.7, INDENT in blocks.ts).
const LIST_INDENT_WIDTH = 4;

interface TreeEntry {
  parent?: any;
  next?: any;
  index: number;
}

// blockTree is the page's top-level blocks with nested children; indexed by id once per page.
const treeIndexCache = new WeakMap<object, Map<string, TreeEntry>>();

function treeEntryOf(blockTree: any[], blockId: string): TreeEntry | undefined {
  let entries = treeIndexCache.get(blockTree);
  if (!entries) {
    const map = new Map<string, TreeEntry>();
    const walk = (blocks: any[], parent?: any) => blocks.forEach((block, i) => {
      map.set(block.id, { parent, next: blocks[i + 1], index: i });
      if (block.children?.length) walk(block.children, block);
    });
    walk(blockTree);
    treeIndexCache.set(blockTree, map);
    entries = map;
  }
  return entries.get(blockId);
}

export class SpacedMDXRenderer extends MDXRenderer {
  // Column where each list item's text starts, recorded before its children are rendered.
  private contentColumns = new Map<string, number>();

  // Wraps every registered transformer (call after registering customs): blank line between siblings except same-family list items, blank line before the first non-list child of a list item/quote/callout, non-list list-item children indented to the item's content column.
  applyBlockLayout(): this {
    const blocks = this.context.transformers.blocks as Record<string, any>;
    for (const [type, transformer] of Object.entries(blocks)) {
      if (!transformer) continue;
      blocks[type] = {
        ...transformer,
        transform: async (context: any) => {
          const { block, blockTree, metadata = {} } = context;

          let itemPrefix = '';
          if (LIST_FAMILY[type]) {
            const marker = type === 'numbered_list_item' ? `${metadata.currentNumber || 1}. ` : '- ';
            itemPrefix = ' '.repeat(LIST_INDENT_WIDTH * (metadata.listLevel || 0)) + marker;
            this.contentColumns.set(block.id, itemPrefix.length);
          }

          let output: string = await transformer.transform.call(transformer, context);
          if (!output) return output;
          if (itemPrefix && !output.startsWith(itemPrefix)) {
            console.warn(`[notion-to-markdown-ci] List item ${block.id} does not start with '${itemPrefix}'; its children may be misaligned.`);
          }

          const entry = treeEntryOf(blockTree, block.id);
          const parent = entry?.parent;
          if (parent && !LIST_FAMILY[type]) {
            const column = this.contentColumns.get(parent.id);
            if (column !== undefined) {
              output = output.split('\n').map((line) => (line ? ' '.repeat(column) + line : line)).join('\n');
            }
            if (entry!.index === 0 && TEXT_WITH_CHILDREN.has(parent.type)) {
              output = '\n' + output;
            }
          }

          const next = entry?.next;
          if (!next) return output;
          if (LIST_FAMILY[type] && LIST_FAMILY[type] === LIST_FAMILY[next.type]) return output;
          return output.replace(/\n+$/, '') + '\n';
        },
      };
    }
    return this;
  }
}