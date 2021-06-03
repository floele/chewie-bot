import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import axios from "axios";
import MaterialTable from "material-table"
import { Box, Button, Grid, Card, TextField, CircularProgress, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Checkbox } from "@material-ui/core";
import { Image } from "react-bootstrap";
import { DropzoneArea, DropzoneDialog } from "material-ui-dropzone";
import { AddToListState } from "../common/addToListState";
import AddIcon from "@material-ui/icons/Add";

const useStyles = makeStyles((theme) => ({
    addButton: {
        margin: theme.spacing(2, 0, 2),
    },
}));

type RowData = { id?: number, type: number, amount: number, seasonal: boolean, imageId: string, url: string };
const MaxFileSize = 1024 * 1024 * 5;
const FileTypes = ["image/jpeg", "image/png"];

const ImageCell: React.FC<{value: RowData}> = ({value}) => {
    const [currentFile, setCurrentFile] = useState({ url: value.url});
    const [open, setOpen] = React.useState(false);

    const handleSave = async (files: File[]) => {
        for (const file of files) {
            const formData = new FormData();
            formData.append("achievement", JSON.stringify(value));
            formData.append("image", file);
            axios.post("/api/achievements/upload", formData, {
                headers: {
                  "Content-Type": "multipart/form-data"
                }
            }).then((result) => {
                if (result) {
                    setCurrentFile({url: result.data.url });
                }
                setOpen(false);
            });
        }
    }

    return <Grid container>
            <Grid item>
                <Image height={40} src={currentFile.url} style={{ marginRight: "0.5em" }} />
            </Grid>
            <Grid item>
                <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
                    Change
                </Button>
                <DropzoneDialog
                    acceptedFiles={FileTypes}
                    initialFiles={[currentFile.url]}
                    maxFileSize={MaxFileSize}
                    open={open}
                    onClose={() => setOpen(false)}
                    onSave={(files) => handleSave(files)}
                    showPreviews={true}
                    showFileNamesInPreview={false}
                    filesLimit={1}
                />
            </Grid>
        </Grid>;
}

