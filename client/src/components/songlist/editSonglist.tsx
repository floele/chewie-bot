import React, { useEffect, useState } from "react";
import { makeStyles } from "tss-react/mui";
import axios from "axios";
import {
    Grid, TextField, Button, Box, Card,
    Popover, ThemeProvider, Tabs, Tab, Chip, Theme, createTheme
} from "@mui/material";
import { Autocomplete } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { ArrowDownward, ArrowUpward, Edit, Delete, Add, Attribution } from "@mui/icons-material";
import {
    MaterialReactTable,
    useMaterialReactTable,
} from 'material-react-table';

// Use "condensed" display for rows
const createCondensedTheme = (theme: any) => createTheme(theme, {
    components: {
        MuiTableCell: {
            styleOverrides: {
                root: {
                    padding: "0 16px",
                }
            }
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    padding: "6px 8px",
                }
            }
        },
        MuiInputBase: {
            styleOverrides: {
                root: {
                    fontSize: "13px",
                }
            }
        }
    }
});

const useStyles = makeStyles()((theme: Theme) => ({
    addButton: {
        margin: theme.spacing(2, 0, 2),
    },
    tableContainer: {
        marginTop: theme.spacing(2)
    },
    tagContainer: {
        display: "flex",
        flexWrap: "wrap",
        listStyle: "none",
        margin: 0,
      },
    chip: {
        margin: theme.spacing(0.5),
    },
}));

