/**
 * One email shell for every message. Inline styles only: email clients drop
 * stylesheets. Colours are the Day theme from the design system, written out
 * because CSS variables do not survive in mail either.
 */
export const COLOURS = {
  ink: '#141414',
  inkMuted: '#5C554C',
  ground: '#FFFFFF',
  surfaceMuted: '#F3F1EE',
  border: '#E3DACB',
  fire: '#E52A2A',
  fireInk: '#C81E1E',
  onFire: '#FFFFFF',
  gold: '#F5C400',
};

const DISPLAY = "'Barlow Condensed','Arial Narrow',Arial,sans-serif";
const BODY = "Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif";

export interface DateStripParts {
  day: string;
  monthYear: string;
  time: string;
}

/** The signature date strip: day in ink, month in fire-ink, time in a fire box. */
export function dateStrip(parts: DateStripParts): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>
  <td style="font-family:${BODY};font-size:16px;font-weight:800;letter-spacing:0.08em;color:${COLOURS.ink};padding-right:10px">${parts.day}</td>
  <td style="font-family:${BODY};font-size:16px;font-weight:800;letter-spacing:0.08em;color:${COLOURS.fireInk};padding-right:10px">${parts.monthYear}</td>
  <td style="background:${COLOURS.fire};border-radius:4px;padding:5px 10px"><span style="font-family:${BODY};font-size:16px;font-weight:800;letter-spacing:0.08em;color:${COLOURS.onFire}">${parts.time}</span></td>
</tr></table>`;
}

export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:${COLOURS.fire};border-radius:10px">
  <a href="${href}" style="display:block;min-height:56px;line-height:56px;padding:0 28px;font-family:${BODY};font-size:16px;font-weight:700;color:${COLOURS.onFire};text-decoration:none">${label}</a>
</td></tr></table>`;
}

export function row(label: string, value: string): string {
  return `<tr>
  <td style="padding:12px 0;border-bottom:1px solid ${COLOURS.border};font-family:${BODY};font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${COLOURS.inkMuted};width:40%">${label}</td>
  <td style="padding:12px 0;border-bottom:1px solid ${COLOURS.border};font-family:${BODY};font-size:16px;color:${COLOURS.ink}">${value}</td>
</tr>`;
}

export interface LayoutOptions {
  title: string;
  preheader: string;
  cityName: string;
  cityColour: string;
  body: string;
  /** MS-2: non-essential mail carries a way out. */
  unsubscribeUrl?: string;
}

export function layout(options: LayoutOptions): string {
  const unsubscribe = options.unsubscribeUrl
    ? `<p style="font-family:${BODY};font-size:13px;line-height:18px;color:${COLOURS.inkMuted};margin:8px 0 0">
         Don't want these updates? <a href="${options.unsubscribeUrl}" style="color:${COLOURS.inkMuted}">Unsubscribe</a>.
       </p>`
    : '';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${options.title}</title>
</head>
<body style="margin:0;padding:0;background:${COLOURS.surfaceMuted}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${options.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOURS.surfaceMuted};padding:24px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLOURS.ground};border-radius:18px;overflow:hidden">
    <tr><td style="height:8px;background:${options.cityColour}"></td></tr>
    <tr><td style="padding:28px 28px 0">
      <p style="margin:0 0 4px;font-family:${DISPLAY};font-style:italic;font-weight:800;font-size:28px;line-height:1;letter-spacing:0.01em;color:${COLOURS.ink};text-transform:uppercase">One Accord</p>
      <p style="margin:0 0 24px;font-family:${BODY};font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${COLOURS.inkMuted}">By Upper Room &middot; ${options.cityName}</p>
    </td></tr>
    <tr><td style="padding:0 28px 28px">${options.body}</td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:20px 28px">
      <p style="font-family:${BODY};font-size:13px;line-height:18px;color:${COLOURS.inkMuted};margin:0">
        One Accord by Upper Room. Entry is free. Please bring your UR Pass.
      </p>
      ${unsubscribe}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** Every HTML mail ships with a plain-text twin, which also helps the inbox. */
export function toText(lines: string[]): string {
  return lines.filter((line) => line !== undefined && line !== null).join('\n');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
