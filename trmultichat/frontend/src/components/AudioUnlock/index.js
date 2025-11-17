import React, { useEffect, useState, useCallback } from "react";
import { makeStyles, Card, CardContent, Button } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  container: {
    position: "fixed",
    bottom: theme.spacing(2),
    right: theme.spacing(2),
    zIndex: 1300,
  },
  card: {
    borderRadius: 12,
    background: theme.palette.background.paper,
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
  },
}));

function createSilentBuffer(context) {
  const channels = 1;
  const frameCount = context.sampleRate * 0.05; // 50ms silent click
  const buffer = context.createBuffer(channels, frameCount, context.sampleRate);
  return buffer;
}

export default function AudioUnlock() {
  const classes = useStyles();
  const [needsUnlock, setNeedsUnlock] = useState(false);

  useEffect(() => {
    try {
      const prev = localStorage.getItem("audioUnlocked") === "1";
      // If browser doesn't support AudioContext, skip
      // eslint-disable-next-line no-undef
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      // If previously unlocked, skip UI
      if (prev) return;
      const ctx = new Ctx();
      if (ctx.state !== "running") {
        setNeedsUnlock(true);
      } else {
        localStorage.setItem("audioUnlocked", "1");
      }
      ctx.close().catch(() => {});
    } catch (_) {}
  }, []);

  const performUnlock = useCallback(async () => {
    try {
      // eslint-disable-next-line no-undef
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        setNeedsUnlock(false);
        return;
      }
      const ctx = new Ctx();
      const source = ctx.createBufferSource();
      source.buffer = createSilentBuffer(ctx);
      source.connect(ctx.destination);
      source.start(0);
      if (ctx.state !== "running") {
        await ctx.resume();
      }
      // small timeout to ensure start completes
      setTimeout(() => {
        try { source.disconnect(); } catch (e) {}
        try { ctx.close(); } catch (e) {}
      }, 100);
      localStorage.setItem("audioUnlocked", "1");
      setNeedsUnlock(false);
    } catch (_) {
      // Keep button visible for retry
      setNeedsUnlock(true);
    }
  }, []);

  if (!needsUnlock) return null;

  return (
    <div className={classes.container}>
      <Card className={classes.card} elevation={6}>
        <CardContent style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>Para habilitar sons, clique em “Ativar som”.</div>
          <Button variant="contained" color="primary" onClick={performUnlock}>
            Ativar som
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


