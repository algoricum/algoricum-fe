"use client";

import React, { useEffect, useState } from "react";
import { Plus, Calendar, X } from "lucide-react";
import dayjs from "dayjs";
import { createClient } from "@/utils/supabase/config/client";

interface Task {
  id: string;
  task: string;
  priority: "low" | "medium" | "high";
  time: string;
  completed: boolean;
  due_at: string;
}
const supabase = createClient();

export default function TodayTasks({ clinicId }: { clinicId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    task: "",
    priority: "low",
    time: "",
  });

  

  const fetchTasks = async () => {
    const start = dayjs().startOf("day").toISOString();
    const end = dayjs().endOf("day").toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("clinic_id", clinicId)
      .gte("due_at", start)
      .lte("due_at", end)
      .order("due_at", { ascending: true });

    if (error) console.error("Error fetching tasks:", error);
    else setTasks(data);
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const { error } = await supabase.from("tasks").update({ completed: !task.completed }).eq("id", taskId);

    if (!error) fetchTasks();
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();

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

    if (!error) {
      setNewTask({ task: "", priority: "low", time: "" });
      setShowAddTaskModal(false);
      fetchTasks();
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [clinicId]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">{"Today's Tasks"}</h3>
        <button onClick={() => setShowAddTaskModal(true)} className="btn btn-primary btn-sm flex items-center">
          <Plus className="w-4 h-4 mr-1" />
          Add Task
        </button>
      </div>
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No tasks for today</p>
            <p className="text-sm">Add some tasks to get started</p>
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="flex items-start space-x-3">
              <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} className="mt-1 cursor-pointer" />
              <div className="flex flex-col w-full">
                <div className="flex justify-between">
                  <p className={`text-sm break-words pr-2 ${task.completed ? "line-through text-gray-500" : "text-gray-900"} flex-1`}>
                    {task.task}
                  </p>
<span className="text-xs text-gray-500 whitespace-nowrap">
  {new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
</span>                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add New Task</h3>
              <button onClick={() => setShowAddTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Description</label>
                <input
                  type="text"
                  required
                  value={newTask.task}
                  onChange={e => setNewTask({ ...newTask, task: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                <button type="button" onClick={() => setShowAddTaskModal(false)} className="flex-1 btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn btn-primary">
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
