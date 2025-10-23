"use client";
import { ErrorToast } from "@/helpers/toast";
import { getClinicData } from "@/utils/supabase/clinic-helper";
import { createClient } from "@/utils/supabase/config/client";
import { Modal } from "antd";
import dayjs from "dayjs";
import { Calendar, CheckCircle, Clock, Info, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getAllIntegrationStatuses } from "../integrations/integrationUtils";
import { Task, SPECIAL_TASK_IDS, TASK_STYLES } from "./types";

const supabase = createClient();

// Helper functions
const getTaskStyle = (task: Task) => {
  if (task.id === SPECIAL_TASK_IDS.ADD_INTEGRATIONS) return TASK_STYLES.INTEGRATION;
  if (task.completed) return TASK_STYLES.COMPLETED;
  return TASK_STYLES.PENDING;
};

const getTaskIcon = (task: Task) => {
  if (task.id === SPECIAL_TASK_IDS.ADD_INTEGRATIONS) {
    return <Info className="w-4 h-4 text-blue-600" />;
  }
  if (task.completed) {
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  }
  return <Clock className="w-4 h-4 text-purple-600" />;
};

const isSpecialTask = (taskId: string) => taskId === SPECIAL_TASK_IDS.ADD_INTEGRATIONS;

export default function TodayTasks({ clinicId }: { clinicId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    task: "",
    priority: "low",
    time: "",
  });

  useEffect(() => {
    const initializeData = async () => {
      setIsLoading(true);
      try {
        const clinicData = await getClinicData();
        if (!clinicData?.id) {
          ErrorToast("Clinic ID is not found.");
          return;
        }

        // 1. Get integration statuses efficiently
        const integrationStatuses = await getAllIntegrationStatuses(clinicData.id);

        // 2. Create a simple structure for task fetching (we only need connection status)
        const connectedIntegrationCount = Object.values(integrationStatuses).filter(status => status === "connected").length;
        const totalAvailableIntegrations = Object.keys(integrationStatuses).length;
        const hasDisconnectedIntegrations = connectedIntegrationCount < totalAvailableIntegrations;

        // 3. Fetch tasks with integration availability info
        await fetchTasks(hasDisconnectedIntegrations);
      } catch (error) {
        console.error("Failed to initialize data:", error);
        ErrorToast("Failed to initialize data");
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [clinicId, supabase]);

  const fetchTasks = async (hasDisconnectedIntegrations: boolean) => {
    try {
      const start = dayjs().startOf("day").toISOString();
      const end = dayjs().endOf("day").toISOString();

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("clinic_id", clinicId)
        .gte("due_at", start)
        .lte("due_at", end)
        .order("due_at", { ascending: true });

      if (error) {
        console.error("Error fetching tasks:", error);
        return;
      }

      // ✅ Only one "Add more integrations" task if any are available
      let integrationTask: Task[] = [];
      if (hasDisconnectedIntegrations) {
        integrationTask = [
          {
            id: SPECIAL_TASK_IDS.ADD_INTEGRATIONS,
            clinic_id: clinicId,
            task: "More CRM & Tools are available. Connect now!",
            priority: "low",
            completed: false,
          },
        ];
      }

      const taskList = [...data, ...integrationTask];
      setTasks(taskList);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const originalCompleted = task.completed;
    const revertOptimisticUpdate = () => {
      setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? { ...t, completed: originalCompleted } : t)));
    };

    // Optimistically update UI immediately
    setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t)));

    try {
      const { error } = await supabase.from("tasks").update({ completed: !originalCompleted }).eq("id", taskId);

      if (error) {
        console.error("Error updating task:", error);
        revertOptimisticUpdate();
        ErrorToast("Failed to update task. Please try again.");
      }
    } catch (err) {
      console.error("Unexpected error updating task:", err);
      revertOptimisticUpdate();
      ErrorToast("Failed to update task. Please try again.");
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const today = dayjs().format("YYYY-MM-DD");
      const dueAt = dayjs(`${today}T${newTask.time}`).toISOString();

      const { error } = await supabase.from("tasks").insert({
        clinic_id: clinicId,
        task: newTask.task,
        priority: newTask.priority,
        time: newTask.time,
        due_at: dueAt,
        completed: false,
        is_automated: false,
      });

      if (error) {
        console.error("Error adding task:", error);
        ErrorToast("Failed to add task. Please try again.");
        return;
      }

      // Success - clear form and close modal
      setNewTask({ task: "", priority: "low", time: "" });
      setShowAddTaskModal(false);

      // Refresh tasks - check integration status again
      const integrationStatuses = await getAllIntegrationStatuses(clinicId);
      const connectedCount = Object.values(integrationStatuses).filter(status => status === "connected").length;
      const totalCount = Object.keys(integrationStatuses).length;
      const hasDisconnected = connectedCount < totalCount;

      await fetchTasks(hasDisconnected);
    } catch (err) {
      console.error("Unexpected error adding task:", err);
      ErrorToast("Failed to add task. Please try again.");
    }
  };

  return (
    <div className="card h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">{"Today's Tasks"}</h3>
        <button
          onClick={() => setShowAddTaskModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
            <p>Loading tasks...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No tasks for today</p>
            <p className="text-sm">Add some tasks to get started</p>
          </div>
        ) : (
          tasks.map(task => {
            const taskStyle = getTaskStyle(task);
            return (
              <div
                key={task.id}
                className={`flex items-start space-x-3 rounded-lg p-3 bg-gray-50 ${taskStyle.cursor}`}
                onClick={() => !isSpecialTask(task.id) && toggleTask(task.id)}
              >
                {/* Icon with colored background */}
                <div className="flex-shrink-0">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${taskStyle.bgColor}`}>{getTaskIcon(task)}</div>
                </div>

                {/* Task content */}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${task.completed ? "line-through text-gray-500" : "text-gray-900"}`}>{task.task}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {task.due_at && !Number.isNaN(Date.parse(task.due_at))
                      ? new Date(task.due_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "Today"}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Task Modal */}
      <Modal title="Add New Task" open={showAddTaskModal} onCancel={() => setShowAddTaskModal(false)} footer={null} centered width={500}>
        <form onSubmit={handleAddTask} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Description</label>
            <input
              type="text"
              required
              value={newTask.task}
              onChange={e => setNewTask({ ...newTask, task: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter task description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              required
              value={newTask.time}
              onChange={e => setNewTask({ ...newTask, time: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowAddTaskModal(false)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              Add Task
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
