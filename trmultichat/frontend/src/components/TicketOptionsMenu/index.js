import React, { useContext, useEffect, useRef, useState, useMemo } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import MenuItem from "@material-ui/core/MenuItem";
import Menu from "@material-ui/core/Menu";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ConfirmationModal from "../ConfirmationModal";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import toastError from "../../errors/toastError";
import { Can } from "../Can";
import { AuthContext } from "../../context/Auth/AuthContext";

import ScheduleModal from "../ScheduleModal";

const TicketOptionsMenu = ({ ticket, menuOpen, handleClose, anchorEl }) => {
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
	const isMounted = useRef(true);
	const { user } = useContext(AuthContext);
	const history = useHistory();

	const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
	const [contactId, setContactId] = useState(null);

	const isAdmin = useMemo(() => {
		const profile = String(user?.profile || "").toLowerCase();
		return Boolean(user?.admin) || profile === "admin" || profile === "super";
	}, [user]);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	const handleDeleteTicket = async () => {
		try {
			await api.delete(`/tickets/${ticket.id}`);
			toast.success(i18n.t("ticketOptionsMenu.deleteSuccess") || "Ticket excluído com sucesso.");
			// If user is currently inside the ticket, go back to list
			try {
				history.push("/tickets");
			} catch {}
		} catch (err) {
			toastError(err);
		}
	};

	const handleOpenConfirmationModal = e => {
		setConfirmationOpen(true);
		handleClose();
	};

	const handleOpenTransferModal = e => {
		setTransferTicketModalOpen(true);
		handleClose();
	};

	const handleCloseTransferTicketModal = () => {
		if (isMounted.current) {
			setTransferTicketModalOpen(false);
		}
	};

	const handleOpenScheduleModal = () => {
		handleClose();
		setContactId(ticket?.contact?.id || null);
		setScheduleModalOpen(true);
	}

	const handleCloseScheduleModal = () => {
		setScheduleModalOpen(false);
		setContactId(null);
	}

	return (
		<>
			<Menu
				id="menu-appbar"
				anchorEl={anchorEl}
				getContentAnchorEl={null}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				keepMounted
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				open={menuOpen}
				onClose={handleClose}
			>
				<MenuItem onClick={handleOpenScheduleModal}>
					{i18n.t("ticketOptionsMenu.schedule")}
				</MenuItem>
				<MenuItem onClick={handleOpenTransferModal}>
					{i18n.t("ticketOptionsMenu.transfer")}
				</MenuItem>
				{/* Admin-friendly delete: show for admin even if permission matrix is misconfigured */}
				{isAdmin ? (
					<MenuItem onClick={handleOpenConfirmationModal}>
						{i18n.t("ticketOptionsMenu.delete")}
					</MenuItem>
				) : (
					<Can
						role={user?.profile || "user"}
						perform="ticket-options:deleteTicket"
						yes={() => (
							<MenuItem onClick={handleOpenConfirmationModal}>
								{i18n.t("ticketOptionsMenu.delete")}
							</MenuItem>
						)}
					/>
				)}
			</Menu>
			<ConfirmationModal
				title={`${i18n.t("ticketOptionsMenu.confirmationModal.title")}${
					ticket.id
				} ${i18n.t("ticketOptionsMenu.confirmationModal.titleFrom")} ${
					ticket?.contact?.name || "-"
				}?`}
				open={confirmationOpen}
				onClose={setConfirmationOpen}
				onConfirm={handleDeleteTicket}
			>
				{i18n.t("ticketOptionsMenu.confirmationModal.message")}
			</ConfirmationModal>
			<TransferTicketModalCustom
				modalOpen={transferTicketModalOpen}
				onClose={handleCloseTransferTicketModal}
				ticketid={ticket.id}
			/>
			<ScheduleModal
				open={scheduleModalOpen}
				onClose={handleCloseScheduleModal}
				aria-labelledby="form-dialog-title"
				contactId={contactId}
			/>
		</>
	);
};

export default TicketOptionsMenu;