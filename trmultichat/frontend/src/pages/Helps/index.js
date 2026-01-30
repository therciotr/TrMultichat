import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  makeStyles,
  Typography,
  Modal,
  IconButton,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Chip,
} from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";
import YouTubeIcon from "@material-ui/icons/YouTube";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import useHelps from "../../hooks/useHelps";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = `1px solid ${theme.palette.divider}`;

  return ({
  gridWrap: {
    padding: theme.spacing(2),
  },
  helpCard: {
    height: "100%",
    borderRadius: 16,
    border,
    overflow: "hidden",
    boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.45)" : "0 1px 2px rgba(15, 23, 42, 0.06)",
    background: isDark
      ? "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.88) 100%)"
      : "linear-gradient(180deg, #FFFFFF 0%, #FBFCFE 100%)",
    transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
    "&:hover": {
      transform: "translateY(-1px)",
      borderColor: isDark ? "rgba(148,163,184,0.32)" : "rgba(15, 23, 42, 0.14)",
      boxShadow: isDark ? "0 12px 26px rgba(0,0,0,0.38)" : "0 12px 26px rgba(15, 23, 42, 0.12)",
    },
  },
  actionArea: {
    height: "100%",
    alignItems: "stretch",
  },
  thumb: {
    position: "relative",
    width: "100%",
    paddingTop: "56.25%", // 16:9
    background: isDark ? "rgba(148,163,184,0.10)" : "rgba(11, 76, 70, 0.06)",
    borderBottom: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
  },
  thumbImg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  thumbOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, rgba(0,0,0,0.00) 0%, rgba(0,0,0,0.22) 100%)",
  },
  playPill: {
    borderRadius: 999,
    padding: "6px 10px",
    background: isDark ? "rgba(15,23,42,0.75)" : "rgba(255,255,255,0.92)",
    color: theme.palette.text.primary,
    border,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  content: {
    padding: theme.spacing(2),
  },
  title: {
    fontWeight: 900,
    color: theme.palette.text.primary,
    lineHeight: 1.25,
  },
  desc: {
    marginTop: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 1.45,
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    minHeight: 56,
  },
  chips: {
    marginTop: theme.spacing(1.25),
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    borderRadius: 999,
    backgroundColor: isDark ? "rgba(148,163,184,0.10)" : "rgba(15, 23, 42, 0.03)",
  },
  videoModal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(2),
  },
  videoModalContent: {
    outline: "none",
    width: "100%",
    maxWidth: 1024,
    position: "relative",
    backgroundColor: theme.palette.background.paper,
    borderRadius: 16,
    overflow: "hidden",
    border,
    boxShadow: isDark ? "0 22px 60px rgba(0,0,0,0.55)" : "0 22px 60px rgba(15, 23, 42, 0.22)",
  },
  modalClose: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
    background: isDark ? "rgba(15,23,42,0.75)" : "rgba(255,255,255,0.92)",
    border,
  },
  modalRatio: {
    position: "relative",
    width: "100%",
    paddingTop: "56.25%",
    background: theme.palette.background.paper,
  },
  iframe: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: 0,
  },
  modalBody: {
    padding: theme.spacing(2.5),
  },
  emptyWrap: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(4),
    borderRadius: 16,
    border: `1px dashed ${theme.palette.divider}`,
    background: isDark ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    display: "block",
    margin: "0 auto 10px",
    color: isDark ? "rgba(148,163,184,0.35)" : "rgba(15, 23, 42, 0.22)",
  },
  emptyTitle: { fontWeight: 900, fontSize: 16, color: theme.palette.text.primary },
  emptySub: { color: theme.palette.text.secondary, fontSize: 13 },
})});