const EditSonglist: React.FC<any> = (props: any) => {
    type RowData = {
        id: number, title: string, album: string, artist: string, categoryId: number,
        created: number, attributedUserId?: number, attributedUsername: string, songTags: string[]
    };
    type CategoryData = { id: number, name: string, sortOrder: number };
    type TagData = { id: number, name: string };
    type AutocompleteUser = { username: string, id: number };

    const { classes } = useStyles();
    const [songlist, setSonglist] = useState([] as RowData[]);
    const [categories, setCategories] = useState([] as CategoryData[]);
    const [tags, setTags] = useState([] as TagData[]);
    const [userlist, setUserlist] = useState([] as AutocompleteUser[]);
    const [selectedTab, setSelectedTab] = useState(0);

    const [popupAnchor, setPopupAnchor] = useState<HTMLElement | undefined>(undefined);
    const [currentRowForAction, setCurrentRowForAction] = useState<RowData>();
    const open = Boolean(popupAnchor);

    const [attributedUser, setAttributedUser] = useState<AutocompleteUser | null>(null);

    useEffect(() => {
        axios.get("/api/songlist").then((response) => {
            const results  = response.data as RowData[];
            setSonglist(results);
        });
        axios.get("/api/songlist/categories").then((response) => {
            const results  = response.data as CategoryData[];
            setCategories(results);
        });
        axios.get("/api/songlist/tags").then((response) => {
            const results  = response.data as TagData[];
            setTags(results);
        });
    }, []);

    useEffect(() => {
        axios.get("/api/userlist/songrequests").then((response) => {
            setUserlist(response.data);
        });
    }, []);

    const updateSong = (newData: RowData, oldData: RowData | undefined) => axios.post("/api/songlist", newData).then((result) => {
        const newSonglist = [...songlist];
        // @ts-ignore
        const target = newSonglist.find((el) => el.id === oldData.id);
        if (target) {
            const index = newSonglist.indexOf(target);
            newSonglist[index] = newData;
            setSonglist([...newSonglist]);
        }
    });

    const onCategoryMoved = (rowsMoved: CategoryData[], direction: number) => {
        const newState = [...categories];

        // Reorder categories according to direction.
        for (const row of rowsMoved) {
            for (let i = 0; i < categories.length; i++) {
                if (categories[i].id === row.id) {
                    const category = categories[i];
                    newState.splice(i, 1);
                    newState.splice(i + direction, 0, category);
                }
            }
        }

        // Assign new sort order for all items to avoid inconsistencies.
        for (let i = 0; i < newState.length; i++) {
            newState[i].sortOrder = i + 1;
        }

        axios.post("/api/songlist/categories", newState).then(() => {
            setCategories([...newState]);
        });
    };

    const handleTabChange = (event: React.ChangeEvent<{}>, tab: number) => {
        setSelectedTab(tab);
    };

    const hasIndex = (categories: CategoryData[], category: CategoryData, index: number) => {
        const obj = categories.find((el) => el.id === category.id);
        return obj && categories.indexOf(obj) === index;
    }

    const categoryTableInstance = useMaterialReactTable({
        columns: [
            {
                accessorKey: 'name',
                header: 'Category'
            }
        ],
        data: categories,
        enableSorting: false,
        enablePagination: false,
        enableColumnActions: false,
        enableDensityToggle: false,
        enableColumnFilters: false,
        enableHiding: false,
        enableTopToolbar: true,
        enableRowActions: true,
        editDisplayMode: 'row',
        enableEditing: true,
        positionActionsColumn: 'last',
        renderRowActions: ({ row }) => (
            <Box sx={{ display: 'flex' }}>
                <Button
                    disabled={hasIndex(categories, row.original, 0)}
                    onClick={() => onCategoryMoved([row.original], -1)}>
                    <ArrowUpward />
                </Button>
                <Button
                    disabled={hasIndex(categories, row.original, categories.length - 1)}
                    onClick={() => onCategoryMoved([row.original], 1)}>
                    <ArrowDownward />
                </Button>
                <Button
                    color="primary"
                    onClick={() => categoryTableInstance.setEditingRow(row)}>
                    <Edit />
                </Button>
                <Button
                    color="error"
                    onClick={() => {
                        if (window.confirm('Are you sure you want to delete this category?')) {
                            axios.post("/api/songlist/categories/delete", row.original).then(() => {
                                const newCategories = [...categories];
                                const target = newCategories.find((el) => el.id === row.original.id);
                                if (target) {
                                    const index = newCategories.indexOf(target);
                                    newCategories.splice(index, 1);
                                    setCategories([...newCategories]);
                                }
                            });
                        }
                    }}>
                        <Delete />
                    </Button>
            </Box>
        ),
        renderTopToolbarCustomActions: () => (
            <Button
                color="primary"
                onClick={() => {
                    const newCategory = { name: 'New Category', sortOrder: categories.length + 1 };
                    axios.post("/api/songlist/categories/add", newCategory).then((result) => {
                        const newList = [...categories, result.data as CategoryData];
                        setCategories(newList);
                    });
                }}
                startIcon={<Add />}
            >
                Add Category
            </Button>
        ),
        onEditingRowSave: ({ row, values }) => {
            const updatedData = { ...row.original, ...values };
            return axios.post("/api/songlist/categories/update", updatedData).then(() => {
                const newCategories = [...categories];
                const target = newCategories.find((el) => el.id === row.original.id);
                if (target) {
                    const index = newCategories.indexOf(target);
                    newCategories[index] = updatedData;
                    setCategories([...newCategories]);
                }
                categoryTableInstance.setEditingRow(null);
            });
        },
        muiTablePaperProps: { 
            elevation: 0,
            sx: { marginTop: 0 },
            className: classes.tableContainer
        },
        initialState: { 
            density: "compact",
        },
    });

    const songTableInstance = useMaterialReactTable({
        columns: [
            {
                accessorKey: 'album',
                header: 'Origin',
                Edit: ({ row, column, cell, table }) => (
                    <Autocomplete
                        freeSolo
                        size="small"
                        fullWidth
                        defaultValue={cell.getValue<string>() ?? ""}
                        options={songlist.map((x) => x.album).filter((v,i,a) => v && a.indexOf(v) === i)}
                        onInputChange={(event: any, newValue: string | null) => row._valuesCache[column.id] = newValue ?? ""}
                        renderInput={(params) => (
                            <TextField {...params} placeholder="Origin" fullWidth size="small" />
                        )}
                    />
                ),
            },
            {
                accessorKey: 'title',
                header: 'Title',
            },
            {
                accessorKey: 'artist',
                header: 'Artist',
                Edit: ({ row, column, cell, table }) => (
                    <Autocomplete
                        freeSolo
                        size="small"
                        fullWidth
                        defaultValue={cell.getValue<string>() ?? ""}
                        options={songlist.map((x) => x.artist).filter((v,i,a) => v && a.indexOf(v) === i)}
                        onInputChange={(event: any, newValue: string | null) => row._valuesCache[column.id] = newValue ?? ""}
                        renderInput={(params) => (
                            <TextField {...params} placeholder="Artist" fullWidth />
                        )}
                    />
                ),
            },
            {
                accessorKey: 'categoryId',
                header: 'Genre',
                editVariant: 'select',
                editSelectOptions: categories.map(c => ({ value: c.id, label: c.name })),
                Cell: ({ cell }) => {
                    const category = categories.find(c => c.id === cell.getValue<number>());
                    return category?.name ?? '';
                },
            },
            {
                accessorKey: 'songTags',
                header: 'Tags',
                Cell: ({ cell }) => (
                    <Box className={classes.tagContainer}>
                        {cell.getValue<string[]>()?.map((tag) => (
                            <li key={tag}>
                                <Chip size="small" label={tag} className={classes.chip} />
                            </li>
                        ))}
                    </Box>
                ),
                Edit: ({ row, column, cell, table }) => (
                    <Autocomplete
                        multiple
                        freeSolo
                        size="small"
                        defaultValue={cell.getValue<string[]>() ?? []}
                        options={tags.map((option) => option.name)}
                        onChange={(_, newValue) => row._valuesCache[column.id] = newValue }
                        renderTags={(value: string[], getTagProps) =>
                            value.map((option: string, index: number) => (
                                <Chip size="small" variant="outlined" label={option} {...getTagProps({ index })} />
                            ))
                        }
                        onInputChange={(event, newValue, reason) => {
                            // Create new tag when user types ";"
                            const newTags = newValue.split(";");
                            if (newTags.length > 1) {
                                const newTagsList = newTags.filter(x => x !== "");
                                row._valuesCache[column.id] = row._valuesCache[column.id].concat(newTagsList);
                            }
                        }}
                        renderInput={(params) => (
                            <TextField {...params} label="" placeholder="Tags"
                                onBlur={e => {
                                    // Create new tag when input focus is lost
                                    const newTags = e.target.value.split(";");
                                    if (newTags.length && row._valuesCache[column.id]) {
                                        const newTagsList = newTags.filter(x => x !== "");
                                        row._valuesCache[column.id] = row._valuesCache[column.id]?.concat(newTagsList);
                                    }
                                }}
                            />
                        )}
                    />
                ),
            },
        ],
        data: songlist,
        enablePagination: true,
        initialState: { 
            pagination: { pageIndex: 0, pageSize: 50 },
            sorting: [{ id: 'album', desc: false }],
            density: "compact",
        },
        enableEditing: true,
        editDisplayMode: 'row',
        enableRowActions: true,
        positionActionsColumn: 'last',
        renderRowActions: ({ row }) => (
            <Box sx={{ display: 'flex' }}>
                <Button
                    onClick={(event) => openAttributionPopup(event.currentTarget, row.original)}
                    color={row.original.attributedUserId ? "primary" : "inherit"}>
                    <Attribution />
                </Button>
                <Button
                    color="primary"
                    onClick={() => songTableInstance.setEditingRow(row)}>
                    <Edit />
                </Button>
                <Button
                    color="error"
                    onClick={() => {
                        if (window.confirm('Are you sure you want to delete this song?')) {
                            axios.post("/api/songlist/delete", row.original).then(() => {
                                const newSonglist = [...songlist];
                                const target = newSonglist.find((el) => el.id === row.original.id);
                                if (target) {
                                    const index = newSonglist.indexOf(target);
                                    newSonglist.splice(index, 1);
                                    setSonglist([...newSonglist]);
                                }
                            });
                        }
                    }}>
                    <Delete />
                </Button>
            </Box>
        ),
        renderTopToolbarCustomActions: () => (
            <Button
                color="primary"
                onClick={() => {
                    const newSong = { title: '', album: '', artist: '', categoryId: categories[0]?.id, songTags: [] };
                    axios.post("/api/songlist/add", newSong).then((result) => {
                        const newList = [...songlist, result.data as RowData];
                        setSonglist(newList);
                        // Start editing the new row
                        const row = songTableInstance.getRow(result.data.id);
                        if (row) {
                            songTableInstance.setEditingCell(null);
                        }
                    });
                }}
                startIcon={<Add />}
            >
                Add Song
            </Button>
        ),
        onEditingRowSave: ({ row, values }) => {
            const updatedData = { ...row.original, ...values };
            return updateSong(updatedData, row.original).then(() => {
                songTableInstance.setEditingRow(null);
            });
        },
        muiTablePaperProps: { 
            elevation: 0,
            sx: { marginTop: 0 },
            className: classes.tableContainer
        },
        enableColumnFilters: true,
        enableGlobalFilter: true,
    });

    const openAttributionPopup = (button: HTMLElement, song: RowData) => {
        setPopupAnchor(button);
        setCurrentRowForAction(song);
        if (song.attributedUserId) {
            setAttributedUser({id: song.attributedUserId, username: song.attributedUsername});
        } else {
            setAttributedUser(null);
        }
    };

    const saveAttribution = async () => {
        if (currentRowForAction) {
            const updatedRow: RowData = {...currentRowForAction};
            updatedRow.attributedUserId = attributedUser?.id;
            updateSong(updatedRow, currentRowForAction);
            setPopupAnchor(undefined);
        }
    };

    const attributionPopover = <Popover
        open = {open}
        anchorEl = {popupAnchor}
        onClose = {() => setPopupAnchor(undefined)}
        anchorOrigin = {{
            vertical: "bottom",
            horizontal: "center"
        }}>
            <Box py={1} px={2}>
                <form>
                    <Grid container spacing={2} justifyContent="flex-start" wrap={"nowrap"} alignItems="center">
                        <Grid item>
                            <Autocomplete
                                id="set-user"
                                options={userlist}
                                value={attributedUser}
                                onChange={(event: any, newValue: AutocompleteUser | null) => {
                                    setAttributedUser(newValue);
                                }}
                                getOptionLabel={(option) => option.username}
                                renderInput={(params) => <TextField {...params} label="Attribute to user" helperText="Select the user who requested this song often enough to be on the song list." />}
                            />
                        </Grid>
                        <Grid item>
                            <Button variant="contained" color="primary" startIcon={<SaveIcon />} onClick={() => saveAttribution()}>Save</Button>
                        </Grid>
                    </Grid>
                </form>
            </Box>
        </Popover>;



    return <Box>
            {attributionPopover}
            <Card>
                <ThemeProvider theme={(theme) => createCondensedTheme(theme)}>
                    <Tabs value={selectedTab}
                          indicatorColor="primary"
                          textColor="primary"
                          onChange={handleTabChange}>
                          <Tab label={"Songs"} value={0} />
                          <Tab label={"Categories"} value={1} />
                    </Tabs>

                    {selectedTab === 0 ? (
                        <MaterialReactTable table={songTableInstance} />
                    ) : (
                        <MaterialReactTable table={categoryTableInstance} />
                    )}
                </ThemeProvider>
            </Card>
        </Box>;
};

export default EditSonglist;