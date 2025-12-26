import React, { useState, useEffect } from "react";
import {
    makeStyles,
    Grid,
    TextField,
    Card,
    CardHeader,
    CardContent,
    Chip,
    Typography,
    Divider,
    IconButton,
    FormControl,
    InputLabel,
    MenuItem,
    Select
} from "@material-ui/core";
import { Formik, Form, Field } from 'formik';
import ButtonWithSpinner from "../ButtonWithSpinner";
import ConfirmationModal from "../ConfirmationModal";

import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import PeopleOutlineIcon from "@material-ui/icons/PeopleOutline";
import LinkIcon from "@material-ui/icons/Link";
import DnsIcon from "@material-ui/icons/Dns";
import MonetizationOnIcon from "@material-ui/icons/MonetizationOn";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import EventIcon from "@material-ui/icons/Event";
import ForumIcon from "@material-ui/icons/Forum";
import SettingsEthernetIcon from "@material-ui/icons/SettingsEthernet";
import ViewColumnIcon from "@material-ui/icons/ViewColumn";
import EmojiObjectsIcon from "@material-ui/icons/EmojiObjects";
import DeviceHubIcon from "@material-ui/icons/DeviceHub";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import { toast } from "react-toastify";
import usePlans from "../../hooks/usePlans";
import { i18n } from "../../translate/i18n";


