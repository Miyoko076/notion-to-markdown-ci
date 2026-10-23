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

/**
 * ==========================================
 * 1. Annotation Transformers
 * ==========================================
 */
export const customAnnotationTransformers: Partial<Record<NotionAnnotationType, AnnotationTransformer>> = {
  // Add custom annotation transformers here, keyed by annotation type (bold, italic, code, ...).
};


/**
 * ==========================================
 * 2. Database Property Transformers
 * ==========================================
 */
export const customPropertyTransformers: Partial<Record<NotionDatabasePropertyType, DatabasePropertyTransformer>> = {
  // Add custom database property transformers here, keyed by property type (date, select, ...).
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

  // @ts-ignore
  heading_4: {
    transform: async ({ block, utils }: any) => {
      // Get heading content
      // @ts-ignore
      const headingBlock = block.heading_4;
      if (!headingBlock) return '';
      const isToggle = headingBlock.is_toggleable;
      // since markdown doesn't get renderer in HTML, on toggle enabled
      // we parse annotations as HTML
      const text = await utils.transformRichText(headingBlock.rich_text, {
        html: isToggle,
      });

      // Simple heading case
      if (!isToggle) {
        return `#### ${text}\n\n`;
      }

      // Process children for toggleable heading
      const childrenContent = block.children?.length
        ? await Promise.all(
            block.children.map((child: any) => utils.processBlock(child)),
          )
        : [];

      // Build toggle with h4
      return `<details>
  <summary>
  <h4>${text}</h4>
  </summary>

  ${childrenContent.join('\n')}

</details>\n`;
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
};