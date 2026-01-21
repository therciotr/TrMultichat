import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles, createTheme, ThemeProvider } from "@material-ui/core/styles";
import { IconButton } from "@material-ui/core";
import { MoreVert, Replay } from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import UndoRoundedIcon from '@material-ui/icons/UndoRounded';
import Tooltip from '@material-ui/core/Tooltip';
import { green } from '@material-ui/core/colors';
import { Can } from "../Can";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import ConfirmationModal from "../ConfirmationModal";
import { toast } from "react-toastify";


const useStyles = makeStyles(theme => ({
	actionButtons: {
		marginRight: 6,
		flex: "none",
		alignSelf: "center",
		marginLeft: "auto",
		"& > *": {
			margin: theme.spacing(0.5),
		},
	},
}));

const TicketActionButtonsCustom = ({ ticket }) => {
	const classes = useStyles();
	const history = useHistory();
	const [anchorEl, setAnchorEl] = useState(null);
	const [loading, setLoading] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const ticketOptionsMenuOpen = Boolean(anchorEl);
	const { user } = useContext(AuthContext);
	const { setCurrentTicket } = useContext(TicketsContext);

	const customTheme = createTheme({
		palette: {
		  	primary: green,
		}
	});

	const handleOpenTicketOptionsMenu = e => {
		setAnchorEl(e.currentTarget);
	};

	const handleCloseTicketOptionsMenu = e => {
		setAnchorEl(null);
	};

	const handleUpdateTicketStatus = async (e, status, userId) => {
		setLoading(true);
		try {
			await api.put(`/tickets/${ticket.id}`, {
				status: status,
				userId: userId || null,
				useIntegration: status === "closed" ? false : ticket.useIntegration,
				promptId: status === "closed" ? false : ticket.promptId,
				integrationId: status === "closed" ? false : ticket.integrationId
			});

			setLoading(false);
			if (status === "open") {
				setCurrentTicket({ ...ticket, code: "#open" });
			} else {
				setCurrentTicket({ id: null, code: null })
				history.push("/tickets");
			}
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
	};

	const isAdmin = String(user?.profile || "").toLowerCase() === "admin" || String(user?.profile || "").toLowerCase() === "super" || Boolean(user?.admin);

	const handleDeleteTicket = async () => {
		setLoading(true);
		try {
			await api.delete(`/tickets/${ticket.id}`);
			setLoading(false);
			setDeleteConfirmOpen(false);
			try {
				toast.success("Ticket excluído com sucesso.");
			} catch {}
			setCurrentTicket({ id: null, code: null });
			history.push("/tickets");
		} catch (err) {
			setLoading(false);
			setDeleteConfirmOpen(false);
			toastError(err);
		}
	};

	return (
		<div className={classes.actionButtons}>
			{ticket.status === "closed" && (
				<>
					<ButtonWithSpinner
						loading={loading}
						startIcon={<Replay />}
						size="small"
						onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
					>
						{i18n.t("messagesList.header.buttons.reopen")}
					</ButtonWithSpinner>
					{isAdmin && (
						<Tooltip title="Excluir ticket">
							<IconButton onClick={() => setDeleteConfirmOpen(true)}>
								<DeleteOutlineIcon />
							</IconButton>
						</Tooltip>
					)}
					{/* Admin can access options (delete) on closed tickets too */}
					{isAdmin && (
						<>
							<IconButton onClick={handleOpenTicketOptionsMenu}>
								<MoreVert />
							</IconButton>
							<TicketOptionsMenu
								ticket={ticket}
								anchorEl={anchorEl}
								menuOpen={ticketOptionsMenuOpen}
								handleClose={handleCloseTicketOptionsMenu}
							/>
						</>
					)}
				</>
			)}
			{ticket.status === "open" && (
				<>
					<Tooltip title={i18n.t("messagesList.header.buttons.return")}>
						<IconButton onClick={e => handleUpdateTicketStatus(e, "pending", null)}>
							<UndoRoundedIcon />
						</IconButton>
					</Tooltip>
					<ThemeProvider theme={customTheme}>
						<Tooltip title={i18n.t("messagesList.header.buttons.resolve")}>
							<IconButton onClick={e => handleUpdateTicketStatus(e, "closed", user?.id)} color="primary">
								<CheckCircleIcon />
							</IconButton>
						</Tooltip>
					</ThemeProvider>
					{isAdmin && (
						<Tooltip title="Excluir ticket">
							<IconButton onClick={() => setDeleteConfirmOpen(true)}>
								<DeleteOutlineIcon />
							</IconButton>
						</Tooltip>
					)}
					{/* <ButtonWithSpinner
						loading={loading}
						startIcon={<Replay />}
						size="small"
						onClick={e => handleUpdateTicketStatus(e, "pending", null)}
					>
						{i18n.t("messagesList.header.buttons.return")}
					</ButtonWithSpinner>
					<ButtonWithSpinner
						loading={loading}
						size="small"
						variant="contained"
						color="primary"
						onClick={e => handleUpdateTicketStatus(e, "closed", user?.id)}
					>
						{i18n.t("messagesList.header.buttons.resolve")}
					</ButtonWithSpinner> */}
					<IconButton onClick={handleOpenTicketOptionsMenu}>
						<MoreVert />
					</IconButton>
					<TicketOptionsMenu
						ticket={ticket}
						anchorEl={anchorEl}
						menuOpen={ticketOptionsMenuOpen}
						handleClose={handleCloseTicketOptionsMenu}
					/>
				</>
			)}
			{ticket.status === "pending" && (
				<>
					<ButtonWithSpinner
						loading={loading}
						size="small"
						variant="contained"
						color="primary"
						onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
					>
						{i18n.t("messagesList.header.buttons.accept")}
					</ButtonWithSpinner>
					{isAdmin && (
						<Tooltip title="Excluir ticket">
							<IconButton onClick={() => setDeleteConfirmOpen(true)}>
								<DeleteOutlineIcon />
							</IconButton>
						</Tooltip>
					)}
					{/* Allow admins to open options (delete) even while pending */}
					<Can
						role={user?.profile || "user"}
						perform="ticket-options:deleteTicket"
						yes={() => (
							<IconButton onClick={handleOpenTicketOptionsMenu}>
								<MoreVert />
							</IconButton>
						)}
					/>
					<TicketOptionsMenu
						ticket={ticket}
						anchorEl={anchorEl}
						menuOpen={ticketOptionsMenuOpen}
						handleClose={handleCloseTicketOptionsMenu}
					/>
				</>
			)}
			<ConfirmationModal
				title={`Excluir o ticket #${ticket?.id}?`}
				open={deleteConfirmOpen}
				onClose={setDeleteConfirmOpen}
				onConfirm={handleDeleteTicket}
			>
				Essa ação é permanente e remove mensagens/anotações relacionadas.
			</ConfirmationModal>
		</div>
	);
};

export default TicketActionButtonsCustom;
