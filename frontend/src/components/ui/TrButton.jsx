import React from "react";
import { Button } from "@material-ui/core";
import { withStyles } from "@material-ui/core/styles";
import { useThemeBranding } from "../../context/ThemeContext";

function darken(hex, amount = 0.15) {
  try {
    const h = hex.replace('#','');
    const bigint = parseInt(h.length === 3 ? h.split('').map(x=>x+x).join('') : h, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;
    r = Math.max(0, Math.min(255, Math.floor(r * (1-amount))));
    g = Math.max(0, Math.min(255, Math.floor(g * (1-amount))));
    b = Math.max(0, Math.min(255, Math.floor(b * (1-amount))));
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch (_) {
    return hex;
  }
}

const TrButtonBase = ({ classes, children, ...rest }) => {
  const { branding } = useThemeBranding();
  const bg = branding.buttonColor || branding.primaryColor || '#2BA9A5';
  const hv = darken(bg, 0.12);
  return (
    <Button
      className={classes.root}
      style={{ background: bg, color: '#fff' }}
      onMouseOver={(e) => { e.currentTarget.style.background = hv; }}
      onMouseOut={(e) => { e.currentTarget.style.background = bg; }}
      {...rest}
    >
      {children}
    </Button>
  );
};

export default withStyles(() => ({ root: { textTransform: 'none', borderRadius: 'var(--tr-radius, 12px)' } }))(TrButtonBase);





