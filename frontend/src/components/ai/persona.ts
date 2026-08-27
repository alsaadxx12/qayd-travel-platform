/**
 * Single source of truth for who the assistant is.
 *
 * The persona was renamed twice already (فلاي → سنفور → أينشتاين العراق) and each
 * rename meant hunting the same strings through the header, the byline and the
 * thinking indicator. Change it here once instead.
 */
export const AI_AVATAR = '/images/einstein-iraq.png';

export const AI_NAME_AR = 'أينشتاين العراق';
export const AI_NAME_EN = 'Einstein of Iraq';

export const AI_GREETING_AR = 'أنت تتحدث مع أينشتاين العراق';
export const AI_GREETING_EN = 'You are talking to Einstein of Iraq';

/** Shown while an answer is being prepared — in the persona's own voice. */
export const AI_THINKING_AR = 'جاي أفكّر… اصبر';
export const AI_THINKING_EN = 'Thinking…';
