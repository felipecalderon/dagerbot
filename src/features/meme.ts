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

export type PermissionCheckContext = {
  effectiveChannelId: string | null;
  activatingAutoReact: boolean;
  activatingMediaOnly: boolean;
};

export type PermissionChecks = {
  checkViewChannel: boolean;
  checkAddReactions: boolean;
  checkManageMessages: boolean;
};

export function getRequiredPermissionChecks(
  ctx: PermissionCheckContext
): PermissionChecks {
  return {
    checkViewChannel: ctx.effectiveChannelId !== null,
    checkAddReactions: ctx.activatingAutoReact && ctx.effectiveChannelId !== null,
    checkManageMessages: ctx.activatingMediaOnly && ctx.effectiveChannelId !== null,
  };
}
