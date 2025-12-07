// Fixed user IDs with their display name, button text, and system prompt
export const fixedUserIds: Array<[string, string, string]> = [
  ["Mark (Starbucks)", "Navigate to Starbucks", "SYSTEM FOR MARK (STARBUCKS)"],
  ["Lia (Phone Call)", "Phone call ends", "SYSTEM FOR LIA (PHONE CALL)"],
  ["Jeff (FSD)", "FSD ends", "SYSTEM FOR JEFF (FSD)"],
  [
    "Ben (Conversation)",
    "No conversation for 20 seconds",
    "SYSTEM FOR BEN (CONVERSATION)",
  ],
  [
    "Sophia (Drop off)",
    "Drop off Kayla at her work",
    "SYSTEM FOR SOPHIA (DROP OFF)",
  ],
];

// Map userId to button text
export const getNewThreadText = (userId?: string) => {
  return fixedUserIds.find((id) => id[0] == userId)?.[1] || "New Thread";
};
