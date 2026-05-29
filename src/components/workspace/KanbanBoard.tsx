import React, { useState, useRef, useCallback, useEffect, useReducer, useMemo } from 'react';
import { useSocketContext } from '../../context/SocketContext';
import { useSocket } from '../../hooks/useSocket';
import { Plus, AlertCircle, GripVertical } from 'lucide-react';

interface User {
  id: string;
  name: string;
  color?: string;
}

interface Task {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  status: 'Todo' | 'In_Progress' | 'Review' | 'Done';
  priority?: 'Low' | 'Medium' | 'High';
  assignedTo?: { _id?: string; name?: string };
  dueDate?: string;
  createdAt?: string;
}

interface Column {
  id: Task['status'];
  title: string;
  border: string;
  headerBg: string;
}

interface KanbanState {
  tasks: Task[];
  snapshot: Task[] | null;
  error: string | null;
}

type KanbanAction =
  | { type: 'SET_TASKS'; payload: Task[] }
  | {
      type: 'OPTIMISTIC_MOVE';
      payload: { taskId: string; status: Task['status'] };
    }
  | { type: 'CONFIRM' }
  | { type: 'ROLLBACK'; payload?: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'ADD_TASK'; payload: Task }
  | {
      type: 'UPDATE_TASK';
      payload: Partial<Task> & { _id?: string; id?: string };
    }
  | { type: 'REMOVE_TASK'; payload: string };

const COLUMNS: Column[] = [
  {
    id: 'Todo',
    title: 'To Do',
    border: 'border-slate-500/30',
    headerBg: 'bg-slate-500',
  },
  {
    id: 'In_Progress',
    title: 'In Progress',
    border: 'border-blue-500/30',
    headerBg: 'bg-blue-500',
  },
  {
    id: 'Review',
    title: 'Review',
    border: 'border-amber-500/30',
    headerBg: 'bg-amber-500',
  },
  {
    id: 'Done',
    title: 'Done',
    border: 'border-emerald-500/30',
    headerBg: 'bg-emerald-500',
  },
];

function isSameTask(a: Task, id: string): boolean {
  return a._id === id || a.id === id;
}

function findTask(tasks: Task[], id: string): Task | undefined {
  return tasks.find((t) => isSameTask(t, id));
}

function kanbanReducer(state: KanbanState, action: KanbanAction): KanbanState {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload, snapshot: null, error: null };

    case 'OPTIMISTIC_MOVE': {
      const { taskId, status } = action.payload;
      const next = state.tasks.map((t) => (isSameTask(t, taskId) ? { ...t, status } : t));
      return { ...state, tasks: next, snapshot: state.tasks, error: null };
    }

    case 'CONFIRM':
      return { ...state, snapshot: null };

    case 'ROLLBACK':
      return {
        ...state,
        tasks: state.snapshot ?? state.tasks,
        snapshot: null,
        error: action.payload ?? 'Update failed. Changes reverted.',
      };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };

    case 'UPDATE_TASK': {
      const patch = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          isSameTask(t, patch._id ?? '') || isSameTask(t, patch.id ?? '') ? { ...t, ...patch } : t
        ),
      };
    }

    case 'REMOVE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((t) => !isSameTask(t, action.payload)),
      };

    default:
      return state;
  }
}

