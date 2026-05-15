console.log('admin.js загружен');

// ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// ========== МОДАЛЬНЫЕ ОКНА ==========
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'block';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Закрытие модальных окон
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        const modal = closeBtn.closest('.modal');
        if (modal) modal.style.display = 'none';
    });
});

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// ========== ЗАГРУЗКА ОСТАНОВОК ДЛЯ ВЫБРАННОГО МАРШРУТА (РАСПИСАНИЕ) ==========
async function loadStopsForRoute(routeId) {
    const stopSelect = document.getElementById('modal-stop-id');
    if (!stopSelect) return;
    
    if (!routeId) {
        stopSelect.innerHTML = '<option value="">Сначала выберите маршрут</option>';
        return;
    }
    
    stopSelect.innerHTML = '<option value="">Загрузка...</option>';
    
    try {
        const response = await fetch(`/api/dispatcher/route/${routeId}/stops`);
        const stops = await response.json();
        
        if (stops.length === 0) {
            stopSelect.innerHTML = '<option value="">Нет остановок на маршруте</option>';
        } else {
            stopSelect.innerHTML = '<option value="">Выберите остановку</option>' + 
                stops.map(s => `<option value="${s.stop_id}">${s.stop_name} ${s.settlement_name ? '('+s.settlement_name+')' : ''}</option>`).join('');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        stopSelect.innerHTML = '<option value="">Ошибка загрузки остановок</option>';
    }
}

// Обработчик изменения маршрута в модальном окне расписания
const modalRouteSelect = document.getElementById('modal-route-id');
if (modalRouteSelect) {
    modalRouteSelect.addEventListener('change', function() {
        loadStopsForRoute(this.value);
    });
}

// ========== ЗАГРУЗКА РАСПИСАНИЯ ==========
const loadScheduleBtn = document.getElementById('load-schedule');
if (loadScheduleBtn) {
    loadScheduleBtn.addEventListener('click', loadSchedule);
}

const addScheduleBtn = document.getElementById('add-schedule-btn');
if (addScheduleBtn) {
    addScheduleBtn.addEventListener('click', () => {
        document.getElementById('schedule-id').value = '';
        document.getElementById('schedule-form').reset();
        document.getElementById('schedule-modal-title').textContent = 'Добавление рейса';
        openModal('schedule-modal');
    });
}

async function loadSchedule() {
    const routeId = document.getElementById('route-filter').value;
    const dayId = document.getElementById('day-filter').value;
    
    const tbody = document.getElementById('schedule-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Загрузка...</td></tr>';
    
    try {
        let url = '/api/dispatcher/schedule';
        const params = new URLSearchParams();
        if (routeId) params.append('route_id', routeId);
        if (dayId) params.append('day_id', dayId);
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        const schedules = await response.json();
        
        if (schedules.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет данных</td></tr>';
            return;
        }
        
        schedules.sort((a, b) => {
            if (a.route_number !== b.route_number) return a.route_number - b.route_number;
            return a.departure_time.localeCompare(b.departure_time);
        });
        
        tbody.innerHTML = schedules.map(s => `
            <tr>
                <td>${s.route_number} ${s.route_name}</td>
                <td>${s.departure_time}</td>
                <td>${s.arrival_time}</td>
                <td>${s.trip_number}</td>
                <td>
                    <button class="btn-edit" onclick="editSchedule(${s.schedule_id})">Изменить</button>
                    <button class="btn-danger" onclick="deleteSchedule(${s.schedule_id})">Удалить</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Ошибка загрузки</td></tr>';
    }
}

window.editSchedule = async function(id) {
    try {
        const response = await fetch(`/api/dispatcher/schedule/${id}`);
        const data = await response.json();
        
        document.getElementById('schedule-id').value = data.id;
        document.getElementById('modal-route-id').value = data.route_id;
        
        await loadStopsForRoute(data.route_id);
        document.getElementById('modal-stop-id').value = data.stop_id;
        document.getElementById('modal-day-id').value = data.day_id;
        document.getElementById('modal-time').value = data.time_departure;
        document.getElementById('modal-trip').value = data.trip_number;
        
        document.getElementById('schedule-modal-title').textContent = 'Редактирование рейса';
        openModal('schedule-modal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить данные рейса');
    }
};

window.deleteSchedule = async function(id) {
    if (!confirm('Удалить эту запись расписания?')) return;
    
    try {
        const response = await fetch('/api/dispatcher/schedule', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schedule_id: id })
        });
        
        const result = await response.json();
        if (result.success) {
            loadSchedule();
        } else {
            alert('Ошибка при удалении');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении');
    }
};

const scheduleForm = document.getElementById('schedule-form');
if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            schedule_id: document.getElementById('schedule-id').value || null,
            route_id: document.getElementById('modal-route-id').value,
            stop_id: document.getElementById('modal-stop-id').value,
            day_id: document.getElementById('modal-day-id').value,
            time: document.getElementById('modal-time').value,
            trip_number: document.getElementById('modal-trip').value
        };
        
        try {
            const response = await fetch('/api/dispatcher/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (result.success) {
                closeModal('schedule-modal');
                scheduleForm.reset();
                document.getElementById('schedule-id').value = '';
                loadSchedule();
            } else {
                alert('Ошибка при сохранении');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при сохранении');
        }
    });
}

// ========== ОСТАНОВКИ МАРШРУТОВ ==========
const loadStopsBtn = document.getElementById('load-stops-btn');
if (loadStopsBtn) {
    loadStopsBtn.addEventListener('click', loadRouteStops);
}

const addStopToRouteBtn = document.getElementById('add-stop-to-route-btn');
if (addStopToRouteBtn) {
    addStopToRouteBtn.addEventListener('click', () => {
        const routeId = document.getElementById('route-stops-select').value;
        if (!routeId) {
            alert('Сначала выберите маршрут');
            return;
        }
        document.getElementById('stop-route-id').value = routeId;
        openModal('stop-to-route-modal');
    });
}

async function loadRouteStops() {
    const routeId = document.getElementById('route-stops-select').value;
    if (!routeId) {
        alert('Выберите маршрут');
        return;
    }
    
    const tbody = document.getElementById('stops-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Загрузка...</td></tr>';
    
    try {
        const response = await fetch(`/api/dispatcher/route/${routeId}/stops`);
        const stops = await response.json();
        
        if (stops.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Нет остановок</td></tr>';
            return;
        }
        
        tbody.innerHTML = stops.map(s => `
            <tr>
                <td>${s.order_number}</td>
                <td>${s.stop_name}</td>
                <td>${s.settlement_name || '—'}</td>
                <td>
                    <button class="btn-edit" onclick="editStopInRoute(${s.stop_id})">Изменить</button>
                    <button class="btn-danger" onclick="removeStopFromRoute(${s.stop_id})">Удалить</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Ошибка загрузки</td></tr>';
    }
}

window.removeStopFromRoute = async function(stopId) {
    const routeId = document.getElementById('route-stops-select').value;
    if (!confirm('Удалить эту остановку из маршрута?')) return;
    
    try {
        const response = await fetch('/api/dispatcher/route/stop', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ route_id: routeId, stop_id: stopId })
        });
        
        const result = await response.json();
        if (result.success) {
            loadRouteStops();
        } else {
            alert('Ошибка при удалении');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении');
    }
};

const stopToRouteForm = document.getElementById('stop-to-route-form');
if (stopToRouteForm) {
    stopToRouteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            route_id: document.getElementById('stop-route-id').value,
            stop_id: document.getElementById('modal-add-stop-id').value,
            order_number: document.getElementById('modal-order-number').value
        };
        
        try {
            const response = await fetch('/api/dispatcher/route/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (result.success) {
                closeModal('stop-to-route-modal');
                stopToRouteForm.reset();
                loadRouteStops();
            } else {
                alert('Ошибка при добавлении');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при добавлении');
        }
    });
}

