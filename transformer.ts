import { MDXRenderer } from 'notion-to-md/plugins/renderer';
import { stripIndent, oneLine } from 'common-tags';
import getVideoId from 'get-video-id';

import type {
  NotionAnnotationType,
  NotionBlockType,
  NotionDatabasePropertyType,
} from 'notion-to-md/types';

// If the library updates and fixes its exports, you can uncomment this block
// and delete the Type Inference section below.
/*
import type {
  AnnotationTransformer,
  BlockTransformer,
  DatabasePropertyTransformer,
} from 'notion-to-md/types';
*/
type AnnotationTransformer = NonNullable<Parameters<MDXRenderer['createAnnotationTransformers']>[0][NotionAnnotationType]>;
type DatabasePropertyTransformer = NonNullable<Parameters<MDXRenderer['createPropertyTransformers']>[0][NotionDatabasePropertyType]>;
type BlockTransformer = NonNullable<Parameters<MDXRenderer['createBlockTransformers']>[0][NotionBlockType]>;

// Used in ['to_do', 'bulleted_list_item', 'numbered_list_item']
const INDENT = '    '; // 4 whitespace = tab space (keeping it consistent)

/**
 * ==========================================
 * 1. Annotation Transformers
 * ==========================================
 */
export const customAnnotationTransformers: Partial<Record<NotionAnnotationType, AnnotationTransformer>> = {
  /*
  bold: {
    transform: async ({ text, annotations, link, metadata, manifest }) => {
      return `<strong>${text}</strong>`;
    },
  },
  */
};


/**
 * ==========================================
 * 2. Database Property Transformers
 * ==========================================
 */
export const customPropertyTransformers: Partial<Record<NotionDatabasePropertyType, DatabasePropertyTransformer>> = {
  /*
  date: {
    transform: async ({ property, properties, block, utils, metadata }) => {
      if (property.type !== 'date' || !property.date) return '';
      return property.date.start; 
    },
  },
  */
};


/**
 * ==========================================
 * 3. Block Transformers
 * ==========================================
 */