const AchievementsList: React.FC<any> = (props: any) => {
    const [achievementlist, setAchievementlist] = useState([] as RowData[]);
    const [achievementListState, setAchievementListState] = useState<AddToListState>();

    const [achievementType, setAchievementType] = useState<number>(0);
    const [achievementAmount, setAchievementAmount] = useState<number>(0);
    const [achievementSeasonal, setAchievementSeasonal] = useState<boolean>(false);
    const [achievementFile, setAchievementFile] = useState<File>();

    const classes = useStyles();

    const achievementTypes = {
        0: "Songs requested",
        1: "Points collected",
        2: "Songs added to Songlist",
        3: "Unique cards collected",
        4: "Sudoku committed",
        5: "Redeemed animation",
        6: "Daily Taxes paid",
        7: "Duels won",
        8: "Total points won in Backheist",
        9: "Total points lost in Backheist",
        10: "Daily Taxes paid (Bits)"
    };

    useEffect(() => {
        axios.get("/api/achievements").then((response) => {
            setAchievementlist(response.data);
        });
    }, []);

    const submitForm = async () => {
        if (!achievementFile) {
            return;
        }

        try {
            setAchievementListState({state: "progress"});

            const newData = { type: achievementType, amount: achievementAmount, seasonal: achievementSeasonal } as RowData;

            const formData = new FormData();
            formData.append("achievement", JSON.stringify(newData));
            formData.append("image", achievementFile);
            axios.post("/api/achievements/upload", formData, {
                headers: {
                  "Content-Type": "multipart/form-data"
                },
                validateStatus(status) { return true; }
            }).then((result) => {
                if (result && result.status === 200) {
                    const newList = [...achievementlist, result.data];
                    setAchievementListState({state: "success"});
                    setAchievementlist(newList);
                    setAchievementType(0);
                    setAchievementAmount(0);
                    setAchievementSeasonal(false);
                    setAchievementFile(undefined);
                } else {
                    setAchievementListState({
                        state: "failed",
                        message: result.data.error.message
                    });
                }
            });
        } catch (error) {
            setAchievementListState({
                state: "failed",
                message: error.message
            });
        }
    };

    const addForm = <Box mb={2}>
            <Card><Box py={1} px={2}>
                <form onSubmit={submitForm}>
                    <Grid container style={{ maxWidth: "90em" }}>
                        <Grid item xs={6}>
                            <Grid item>
                                <FormControl fullWidth style={{ marginTop: 15 }}>
                                    <InputLabel>Type</InputLabel>
                                    <Select
                                        value={achievementType}
                                        onChange={(event: React.ChangeEvent<{ name?: string | undefined; value: unknown; }>) => setAchievementType(event.target.value as number ?? 0)}>
                                        {Object.entries(achievementTypes).map(([key, value]) => <MenuItem value={key}>{value}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item>
                                <TextField
                                    id="achievement-amount"
                                    label="Amount required"
                                    type="number"
                                    fullWidth
                                    value={achievementAmount}
                                    onChange={(e) => setAchievementAmount(parseInt(e.target.value, 10))}
                                />
                            </Grid>
                            <Grid item>
                                <FormControlLabel
                                    control={
                                    <Checkbox
                                        checked={achievementSeasonal}
                                        onChange={(e) => setAchievementSeasonal(e.target.checked)}
                                        name="achievement-seasonal"
                                        color="primary"
                                    />}
                                    label="Seasonal (archive when season ends)"
                                />
                            </Grid>
                            <Grid item>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={achievementListState?.state === "progress" ? <CircularProgress size={15} /> : <AddIcon />}
                                    onClick={submitForm}
                                    className={classes.addButton}
                                    disabled={achievementListState?.state === "progress" || !achievementFile || !achievementAmount}>
                                    Add
                                </Button>
                            </Grid>
                        </Grid>
                        <Grid item xs={6}>
                            <Box ml={2}>
                                <DropzoneArea maxFileSize={MaxFileSize} acceptedFiles={FileTypes} filesLimit={1}
                                    onChange={(files) => setAchievementFile(files.length === 0 ? undefined : files[0])} initialFiles={achievementFile ? [achievementFile] : undefined} />
                            </Box>
                        </Grid>
                    </Grid>
                </form>
            </Box></Card>
        </Box>;

    return <div>
            {addForm}
            <MaterialTable
                columns = {[
                    {
                        title: "Event type", field: "type",
                        defaultSort: "asc",
                        lookup: achievementTypes
                    },
                    { title: "Amount", field: "amount" },
                    { title: "Seasonal", field: "seasonal", type: "boolean" },
                    { title: "Image", field: "image", render: rowData => <ImageCell value={rowData} />, editable: "never" }
                ]}
                options = {{
                    paging: false,
                    actionsColumnIndex: 4,
                    showTitle: false,
                    addRowPosition: "first",
                    tableLayout: "auto",
                }}
                data = {achievementlist}
                editable = {
                    {
                        isEditable: rowData => true,
                        isDeletable: rowData => true,
                        onRowUpdate: (newData, oldData) => axios.post("/api/achievements", newData).then((result) => {
                            if (result.status === 200) {
                                const newList = [...achievementlist];
                                // @ts-ignore
                                const index = oldData?.tableData.id;
                                newList[index] = newData;
                                setAchievementlist(newList);
                            }
                        }),
                        onRowDelete: oldData => axios.post("/api/achievements/delete", oldData).then((result) => {
                            if (result.status === 200) {
                                const newList = [...achievementlist];
                                // @ts-ignore
                                const index = oldData?.tableData.id;
                                newList.splice(index, 1);
                                setAchievementlist(newList);
                            }
                        })
                    }
                }
            />
    </div>;
};

export default AchievementsList;