const useStyles = makeStyles(theme => ({
    root: {
        width: '100%'
    },
    fullWidth: {
        width: '100%'
    },
    textfield: {
        width: '100%'
    },
    textRight: {
        textAlign: 'right'
    },
    row: {
        paddingTop: theme.spacing(2),
        paddingBottom: theme.spacing(2)
    },
    control: {
        paddingRight: theme.spacing(1),
        paddingLeft: theme.spacing(1)
    },
    buttonContainer: {
        textAlign: 'right',
        padding: theme.spacing(1)
    },
    softCard: {
        borderRadius: 16,
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.type === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.01)"
    },
    cardsGrid: {
        marginTop: theme.spacing(1)
    },
    planCard: {
        height: "100%",
        borderRadius: 16,
        border: `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
        transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
        "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: theme.shadows[4],
            borderColor: theme.palette.primary.main,
        }
    },
    planHeader: {
        paddingBottom: theme.spacing(1)
    },
    titleRow: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: theme.spacing(1),
        flexWrap: "wrap"
    },
    planName: {
        fontWeight: 900,
        lineHeight: 1.15,
        wordBreak: "break-word",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        minWidth: 0
    },
    pricePill: {
        fontWeight: 900,
        backgroundColor: theme.palette.primary.main,
        color: "#fff"
    },
    metricsRow: {
        display: "flex",
        gap: theme.spacing(1),
        flexWrap: "wrap",
        marginTop: theme.spacing(1.25),
    },
    metric: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        padding: theme.spacing(1),
        borderRadius: 12,
        border: `1px solid ${theme.palette.divider}`,
        background: theme.palette.type === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
        flex: "1 1 140px",
        minWidth: 140
    },
    metricIcon: { opacity: 0.85 },
    metricLabel: { opacity: 0.75, fontWeight: 700, fontSize: 12, lineHeight: 1.2 },
    metricValue: { fontWeight: 900, fontSize: 14, lineHeight: 1.2 },
    featuresWrap: {
        display: "flex",
        flexWrap: "wrap",
        gap: theme.spacing(0.75),
        marginTop: theme.spacing(1.25),
    },
    featureChip: {
        borderRadius: 12,
        fontWeight: 800,
    },
    featureOn: {
        color: theme.palette.primary.main,
        borderColor: theme.palette.primary.main
    },
    featureOff: {
        opacity: 0.8
    },
    actions: {
        display: "flex",
        justifyContent: "flex-end",
        padding: theme.spacing(1, 1.5),
        borderTop: `1px solid ${theme.palette.divider}`,
        background: theme.palette.type === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"
    },
    iconBtn: { borderRadius: 10 }
}));

function formatMoneyBRL(value) {
    const n = Number(value || 0);
    const v = Number.isFinite(n) ? n : 0;
    return v.toLocaleString('pt-br', { minimumFractionDigits: 2 });
}

function yesNoChip(classes, label, enabled, Icon) {
    return (
        <Chip
            size="small"
            variant="outlined"
            className={`${classes.featureChip} ${enabled ? classes.featureOn : classes.featureOff}`}
            icon={enabled ? <CheckCircleOutlineIcon fontSize="small" /> : <HighlightOffIcon fontSize="small" />}
            label={label}
        />
    );
}

export function PlanManagerForm(props) {
    const { onSubmit, onDelete, onCancel, initialValue, loading } = props;
    const classes = useStyles()

    const [record, setRecord] = useState({
        name: '',
        users: 0,
        connections: 0,
        queues: 0,
        value: 0,
        useCampaigns: true,
        useSchedules: true,
        useInternalChat: true,
        useExternalApi: true,
        useKanban: true,
        useOpenAi: true,
        useIntegrations: true,
    });

    useEffect(() => {
        setRecord(initialValue)
    }, [initialValue])

    const handleSubmit = async (data) => {
        onSubmit(data)
    }

    return (
        <Formik
            enableReinitialize
            className={classes.fullWidth}
            initialValues={record}
            onSubmit={(values, { resetForm }) =>
                setTimeout(() => {
                    handleSubmit(values)
                    resetForm()
                }, 500)
            }
        >
            {(values) => (
                <Form className={classes.fullWidth}>
                    <Grid spacing={2} justifyContent="flex-start" container>
                        {/* NOME */}
                        <Grid xs={12} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.name")}
                                name="name"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                            />
                        </Grid>

                        {/* USUARIOS */}
                        <Grid xs={12} sm={6} md={3} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.users")}
                                name="users"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                type="number"
                            />
                        </Grid>

                        {/* CONEXOES */}
                        <Grid xs={12} sm={6} md={3} item>
                            <Field
                                as={TextField}
                                label={i18n.t("plans.form.connections")}
                                name="connections"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                type="number"
                            />
                        </Grid>

                        {/* FILAS */}
                        <Grid xs={12} sm={6} md={3} item>
                            <Field
                                as={TextField}
                                label="Filas"
                                name="queues"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                type="number"
                            />
                        </Grid>

                        {/* VALOR */}
                        <Grid xs={12} sm={6} md={3} item>
                            <Field
                                as={TextField}
                                label="Valor"
                                name="value"
                                variant="outlined"
                                className={classes.fullWidth}
                                margin="dense"
                                type="text"
                            />
                        </Grid>

                        {/* CAMPANHAS */}
                        <Grid xs={12} sm={6} md={6} lg={4} item>
                            <FormControl margin="dense" variant="outlined" fullWidth>
                                <InputLabel htmlFor="useCampaigns-selection">{i18n.t("plans.form.campaigns")}</InputLabel>
                                <Field
                                    as={Select}
                                    id="useCampaigns-selection"
                                    label={i18n.t("plans.form.campaigns")}
                                    labelId="useCampaigns-selection-label"
                                    name="useCampaigns"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* AGENDAMENTOS */}
                        <Grid xs={12} sm={6} md={6} lg={4} item>
                            <FormControl margin="dense" variant="outlined" fullWidth>
                                <InputLabel htmlFor="useSchedules-selection">{i18n.t("plans.form.schedules")}</InputLabel>
                                <Field
                                    as={Select}
                                    id="useSchedules-selection"
                                    label={i18n.t("plans.form.schedules")}
                                    labelId="useSchedules-selection-label"
                                    name="useSchedules"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* CHAT INTERNO */}
                        <Grid xs={12} sm={6} md={6} lg={4} item>
                            <FormControl margin="dense" variant="outlined" fullWidth>
                                <InputLabel htmlFor="useInternalChat-selection">Chat Interno</InputLabel>
                                <Field
                                    as={Select}
                                    id="useInternalChat-selection"
                                    label="Chat Interno"
                                    labelId="useInternalChat-selection-label"
                                    name="useInternalChat"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* API Externa */}
                        <Grid xs={12} sm={6} md={6} lg={4} item>
                            <FormControl margin="dense" variant="outlined" fullWidth>
                                <InputLabel htmlFor="useExternalApi-selection">API Externa</InputLabel>
                                <Field
                                    as={Select}
                                    id="useExternalApi-selection"
                                    label="API Externa"
                                    labelId="useExternalApi-selection-label"
                                    name="useExternalApi"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* KANBAN */}
                        <Grid xs={12} sm={6} md={6} lg={4} item>
                            <FormControl margin="dense" variant="outlined" fullWidth>
                                <InputLabel htmlFor="useKanban-selection">Kanban</InputLabel>
                                <Field
                                    as={Select}
                                    id="useKanban-selection"
                                    label="Kanban"
                                    labelId="useKanban-selection-label"
                                    name="useKanban"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* OPENAI */}
                        <Grid xs={12} sm={6} md={6} lg={4} item>
                            <FormControl margin="dense" variant="outlined" fullWidth>
                                <InputLabel htmlFor="useOpenAi-selection">Open.Ai</InputLabel>
                                <Field
                                    as={Select}
                                    id="useOpenAi-selection"
                                    label="Talk.Ai"
                                    labelId="useOpenAi-selection-label"
                                    name="useOpenAi"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>

                        {/* INTEGRACOES */}
                        <Grid xs={12} sm={6} md={6} lg={4} item>
                            <FormControl margin="dense" variant="outlined" fullWidth>
                                <InputLabel htmlFor="useIntegrations-selection">Integrações</InputLabel>
                                <Field
                                    as={Select}
                                    id="useIntegrations-selection"
                                    label="Integrações"
                                    labelId="useIntegrations-selection-label"
                                    name="useIntegrations"
                                    margin="dense"
                                >
                                    <MenuItem value={true}>{i18n.t("plans.form.enabled")}</MenuItem>
                                    <MenuItem value={false}>{i18n.t("plans.form.disabled")}</MenuItem>
                                </Field>
                            </FormControl>
                        </Grid>
                    </Grid>
                    <Grid spacing={2} justifyContent="flex-end" container style={{ marginTop: 4 }}>

                        <Grid xs={12} sm={4} md={3} item>
                            <ButtonWithSpinner className={classes.fullWidth} loading={loading} onClick={() => onCancel()} variant="contained">
                                {i18n.t("plans.form.clear")}
                            </ButtonWithSpinner>
                        </Grid>
                        {record.id !== undefined ? (
                            <Grid xs={12} sm={4} md={3} item>
                                <ButtonWithSpinner className={classes.fullWidth} loading={loading} onClick={() => onDelete(record)} variant="contained" color="secondary">
                                    {i18n.t("plans.form.delete")}
                                </ButtonWithSpinner>
                            </Grid>
                        ) : null}
                        <Grid xs={12} sm={4} md={3} item>
                            <ButtonWithSpinner className={classes.fullWidth} loading={loading} type="submit" variant="contained" color="primary">
                                {i18n.t("plans.form.save")}
                            </ButtonWithSpinner>
                        </Grid>
                    </Grid>
                </Form>
            )}
        </Formik>
    )
}

export function PlansManagerGrid(props) {
    const { records, onSelect, onDelete } = props
    const classes = useStyles()

    return (
        <Grid container spacing={2} className={classes.cardsGrid}>
            {(records || []).map((row) => {
                const campaigns = row.useCampaigns !== false;
                const schedules = row.useSchedules !== false;
                const internalChat = row.useInternalChat !== false;
                const externalApi = row.useExternalApi !== false;
                const kanban = row.useKanban !== false;
                const openAi = row.useOpenAi !== false;
                const integrations = row.useIntegrations !== false;

                return (
                    <Grid key={row.id} item xs={12} sm={6} md={4}>
                        <Card className={classes.planCard} elevation={0}>
                            <CardContent>
                                <div className={classes.titleRow}>
                                    <Typography variant="subtitle1" className={classes.planName}>
                                        {row.name || "-"}
                                    </Typography>
                                    <Chip
                                        size="small"
                                        icon={<MonetizationOnIcon fontSize="small" />}
                                        className={classes.pricePill}
                                        label={`${i18n.t("plans.form.money")} ${formatMoneyBRL(row.value)}`}
                                    />
                                </div>

                                <div className={classes.metricsRow}>
                                    <div className={classes.metric}>
                                        <PeopleOutlineIcon className={classes.metricIcon} fontSize="small" />
                                        <div>
                                            <div className={classes.metricLabel}>{i18n.t("plans.form.users")}</div>
                                            <div className={classes.metricValue}>{row.users ?? "-"}</div>
                                        </div>
                                    </div>
                                    <div className={classes.metric}>
                                        <LinkIcon className={classes.metricIcon} fontSize="small" />
                                        <div>
                                            <div className={classes.metricLabel}>{i18n.t("plans.form.connections")}</div>
                                            <div className={classes.metricValue}>{row.connections ?? "-"}</div>
                                        </div>
                                    </div>
                                    <div className={classes.metric}>
                                        <DnsIcon className={classes.metricIcon} fontSize="small" />
                                        <div>
                                            <div className={classes.metricLabel}>Filas</div>
                                            <div className={classes.metricValue}>{row.queues ?? "-"}</div>
                                        </div>
                                    </div>
                                </div>

                                <Divider style={{ margin: "12px 0" }} />

                                <div className={classes.featuresWrap}>
                                    {yesNoChip(classes, i18n.t("plans.form.campaigns"), campaigns, LocalOfferIcon)}
                                    {yesNoChip(classes, i18n.t("plans.form.schedules"), schedules, EventIcon)}
                                    {yesNoChip(classes, "Chat", internalChat, ForumIcon)}
                                    {yesNoChip(classes, "API", externalApi, SettingsEthernetIcon)}
                                    {yesNoChip(classes, "Kanban", kanban, ViewColumnIcon)}
                                    {yesNoChip(classes, "IA", openAi, EmojiObjectsIcon)}
                                    {yesNoChip(classes, "Integrações", integrations, DeviceHubIcon)}
                                </div>
                            </CardContent>
                            <div className={classes.actions}>
                                <IconButton
                                    className={classes.iconBtn}
                                    size="small"
                                    color="primary"
                                    onClick={() => onSelect(row)}
                                    aria-label={`Editar plano ${row.name || ""}`}
                                >
                                    <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    className={classes.iconBtn}
                                    size="small"
                                    onClick={() => onDelete && onDelete(row)}
                                    aria-label={`Excluir plano ${row.name || ""}`}
                                    style={{ color: "#d32f2f" }}
                                >
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            </div>
                        </Card>
                    </Grid>
                )
            })}
        </Grid>
    )
}

export default function PlansManager() {
    const classes = useStyles()
    const { list, save, update, remove } = usePlans()

    const [showConfirmDialog, setShowConfirmDialog] = useState(false)
    const [loading, setLoading] = useState(false)
    const [records, setRecords] = useState([])
    const [record, setRecord] = useState({
        name: '',
        users: 0,
        connections: 0,
        queues: 0,
        value: 0,
        useCampaigns: true,
        useSchedules: true,
        useInternalChat: true,
        useExternalApi: true,
        useKanban: true,
        useOpenAi: true,
        useIntegrations: true,
    })

    useEffect(() => {
        async function fetchData() {
            await loadPlans()
        }
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [record])

    const loadPlans = async () => {
        setLoading(true)
        try {
            const planList = await list()
            setRecords(planList)
        } catch (e) {
            toast.error('Não foi possível carregar a lista de registros')
        }
        setLoading(false)
    }

    const handleSubmit = async (data) => {
        setLoading(true)
        console.log(data)
        try {
            if (data.id !== undefined) {
                await update(data)
            } else {
                await save(data)
            }
            await loadPlans()
            handleCancel()
            toast.success('Operação realizada com sucesso!')
        } catch (e) {
            toast.error('Não foi possível realizar a operação. Verifique se já existe uma plano com o mesmo nome ou se os campos foram preenchidos corretamente')
        }
        setLoading(false)
    }

    const handleDelete = async () => {
        setLoading(true)
        try {
            await remove(record.id)
            await loadPlans()
            handleCancel()
            toast.success('Operação realizada com sucesso!')
        } catch (e) {
            toast.error('Não foi possível realizar a operação')
        }
        setLoading(false)
    }

    const handleOpenDeleteDialog = () => {
        setShowConfirmDialog(true)
    }

    const handleCancel = () => {
        setRecord({
            id: undefined,
            name: '',
            users: 0,
            connections: 0,
            queues: 0,
            value: 0,
            useCampaigns: true,
            useSchedules: true,
            useInternalChat: true,
            useExternalApi: true,
            useKanban: true,
            useOpenAi: true,
            useIntegrations: true
        })
    }

    const handleSelect = (data) => {

        let useCampaigns = data.useCampaigns === false ? false : true
        let useSchedules = data.useSchedules === false ? false : true
        let useInternalChat = data.useInternalChat === false ? false : true
        let useExternalApi = data.useExternalApi === false ? false : true
        let useKanban = data.useKanban === false ? false : true
        let useOpenAi = data.useOpenAi === false ? false : true
        let useIntegrations = data.useIntegrations === false ? false : true

        setRecord({
            id: data.id,
            name: data.name || '',
            users: data.users || 0,
            connections: data.connections || 0,
            queues: data.queues || 0,
            value: data.value?.toLocaleString('pt-br', { minimumFractionDigits: 0 }) || 0,
            useCampaigns,
            useSchedules,
            useInternalChat,
            useExternalApi,
            useKanban,
            useOpenAi,
            useIntegrations
        })
    }

    return (
        <Grid spacing={2} container>
            <Grid xs={12} item>
                <Card className={classes.softCard} elevation={0}>
                    <CardHeader
                        className={classes.planHeader}
                        title={record?.id ? "Editar plano" : "Criar plano"}
                        subheader="Configure limites e recursos. Use os cards ao lado para editar rapidamente."
                    />
                    <CardContent>
                        <PlanManagerForm
                            initialValue={record}
                            onDelete={handleOpenDeleteDialog}
                            onSubmit={handleSubmit}
                            onCancel={handleCancel}
                            loading={loading}
                        />
                    </CardContent>
                </Card>
            </Grid>
            <Grid xs={12} item>
                <Card className={classes.softCard} elevation={0}>
                    <CardHeader
                        className={classes.planHeader}
                        title="Planos cadastrados"
                        subheader={`${Array.isArray(records) ? records.length : 0} item(ns)`}
                    />
                    <CardContent>
                        <PlansManagerGrid
                            records={records}
                            onSelect={handleSelect}
                            onDelete={(row) => {
                                handleSelect(row);
                                handleOpenDeleteDialog();
                            }}
                        />
                    </CardContent>
                </Card>
            </Grid>
            <ConfirmationModal
                title="Exclusão de Registro"
                open={showConfirmDialog}
                onClose={() => setShowConfirmDialog(false)}
                onConfirm={() => handleDelete()}
            >
                Deseja realmente excluir esse registro?
            </ConfirmationModal>
        </Grid>
    )
}