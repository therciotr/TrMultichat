import React from "react";
import { TrButton } from "../ui";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";

const ConfirmationModal = ({ title, children, open, onClose, onConfirm }) => {
	return (
		<Dialog
			open={open}
			onClose={() => onClose(false)}
			aria-labelledby="confirm-dialog"
		>
			<DialogTitle id="confirm-dialog">{title}</DialogTitle>
			<DialogContent dividers>
				<Typography>{children}</Typography>
			</DialogContent>
			<DialogActions>
				<TrButton onClick={() => onClose(false)}>
					{i18n.t("confirmationModal.buttons.cancel")}
				</TrButton>
				<TrButton onClick={() => { onClose(false); onConfirm(); }}>
					{i18n.t("confirmationModal.buttons.confirm")}
				</TrButton>
			</DialogActions>
		</Dialog>
	);
};

export default ConfirmationModal;