// ========== РЕДАКТИРОВАНИЕ ОСТАНОВКИ В МАРШРУТЕ ==========
window.editStopInRoute = async function(stopId) {
    const routeId = document.getElementById('route-stops-select').value;
    if (!routeId) return;
    
    try {
        const response = await fetch(`/api/dispatcher/route/stop/${routeId}/${stopId}`);
        const stop = await response.json();
        
        document.getElementById('edit-stop-route-id').value = routeId;
        document.getElementById('edit-old-stop-id').value = stopId;
        document.getElementById('edit-order-number').value = stop.order_number;
        document.getElementById('edit-current-stop').value = stop.stop_name;
        document.getElementById('edit-new-stop-id').value = '';
        
        openModal('edit-stop-modal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить данные остановки');
    }
};

const editStopForm = document.getElementById('edit-stop-form');
if (editStopForm) {
    editStopForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            route_id: document.getElementById('edit-stop-route-id').value,
            old_stop_id: document.getElementById('edit-old-stop-id').value,
            new_stop_id: document.getElementById('edit-new-stop-id').value
        };
        
        if (!formData.new_stop_id) {
            alert('Выберите новую остановку');
            return;
        }
        
        try {
            const response = await fetch('/api/dispatcher/route/stop', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (result.success) {
                closeModal('edit-stop-modal');
                loadRouteStops();
                alert('Остановка успешно изменена');
            } else {
                alert('Ошибка при обновлении остановки');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при обновлении остановки');
        }
    });
}

