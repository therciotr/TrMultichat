import React from "react";
import { TableHead, TableRow, TableCell } from "@material-ui/core";

// Usage A: <TrTableHeader columns={["Nome", "Status"]} align="center" />
// Usage B: <TrTableHeader><TableRow>...</TableRow></TrTableHeader>
const TrTableHeader = ({ columns, align = "center", children }) => {
  const styleHead = { backgroundColor: "var(--tr-heading-soft, rgba(11, 76, 70, 0.06))" };
  const styleCell = { color: "var(--tr-heading, var(--tr-primary))", fontWeight: 600 };
  if (Array.isArray(columns) && columns.length > 0) {
    return (
      <TableHead style={styleHead}>
        <TableRow>
          {columns.map((c, idx) => (
            <TableCell key={idx} align={align} style={styleCell}>{c}</TableCell>
          ))}
        </TableRow>
      </TableHead>
    );
  }
  return <TableHead style={styleHead}>{children}</TableHead>;
};

export default TrTableHeader;





