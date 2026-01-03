import React, { useState, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
	Box,
	Chip,
	Grid,
	IconButton,
	Paper,
	Tooltip,
	Typography,
	CircularProgress,
} from "@material-ui/core";
import { TrButton } from "../../components/ui";
import {
	Edit,
	CheckCircle,
	SignalCellularConnectedNoInternet2Bar,
	SignalCellularConnectedNoInternet0Bar,
	SignalCellular4Bar,
	CropFree,
	DeleteOutline,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import QrcodeIcon from "@material-ui/icons/CropFree";
import RefreshIcon from "@material-ui/icons/Autorenew";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(2),
		overflowY: "auto",
		...theme.scrollbarStyles,
	},
	customStatusCell: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	tooltip: {
		backgroundColor: "#f5f5f9",
		color: "rgba(0, 0, 0, 0.87)",
		fontSize: theme.typography.pxToRem(14),
		border: "1px solid #dadde9",
		maxWidth: 450,
	},
	tooltipPopper: {
		textAlign: "center",
	},
	buttonProgress: {
		color: green[500],
	},
	card: {
		padding: theme.spacing(2),
		borderRadius: 14,
		border: "1px solid rgba(11, 76, 70, 0.18)",
		background:
			"linear-gradient(180deg, rgba(11, 76, 70, 0.045), rgba(255,255,255,1) 42%)",
		height: "100%",
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(1.25),
		minWidth: 0,
	},
	cardHeader: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing(1),
	},
	cardTitle: {
		fontWeight: 800,
		color: "var(--tr-primary)",
		minWidth: 0,
	},
	cardMeta: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: theme.spacing(1),
	},
	actionsRow: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: theme.spacing(1),
	},
	emptyState: {
		padding: theme.spacing(4),
		textAlign: "center",
		color: theme.palette.text.secondary,
	},
}));

const CustomToolTip = ({ title, content, children }) => {
	const classes = useStyles();

	return (
		<Tooltip
			arrow
			classes={{
				tooltip: classes.tooltip,
				popper: classes.tooltipPopper,
			}}
			title={
				<React.Fragment>
					<Typography gutterBottom color="inherit">
						{title}
					</Typography>
					{content && <Typography>{content}</Typography>}
				</React.Fragment>
			}
		>
			{children}
		</Tooltip>
	);
};