// ========== МАРКЕРЫ ==========
async function loadMarkers() {
    const tbody = document.getElementById('markers-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Загрузка...</td></tr>';
    
    try {
        const response = await fetch('/api/dispatcher/markers');
        const markers = await response.json();
        
        if (markers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Нет активных маркеров</td></tr>';
            return;
        }
        
        tbody.innerHTML = markers.map(m => `
            <tr>
                <td>${new Date(m.marker_time).toLocaleString()}</td>
                <td>${m.stop_name}</td>
                <td>${m.route_name}</td>
                <td>${m.marker_type}</td>
                <td>${m.dispatcher_name}</td>
                <td>
                    <button class="btn-edit" onclick="editMarker(${m.marker_id})">Изменить</button>
                    <button class="btn-danger" onclick="deleteMarker(${m.marker_id})">Удалить</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Ошибка загрузки</td></tr>';
    }
}

const addMarkerBtn = document.getElementById('add-marker-btn');
if (addMarkerBtn) {
    addMarkerBtn.addEventListener('click', () => {
        openModal('marker-modal');
        loadStopsForMarker();
    });
}

async function loadStopsForMarker() {
    const routeId = document.getElementById('marker-route-id').value;
    const stopSelect = document.getElementById('marker-stop-id');
    if (!stopSelect) return;
    
    if (!routeId) {
        stopSelect.innerHTML = '<option value="">Сначала выберите маршрут</option>';
        return;
    }
    
    stopSelect.innerHTML = '<option value="">Загрузка...</option>';
    
    try {
        const response = await fetch(`/api/dispatcher/route/${routeId}/stops`);
        const stops = await response.json();
        
        if (stops.length === 0) {
            stopSelect.innerHTML = '<option value="">Нет остановок на маршруте</option>';
        } else {
            stopSelect.innerHTML = '<option value="">Выберите остановку</option>' + 
                stops.map(s => `<option value="${s.stop_id}">${s.stop_name} ${s.settlement_name ? '('+s.settlement_name+')' : ''}</option>`).join('');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        stopSelect.innerHTML = '<option value="">Ошибка загрузки остановок</option>';
    }
}

const markerRouteSelect = document.getElementById('marker-route-id');
if (markerRouteSelect) {
    markerRouteSelect.addEventListener('change', loadStopsForMarker);
}

const markerForm = document.getElementById('marker-form');
if (markerForm) {
    markerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            route_id: document.getElementById('marker-route-id').value,
            stop_id: document.getElementById('marker-stop-id').value,
            type_marker_id: document.getElementById('marker-type-id').value
        };
        
        if (!formData.stop_id) {
            alert('Выберите остановку');
            return;
        }
        
        try {
            const response = await fetch('/api/dispatcher/markers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (result.success) {
                closeModal('marker-modal');
                markerForm.reset();
                document.getElementById('marker-stop-id').innerHTML = '<option value="">Сначала выберите маршрут</option>';
                loadMarkers();
            } else {
                alert('Ошибка при добавлении маркера');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при добавлении маркера');
        }
    });
}

window.deleteMarker = async function(markerId) {
    if (!confirm('Удалить этот маркер?')) return;
    
    try {
        const response = await fetch('/api/dispatcher/markers', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marker_id: markerId })
        });
        
        const result = await response.json();
        if (result.success) {
            loadMarkers();
        } else {
            alert('Ошибка при удалении маркера');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении маркера');
    }
};

window.editMarker = async function(markerId) {
    try {
        const response = await fetch(`/api/dispatcher/markers/${markerId}`);
        const marker = await response.json();
        
        document.getElementById('edit-marker-id').value = marker.id;
        document.getElementById('edit-marker-route-id').value = marker.route_id;
        document.getElementById('edit-marker-type-id').value = marker.type_marker_id;
        
        await loadStopsForEditMarker(marker.route_id);
        document.getElementById('edit-marker-stop-id').value = marker.stop_id;
        
        openModal('edit-marker-modal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить данные маркера');
    }
};

async function loadStopsForEditMarker(routeId) {
    const stopSelect = document.getElementById('edit-marker-stop-id');
    if (!stopSelect) return;
    
    if (!routeId) {
        stopSelect.innerHTML = '<option value="">Сначала выберите маршрут</option>';
        return;
    }
    
    stopSelect.innerHTML = '<option value="">Загрузка...</option>';
    
    try {
        const response = await fetch(`/api/dispatcher/route/${routeId}/stops`);
        const stops = await response.json();
        
        if (stops.length === 0) {
            stopSelect.innerHTML = '<option value="">Нет остановок на маршруте</option>';
        } else {
            stopSelect.innerHTML = stops.map(s => 
                `<option value="${s.stop_id}">${s.stop_name} ${s.settlement_name ? '('+s.settlement_name+')' : ''}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        stopSelect.innerHTML = '<option value="">Ошибка загрузки остановок</option>';
    }
}

const editMarkerRouteSelect = document.getElementById('edit-marker-route-id');
if (editMarkerRouteSelect) {
    editMarkerRouteSelect.addEventListener('change', function() {
        loadStopsForEditMarker(this.value);
    });
}

const editMarkerForm = document.getElementById('edit-marker-form');
if (editMarkerForm) {
    editMarkerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const markerId = document.getElementById('edit-marker-id').value;
        const formData = {
            route_id: document.getElementById('edit-marker-route-id').value,
            stop_id: document.getElementById('edit-marker-stop-id').value,
            type_marker_id: document.getElementById('edit-marker-type-id').value
        };
        
        if (!formData.stop_id) {
            alert('Выберите остановку');
            return;
        }
        
        try {
            const response = await fetch(`/api/dispatcher/markers/${markerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (result.success) {
                closeModal('edit-marker-modal');
                loadMarkers();
                showMessage('Маркер обновлён', 'success');
            } else {
                alert('Ошибка при обновлении маркера');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при обновлении маркера');
        }
    });
}

// ========== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ==========
async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка...</td></tr>';
    
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет пользователей</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${u.name}</td>
                <td>${u.surname}</td>
                <td>${u.patronymic || '—'}</td>
                <td>${u.login}</td>
                <td><span class="role-badge role-${u.role === 'Администратор' ? 'admin' : (u.role === 'Диспетчер' ? 'dispatcher' : 'user')}">${u.role}</span></td>
                <td>
                    <button class="btn-edit" onclick="editUser(${u.id})">Изменить</button>
                    <button class="btn-danger" onclick="deleteUser(${u.id})">Удалить</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Ошибка загрузки</td></tr>';
    }
}

const addUserBtn = document.getElementById('add-user-btn');
if (addUserBtn) {
    addUserBtn.addEventListener('click', () => {
        document.getElementById('user-modal-title').textContent = 'Добавление пользователя';
        document.getElementById('user-id').value = '';
        document.getElementById('user-name').value = '';
        document.getElementById('user-surname').value = '';
        document.getElementById('user-patronymic').value = '';
        document.getElementById('user-login').value = '';
        document.getElementById('user-password').value = '';
        document.getElementById('user-role-id').value = '';
        openModal('user-modal');
    });
}

const userForm = document.getElementById('user-form');
if (userForm) {
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            id: document.getElementById('user-id').value || null,
            name: document.getElementById('user-name').value,
            surname: document.getElementById('user-surname').value,
            patronymic: document.getElementById('user-patronymic').value,
            login: document.getElementById('user-login').value,
            password: document.getElementById('user-password').value,
            role_id: document.getElementById('user-role-id').value
        };
        
        if (!formData.password && !formData.id) {
            alert('Введите пароль');
            return;
        }
        
        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (result.success) {
                closeModal('user-modal');
                loadUsers();
                showMessage('Пользователь сохранён', 'success');
            } else {
                alert(result.error || 'Ошибка при сохранении');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при сохранении');
        }
    });
}

window.editUser = async function(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`);
        const user = await response.json();
        
        document.getElementById('user-modal-title').textContent = 'Редактирование пользователя';
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-surname').value = user.surname;
        document.getElementById('user-patronymic').value = user.patronymic || '';
        document.getElementById('user-login').value = user.login;
        document.getElementById('user-password').value = '';
        document.getElementById('user-role-id').value = user.role_id;
        
        openModal('user-modal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить данные пользователя');
    }
};

window.deleteUser = async function(userId) {
    if (!confirm('Удалить этого пользователя?')) return;
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            loadUsers();
            showMessage('Пользователь удалён', 'success');
        } else {
            alert('Ошибка при удалении');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении');
    }
};

// ========== ПОКАЗ СООБЩЕНИЙ ==========
function showMessage(message, type) {
    const container = document.querySelector('.dashboard-container');
    if (!container) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = type === 'success' ? 'success-message' : 'error-message';
    msgDiv.textContent = message;
    msgDiv.style.marginBottom = '20px';
    
    document.querySelectorAll('.success-message, .error-message').forEach(el => el.remove());
    container.insertBefore(msgDiv, container.firstChild);
    
    setTimeout(() => {
        msgDiv.remove();
    }, 3000);
}

// ========== УПРАВЛЕНИЕ ТРАНСПОРТОМ ==========
async function loadTransport() {
    const tbody = document.getElementById('transport-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка...</td></tr>';
    
    try {
        const response = await fetch('/api/admin/transport');
        const transport = await response.json();
        
        if (transport.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет транспортных средств</td></tr>';
            return;
        }
        
        tbody.innerHTML = transport.map(t => `
            <tr>
                <td>${t.id}</td>
                <td>${t.model}</td>
                <td>${t.capacity}</td>
                <td>${t.transport_type}</td>
                <td>${t.route_number} ${t.route_name}</td>
                <td>${t.vehicle_number}</td>
                <td>
                    <button class="btn-edit" onclick="editTransport(${t.id})">Изменить</button>
                    <button class="btn-danger" onclick="deleteTransport(${t.id})">Удалить</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Ошибка загрузки</td></tr>';
    }
}

const addTransportBtn = document.getElementById('add-transport-btn');
if (addTransportBtn) {
    addTransportBtn.addEventListener('click', () => {
        document.getElementById('transport-modal-title').textContent = 'Добавление транспорта';
        document.getElementById('transport-id').value = '';
        document.getElementById('transport-model').value = '';
        document.getElementById('transport-capacity').value = '';
        document.getElementById('transport-type-id').value = '';
        document.getElementById('transport-route-id').value = '';
        document.getElementById('transport-vehicle-number').value = '';
        openModal('transport-modal');
    });
}

const transportForm = document.getElementById('transport-form');
if (transportForm) {
    transportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            id: document.getElementById('transport-id').value || null,
            model: document.getElementById('transport-model').value,
            capacity: document.getElementById('transport-capacity').value,
            type_id: document.getElementById('transport-type-id').value,
            route_id: document.getElementById('transport-route-id').value,
            vehicle_number: document.getElementById('transport-vehicle-number').value
        };
        
        try {
            const response = await fetch('/api/admin/transport', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (result.success) {
                closeModal('transport-modal');
                transportForm.reset();
                loadTransport();
                showMessage('Транспорт сохранён', 'success');
            } else {
                alert(result.error || 'Ошибка при сохранении');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при сохранении');
        }
    });
}

window.editTransport = async function(transportId) {
    try {
        const response = await fetch(`/api/admin/transport/${transportId}`);
        const transport = await response.json();
        
        document.getElementById('transport-modal-title').textContent = 'Редактирование транспорта';
        document.getElementById('transport-id').value = transport.id;
        document.getElementById('transport-model').value = transport.model;
        document.getElementById('transport-capacity').value = transport.capacity;
        document.getElementById('transport-type-id').value = transport.type_id;
        document.getElementById('transport-route-id').value = transport.route_id;
        document.getElementById('transport-vehicle-number').value = transport.vehicle_number;
        
        openModal('transport-modal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить данные транспорта');
    }
};

window.deleteTransport = async function(transportId) {
    if (!confirm('Удалить это транспортное средство?')) return;
    
    try {
        const response = await fetch(`/api/admin/transport/${transportId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            loadTransport();
            showMessage('Транспорт удалён', 'success');
        } else {
            alert('Ошибка при удалении');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении');
    }
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
if (document.getElementById('tab-markers')) {
    loadMarkers();
}
if (document.getElementById('tab-users')) {
    loadUsers();
}
if (document.getElementById('tab-transport')) {
    loadTransport();
}