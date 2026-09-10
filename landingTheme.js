/**
 * deriveTheme, the shared rule that turns a tenant's brand colours into a
 * legible dark-ground field, a legible pale-ground lift, and one accent that
 * clears both.
 *
 * Ported verbatim from `.planning/sketches/theme.js` in cdtr-studio. Only
 * change from the sketch: this file is real CommonJS (page-kit has no ESM
 * constraint the sketch was working around), so it ends with a real
 * `module.exports` instead of staying exportless.
 */
const hex2rgb = h => { h = h.replace('#',''); if (h.length===3) h = h.split('').map(c=>c+c).join('');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }; };
const rgb2hex = ({r,g,b}) => '#' + [r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
function rgb2hsl({r,g,b}) { r/=255;g/=255;b/=255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b); let h=0,s=0; const l=(mx+mn)/2;
  if (mx!==mn) { const d=mx-mn; s = l>0.5 ? d/(2-mx-mn) : d/(mx+mn);
    h = mx===r ? ((g-b)/d + (g<b?6:0)) : mx===g ? ((b-r)/d + 2) : ((r-g)/d + 4); h*=60; }
  return { h, s, l }; }
function hsl2rgb({h,s,l}) { h=((h%360)+360)%360/360;
  const f=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
  if (s===0) { const v=l*255; return {r:v,g:v,b:v}; }
  const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  return { r: f(p,q,h+1/3)*255, g: f(p,q,h)*255, b: f(p,q,h-1/3)*255 }; }
const hsl = (h,s,l) => rgb2hex(hsl2rgb({h,s,l}));
const lum = hex => { const {r,g,b} = hex2rgb(hex); const c = [r,g,b].map(v=>{ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]; };
const contrast = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const hueGap = (a,b) => { const d = Math.abs(((a-b)%360+360)%360); return Math.min(d, 360-d); };


/**
 * deriveTheme, the shared rule.
 *
 * Returns TWO accents, because every problem-section variant is kept and one
 * of them lifts the page to a pale ground. Measured across six brands, the
 * dark-ground accent scores 1.8:1 to 2.6:1 on the lifted ground, which is
 * unreadable, so a section must take the accent belonging to the ground it
 * actually sits on.
 */
function deriveTheme(brandHex, secondaryHex) {
  const brand = rgb2hsl(hex2rgb(brandHex));
  const achromatic = brand.s < 0.12;

  const gh = achromatic ? 210 : brand.h;
  const gs = achromatic ? 0.10 : Math.max(0.32, Math.min(0.68, brand.s));

  // ── the dark ground, and the pale one, from the same hue ──────────────────
  const FIELD = hsl(gh, gs, 0.11);
  const LINE  = hsl(gh, gs * 0.72, 0.22);
  const MUTED = hsl(gh, gs * 0.32, 0.66);
  const PANEL = hsl(gh, gs, 0.16);              // one shade off, for P2's blocks
  const LIFT      = hsl(gh, achromatic ? 0.04 : 0.18, 0.955);
  const LIFT_LINE = hsl(gh, achromatic ? 0.05 : 0.16, 0.86);
  const LIFT_INK  = hsl(gh, achromatic ? 0.10 : 0.30, 0.13);
  const LIFT_BODY = hsl(gh, achromatic ? 0.06 : 0.14, 0.38);

  // ── the accent ───────────────────────────────────────────────────────────
  //
  // PRIORITY: the tenant's own secondary comes FIRST. It is their colour and
  // it is what makes the page look like their business rather than like our
  // template. The generated hues are fallbacks for when they have no usable
  // second colour.
  let accentH, accentS, accentL, source;
  const sec = secondaryHex ? rgb2hsl(hex2rgb(secondaryHex)) : null;
  const tenantUsable = sec && sec.s >= 0.20 && hueGap(sec.h, brand.h) >= 55;

  if (tenantUsable) {
    accentH = sec.h; accentS = sec.s; accentL = sec.l; source = 'tenant secondary';
  } else if (achromatic) {
    accentH = 42; accentS = 0.70; accentL = 0.56; source = 'gold, brand has no hue';
  } else {
    // The brand's own complement, so a tenant with no second colour still gets
    // an accent tied to the one they do have.
    accentH = (brand.h + 185) % 360; accentS = 0.70; accentL = 0.56;
    source = 'rotated from brand';
  }
  // A generated hue was chosen at a legible lightness already, so it can be
  // held to 5.5. A tenant's real colour is worth bending the target to 4.5 for,
  // which is still ample: every accent here carries display type or a fill.
  const target = tenantUsable ? 4.5 : 5.5;

  let l = accentL, sat = accentS, ON_DARK = hsl(accentH, sat, l);
  while (contrast(ON_DARK, FIELD) < target && l < 0.84) {
    l += 0.03; sat = Math.min(0.80, sat + 0.045); ON_DARK = hsl(accentH, sat, l);
  }
  // Same hue driven DOWN for the pale ground rather than up.
  let dl = accentL, ds = accentS, ON_LIGHT = hsl(accentH, ds, dl);
  while (contrast(ON_LIGHT, LIFT) < 4.5 && dl > 0.16) {
    dl -= 0.03; ds = Math.min(0.90, ds + 0.045); ON_LIGHT = hsl(accentH, ds, dl);
  }

  return {
    FIELD, LINE, MUTED, PANEL, LIFT, LIFT_LINE, LIFT_INK, LIFT_BODY,
    ON_DARK, ON_LIGHT, source,
    onDarkRatio:  contrast(ON_DARK, FIELD).toFixed(1),
    onLightRatio: contrast(ON_LIGHT, LIFT).toFixed(1),
    textRatio:    contrast('#ffffff', FIELD).toFixed(1),
    inkRatio:     contrast(LIFT_INK, LIFT).toFixed(1),
    onAccentDark:  contrast('#ffffff', ON_DARK)  >= 4.5 ? '#ffffff' : FIELD,
    onAccentLight: contrast('#ffffff', ON_LIGHT) >= 4.5 ? '#ffffff' : LIFT,
  };
}

module.exports = { deriveTheme };
