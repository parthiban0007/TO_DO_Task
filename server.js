const express = require('express');
const cors = require('cors');
const xlsx = require('xlsx');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
// Serve static files from the current directory
app.use(express.static(__dirname));

app.post('/api/sync', (req, res) => {
    try {
        const tasks = req.body;

        if (!Array.isArray(tasks)) {
            return res.status(400).json({ success: false, error: 'Invalid data format' });
        }

        const formattedTasks = tasks.map((task, index) => ({
            id: index + 1,
            title: task.title,
            note: task.note,
            priority: task.priority,
            category: task.category,
            startDate: task.startDate || '',
            due: task.due,
            status: task.status || 'todo',
            done: task.done ? 'finish' : 'unfinish',
            timeSpent: task.timeSpent || 0,
            created: new Date(task.created).toLocaleString()
        }));

        // Convert the tasks JSON array into an Excel worksheet
        const worksheet = xlsx.utils.json_to_sheet(formattedTasks);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Tasks');

        // Write the Excel file to the local directory
        const filePath = path.join(__dirname, 'tasks.xlsx');
        xlsx.writeFile(workbook, filePath);

        res.status(200).json({ success: true, message: 'Tasks synced to Excel' });
    } catch (error) {
        console.error('Error writing Excel file:', error);
        res.status(500).json({ success: false, error: 'Failed to write Excel file' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'todo_task_manager_app.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
