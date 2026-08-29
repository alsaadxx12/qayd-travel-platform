/**
 * Single source of truth for who the assistant is.
 *
 * The persona was renamed twice already (فلاي → سنفور → أينشتاين العراق) and each
 * rename meant hunting the same strings through the header, the byline and the
 * thinking indicator. Change it here once instead.
 */
/**
 * 224x224 WebP with alpha. The original was a 1254x1254 PNG weighing 2.65MB that
 * every screen scaled down to 40-80px; 224 covers the largest use (80px) at ~2.8x
 * for HiDPI. `AI_AVATAR_PNG` stays available for canvas/print paths that need PNG.
 */
export const AI_AVATAR = '/images/einstein-iraq.webp';
export const AI_AVATAR_PNG = '/images/einstein-iraq-224.png';

/** Intrinsic pixel size of AI_AVATAR — set width/height on <img> to reserve space. */
export const AI_AVATAR_SIZE = 224;

export const AI_NAME_AR = 'أينشتاين العراق';
export const AI_NAME_EN = 'Einstein of Iraq';

export const AI_GREETING_AR = 'أنت تتحدث مع أينشتاين العراق';
export const AI_GREETING_EN = 'You are talking to Einstein of Iraq';

/** Shown while an answer is being prepared — in the persona's own voice. */
export const AI_THINKING_AR = 'جاي أفكّر… اصبر';
export const AI_THINKING_EN = 'Thinking…';
