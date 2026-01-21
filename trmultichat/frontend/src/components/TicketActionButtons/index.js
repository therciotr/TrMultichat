import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { IconButton } from "@material-ui/core";
import { MoreVert, Replay } from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
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
			marginRight: theme.spacing(1),
			marginLeft: theme.spacing(1),
		},
	},
}));

const TicketActionButtons = ({ ticket }) => {
	const classes = useStyles();
	const history = useHistory();
	const [anchorEl, setAnchorEl] = useState(null);
	const [loading, setLoading] = useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const ticketOptionsMenuOpen = Boolean(anchorEl);
	const { user } = useContext(AuthContext);

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
			});

			setLoading(false);
			if (status === "open") {
				history.push(`/tickets/${ticket.id}`);
			} else {
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
			try { toast.success("Ticket excluído com sucesso."); } catch {}
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
						<IconButton onClick={() => setDeleteConfirmOpen(true)}>
							<DeleteOutlineIcon />
						</IconButton>
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
					<ButtonWithSpinner
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
					</ButtonWithSpinner>
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
						<IconButton onClick={() => setDeleteConfirmOpen(true)}>
							<DeleteOutlineIcon />
						</IconButton>
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

export default TicketActionButtons;