const Connections = () => {
	const classes = useStyles();

	const { user } = useContext(AuthContext);
	const { whatsApps, loading } = useContext(WhatsAppsContext);
	const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
	const [qrModalOpen, setQrModalOpen] = useState(false);
	const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const confirmationModalInitialState = {
		action: "",
		title: "",
		message: "",
		whatsAppId: "",
		open: false,
	};
	const [confirmModalInfo, setConfirmModalInfo] = useState(
		confirmationModalInitialState
	);

	const handleStartWhatsAppSession = async whatsAppId => {
		try {
			// Gerar/reiniciar sessão para obter QR Code (método correto: PUT)
			await api.put(`/whatsappsession/${whatsAppId}`);
			setSelectedWhatsApp({ id: whatsAppId });
			setQrModalOpen(true);
		} catch (err) {
			toastError(err);
		}
	};

	const handleRequestNewQrCode = async whatsAppId => {
		try {
			await api.put(`/whatsappsession/${whatsAppId}`);
			setSelectedWhatsApp({ id: whatsAppId });
			setQrModalOpen(true);
		} catch (err) {
			toastError(err);
		}
	};

	const handleOpenWhatsAppModal = () => {
		setSelectedWhatsApp(null);
		setWhatsAppModalOpen(true);
	};

	const handleCloseWhatsAppModal = useCallback(() => {
		setWhatsAppModalOpen(false);
		setSelectedWhatsApp(null);
	}, [setSelectedWhatsApp, setWhatsAppModalOpen]);

	const handleOpenQrModal = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setQrModalOpen(true);
	};

	const handleCloseQrModal = useCallback(() => {
		setSelectedWhatsApp(null);
		setQrModalOpen(false);
	}, [setQrModalOpen, setSelectedWhatsApp]);

	const handleEditWhatsApp = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setWhatsAppModalOpen(true);
	};

	const handleOpenConfirmationModal = (action, whatsAppId) => {
		if (action === "disconnect") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.disconnectTitle"),
				message: i18n.t("connections.confirmationModal.disconnectMessage"),
				whatsAppId: whatsAppId,
			});
		}

		if (action === "delete") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.deleteTitle"),
				message: i18n.t("connections.confirmationModal.deleteMessage"),
				whatsAppId: whatsAppId,
			});
		}
		setConfirmModalOpen(true);
	};

	const handleSubmitConfirmationModal = async () => {
		if (confirmModalInfo.action === "disconnect") {
			try {
				await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
			} catch (err) {
				toastError(err);
			}
		}

		if (confirmModalInfo.action === "delete") {
			try {
				await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
				toast.success(i18n.t("connections.toasts.deleted"));
			} catch (err) {
				toastError(err);
			}
		}

		setConfirmModalInfo(confirmationModalInitialState);
	};

	const renderActionButtons = whatsApp => {
		return (
			<>
				{whatsApp.status === "qrcode" && (
					<TrButton size="small" startIcon={<QrcodeIcon />} onClick={() => handleOpenQrModal(whatsApp)}>
						{i18n.t("connections.buttons.qrcode")}
					</TrButton>
				)}
				{whatsApp.status === "DISCONNECTED" && (
					<>
						<TrButton size="small" startIcon={<RefreshIcon />} onClick={() => handleStartWhatsAppSession(whatsApp.id)}>
							{i18n.t("connections.buttons.tryAgain")}
						</TrButton>{" "}
						<TrButton size="small" startIcon={<QrcodeIcon />} onClick={() => handleRequestNewQrCode(whatsApp.id)}>
							{i18n.t("connections.buttons.newQr")}
						</TrButton>
					</>
				)}
				{(whatsApp.status === "CONNECTED" ||
					whatsApp.status === "PAIRING" ||
					whatsApp.status === "TIMEOUT") && (
					<TrButton size="small" onClick={() => { handleOpenConfirmationModal("disconnect", whatsApp.id); }}>
						{i18n.t("connections.buttons.disconnect")}
					</TrButton>
				)}
				{whatsApp.status === "OPENING" && (
					<TrButton size="small" disabled>
						{i18n.t("connections.buttons.connecting")}
					</TrButton>
				)}
			</>
		);
	};

	const renderStatusToolTips = whatsApp => {
		return (
			<div className={classes.customStatusCell}>
				{whatsApp.status === "DISCONNECTED" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.disconnected.title")}
						content={i18n.t("connections.toolTips.disconnected.content")}
					>
						<SignalCellularConnectedNoInternet0Bar color="secondary" />
					</CustomToolTip>
				)}
				{whatsApp.status === "OPENING" && (
					<CircularProgress size={24} className={classes.buttonProgress} />
				)}
				{whatsApp.status === "qrcode" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.qrcode.title")}
						content={i18n.t("connections.toolTips.qrcode.content")}
					>
						<CropFree />
					</CustomToolTip>
				)}
				{whatsApp.status === "CONNECTED" && (
					<CustomToolTip title={i18n.t("connections.toolTips.connected.title")}>
						<SignalCellular4Bar style={{ color: green[500] }} />
					</CustomToolTip>
				)}
				{(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.timeout.title")}
						content={i18n.t("connections.toolTips.timeout.content")}
					>
						<SignalCellularConnectedNoInternet2Bar color="secondary" />
					</CustomToolTip>
				)}
			</div>
		);
	};

	const renderStatusChip = (whatsApp) => {
		const status = String(whatsApp?.status || "").toUpperCase();
		let label = status || "—";
		if (status === "QRCODE") label = "QR Code";
		if (status === "CONNECTED") label = "Conectado";
		if (status === "DISCONNECTED") label = "Desconectado";
		if (status === "OPENING") label = "Conectando";
		if (status === "PAIRING") label = "Pareando";
		if (status === "TIMEOUT") label = "Timeout";

		const isGood = status === "CONNECTED";
		const isWarn = status === "QRCODE" || status === "PAIRING" || status === "TIMEOUT";
		const bg = isGood
			? "rgba(46, 125, 50, 0.12)"
			: isWarn
			? "rgba(245, 124, 0, 0.12)"
			: "rgba(211, 47, 47, 0.10)";
		const color = isGood
			? "#2e7d32"
			: isWarn
			? "#f57c00"
			: "#d32f2f";

		return (
			<Chip
				size="small"
				label={label}
				style={{
					background: bg,
					color,
					fontWeight: 800,
				}}
			/>
		);
	};

	return (
		<MainContainer>
			<ConfirmationModal
				title={confirmModalInfo.title}
				open={confirmModalOpen}
				onClose={setConfirmModalOpen}
				onConfirm={handleSubmitConfirmationModal}
			>
				{confirmModalInfo.message}
			</ConfirmationModal>
			<QrcodeModal
				open={qrModalOpen}
				onClose={handleCloseQrModal}
				whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
			/>
			<WhatsAppModal
				open={whatsAppModalOpen}
				onClose={handleCloseWhatsAppModal}
				whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
			/>
			<MainHeader>
				<Title>{i18n.t("connections.title")}</Title>
				<MainHeaderButtonsWrapper>
					<Can
						role={user?.profile || "user"}
						perform="connections-page:addConnection"
						yes={() => (
							<TrButton onClick={handleOpenWhatsAppModal}>
								{i18n.t("connections.buttons.add")}
							</TrButton>
						)}
					/>
				</MainHeaderButtonsWrapper>
			</MainHeader>
			<Paper className={`${classes.mainPaper} tr-card-border`} variant="outlined">
				{loading && (
					<Box className={classes.emptyState}>
						<Typography variant="body2">Carregando conexões...</Typography>
					</Box>
				)}

				{!loading && (!whatsApps || whatsApps.length === 0) && (
					<Box className={classes.emptyState}>
						<Typography variant="h6" style={{ fontWeight: 800, color: "var(--tr-primary)" }}>
							Nenhuma conexão cadastrada
						</Typography>
						<Typography variant="body2" style={{ marginTop: 8 }}>
							Clique em <b>Adicionar WhatsApp</b> para criar sua primeira conexão.
						</Typography>
						<Box style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
							<Can
								role={user?.profile || "user"}
								perform="connections-page:addConnection"
								yes={() => (
									<TrButton onClick={handleOpenWhatsAppModal}>
										{i18n.t("connections.buttons.add")}
									</TrButton>
								)}
							/>
						</Box>
					</Box>
				)}

				{!loading && whatsApps && whatsApps.length > 0 && (
					<Grid container spacing={2}>
						{whatsApps.map((whatsApp) => (
							<Grid key={whatsApp.id} item xs={12} sm={6} md={4} lg={3}>
								<Paper className={classes.card} variant="outlined">
									<div className={classes.cardHeader}>
										<Box style={{ minWidth: 0 }}>
											<Typography className={classes.cardTitle} variant="subtitle1" noWrap>
												{whatsApp.name}
											</Typography>
											<Box className={classes.cardMeta} style={{ marginTop: 6 }}>
												{renderStatusChip(whatsApp)}
												{whatsApp.isDefault && (
													<Chip
														size="small"
														icon={<CheckCircle style={{ color: green[500] }} />}
														label="Padrão"
														style={{ fontWeight: 800 }}
													/>
												)}
											</Box>
										</Box>

										<Box style={{ display: "flex", alignItems: "center", gap: 4 }}>
											{renderStatusToolTips(whatsApp)}
											<Can
												role={user?.profile || "user"}
												perform="connections-page:editOrDeleteConnection"
												yes={() => (
													<>
														<Tooltip title="Editar">
															<IconButton size="small" onClick={() => handleEditWhatsApp(whatsApp)}>
																<Edit />
															</IconButton>
														</Tooltip>
														<Tooltip title="Excluir">
															<IconButton
																size="small"
																onClick={() => handleOpenConfirmationModal("delete", whatsApp.id)}
															>
																<DeleteOutline />
															</IconButton>
														</Tooltip>
													</>
												)}
											/>
										</Box>
									</div>

									<Typography variant="caption" color="textSecondary" style={{ fontWeight: 800 }}>
										Última atualização
									</Typography>
									<Typography variant="body2">
										{whatsApp.updatedAt
											? format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")
											: "-"}
									</Typography>

									<Can
										role={user?.profile || "user"}
										perform="connections-page:actionButtons"
										yes={() => (
											<Box className={classes.actionsRow} style={{ marginTop: 8 }}>
												{renderActionButtons(whatsApp)}
											</Box>
										)}
									/>
								</Paper>
							</Grid>
						))}
					</Grid>
				)}
			</Paper>
		</MainContainer>
	);
};

export default Connections;
