const MEDIA_MIME_PREFIXES = ["image/", "video/"] as const;

export const MAX_REACT_EMOJIS = 3;

/**
 * Returns true if at least one attachment is an image or video.
 * Receives raw MIME types so this function stays pure and testable.
 */
export function hasMediaAttachment(contentTypes: (string | null)[]): boolean {
  return contentTypes.some(
    (type) =>
      type !== null &&
      MEDIA_MIME_PREFIXES.some((prefix) => type.startsWith(prefix))
  );
}
