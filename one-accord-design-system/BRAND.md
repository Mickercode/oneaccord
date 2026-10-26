# One Accord

One Accord is a concept registration and check-in platform for Upper Room, the worship gathering led by Dunsin Oyekan. It handles registration, bus trips, delegates, check-in and live seating for every Upper Room city. This system records its naming, voice and visual style so every screen, message and printed item looks like part of the same event.

_Status: concept, prepared to pitch to the Upper Room team at Dunsin Oyekan Ministries. Not an official Upper Room asset._

## Naming

| Name           | What it is                                            | Use it for                                                                                                                       |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **One Accord** | The platform                                          | The product name used by the team, delegates and partners. Always written "One Accord by Upper Room" on first mention.           |
| **UR Pass**    | The attendee's QR pass                                | Everything an attendee carries or shows: "Have your UR Pass ready." It arrives by email, with a short pass code such as UR-4K7Q. |
| **Trip**       | One journey by one bus                                | "Trip 12A" = Bus 12, first run. A bus that makes two runs has Trip 12A and Trip 12B.                                             |
| **Delegate**   | The campus or area leader in charge of a pickup point | "Your delegate is Tolu, UNILAG."                                                                                                 |
| **Zone**       | A seating area in the hall                            | "Zone C is 92% full."                                                                                                            |

**Where the name comes from.** Acts 2:1: "they were all with one accord in one place." It is the moment in the upper room before the fire fell, and it describes what the platform does: everyone gathered in one place, together and accounted for.

### Words to use

- **Register**, not "sign up". **Check in**, not "verify". **Welcome**, not "access granted".
- **Your UR Pass**, not "your ticket". Entry is free, so there are no tickets.
- **Trip 12A**, not "bus slot".

## Voice

Warm, brief and calm, like a good usher at the door. Reverent where it speaks about the gathering, plain where it gives instructions.

| Moment    | Write                                                                         | Avoid                        |
| --------- | ----------------------------------------------------------------------------- | ---------------------------- |
| Pass sent | "You're registered. Here's your UR Pass for Upper Room Lagos."                | "Registration successful!!!" |
| Boarding  | "You're checked in. Welcome aboard."                                          | "Scan complete."             |
| Not found | "We can't find this pass. Please head to the walk-in lane."                   | "Invalid. Access denied."    |
| Reminder  | "Upper Room Lagos is tomorrow. Your trip leaves UNILAG main gate at 2:00 pm." | Long paragraphs, many emojis |

No more than one emoji in an email, and none in the app.

## Relationship to the Upper Room brand

One Accord follows the visual language of recent Upper Room flyers (Lagos 2026, Abuja 2024). It does **not** recreate the Upper Room logo, which is a registered trademark, or Dunsin Oyekan's signature. Every screen leaves a marked **[Upper Room logo]** space for the team to place the official logo once they approve the concept.

The colour values here were sampled by eye from published flyers. Confirm exact values with the Upper Room design team.

## Logo

**The mark: Gathered.** Twelve short strokes in a ring around a flame. It comes from Acts 2:1–3: the disciples "all with one accord in one place", and the fire that fell on them. The twelve strokes are the people gathered; the flame is the presence they gathered for. The red flame and gold inner flame use `fire` and `gold`.

| File                                           | Use                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `oneaccord-logo-horizontal.svg`                | Default lockup on white: headers, emails, the UR Pass                          |
| `oneaccord-logo-horizontal-reversed.svg`       | On Night (usher and dashboard screens), with a gold tagline                    |
| `oneaccord-logo-stacked.svg` / `-reversed.svg` | Posters, the gate poster, square spaces                                        |
| `oneaccord-mark.svg` / `-white.svg`            | The mark alone, full colour                                                    |
| `oneaccord-mark-black.svg` / `-white-mono.svg` | One colour: stamps, wristbands, single-colour print                            |
| `oneaccord-mark-small.svg`                     | 32px and below (favicons, tabs): bolder strokes, flame without the gold centre |
| `oneaccord-app-icon.svg` (+ 1024 and 192 PNG)  | Home screen and web app icon                                                   |

**Rules**

- Clear space around the logo equals the height of one ring stroke on every side.
- Minimum size: the full mark 32px; below that, use the small mark. The horizontal lockup at least 140px wide.
- Do not rotate the ring, change the number of strokes, recolour the flame, or set the logo on a busy photo without a solid panel.
- The wordmark is Barlow Condensed ExtraBold Italic; "BY UPPER ROOM" is Archivo ExtraBold with wide letter-spacing. In the SVG lockups the words are live text. Before print or final hand-off, a designer should convert them to outlines.
- The One Accord logo sits beside the official Upper Room logo, never merged with it.

## Colour

Bold type, clean white ground, one burst of fire.

- **White (`ground`) with black (`ink`)** for attendee screens, the UR Pass and printed posters. Use `surface-muted` for soft panels.
- **Night theme** for usher and dashboard screens, which are used in dark halls and car parks.
- **`fire`** is the brand red: primary buttons, the time box, key highlights. For red text on white, use `fire-ink`.
- **`gold`** is the brand yellow, for shapes, tabs and stripes only. Never set gold text on white.
- **City colours** follow the flyers' city tabs: `city-lagos` yellow, `city-abuja` red. A city's colour tints its UR Pass, wristbands and dashboard header so ushers spot the right city at a glance. New cities get a colour from the team.
- **Scanner results** use `status-go`, `status-check` and `status-stop` as full-screen fills. They stay the same in every city, because ushers must read them instantly.

## Type

- **Barlow Condensed**, extra bold, usually italic capitals, for display: it carries the slanted, condensed weight of the Upper Room logo without copying it.
- **Archivo at its widest (width 125)**, extra bold capitals with wide letter-spacing, for the **date strip** and venue lines, like the flyers' "TRINITY TOWERS" and "25TH · JAN. 2026 · 5:00PM".
- **Archivo** at normal width for body text and forms.

All three are free on Google Fonts.

## Signature patterns

- **The date strip.** One line, three parts, three colours: day in `ink`, month and year in `fire-ink`, time in a `fire` box with `on-fire` text (or in `gold` on Night). Used on the UR Pass, reminders and the dashboard header.
- **The city tab.** A slanted band (skewed about −12°) in the city colour with the city name in capitals. Lagos adds black diagonal stripes, like the Lagos flyer.
- **Bold top, soft bottom.** Strong type and a city tab at the top of a screen, information in calm rows below.

## Imagery

Worship posture and light: raised hands, a tambourine wrapped in warm light, a worshipper kneeling in white, crowds in red-tinted stage light. Clean grounds with one warm glow. No stock photos of people at laptops, and no photos presented as real attendees unless they are.

## Iconography

Outline icons, 2px stroke, rounded caps. Icons use `ink` on white and on Night; a coloured icon appears only inside a status fill.

## Messages and check-in

- **Email** carries the UR Pass, reminders and updates. A WhatsApp Business integration is a paid service, so the first version uses email only.
- **Check-in is a web page.** Scanning the delegate's code or the gate poster opens a One Accord page that recognises the attendee from their UR Pass email on the same phone, with the pass code as a backup.
- **WhatsApp groups** for each trip are optional and run by delegates with an ordinary invite link. One Accord only shows the link.

## Layout

- Phones first: attendees and delegates use their own phones, often outdoors and on low data.
- Touch targets at least 48px; primary buttons 56px tall.
- One primary action per screen, in `fire`.
