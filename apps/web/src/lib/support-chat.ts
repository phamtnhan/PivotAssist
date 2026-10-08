export const SUPPORT_CHAT_EVENT = "pivotassist:open-support";

export function openSupportChat(draft?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SUPPORT_CHAT_EVENT, { detail: { draft } }));
}
