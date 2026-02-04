import React from "react";
import Typography from "@material-ui/core/Typography";

export default function Title(props) {
	const { children, style, ...rest } = props || {};
	return (
		<Typography
			variant="h5"
			gutterBottom
			style={{
				color: "var(--tr-heading, var(--tr-primary))",
				fontWeight: 900,
				letterSpacing: "-0.01em",
				...(style || {}),
			}}
			{...rest}
		>
			{children}
		</Typography>
	);
}