export default function KanbanBoard({
  roomId,
  user,
  onBack,
}: {
  roomId: string;
  user: User;
  onBack?: () => void;
}) {
  const { socket, isConnected } = useSocketContext();
  const [state, dispatch] = useReducer(kanbanReducer, {
    tasks: [],
    snapshot: null,
    error: null,
  });

  const [editingColumn, setEditingColumn] = useState<Task['status'] | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const [dropTarget, setDropTarget] = useState<Task['status'] | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tasksByStatus = useMemo(() => {
    const map: Record<Task['status'], Task[]> = {
      Todo: [],
      In_Progress: [],
      Review: [],
      Done: [],
    };
    for (const t of state.tasks) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [state.tasks]);

  useSocket(
    'task_updated',
    (payload: { taskId: string; status: Task['status']; roomId: string }) => {
      if (!payload || payload.roomId !== roomId) return;
      dispatch({
        type: 'UPDATE_TASK',
        payload: { _id: payload.taskId, status: payload.status },
      });
    }
  );

  useSocket('task_created', (payload: Task & { roomId: string }) => {
    if (!payload || payload.roomId !== roomId) return;
    dispatch({ type: 'ADD_TASK', payload });
  });

  useSocket('typing_start', (payload: { socketId: string; user?: { name: string } }) => {
    if (!payload || payload.socketId === socket?.id) return;
    setTypingUsers((prev) => ({
      ...prev,
      [payload.socketId]: payload.user?.name ?? 'Someone',
    }));
  });

  useSocket('typing_stop', (payload: { socketId: string }) => {
    if (!payload) return;
    setTypingUsers((prev) => {
      const next = { ...prev };
      delete next[payload.socketId];
      return next;
    });
  });

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.emit('join_room', roomId, (res: { success: boolean; error?: string }) => {
      if (!res?.success) {
        dispatch({
          type: 'ROLLBACK',
          payload: `Failed to join room: ${res?.error ?? 'unknown'}`,
        });
      }
    });

    return () => {
      socket.emit('leave_room', roomId);
    };
  }, [socket, roomId]);

  useEffect(() => {
    if (!state.error) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_ERROR' }), 5000);
    return () => clearTimeout(t);
  }, [state.error]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (socket && roomId) {
        socket.emit('typing_stop', { roomId });
      }
    };
  }, [socket, roomId]);

  const moveTask = useCallback(
    (taskId: string, newStatus: Task['status']) => {
      const task = findTask(state.tasks, taskId);
      if (!task || task.status === newStatus) return;

      const previousStatus = task.status;
      dispatch({
        type: 'OPTIMISTIC_MOVE',
        payload: { taskId, status: newStatus },
      });

      if (!socket) return;

      const timeout = setTimeout(() => {
        dispatch({
          type: 'ROLLBACK',
          payload: 'Server did not respond. Changes reverted.',
        });
      }, 8000);

      socket.emit(
        'task_update_status',
        {
          roomId,
          taskId,
          status: newStatus,
          previousStatus,
          updatedBy: user?.id ?? user?.name ?? null,
        },
        (response: { success: boolean; error?: string }) => {
          clearTimeout(timeout);
          if (response?.success) {
            dispatch({ type: 'CONFIRM' });
          } else {
            dispatch({
              type: 'ROLLBACK',
              payload: response?.error ?? 'Server rejected update.',
            });
          }
        }
      );
    },
    [state.tasks, socket, roomId, user]
  );

  const emitTyping = useCallback(() => {
    if (!socket || !roomId) return;

    socket.emit('typing_start', { roomId, user });

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing_stop', { roomId });
    }, 1500);
  }, [socket, roomId, user]);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task._id ?? task.id ?? '');
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, status: Task['status']) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(status);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, status: Task['status']) => {
      e.preventDefault();
      if (!draggedTask) return;
      const id = draggedTask._id ?? draggedTask.id;
      if (id) moveTask(id, status);
      setDropTarget(null);
    },
    [draggedTask, moveTask]
  );

  const handleAddTask = useCallback(
    (status: Task['status']) => {
      const title = newTaskTitle.trim();
      if (!title) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newTask: Task = {
        _id: tempId,
        title,
        description: '',
        status,
        priority: 'Medium',
        createdAt: new Date().toISOString(),
      };

      dispatch({ type: 'ADD_TASK', payload: newTask });
      setNewTaskTitle('');
      setEditingColumn(null);

      if (socket) {
        socket.emit(
          'task_create',
          { roomId, task: newTask },
          (response: { success: boolean; task?: Task; error?: string }) => {
            if (response?.success && response.task) {
              dispatch({
                type: 'UPDATE_TASK',
                payload: {
                  _id: tempId,
                  id: response.task._id ?? response.task.id,
                },
              });
            } else {
              dispatch({ type: 'REMOVE_TASK', payload: tempId });
              dispatch({
                type: 'ROLLBACK',
                payload: response?.error ?? 'Failed to create task.',
              });
            }
          }
        );
      }
    },
    [newTaskTitle, socket, roomId]
  );

  const typingText = useMemo(() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names[0]} and ${names.length - 1} others are typing...`;
  }, [typingUsers]);

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#0a0a0a] text-white">
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#111] shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-white/50 hover:text-white transition-colors text-sm"
            >
              &larr; Back
            </button>
          )}
          <h1 className="text-base font-semibold tracking-tight">Kanban Board</h1>
          <span className="text-[11px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full font-mono">
            {roomId}
          </span>
          <span className="text-xs text-white/40">
            {state.tasks.length} task{state.tasks.length !== 1 ? 's' : ''}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              isConnected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
            }`}
          >
            {isConnected ? 'connected' : 'disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {typingText && (
            <span className="text-xs text-emerald-400/70 animate-pulse flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {typingText}
            </span>
          )}

          {state.error && (
            <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
              <AlertCircle size={12} />
              {state.error}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex gap-4 p-6 overflow-x-auto items-start">
        {COLUMNS.map((col) => {
          const tasks = tasksByStatus[col.id];
          const isOver = dropTarget === col.id;

          return (
            <div
              key={col.id}
              className={`flex flex-col rounded-xl border min-w-[280px] w-[280px] max-h-full transition-all duration-150 ${
                col.border
              } ${isOver ? 'ring-2 ring-white/20 scale-[1.01]' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div
                className={`flex items-center justify-between px-4 py-3 rounded-t-xl ${col.headerBg}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white/60" />
                  <h2 className="text-sm font-semibold text-white drop-shadow-sm">{col.title}</h2>
                  <span className="text-xs text-white/80 bg-white/20 px-1.5 py-0.5 rounded-full font-medium">
                    {tasks.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setEditingColumn(col.id);
                    setNewTaskTitle('');
                  }}
                  className="text-white/70 hover:text-white transition-colors p-0.5"
                  aria-label={`Add task to ${col.title}`}
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2 p-3 overflow-y-auto max-h-[calc(100vh-220px)]">
                {tasks.map((task) => {
                  const taskId = task._id ?? task.id ?? '';
                  return (
                    <div
                      key={taskId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      className="group bg-[#1a1a1a] border border-white/5 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-white/20 transition-all duration-150 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical
                          size={14}
                          className="mt-0.5 shrink-0 text-white/20 group-hover:text-white/40 transition-colors"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white/90 leading-snug break-words">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-white/40 mt-1.5 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          {task.priority && (
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                task.priority === 'High'
                                  ? 'bg-red-500/20 text-red-300'
                                  : task.priority === 'Medium'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-slate-500/20 text-slate-300'
                              }`}
                            >
                              {task.priority}
                            </span>
                          )}

                          {task.assignedTo && (
                            <span
                              className="w-5 h-5 rounded-full bg-white/10 border border-[#1a1a1a] flex items-center justify-center text-[9px] font-medium text-white/60 shrink-0"
                              title={task.assignedTo.name ?? 'Assigned'}
                            >
                              {(task.assignedTo.name?.[0] ?? '?').toUpperCase()}
                            </span>
                          )}
                        </div>

                        {task.dueDate && (
                          <span className="text-[10px] text-white/30">
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {tasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-white/15 text-xs select-none">
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center mb-2">
                      <Plus size={14} />
                    </div>
                    <span>Drop tasks here</span>
                  </div>
                )}
              </div>

              {editingColumn === col.id && (
                <div className="p-3 border-t border-white/5">
                  <input
                    autoFocus
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTask(col.id);
                      if (e.key === 'Escape') {
                        setEditingColumn(null);
                        setNewTaskTitle('');
                      }
                      emitTyping();
                    }}
                    placeholder="Task title..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:bg-white/[7%] transition-all"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleAddTask(col.id)}
                      className="flex-1 bg-white/10 hover:bg-white/20 text-xs font-medium text-white rounded-lg py-1.5 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setEditingColumn(null);
                        setNewTaskTitle('');
                      }}
                      className="text-white/40 hover:text-white/60 text-xs py-1.5 px-3 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
