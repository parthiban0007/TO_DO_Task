let tasks = [], currentView = 'all', currentFilter = 'all';

    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

    function toggleForm() { const f = document.getElementById('add-form'); f.classList.toggle('open'); if (f.classList.contains('open')) document.getElementById('new-title').focus() }
    function setView(v) { 
      currentView = v; 
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); 
      event.currentTarget.classList.add('active'); 
      const titles = { all: 'All Tasks', today: "Today's Tasks", active: 'Active Tasks', done: 'Completed Tasks', 'cat-work': 'Work', 'cat-personal': 'Personal', 'cat-study': 'Study', kanban: 'Kanban Board', gantt: 'Gantt Chart', analytics: 'Analytics Dashboard' }; 
      document.getElementById('view-title').textContent = titles[v] || 'Tasks'; 
      
      const views = ['list-view-container', 'kanban-view-container', 'gantt-view-container', 'analytics-view-container'];
      views.forEach(id => document.getElementById(id).style.display = 'none');
      
      if (['kanban', 'gantt', 'analytics'].includes(v)) {
        document.getElementById(`${v}-view-container`).style.display = 'block';
        if (v === 'kanban') renderKanban();
        if (v === 'gantt') renderGantt();
        if (v === 'analytics') renderAnalytics();
      } else {
        document.getElementById('list-view-container').style.display = 'block';
        renderList(); 
      }
    }
    function setFilter(f, el) { currentFilter = f; document.querySelectorAll('.filter-chip').forEach(x => x.classList.remove('active')); el.classList.add('active'); renderList(); if(currentView === 'kanban') renderKanban(); if(currentView==='gantt') renderGantt(); }

    function todayStr() { return new Date().toISOString().split('T')[0] }
    function dueCls(due) { if (!due) return ''; if (due < todayStr()) return 'overdue'; if (due === todayStr()) return 'today'; return '' }
    function priorityOrder(p) { return { high: 0, med: 1, low: 2 }[p] || 1 }

    async function addTask() {
      const title = document.getElementById('new-title').value.trim();
      if (!title) { toast('Title required'); return }
      const t = { 
        id: uid(), title, note: document.getElementById('new-note').value.trim(), 
        priority: document.getElementById('new-priority').value, 
        category: document.getElementById('new-cat').value, 
        startDate: document.getElementById('new-start').value || todayStr(),
        due: document.getElementById('new-due').value, 
        done: false, status: 'todo', timeSpent: 0, created: Date.now() 
      };
      await dbPut(t); tasks.push(t);
      document.getElementById('new-title').value = ''; document.getElementById('new-note').value = ''; document.getElementById('new-due').value = ''; document.getElementById('new-start').value = '';
      document.getElementById('add-form').classList.remove('open');
      renderViews(); updateBadges(); syncToExcel(); toast('Task added')
    }

    function renderViews() {
      if (currentView === 'kanban') renderKanban();
      else if (currentView === 'gantt') renderGantt();
      else if (currentView === 'analytics') renderAnalytics();
      else renderList();
    }

    async function toggleDone(id) {
      const t = tasks.find(x => x.id === id); if (!t) return;
      t.done = !t.done; 
      t.status = t.done ? 'done' : 'todo';
      await dbPut(t); renderViews(); updateBadges(); syncToExcel(); toast(t.done ? 'Marked complete' : 'Marked active')
    }

    async function deleteTask(id) {
      if (activeTimerId === id) toggleTimer(id);
      tasks = tasks.filter(x => x.id !== id); await dbDel(id); renderViews(); updateBadges(); syncToExcel(); toast('Task deleted')
    }

    function openEdit(id) {
      const t = tasks.find(x => x.id === id); if (!t) return;
      document.getElementById('edit-id').value = id;
      document.getElementById('edit-title').value = t.title;
      document.getElementById('edit-note').value = t.note || '';
      document.getElementById('edit-priority').value = t.priority;
      document.getElementById('edit-cat').value = t.category;
      document.getElementById('edit-start').value = t.startDate || '';
      document.getElementById('edit-due').value = t.due || '';
      document.getElementById('edit-status').value = t.status || (t.done ? 'done' : 'todo');
      document.getElementById('edit-modal').classList.add('open')
    }
    function closeModal() { document.getElementById('edit-modal').classList.remove('open') }
    async function saveEdit() {
      const id = document.getElementById('edit-id').value;
      const t = tasks.find(x => x.id === id); if (!t) return;
      t.title = document.getElementById('edit-title').value.trim() || t.title;
      t.note = document.getElementById('edit-note').value.trim();
      t.priority = document.getElementById('edit-priority').value;
      t.category = document.getElementById('edit-cat').value;
      t.startDate = document.getElementById('edit-start').value;
      t.due = document.getElementById('edit-due').value;
      t.status = document.getElementById('edit-status').value;
      t.done = (t.status === 'done');
      await dbPut(t); closeModal(); renderViews(); updateBadges(); syncToExcel(); toast('Task updated')
    }
    async function deleteFromModal() {
      const id = document.getElementById('edit-id').value;
      closeModal(); await deleteTask(id)
    }

    function getFiltered() {
      let list = [...tasks];
      const q = document.getElementById('search-input').value.trim().toLowerCase();
      if (q) list = list.filter(t => t.title.toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q));
      if (currentView === 'today') list = list.filter(t => t.due === todayStr());
      else if (currentView === 'active') list = list.filter(t => !t.done);
      else if (currentView === 'done') list = list.filter(t => t.done);
      else if (currentView === 'cat-work') list = list.filter(t => t.category === 'work');
      else if (currentView === 'cat-personal') list = list.filter(t => t.category === 'personal');
      else if (currentView === 'cat-study') list = list.filter(t => t.category === 'study');
      if (currentFilter !== 'all') list = list.filter(t => t.priority === currentFilter);
      const sort = document.getElementById('sort-select').value;
      if (sort === 'due') list.sort((a, b) => { if (!a.due && !b.due) return 0; if (!a.due) return 1; if (!b.due) return -1; return a.due.localeCompare(b.due) });
      else if (sort === 'priority') list.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
      else if (sort === 'alpha') list.sort((a, b) => a.title.localeCompare(b.title));
      else list.sort((a, b) => b.created - a.created);
      return list
    }

    function renderList() {
      const list = getFiltered(); const el = document.getElementById('task-list');
      if (!list.length) { el.innerHTML = `<div class="empty"><div class="empty-icon">◈</div><div class="empty-text">No tasks found</div></div>`; return }
      const active = list.filter(t => !t.done), done = list.filter(t => t.done);
      let html = '';
      if (active.length) { html += `<div class="section-label">Active · ${active.length}</div>`; active.forEach(t => html += taskHTML(t)) }
      if (done.length) { html += `<div class="section-label" style="margin-top:${active.length ? '16px' : '0'}">Completed · ${done.length}</div>`; done.forEach(t => html += taskHTML(t)) }
      el.innerHTML = html
    }

    function formatTime(secs) {
      if(!secs) return '0m';
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    function taskHTML(t) {
      const dc = dueCls(t.due);
      const dueLabel = t.due ? `<span class="tag-due ${dc}">${dc === 'today' ? 'Today' : dc === 'overdue' ? 'Overdue' : t.due}</span>` : '';
      const pCls = { high: 'tag-high', med: 'tag-med', low: 'tag-low' }[t.priority];
      const isTracking = activeTimerId === t.id;
      return `<div class="task-item ${t.done ? 'done' : ''}" id="task-${t.id}">
    <div class="check-box ${t.done ? 'checked' : ''}" onclick="toggleDone('${t.id}')"><span class="check-icon">✓</span></div>
    <div class="task-body">
      <div class="task-title">${esc(t.title)}</div>
      ${t.note ? `<div class="task-note">${esc(t.note)}</div>` : ''}
      <div class="task-meta">
        <span class="tag ${pCls}">${t.priority}</span>
        <span class="tag tag-cat">${t.category}</span>
        ${dueLabel}
        <span class="timer-pill ${isTracking ? 'active' : ''}" id="timer-${t.id}">⏱ ${formatTime(t.timeSpent)}</span>
        <button class="btn-timer ${isTracking ? 'stop' : 'play'}" onclick="toggleTimer('${t.id}')" title="${isTracking ? 'Stop Tracking' : 'Start Tracking'}">${isTracking ? '⏹' : '▶'}</button>
      </div>
    </div>
    <div class="task-actions">
      <button class="icon-btn" onclick="openEdit('${t.id}')" title="Edit">✎</button>
      <button class="icon-btn del" onclick="deleteTask('${t.id}')" title="Delete">✕</button>
    </div>
  </div>`
    }

    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

    function updateBadges() {
      const today = todayStr();
      document.getElementById('badge-all').textContent = tasks.length;
      document.getElementById('badge-today').textContent = tasks.filter(t => t.due === today).length;
      document.getElementById('badge-active').textContent = tasks.filter(t => !t.done).length;
      document.getElementById('badge-done').textContent = tasks.filter(t => t.done).length;
      document.getElementById('badge-work').textContent = tasks.filter(t => t.category === 'work').length;
      document.getElementById('badge-personal').textContent = tasks.filter(t => t.category === 'personal').length;
      document.getElementById('badge-study').textContent = tasks.filter(t => t.category === 'study').length;
      document.getElementById('s-total').textContent = tasks.length;
      document.getElementById('s-done').textContent = tasks.filter(t => t.done).length;
      document.getElementById('s-high').textContent = tasks.filter(t => t.priority === 'high').length;
    }

    let toastTimer;
    function toast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2000) }

    async function syncToExcel() {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tasks)
        });
      } catch (err) {
        console.error('Failed to sync to Excel:', err);
      }
    }

    async function init() {
      await openDB();
      tasks = await dbGet();
      if (!tasks.length) {
        const seed = [
          { id: uid(), title: 'Review Q3 project proposal', note: 'Check the budget estimates and timeline', priority: 'high', category: 'work', startDate: todayStr(), due: todayStr(), done: false, status: 'todo', timeSpent: 0, created: Date.now() - 5000 },
          { id: uid(), title: 'Read "Designing Data-Intensive Applications"', note: 'Chapter 3 — Storage engines', priority: 'med', category: 'study', startDate: todayStr(), due: '', done: false, status: 'in-progress', timeSpent: 3600, created: Date.now() - 4000 },
          { id: uid(), title: 'Grocery run — weekend', note: 'Milk, coffee, sourdough bread', priority: 'low', category: 'personal', startDate: todayStr(), due: '', done: false, status: 'todo', timeSpent: 0, created: Date.now() - 3000 },
          { id: uid(), title: 'Fix authentication bug in API', note: 'Token expiry not handled correctly', priority: 'high', category: 'work', startDate: todayStr(), due: todayStr(), done: true, status: 'done', timeSpent: 7200, created: Date.now() - 2000 },
        ];
        for (const t of seed) { await dbPut(t); tasks.push(t) }
      } else {
        // Data migration for older tasks
        let migrated = false;
        for (const t of tasks) {
          if (t.status === undefined) {
             t.status = t.done ? 'done' : 'todo';
             t.startDate = t.startDate || new Date(t.created).toISOString().split('T')[0];
             t.timeSpent = t.timeSpent || 0;
             await dbPut(t);
             migrated = true;
          }
        }
        if (migrated) syncToExcel();
      }
      renderViews(); updateBadges(); syncToExcel();
    }
    // --- Kanban Logic ---
    function renderKanban() {
      ['todo', 'in-progress', 'done'].forEach(status => {
        const list = tasks.filter(t => t.status === status);
        const el = document.getElementById(status === 'todo' ? 'kb-todo' : status === 'in-progress' ? 'kb-prog' : 'kb-done');
        document.getElementById(`kb-${status === 'in-progress' ? 'prog' : status}-count`).textContent = list.length;
        let html = '';
        list.forEach(t => {
          html += `<div class="kanban-card" draggable="true" ondragstart="kbDragStart(event, '${t.id}')" onclick="openEdit('${t.id}')">
            <div class="kb-title">${esc(t.title)}</div>
            <div class="kb-meta">
              <span class="tag ${ {high:'tag-high', med:'tag-med', low:'tag-low'}[t.priority] }">${t.priority}</span>
              ${t.due ? `<span class="tag-due">${t.due}</span>` : ''}
              ${t.timeSpent ? `<span style="font-size:10px;color:var(--muted)">⏱ ${formatTime(t.timeSpent)}</span>` : ''}
            </div>
          </div>`;
        });
        el.innerHTML = html;
      });
    }

    function kbDragStart(e, id) { e.dataTransfer.setData('text/plain', id); }
    function kbAllowDrop(e) { e.preventDefault(); }
    async function kbDrop(e, status) {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      const t = tasks.find(x => x.id === id);
      if (t && t.status !== status) {
        t.status = status;
        t.done = (status === 'done');
        await dbPut(t);
        renderViews(); updateBadges(); syncToExcel();
      }
    }

    // --- Gantt Chart Logic ---
    function renderGantt() {
      const el = document.getElementById('gantt-chart');
      if (!tasks.length) { el.innerHTML = '<div class="empty-text">No tasks for Gantt chart</div>'; return; }
      
      let minDate = new Date();
      let maxDate = new Date();
      tasks.forEach(t => {
        if(t.startDate && new Date(t.startDate) < minDate) minDate = new Date(t.startDate);
        if(t.due && new Date(t.due) > maxDate) maxDate = new Date(t.due);
        else if (t.startDate && new Date(t.startDate) > maxDate) maxDate = new Date(t.startDate);
      });
      
      minDate.setDate(minDate.getDate() - 2);
      maxDate.setDate(maxDate.getDate() + 14);
      
      const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
      
      let headerHtml = '<div class="gantt-header">';
      for(let i=0; i<totalDays; i++) {
         const d = new Date(minDate); d.setDate(d.getDate() + i);
         headerHtml += `<div class="gantt-header-date" style="flex-basis: ${100/totalDays}%">${d.getDate()}/${d.getMonth()+1}</div>`;
      }
      headerHtml += '</div>';
      
      let rowsHtml = '';
      tasks.forEach(t => {
         const start = t.startDate ? new Date(t.startDate) : new Date();
         const end = t.due ? new Date(t.due) : new Date(start);
         end.setDate(end.getDate() + 1); // min 1 day width
         
         const leftPct = Math.max(0, (start - minDate) / (1000 * 60 * 60 * 24)) / totalDays * 100;
         const widthPct = Math.max(1, (end - start) / (1000 * 60 * 60 * 24)) / totalDays * 100;
         
         rowsHtml += `<div class="gantt-row" title="${esc(t.title)}" onclick="openEdit('${t.id}')">
           <div class="gantt-bar ${t.done ? 'done' : ''}" style="left: ${leftPct}%; width: ${widthPct}%">${esc(t.title)}</div>
         </div>`;
      });
      
      el.innerHTML = headerHtml + rowsHtml;
    }

    // --- Analytics Logic ---
    let chart1, chart2;
    function renderAnalytics() {
      const totalSecs = tasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0);
      document.getElementById('stat-time').textContent = formatTime(totalSecs);
      
      const doneTasks = tasks.filter(t => t.done).length;
      document.getElementById('stat-rate').textContent = tasks.length ? Math.round((doneTasks / tasks.length) * 100) + '%' : '0%';
      
      if (!window.Chart) return;
      
      const statusCounts = { todo: 0, 'in-progress': 0, done: 0 };
      const catCounts = { work: 0, personal: 0, study: 0, other: 0 };
      
      tasks.forEach(t => { 
        if(statusCounts[t.status] !== undefined) statusCounts[t.status]++; 
        if(catCounts[t.category] !== undefined) catCounts[t.category]++;
      });
      
      const ctx1 = document.getElementById('statusChart').getContext('2d');
      if(chart1) chart1.destroy();
      chart1 = new Chart(ctx1, {
         type: 'doughnut',
         data: {
           labels: ['To Do', 'In Progress', 'Done'],
           datasets: [{ data: [statusCounts['todo'], statusCounts['in-progress'], statusCounts['done']], backgroundColor: ['#444', '#c9a96e', '#3d7a5c'], borderWidth: 0 }]
         },
         options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#f0ece0' } } } }
      });
      
      const ctx2 = document.getElementById('categoryChart').getContext('2d');
      if(chart2) chart2.destroy();
      chart2 = new Chart(ctx2, {
         type: 'bar',
         data: {
           labels: ['Work', 'Personal', 'Study', 'Other'],
           datasets: [{ label: 'Tasks', data: [catCounts.work, catCounts.personal, catCounts.study, catCounts.other], backgroundColor: '#e8d5a3' }]
         },
         options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#888', stepSize: 1 }, grid: { color: '#333' } }, x: { ticks: { color: '#888' }, grid: { display: false } } } }
      });
    }

    // --- Time Tracking Logic ---
    let activeTimerId = null;
    let timerInterval = null;
    
    async function toggleTimer(id) {
       if (activeTimerId === id) {
          clearInterval(timerInterval);
          activeTimerId = null;
          const t = tasks.find(x => x.id === id);
          if (t) await dbPut(t);
          renderViews();
          syncToExcel();
       } else {
          if (activeTimerId) {
             clearInterval(timerInterval);
             const oldT = tasks.find(x => x.id === activeTimerId);
             if (oldT) await dbPut(oldT);
          }
          activeTimerId = id;
          const t = tasks.find(x => x.id === id);
          if(t && t.status === 'todo') { t.status = 'in-progress'; await dbPut(t); } // Auto move to in-progress
          
          renderViews(); // To show active state
          
          timerInterval = setInterval(() => {
             const currentT = tasks.find(x => x.id === activeTimerId);
             if (currentT) {
                currentT.timeSpent = (currentT.timeSpent || 0) + 1;
                const pill = document.getElementById(`timer-${currentT.id}`);
                if(pill) pill.textContent = '⏱ ' + formatTime(currentT.timeSpent);
             }
          }, 1000);
       }
    }

    init();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }).catch(err => {
          console.log('ServiceWorker registration failed: ', err);
        });
      });
    }
