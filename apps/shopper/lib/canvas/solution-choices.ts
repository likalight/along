/** Stable order for the optional compact chooser and voice references. */
export const AUDIO_SOLUTION_CHOICES = [
  {
    id: "headset",
    solutionType: "headset",
    title: "Headset",
    tag: "Wear it",
    text: "Keeps the mic by your mouth as you move.",
    trade: "You wear the headphones and mic; less suitable if you want your ears free.",
    command: "Choose headset",
  },
  {
    id: "clip",
    solutionType: "clip_on",
    title: "Clip-on mic",
    tag: "Clip it on",
    text: "Moves with you and leaves your ears free.",
    trade: "Clothing rustle and nearby voices can enter the mic. Check the receiver and device connection.",
    command: "Choose clip-on",
  },
  {
    id: "desktop",
    solutionType: "directional_desktop",
    title: "Desk mic",
    tag: "Keep it on the desk",
    text: "Nothing to wear; needs close, steady placement.",
    trade: "Needs desk space and close, consistent placement. Directional pickup does not remove all room noise.",
    command: "Choose desktop",
  },
] as const;
