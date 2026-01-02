import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardActions from "@material-ui/core/CardActions";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import InputAdornment from "@material-ui/core/InputAdornment";
import Box from "@material-ui/core/Box";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import PlaylistAddOutlinedIcon from "@material-ui/icons/PlaylistAddOutlined";
import AddCircleOutlineIcon from "@material-ui/icons/AddCircleOutline";
import AssignmentTurnedInOutlinedIcon from "@material-ui/icons/AssignmentTurnedInOutlined";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
  surface: {
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    backgroundColor: "#F8FAFC",
    padding: theme.spacing(2),
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  titleIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    color: "rgba(5, 150, 105, 0.95)",
    flex: "none",
  },
  title: {
    fontWeight: 900,
    letterSpacing: 0,
    color: "rgba(15, 23, 42, 0.92)",
  },
  subtitle: {
    marginTop: 2,
    color: "rgba(15, 23, 42, 0.62)",
    fontSize: 13,
  },
  inputRow: {
    display: "flex",
    gap: theme.spacing(1.5),
    alignItems: "stretch",
    marginBottom: theme.spacing(2),
  },
  input: {
    flex: 1,
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      backgroundColor: "#fff",
    },
  },
  addButton: {
    borderRadius: 12,
    fontWeight: 900,
    textTransform: "none",
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    whiteSpace: "nowrap",
  },
  grid: {
    marginTop: theme.spacing(0.5),
  },
  card: {
    borderRadius: 14,
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
    transition: "box-shadow 150ms ease, transform 150ms ease, border-color 150ms ease",
    "&:hover": {
      borderColor: "rgba(15, 23, 42, 0.14)",
      boxShadow: "0 10px 22px rgba(15, 23, 42, 0.10)",
      transform: "translateY(-1px)",
    },
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  taskText: {
    fontWeight: 900,
    color: "rgba(15, 23, 42, 0.92)",
    lineHeight: 1.25,
    wordBreak: "break-word",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: theme.spacing(1),
  },
  chip: {
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  actions: {
    justifyContent: "flex-end",
    paddingTop: 0,
  },
  emptyWrap: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(4),
    borderRadius: 14,
    border: "1px dashed rgba(15, 23, 42, 0.18)",
    backgroundColor: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    color: "rgba(15, 23, 42, 0.22)",
    margin: "0 auto 10px",
    display: "block",
  },
}));

const ToDoList = () => {
  const classes = useStyles();

  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);
  const [editIndex, setEditIndex] = useState(-1);

  useEffect(() => {
    const savedTasks = localStorage.getItem("tasks");
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  const handleTaskChange = (event) => {
    setTask(event.target.value);
  };

  const handleAddTask = () => {
    if (!task.trim()) {
      // Impede que o usuário crie uma tarefa sem texto
      return;
    }

    const now = new Date();
    if (editIndex >= 0) {
      // Editar tarefa existente
      const newTasks = [...tasks];
      newTasks[editIndex] = {text: task, updatedAt: now, createdAt: newTasks[editIndex].createdAt};
      setTasks(newTasks);
      setTask("");
      setEditIndex(-1);
    } else {
      // Adicionar nova tarefa
      setTasks([...tasks, {text: task, createdAt: now, updatedAt: now}]);
      setTask("");
    }
  };

  const handleEditTask = (index) => {
    setTask(tasks[index].text);
    setEditIndex(index);
  };

  const handleDeleteTask = (index) => {
    const newTasks = [...tasks];
    newTasks.splice(index, 1);
    setTasks(newTasks);
  };

  return (
    <div className={classes.root}>
      <Paper className={classes.surface} elevation={0}>
        <div className={classes.header}>
          <div>
            <div className={classes.titleRow}>
              <div className={classes.titleIcon}>
                <AssignmentTurnedInOutlinedIcon />
              </div>
              <div>
                <Typography variant="h6" className={classes.title}>
                  Tarefas
                </Typography>
                <Typography className={classes.subtitle}>
                  Organize atividades rápidas do dia a dia com edição e exclusão.
                </Typography>
              </div>
            </div>
          </div>
        </div>

        <div className={classes.inputRow}>
          <TextField
            className={classes.input}
            label="Nova tarefa"
            value={task}
            onChange={handleTaskChange}
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PlaylistAddOutlinedIcon style={{ color: "rgba(15, 23, 42, 0.55)" }} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            className={classes.addButton}
            variant="contained"
            color="primary"
            onClick={handleAddTask}
            startIcon={<AddCircleOutlineIcon />}
          >
            {editIndex >= 0 ? "Salvar" : "Adicionar"}
          </Button>
        </div>

        {tasks.length === 0 ? (
          <div className={classes.emptyWrap}>
            <AssignmentTurnedInOutlinedIcon className={classes.emptyIcon} />
            <Typography style={{ fontWeight: 900, fontSize: 16, color: "rgba(15, 23, 42, 0.92)" }}>
              Nenhuma tarefa ainda
            </Typography>
            <Typography style={{ color: "rgba(15, 23, 42, 0.62)", fontSize: 13 }}>
              Adicione uma nova tarefa para começar a organizar seu dia.
            </Typography>
          </div>
        ) : (
          <Grid container spacing={2} className={classes.grid}>
            {tasks.map((t, index) => (
              <Grid key={index} item xs={12} sm={6} md={4} lg={3}>
                <Card className={classes.card} variant="outlined">
                  <CardContent>
                    <div className={classes.cardHeader}>
                      <Typography className={classes.taskText}>
                        {t.text}
                      </Typography>
                      <Box>
                        <IconButton size="small" onClick={() => handleEditTask(index)} aria-label="Editar tarefa">
                          <EditOutlinedIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteTask(index)} aria-label="Excluir tarefa">
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Box>
                    </div>
                    <div className={classes.metaRow}>
                      <Chip
                        className={classes.chip}
                        size="small"
                        label={`Atualizada: ${String(t.updatedAt).toLocaleString()}`}
                        variant="outlined"
                      />
                    </div>
                  </CardContent>
                  <CardActions className={classes.actions}>
                    {/* ações ficam nos ícones para não alterar comportamento */}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
    </div>
  );
};


export default ToDoList;
