import { MDXRenderer } from 'notion-to-md/plugins/renderer';

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