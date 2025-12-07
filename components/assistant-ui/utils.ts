import { Trigger } from "@/lib/types";

// Default fallback mem0 user_id (used only if scenario is missing)
export const MEM0_USER_ID = "demo_tesla_user";

// Scenario-specific mem0 user IDs to keep memories isolated per persona
const mem0UserIds: Record<string, string> = {
  "Mark (Starbucks)": "mem_mark",
  "Lia (Phone Call)": "mem_lia",
  "Jeff (FSD)": "mem_jeff",
  "Ben (Conversation)": "mem_ben",
  "Sophia (Drop off)": "mem_sophia",
};

// Fixed user IDs with their display name, button text, system prompt, trigger, and greeting context
// Format: [displayName, buttonText, systemPrompt, trigger, greetingContext]
export const fixedUserIds: Array<[string, string, string, Trigger, string]> = [
  [
    "Mark (Starbucks)",
    "Navigate to Starbucks",
    "User is Mark. Driving to Starbucks. Search for coffee preferences and offer to place usual order.",
    "destination_set",
    "Navigation started to Starbucks. User may want their usual coffee order."
  ],
  [
    "Lia (Phone Call)",
    "Phone call ends",
    "User is Lia. Just finished a phone call. Be proactive - offer to help with next steps like booking flights, researching hotels near the venue, or finding things to do in the destination.",
    "call_ended",
    `Phone call just ended. Transcript:
---
Lia: Hey! Long time no talk. What's up?
Sarah: Heyyy! Got a minute?
Lia: For you? Always. What's going on?
Sarah: Okay, don't freak out… but I have some big news.
Lia: Oh god, that's how all the best and worst stories start. What happened?
Sarah: I'm getting married!
Lia: WHAT?! Shut up. For real?!
Sarah: For real for real. It's official.
Lia: Oh my god, congratulations! I'm so happy for you. When did this happen?
Sarah: We got engaged a few weeks ago, but we just locked everything in, so I wanted to call once it was real-real.
Lia: This is huge. Okay, details. Who, what, where, when—give me everything.
Sarah: You already know the who obviously. The where is the fun part… We're having the wedding in Hawaii.
Lia: HAWAII?! Are you kidding me? That's amazing.
Sarah: Haha, yeah, we figured if we're going to stress over planning something, at least let it be somewhere beautiful.
Lia: Facts. Okay, so when? Don't tell me it's, like, next month.
Sarah: Nope, you've got plenty of time. It's on February 20th, 2026.
Lia: February 20th, 2026… okay, hold on, I'm mentally opening my calendar. That's a Friday, right?
Sarah: Yup, Friday. We're doing the ceremony that day and then probably a chill beach day and brunch the next morning.
Lia: Oh my god, this is going to be a whole vacation. Where in Hawaii?
Sarah: We're looking at a venue on Oahu, near Honolulu. It's by the beach, small-ish ceremony, close friends and family.
Lia: That sounds perfect. Like, annoyingly perfect. I'm so happy for you.
Sarah: Aww, thank you. Honestly, I couldn't imagine doing it without you there, so… this is also me low-key making sure you're coming.
Lia: "Low-key"? This is maximum-key emotional blackmail and it's working. Of course I'm coming. I wouldn't miss it.
Sarah: You promise?
Lia: I promise. I'll start planning for it. I've got, what, over a year? I can figure out flights, hotels, all that.
Sarah: Yeah, we'll send out save-the-dates soon with more details—hotel blocks, rough schedule, that kind of stuff.
Lia: Do you have a time for the ceremony yet?
Sarah: Tentatively around sunset, so like 4–5 PM local time. We want that golden hour vibe.
Lia: Ugh, that's going to be so pretty. I'm going to cry just from the lighting alone.
Sarah: Good. I'm expecting tears. Happy ones only, though.
Lia: Deal. Are you doing it outdoors on the beach?
Sarah: Kind of a mix. It's a venue overlooking the ocean with a lawn area. Ceremony outside, reception in an open-air space right next to it.
Lia: You really thought this through, huh?
Sarah: We tried! Once we saw pictures, we were like, "Okay yeah, this is it."
Lia: So what do you need from me? Besides showing up in Hawaii on February 20th, 2026 and crying on command.
Sarah: Mostly that. And maybe some help later with playlists and random planning decisions when my brain melts.
Lia: Done. I'm already thinking: beach wedding = no boring playlist. We're going full vibes.
Sarah: Exactly what I wanted to hear.
Lia: Are you nervous?
Sarah: A little. Not about getting married, more about the logistics. Destination wedding planning is… a lot.
Lia: Yeah, but you're not doing it alone. You've got planners, and you've got me on call for panic rants.
Sarah: That actually makes me feel better. Thank you.
Lia: Always. So, to recap: Hawaii, February 20th, 2026, Oahu, sunset ceremony, I'm absolutely going to be there.
Sarah: That's the summary, yes.
Lia: I'm seriously so happy for you. This is huge.
Sarah: I'm really glad I got to tell you over the phone and not just in a group text.
Lia: Same. This deserved a full dramatic reveal.
Sarah: Mission accomplished?
Lia: Definitely. Now send me a selfie of that ring.
Sarah: Already took like 50. I'll text you the best ones.
Lia: Perfect. Okay, I'll let you go, but we're doing a longer catch-up soon. I need every detail.
Sarah: Deal. Thanks again. Love you.
Lia: Love you too. And congrats again, future newlywed! Byeee.
Sarah: Bye!
---`
  ],
  [
    "Jeff (FSD)",
    "FSD engaged",
    "User is Jeff. FSD engaged.",
    "fsd_on",
    "FSD engaged."
  ],
  [
    "Ben (Conversation)",
    "Conversation gap",
    "User is Ben. Quiet moment in cabin.",
    "conversation_gap",
    "Silence in cabin."
  ],
  [
    "Sophia (Drop off)",
    "Passenger exit",
    "User is Sophia. Passenger just exited.",
    "passenger_exit",
    "Passenger dropped off."
  ],
];

// Map displayName to button text
export const getNewThreadText = (displayName?: string): string => {
  const found = fixedUserIds.find((id) => id[0] === displayName);
  return found?.[1] || "New Thread";
};

// Map displayName to trigger
export const getTriggerForUser = (displayName?: string): Trigger => {
  const found = fixedUserIds.find((id) => id[0] === displayName);
  return found?.[3] || "general";
};

// Map displayName to system prompt
export const getSystemPromptForUser = (displayName?: string): string => {
  const found = fixedUserIds.find((id) => id[0] === displayName);
  return found?.[2] || "";
};

// Map displayName to greeting context (the specific scenario for greeting generation)
export const getGreetingContextForUser = (displayName?: string): string => {
  const found = fixedUserIds.find((id) => id[0] === displayName);
  return found?.[4] || "Generate a helpful greeting.";
};

// Get the mem0 user_id (scenario-specific, falls back to demo_user)
export const getMem0UserId = (displayName?: string): string => {
  return (displayName && mem0UserIds[displayName]) || MEM0_USER_ID;
};

// Human-friendly trigger label
export const getTriggerLabel = (trigger?: Trigger): string => {
  switch (trigger) {
    case "destination_set":
      return "Destination Entered";
    case "call_ended":
      return "Call Ended";
    case "fsd_on":
      return "FSD Engaged";
    case "conversation_gap":
      return "Conversation Gap";
    case "passenger_exit":
      return "Passenger Exit";
    default:
      return "General";
  }
};
