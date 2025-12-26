import React, { useState, useEffect, useCallback, useMemo } from "react";
import { makeStyles, Paper, Typography, Modal, IconButton } from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";
import YouTubeIcon from "@material-ui/icons/YouTube";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import useHelps from "../../hooks/useHelps";

const useStyles = makeStyles(theme => ({
  mainPaperContainer: {
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 200px)',
  },
  mainPaper: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: theme.spacing(3),
    padding: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  helpPaper: {
    position: 'relative',
    width: '100%',
    minHeight: '340px',
    padding: theme.spacing(2),
    boxShadow: theme.shadows[3],
    borderRadius: theme.spacing(1),
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    maxWidth: '340px',
  },
  paperHover: {
    transition: 'transform 0.3s, box-shadow 0.3s',
    '&:hover': {
      transform: 'scale(1.03)',
      boxShadow: `0 0 8px`,
      color: theme.palette.primary.main,
    },
  },
  videoThumbnail: {
    width: '100%',
    height: 'calc(100% - 56px)',
    objectFit: 'cover',
    borderRadius: `${theme.spacing(1)}px ${theme.spacing(1)}px 0 0`,
  },
  videoTitle: {
    marginTop: theme.spacing(1),
    flex: 1,
  },
  videoDescription: {
    maxHeight: '100px',
    overflow: 'hidden',
  },
  videoModal: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoModalContent: {
    outline: 'none',
    width: '90%',
    maxWidth: 1024,
    aspectRatio: '16/9',
    position: 'relative',
    backgroundColor: 'white',
    borderRadius: theme.spacing(1),
    overflow: 'hidden',
  },
  modalClose: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 2,
    background: "rgba(255,255,255,0.8)",
  },
  modalBody: {
    position: "absolute",
    inset: 0,
    padding: theme.spacing(2),
    overflowY: "auto",
  },
  emptyThumb: {
    width: "100%",
    height: "calc(100% - 56px)",
    borderRadius: `${theme.spacing(1)}px ${theme.spacing(1)}px 0 0`,
    background: theme.palette.action.hover,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.palette.text.secondary,
  },
}));

const Helps = () => {
  const classes = useStyles();
  const [records, setRecords] = useState([]);
  const { list } = useHelps();
  const [selectedHelp, setSelectedHelp] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const helps = await list();
      setRecords(helps);
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
            <iframe
              style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
              src={`https://www.youtube.com/embed/${modalVideoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
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
    return (
      <>
        <div className={`${classes.mainPaper} ${classes.mainPaperContainer}`}>
          {records.length ? records.map((record, key) => {
            const videoId = record?.video ? String(record.video).trim() : "";
            const hasVideo = Boolean(videoId);
            return (
            <Paper
              key={record?.id || key}
              className={`${classes.helpPaper} ${classes.paperHover}`}
              onClick={() => openHelpModal(record)}
              role="button"
            >
              {hasVideo ? (
                <img
                  src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                  alt="Thumbnail"
                  className={classes.videoThumbnail}
                />
              ) : (
                <div className={classes.emptyThumb}>
                  <YouTubeIcon style={{ marginRight: 8, opacity: 0.8 }} />
                  <Typography variant="caption">Sem vídeo</Typography>
                </div>
              )}
              <Typography variant="button" className={classes.videoTitle}>
                {record.title}
              </Typography>
              <Typography variant="caption" className={classes.videoDescription}>
                {record.description}
              </Typography>
            </Paper>
          )}) : null}
        </div>
      </>
    );
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("helps.title")} ({records.length})</Title>
        <MainHeaderButtonsWrapper></MainHeaderButtonsWrapper>
      </MainHeader>
      <div className={classes.mainPaper}>
        {renderHelps()}
      </div>
      {renderVideoModal()}
    </MainContainer>
  );
};

export default Helps;