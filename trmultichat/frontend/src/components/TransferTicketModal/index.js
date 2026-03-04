import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";

import { TrButton } from "../ui";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";

const TransferTicketModal = ({ modalOpen, onClose, ticketid }) => {
	const history = useHistory();
	const [options, setOptions] = useState([]);
	const [loading, setLoading] = useState(false);
	const [selectedUserId, setSelectedUserId] = useState("");

	useEffect(() => {
		if (!modalOpen) return;
		setLoading(true);
		const fetchUsers = async () => {
			try {
				const { data } = await api.get("/users/list");
				setOptions(Array.isArray(data) ? data : []);
			} catch (err) {
				toastError(err);
				setOptions([]);
			} finally {
				setLoading(false);
			}
		};
		fetchUsers();
	}, [modalOpen]);

	const handleClose = () => {
		onClose();
		setSelectedUserId("");
	};

	const handleSaveTicket = async e => {
		e.preventDefault();
		if (!ticketid || !selectedUserId) return;
		setLoading(true);
		try {
			await api.put(`/tickets/${ticketid}`, {
				userId: selectedUserId,
				queueId: null,
				status: "open",
			});
			setLoading(false);
			history.push(`/tickets`);
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
	};

	return (
		<Dialog open={modalOpen} onClose={handleClose} maxWidth="lg" scroll="paper">
			<form onSubmit={handleSaveTicket}>
				<DialogTitle id="form-dialog-title">
					{i18n.t("transferTicketModal.title")}
				</DialogTitle>
				<DialogContent dividers>
					<FormControl variant="outlined" style={{ width: 300 }}>
						<InputLabel>{i18n.t("transferTicketModal.fieldLabel")}</InputLabel>
						<Select
							autoFocus
							required
							value={selectedUserId}
							onChange={(e) => setSelectedUserId(e.target.value)}
							label={i18n.t("transferTicketModal.fieldLabel")}
						>
							{options.map((u) => (
								<MenuItem key={u.id} value={u.id}>
									{u.name}
								</MenuItem>
							))}
						</Select>
					</FormControl>
				</DialogContent>
				<DialogActions>
					<TrButton onClick={handleClose} disabled={loading}>
						{i18n.t("transferTicketModal.buttons.cancel")}
					</TrButton>
					<ButtonWithSpinner
						type="submit"
						loading={loading}
					>
						{i18n.t("transferTicketModal.buttons.ok")}
					</ButtonWithSpinner>
				</DialogActions>
			</form>
		</Dialog>
	);
};

export default TransferTicketModal;
