export interface ActionConfig {
  /**
   * Maximum number of retries for failed API requests.
   * @default 7
   */
  maxRetries: number;

  /**
   * Root directory for all output files.
   * Markdown files will be written relative to this path,
   * mirroring the Notion workspace tree structure.
   * @default './'
   * @example './output' for local testing to avoid mixing with source files
   */
  outputDir: string;

  /**
   * Name of the subdirectory inside `outputDir` for downloaded media files.
   * @default 'assets'
   */
  mediaDirName: string;

  /**
   * Whether to include YAML frontmatter in the output markdown.
   * When enabled, all Notion page properties are included automatically.
   * Disable if you're using include_relative or similar patterns
   * where frontmatter lives in a parent HTML file.
   * @default false
   */
  frontmatter: boolean;

  /**
   * Whether to include `id`, `created`, and `updated` metadata fields
   * from the frontmatter. Has no effect if `frontmatter` is false.
   * @default true
   */
  enableDefaultFrontmatterMetadata: boolean;

  /**
   * Whether to render videos and embeds as interactive elements.
   * - true: YouTube/Vimeo -> <iframe>, local video -> <video>
   * - false: all media -> markdown hyperlink [caption](url)
   * Disable for SSGs that don't support JSX/HTML in markdown,
   * or when you want to handle embeds with your own shortcodes.
   * @default true
   */
  embedMedia: boolean;
}

export const CONFIG_DEFAULTS: ActionConfig = {
  maxRetries: 7,
  outputDir: './',
  mediaDirName: 'assets',
  frontmatter: false,
  enableDefaultFrontmatterMetadata: true,
  embedMedia: true,
};

/**
 * Merges user-provided config with defaults.
 */
export function resolveConfig(partial: Partial<ActionConfig>): ActionConfig {
  const resolved = { ...CONFIG_DEFAULTS };
  for (const key in partial) {
    const k = key as keyof ActionConfig;
    if (partial[k] !== undefined) {
      // @ts-ignore
      resolved[k] = partial[k];
    }
  }
  return resolved;
}