export const customBlockTransformers: Partial<Record<NotionBlockType, BlockTransformer>> = {
  code: {
    transform: async ({ block, utils }) => {
      const codeBlock = (block as any).code;
      const text = await utils.transformRichText(codeBlock.rich_text);
      const originalLang = (codeBlock.language || '').toLowerCase();

      // Local dictionary to map Notion languages to specific highlighter aliases
      const languageMap: Record<string, string> = {
        'ascii art': 'text',
        'c#': 'csharp',
        'c++': 'cpp',
        'f#': 'fsharp',
        'llvm ir': 'llvm',
        'notion formula': 'javascript',
        'plain text': 'text',
        'vb.net': 'vb',
        'visual basic': 'vb',
        'arduino': 'cpp',
        'objective-c': 'objectivec',
        'lisp': 'common_lisp',
        'assembly': 'nasm',
        'markup': 'xml'
      };

      // Use mapped language if it exists, otherwise fallback to the original
      const mappedLang = languageMap[originalLang] || originalLang;
      return `\`\`\`${mappedLang}\n${text}\n\`\`\`\n\n`;
    },
  },

  toggle: {
    transform: async ({ block, utils, metadata = {} }) => {
      const toggleBlock = (block as any).toggle;
      const text = await utils.transformRichText(toggleBlock.rich_text, {
        html: true,
      });

      if (!block.children?.length) {
        return `<details markdown="1">\n<summary>\n${text}\n</summary>\n</details>\n`;
      }

      const baseLevel = (metadata.listLevel || 0) + 1;
      let currentNumber = 1;
      const childrenContent: string[] = [];

      for (const child of block.children) {
        const isNumberedList = child.type === 'numbered_list_item';
        if (!isNumberedList) currentNumber = 1;

        const childMetadata = isNumberedList
          ? { currentNumber, listLevel: baseLevel }
          : { listLevel: baseLevel };
        const content = await utils.processBlock(child, childMetadata);
        childrenContent.push(content);

        if (isNumberedList) currentNumber++;
      }

      return `<details markdown="1">\n<summary>${text}</summary>\n\n${childrenContent.join('\n')}\n\n</details>\n`;
    },
  },

  heading_1: {
    transform: async ({ block, utils }) => {
      const headingBlock = (block as any).heading_1;
      const isToggle = headingBlock.is_toggleable;
      const text = await utils.transformRichText(headingBlock.rich_text);

      if (!isToggle) return `# ${text}\n`;

      let currentNumber = 1;
      const childrenContent: string[] = [];

      const uniqueId = `toc-${block.id.replace(/-/g, '')}`;

      if (block.children?.length) {
        for (const child of block.children) {
          const isNumberedList = child.type === 'numbered_list_item';
          if (!isNumberedList) currentNumber = 1;

          const childMetadata = isNumberedList ? { currentNumber } : {};
          const content = await utils.processBlock(child, childMetadata);
          childrenContent.push(content);

          if (isNumberedList) currentNumber++;
        }
      }

      return `<details markdown="1">\n  <summary markdown="block">\n\n# ${text} {#${uniqueId}}\n\n  </summary>\n\n${childrenContent.join('\n')}\n\n</details>\n`;
    },
  },

  heading_2: {
    transform: async ({ block, utils }) => {
      const headingBlock = (block as any).heading_2;
      const isToggle = headingBlock.is_toggleable;
      const text = await utils.transformRichText(headingBlock.rich_text);

      if (!isToggle) return `## ${text}\n`;

      let currentNumber = 1;
      const childrenContent: string[] = [];

      const uniqueId = `toc-${block.id.replace(/-/g, '')}`;

      if (block.children?.length) {
        for (const child of block.children) {
          const isNumberedList = child.type === 'numbered_list_item';
          if (!isNumberedList) currentNumber = 1;

          const childMetadata = isNumberedList ? { currentNumber } : {};
          const content = await utils.processBlock(child, childMetadata);
          childrenContent.push(content);

          if (isNumberedList) currentNumber++;
        }
      }

      return `<details markdown="1">\n  <summary markdown="block">\n\n## ${text} {#${uniqueId}}\n\n  </summary>\n\n${childrenContent.join('\n')}\n\n</details>\n`;
    },
  },

  heading_3: {
    transform: async ({ block, utils }) => {
      const headingBlock = (block as any).heading_3;
      const isToggle = headingBlock.is_toggleable;
      const text = await utils.transformRichText(headingBlock.rich_text);

      if (!isToggle) return `### ${text}\n`;

      let currentNumber = 1;
      const childrenContent: string[] = [];

      const uniqueId = `toc-${block.id.replace(/-/g, '')}`;

      if (block.children?.length) {
        for (const child of block.children) {
          const isNumberedList = child.type === 'numbered_list_item';
          if (!isNumberedList) currentNumber = 1;

          const childMetadata = isNumberedList ? { currentNumber } : {};
          const content = await utils.processBlock(child, childMetadata);
          childrenContent.push(content);

          if (isNumberedList) currentNumber++;
        }
      }

      return `<details markdown="1">\n  <summary markdown="block">\n\n### ${text} {#${uniqueId}}\n\n  </summary>\n\n${childrenContent.join('\n')}\n\n</details>\n`;
    },
  },

  // @ts-ignore
  heading_4: {
    transform: async ({ block, utils }: any) => {
      const headingBlock = (block as any).heading_4;
      if (!headingBlock) return '';

      const isToggle = headingBlock.is_toggleable;

      const text = await utils.transformRichText(headingBlock.rich_text);
      if (!isToggle) return `#### ${text}\n`;

      let currentNumber = 1;
      const childrenContent: string[] = [];

      const uniqueId = `toc-${block.id.replace(/-/g, '')}`;

      if (block.children?.length) {
        for (const child of block.children) {
          const isNumberedList = child.type === 'numbered_list_item';
          if (!isNumberedList) currentNumber = 1;

          const childMetadata = isNumberedList ? { currentNumber } : {};
          const content = await utils.processBlock(child, childMetadata);
          childrenContent.push(content);

          if (isNumberedList) currentNumber++;
        }
      }

      return `<details markdown="1">\n  <summary markdown="block">\n\n#### ${text} {#${uniqueId}}\n\n  </summary>\n\n${childrenContent.join('\n')}\n\n</details>\n`;
    },
  },

  video: {
    transform: async (context: any) => {
      const escapeJSXAttribute = (str: string) => (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const generateJSXClassName = (base: string, prefix?: string, custom?: Record<string, string>) => custom?.[base] || (prefix ? `${prefix}-${base}` : base);

      const config = context.metadata.config || {}; 

      const className = generateJSXClassName(
        'video',
        config.styling?.classNamePrefix,
        config.styling?.customClasses,
      );
      
      const captionClassName = generateJSXClassName(
        'video-caption',
        config.styling?.classNamePrefix,
        config.styling?.customClasses,
      );

      const videoUrl = context.block.video?.file?.url || context.block.video?.external?.url || '';
      const escapedVideoUrl = escapeJSXAttribute(videoUrl);

      const { id, service } = getVideoId(videoUrl);

      let videoElement = '';

      if (service === 'youtube' && id) {
        const params = new URLSearchParams({
          rel: '0',
          playsinline: '1',
          cc_load_policy: '1'
        });
        videoElement = stripIndent`
          ${oneLine`
            <iframe
              className="${className}"
              src="https://www.youtube.com/embed/${id}?${params.toString()}"
              title="YouTube video player"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen>`}
          </iframe>
        `;
      } else if (service === 'vimeo' && id) {
        videoElement = stripIndent`
          ${oneLine`
            <iframe
              className="${className}"
              src="https://player.vimeo.com/video/${id}"
              title="vimeo-player"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen>`}
          </iframe>
        `;
      } else {
        videoElement = stripIndent`
          <video className="${className}" controls>
            <source src="${escapedVideoUrl}" />
            Your browser does not support the video tag.
          </video>
        `;
      }

      if (
        context.block.video?.caption &&
        context.block.video.caption.length > 0
      ) {
        const captionContent = await context.utils.transformRichText(
          context.block.video.caption,
          context.metadata,
        );

        const figureClassName = generateJSXClassName(
          'figure',
          config.styling?.classNamePrefix,
          config.styling?.customClasses,
        );

        const indentedVideo = videoElement.split('\n').map(line => `  ${line}`).join('\n');
        videoElement = `<figure className="${figureClassName}">\n${indentedVideo}\n  <figcaption className="${captionClassName}">${captionContent}</figcaption>\n</figure>`;
      }

      return videoElement + '\n';
    },
  },

  embed: {
    transform: async (context: any) => {
      // --- v4-alpha-8 Helpers Polyfill ---
      const escapeJSXAttribute = (str: string) => (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const generateJSXClassName = (base: string, prefix?: string, custom?: Record<string, string>) => custom?.[base] || (prefix ? `${prefix}-${base}` : base);
      // ------------------------------------------------

      const config = context.metadata.config || {};

      const className = generateJSXClassName(
        'embed',
        config.styling?.classNamePrefix,
        config.styling?.customClasses,
      );
      const captionClassName = generateJSXClassName(
        'embed-caption',
        config.styling?.classNamePrefix,
        config.styling?.customClasses,
      );

      const src = escapeJSXAttribute(context.block.embed?.url || '');
      
      const alt = context.block.embed?.caption
        ? await context.utils.transformRichText(
            context.block.embed.caption,
            context.metadata,
          )
        : src;

      let embedElement = `<iframe src="${src}" className="${className}" title="${escapeJSXAttribute(alt)}" frameBorder="0" allowFullScreen></iframe>`;

      if (
        context.block.embed?.caption &&
        context.block.embed.caption.length > 0
      ) {
        const captionContent = await context.utils.transformRichText(
          context.block.embed.caption,
          context.metadata,
        );
        embedElement += `\n<figcaption className="${captionClassName}">${captionContent}</figcaption>`;

        const figureClassName = generateJSXClassName(
          'figure',
          config.styling?.classNamePrefix,
          config.styling?.customClasses,
        );
        embedElement = `<figure className="${figureClassName}">\n${embedElement}\n</figure>`;
      }

      return embedElement + '\n';
    },
  },

  bulleted_list_item: {
    transform: async ({ block, utils, metadata = {}, blockTree }) => {
      // First, handle this block's own content
      const text = await utils.transformRichText(
        // @ts-ignore
        block.bulleted_list_item.rich_text,
      );
      const currentLevel = metadata.listLevel || 0;
      const indent = INDENT.repeat(currentLevel);
      
      const formattedItem = `${indent}- ${text}`;

      // Check if the current block is the last item in its list group
      let isEndOfList = false;
      
      // @ts-ignore
      if (block.parent?.type === 'page_id' && Array.isArray(blockTree)) {
        const currentIndex = blockTree.findIndex((b: any) => b.id === block.id);
        
        if (currentIndex !== -1) {
          const nextBlock = blockTree[currentIndex + 1];
          const listTypes = ['to_do', 'bulleted_list_item', 'numbered_list_item'];
          
          if (!nextBlock || !listTypes.includes(nextBlock.type)) {
            isEndOfList = true;
          }
        }
      }
      
      const listTermination = isEndOfList ? '\n' : '';

      // If no children, just return formatted content
      if (!block.children?.length) {
        return formattedItem + listTermination;
      }

      // Process each child block directly through processBlock
      let childNumber = 1;
      const childrenContent: string[] = [];

      for (const childBlock of block.children) {
        const isNumberedList = childBlock.type === 'numbered_list_item';

        // Reset numbering if sequence is broken
        if (!isNumberedList) {
          childNumber = 1;
        }

        const content = await utils.processBlock(childBlock, {
          ...metadata,
          listLevel: currentLevel + 1,
          currentNumber: isNumberedList ? childNumber : undefined,
        });

        childrenContent.push(content);

        if (isNumberedList) {
          childNumber++;
        }
      }

      // Combine everything with proper formatting
      return `${formattedItem}\n${childrenContent.join('\n')}\n` + listTermination;
    },
  },

  numbered_list_item: {
    transform: async ({ block, utils, metadata = {}, blockTree }) => {
      // Get the current nesting level
      const currentLevel = metadata.listLevel || 0;

      // The parent passes down the current number to its children
      const currentNumber = metadata.currentNumber || 1;

      // Create indentation based on level
      const indent = INDENT.repeat(currentLevel);

      // Process the item's text content
      const text = await utils.transformRichText(
        // @ts-ignore
        block.numbered_list_item.rich_text,
      );

      // Format this item with proper number
      const formattedItem = `${indent}${currentNumber}. ${text}`;

      // Check if the current block is the last item in its list group
      let isEndOfList = false;
      
      // @ts-ignore
      if (block.parent?.type === 'page_id' && Array.isArray(blockTree)) {
        const currentIndex = blockTree.findIndex((b: any) => b.id === block.id);
        
        if (currentIndex !== -1) {
          const nextBlock = blockTree[currentIndex + 1];
          const listTypes = ['to_do', 'bulleted_list_item', 'numbered_list_item'];
          
          if (!nextBlock || !listTypes.includes(nextBlock.type)) {
            isEndOfList = true;
          }
        }
      }
      
      const listTermination = isEndOfList ? '\n' : '';

      // If no children, just return this item
      if (!block.children?.length) {
        return formattedItem + listTermination;
      }

      // For items with children, process each child sequentially
      // Each child starts with number 1 at its level
      const childrenContent: string[] = [];
      let childNumber = 1;
      for (let i = 0; i < block.children.length; i++) {
        const child = block.children[i];
        const isNumberedList = child.type === 'numbered_list_item';

        const childContent = await utils.processBlock(child, {
          ...metadata,
          listLevel: currentLevel + 1,
          currentNumber: isNumberedList ? childNumber : undefined, // Pass sequential numbers to siblings
        });

        if (isNumberedList) {
          childNumber++;
        }
        childrenContent.push(childContent);
      }

      // Combine this item with its children
      return `${formattedItem}\n${childrenContent.join('\n')}\n` + listTermination;
    },
  },

  to_do: {
    transform: async ({ block, utils, metadata = {}, blockTree }) => {
      // Get current nesting level for indentation
      const currentLevel = metadata.listLevel || 0;
      const indent = INDENT.repeat(currentLevel);
      
      // @ts-ignore
      const todoBlock = block.to_do;
      const text = await utils.transformRichText(todoBlock.rich_text);
      
      // Determine checkbox state - checked or unchecked
      const checkbox = todoBlock.checked ? 'x' : ' ';
      
      // Format the todo item with proper indentation and checkbox
      const formattedItem = `${indent}- [${checkbox}] ${text}`;

      // Check if the current block is the last item in its list group
      let isEndOfList = false;
      
      // @ts-ignore
      if (block.parent?.type === 'page_id' && Array.isArray(blockTree)) {
        const currentIndex = blockTree.findIndex((b: any) => b.id === block.id);
        
        if (currentIndex !== -1) {
          const nextBlock = blockTree[currentIndex + 1];
          const listTypes = ['to_do', 'bulleted_list_item', 'numbered_list_item'];
          
          if (!nextBlock || !listTypes.includes(nextBlock.type)) {
            isEndOfList = true;
          }
        }
      }
      
      const listTermination = isEndOfList ? '\n' : '';

      // If this todo item has no children, return just the item
      if (!block.children?.length) {
        return formattedItem + listTermination;
      }

      // For todo items with children, process each child
      // maintaining the proper hierarchy
      let childNumber = 1;
      const childrenContent: string[] = [];

      for (const childBlock of block.children) {
        const isNumberedList = childBlock.type === 'numbered_list_item';

        // Reset numbering if sequence is broken
        if (!isNumberedList) {
          childNumber = 1;
        }

        const content = await utils.processBlock(childBlock, {
          ...metadata,
          listLevel: currentLevel + 1,
          currentNumber: isNumberedList ? childNumber : undefined,
        });

        childrenContent.push(content);

        if (isNumberedList) {
          childNumber++;
        }
      }

      return `${formattedItem}\n${childrenContent.join('\n')}\n` + listTermination;
    },
  },

  /*
  paragraph: {
    transform: async ({ block, utils, metadata = {} }) => {
      const text = await utils.transformRichText(
        // @ts-ignore
        block.paragraph.rich_text,
      );
      if (!text) return '';
      return `<p class="custom-paragraph">${text}</p>\n`;
    },
  },
  */
};