const Helps = () => {
  const classes = useStyles();
  const [records, setRecords] = useState([]);
  const { list } = useHelps();
  const [selectedHelp, setSelectedHelp] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const helps = await list();
        setRecords(Array.isArray(helps) ? helps : []);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openHelpModal = (help) => setSelectedHelp(help || null);

  const closeHelpModal = () => setSelectedHelp(null);

  const handleModalClose = useCallback((event) => {
    if (event.key === "Escape") {
      closeHelpModal();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleModalClose);
    return () => {
      document.removeEventListener("keydown", handleModalClose);
    };
  }, [handleModalClose]);

  const modalVideoId = useMemo(() => {
    const v = selectedHelp?.video ? String(selectedHelp.video).trim() : "";
    return v || "";
  }, [selectedHelp]);

  const renderVideoModal = () => {
    return (
      <Modal
        open={Boolean(selectedHelp)}
        onClose={closeHelpModal}
        className={classes.videoModal}
      >
        <div className={classes.videoModalContent}>
          <IconButton
            aria-label="Fechar"
            className={classes.modalClose}
            onClick={closeHelpModal}
            size="small"
          >
            <CloseIcon />
          </IconButton>

          {modalVideoId ? (
            <div className={classes.modalRatio}>
              <iframe
                className={classes.iframe}
                src={`https://www.youtube.com/embed/${modalVideoId}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className={classes.modalBody}>
              <Typography variant="h6" gutterBottom>
                {selectedHelp?.title || i18n.t("helps.title")}
              </Typography>
              {selectedHelp?.description ? (
                <Typography variant="body2" style={{ whiteSpace: "pre-wrap" }}>
                  {selectedHelp.description}
                </Typography>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Sem descrição.
                </Typography>
              )}
            </div>
          )}
        </div>
      </Modal>
    );
  };

  const renderHelps = () => {
    if (loading) {
      return (
        <Grid container spacing={2} className={classes.gridWrap}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Grid key={`sk-${idx}`} item xs={12} sm={6} md={4} lg={3}>
              <Card className={classes.helpCard} variant="outlined">
                <div className={classes.thumb} />
                <CardContent className={classes.content}>
                  <div style={{ height: 18, width: "70%", background: "rgba(15,23,42,0.10)", borderRadius: 8 }} />
                  <div style={{ height: 12, marginTop: 10, width: "90%", background: "rgba(15,23,42,0.06)", borderRadius: 8 }} />
                  <div style={{ height: 12, marginTop: 8, width: "80%", background: "rgba(15,23,42,0.06)", borderRadius: 8 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      );
    }

    if (!records.length) {
      return (
        <div className={classes.emptyWrap}>
          <HelpOutlineIcon className={classes.emptyIcon} />
          <Typography className={classes.emptyTitle}>
            {i18n.t("helps.title")}
          </Typography>
          <Typography className={classes.emptySub}>
            Nenhum conteúdo de ajuda disponível no momento.
          </Typography>
        </div>
      );
    }

    return (
      <Grid container spacing={2} className={classes.gridWrap}>
        {records.map((record, idx) => {
          const videoId = record?.video ? String(record.video).trim() : "";
          const hasVideo = Boolean(videoId);
          const title = record?.title || i18n.t("helps.title");
          const description = record?.description || "";
          return (
            <Grid key={record?.id || idx} item xs={12} sm={6} md={4} lg={3}>
              <Card className={classes.helpCard} variant="outlined">
                <CardActionArea
                  className={classes.actionArea}
                  onClick={() => openHelpModal(record)}
                  aria-label={`Abrir ajuda: ${title}`}
                >
                  <div className={classes.thumb}>
                    {hasVideo ? (
                      <img
                        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                        alt="Thumbnail"
                        className={classes.thumbImg}
                      />
                    ) : (
                      <div className={classes.thumbOverlay} style={{ background: "none" }}>
                        <div className={classes.playPill}>
                          <YouTubeIcon fontSize="small" style={{ opacity: 0.9 }} />
                          <span>Sem vídeo</span>
                        </div>
                      </div>
                    )}
                    {hasVideo && (
                      <div className={classes.thumbOverlay}>
                        <div className={classes.playPill}>
                          <PlayCircleOutlineIcon fontSize="small" />
                          <span>Assistir</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <CardContent className={classes.content}>
                    <Typography className={classes.title} variant="subtitle1" noWrap>
                      {title}
                    </Typography>
                    <Typography className={classes.desc}>
                      {description}
                    </Typography>
                    <div className={classes.chips}>
                      <Chip
                        className={classes.chip}
                        size="small"
                        icon={<YouTubeIcon style={{ fontSize: 16 }} />}
                        label={hasVideo ? "Vídeo" : "Conteúdo"}
                        variant="outlined"
                      />
                    </div>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("helps.title")} ({records.length})</Title>
        <MainHeaderButtonsWrapper></MainHeaderButtonsWrapper>
      </MainHeader>
      {renderHelps()}
      {renderVideoModal()}
    </MainContainer>
  );
};

export default Helps;