import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
    MaterialReactTable,
    type MRT_ColumnDef,
    type MRT_Row,
    type MRT_Cell,
    useMaterialReactTable,
} from "material-react-table";
import { Box, IconButton } from "@mui/material";
import { Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";

interface DateCellProps {
    date: number;
}

const DateCell: React.FC<DateCellProps> = ({ date }) => {
    return (
        <span>
            {date ? new Intl.DateTimeFormat("en", { day: "2-digit", year: "numeric", month: "short" }).format(new Date(date)): "-"}
        </span>
    );
};

interface RowData {
    id?: number;
    text: string;
    author: string;
    dateAdded: number;
    addedByUserName: string;
}

const QuoteList: React.FC = () => {
    const [quotelist, setQuotelist] = useState<RowData[]>([]);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        axios.get<RowData[]>("/api/quotes").then((response) => {
            setQuotelist(response.data);
        });
    }, []);

    const columns = useMemo<MRT_ColumnDef<RowData>[]>(
        () => [
            {
                accessorKey: "id",
                header: "ID",
                enableEditing: false,
                size: 80,
                grow: false
            },
            {
                accessorKey: "text",
                header: "Quote",
                grow: true,
                size: 200
            },
            {
                accessorKey: "author",
                header: "Author",
                size: 50,
            },
            {
                accessorKey: "addedByUserName",
                header: "Added by user",
                size: 50,
            },
            {
                accessorKey: "dateAdded",
                header: "Creation",
                size: 150,
                grow: false,
                Cell: ({ cell }: { cell: MRT_Cell<RowData> }) => <DateCell date={cell.getValue<number>()} />,
            },
        ],
        [],
    );

    const handleCreateRow = async ({ values, exitCreatingMode }: { 
        values: Record<string, any>;
        exitCreatingMode: () => void;
    }) => {
        const result = await axios.post<RowData>("/api/quotes/add", values);
        setQuotelist([...quotelist, result.data]);
        exitCreatingMode();
    };

    const handleSaveRow = async ({ row, values, exitEditingMode }: { 
        row: MRT_Row<RowData>;
        values: Record<string, any>;
        exitEditingMode: () => void;
    }) => {
        await axios.post("/api/quotes", values);
        const newList = [...quotelist];
        const index = newList.findIndex((item) => item.id === values.id);
        if (index !== -1) {
            newList[index] = values as RowData;
            setQuotelist([...newList]);
        }
        exitEditingMode();
    };

    const handleDeleteRow = async ({ row }: { row: MRT_Row<RowData> }) => {
        await axios.post("/api/quotes/delete", row.original);
        const newList = [...quotelist];
        const index = newList.findIndex((item) => item.id === row.original.id);
        if (index !== -1) {
            newList.splice(index, 1);
            setQuotelist([...newList]);
        }
    };

    const table = useMaterialReactTable({
        columns,
        data: quotelist,
        layoutMode: "grid",
        enableEditing: true,
        enableRowActions: true,
        positionActionsColumn: "last",
        enableDensityToggle: false,
        enableFilters: false,
        getRowId: (row: RowData) => row.id?.toString() ?? "",
        muiTablePaperProps: {
            elevation: 0,
        },
        displayColumnDefOptions: {
            "mrt-row-actions": {
                size: 120,
                grow: false
            },
        },
        renderRowActions: ({ row }: { row: MRT_Row<RowData> }) => (
            <Box>
                <IconButton onClick={() => table.setEditingRow(row)}>
                    <EditIcon />
                </IconButton>
                <IconButton onClick={() => handleDeleteRow({ row })}>
                    <DeleteIcon color="error" />
                </IconButton>
            </Box>
        ),
        onCreatingRowCancel: () => setValidationErrors({}),
        onCreatingRowSave: handleCreateRow,
        onEditingRowCancel: () => setValidationErrors({}),
        onEditingRowSave: handleSaveRow,
        initialState: {
            density: "compact",
            pagination: { pageSize: 50, pageIndex: 0 },
            showColumnFilters: false,
        },
        paginationDisplayMode: "pages",
        // Word wrap for "compact" mode
        muiTableBodyCellProps: {
            sx: {
                whiteSpace: 'normal',
                wordWrap: 'break-word',
            },
        },

    });

    return (
        <Box>
            <MaterialReactTable table={table} />
        </Box>
    );
};

export default QuoteList;