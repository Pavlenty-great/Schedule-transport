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
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        closeBtn.closest('.modal').style.display = 'none';
    });
});

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// ========== ЗАГРУЗКА РАСПИСАНИЯ ==========
document.getElementById('load-schedule')?.addEventListener('click', loadSchedule);
document.getElementById('add-schedule-btn')?.addEventListener('click', () => openModal('schedule-modal'));

async function loadSchedule() {
    const routeId = document.getElementById('route-filter').value;
    const dayId = document.getElementById('day-filter').value;
    
    const tbody = document.getElementById('schedule-tbody');
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
        
        // Сортируем сначала по номеру маршрута, затем по времени отправления
        schedules.sort((a, b) => {
            // Сначала по номеру маршрута
            if (a.route_number !== b.route_number) {
                return a.route_number - b.route_number;
            }
            // Затем по времени отправления
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

async function editSchedule(id) {
    try {
        const response = await fetch(`/api/dispatcher/schedule/${id}`);
        const data = await response.json();
        
        document.getElementById('schedule-id').value = data.id;
        document.getElementById('modal-route-id').value = data.route_id;
        
        // Загружаем остановки для выбранного маршрута
        await loadStopsForSchedule();
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
}

async function deleteSchedule(id) {
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
}

document.getElementById('schedule-form')?.addEventListener('submit', async (e) => {
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
            document.getElementById('schedule-form').reset();
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

// ========== ЗАГРУЗКА ОСТАНОВОК МАРШРУТА ==========
document.getElementById('load-stops-btn')?.addEventListener('click', loadRouteStops);
document.getElementById('add-stop-to-route-btn')?.addEventListener('click', () => {
    const routeId = document.getElementById('route-stops-select').value;
    if (!routeId) {
        alert('Сначала выберите маршрут');
        return;
    }
    document.getElementById('stop-route-id').value = routeId;
    openModal('stop-to-route-modal');
});

async function loadRouteStops() {
    const routeId = document.getElementById('route-stops-select').value;
    if (!routeId) {
        alert('Выберите маршрут');
        return;
    }
    
    const tbody = document.getElementById('stops-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Загрузка...<\/td><\/tr>';
    
    try {
        const response = await fetch(`/api/dispatcher/route/${routeId}/stops`);
        const stops = await response.json();
        
        if (stops.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Нет остановок<\/td><\/tr>';
            return;
        }
        
        tbody.innerHTML = stops.map(s => `
            <tr>
                <td>${s.order_number}<\/td>
                <td>${s.stop_name}<\/td>
                <td>${s.settlement_name || '—'}<\/td>
                <td>
                    <button class="btn-edit" onclick="editStopInRoute(${s.stop_id})">Изменить<\/button>
                    <button class="btn-danger" onclick="removeStopFromRoute(${s.stop_id})">Удалить<\/button>
                 <\/td>
             <\/tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Ошибка загрузки<\/td><\/tr>';
    }
}

async function removeStopFromRoute(stopId) {
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
}

document.getElementById('stop-to-route-form')?.addEventListener('submit', async (e) => {
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
            document.getElementById('stop-to-route-form').reset();
            loadRouteStops();
        } else {
            alert('Ошибка при добавлении');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при добавлении');
    }
});

// ========== ЗАГРУЗКА МАРКЕРОВ ==========
async function loadMarkers() {
    const tbody = document.getElementById('markers-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка...<\/td><\/tr>';
    
    try {
        const response = await fetch('/api/dispatcher/markers');
        const markers = await response.json();
        
        if (markers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет активных маркеров<\/td><\/tr>';
            return;
        }
        
        tbody.innerHTML = markers.map(m => `
            <tr>
                <td>${new Date(m.marker_time).toLocaleString()}<\/td>
                <td>${m.stop_name}<\/td>
                <td>${m.route_name}<\/td>
                <td>Рейс №${m.trip_number}<\/td>
                <td>${m.marker_type}<\/td>
                <td>${m.dispatcher_name}<\/td>
                <td>
                    <button class="btn-edit" onclick="editMarker(${m.marker_id})">Изменить<\/button>
                    <button class="btn-danger" onclick="deleteMarker(${m.marker_id})">Удалить<\/button>
                 <\/td>
             <\/tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Ошибка загрузки<\/td><\/tr>';
    }
}

document.getElementById('add-marker-btn')?.addEventListener('click', () => {
    // Сбрасываем значения
    document.getElementById('marker-route-id').value = '';
    document.getElementById('marker-trip-number').innerHTML = '<option value="">Сначала выберите маршрут</option>';
    document.getElementById('marker-stop-id').innerHTML = '<option value="">Сначала выберите маршрут</option>';
    document.getElementById('marker-type-id').value = '';
    openModal('marker-modal');
});

async function loadTripsForMarker() {
    const routeId = document.getElementById('marker-route-id').value;
    const tripSelect = document.getElementById('marker-trip-number');
    
    if (!routeId) {
        tripSelect.innerHTML = '<option value="">Сначала выберите маршрут</option>';
        return;
    }
    
    tripSelect.innerHTML = '<option value="">Загрузка...</option>';
    
    try {
        const response = await fetch(`/api/dispatcher/route/${routeId}/trips`);
        const trips = await response.json();
        
        if (trips.length === 0) {
            tripSelect.innerHTML = '<option value="">Нет рейсов на маршруте</option>';
        } else {
            tripSelect.innerHTML = '<option value="">Выберите рейс</option>' + 
                trips.map(t => `<option value="${t.trip_number}">Рейс №${t.trip_number} (${t.departure_time})</option>`).join('');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        tripSelect.innerHTML = '<option value="">Ошибка загрузки рейсов</option>';
    }
}

// Добавляем обработчик изменения маршрута для загрузки рейсов
document.getElementById('marker-route-id')?.addEventListener('change', () => {
    loadStopsForMarker();
    loadTripsForMarker();  // добавляем
});

document.getElementById('marker-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        route_id: document.getElementById('marker-route-id').value,
        stop_id: document.getElementById('marker-stop-id').value,
        type_marker_id: document.getElementById('marker-type-id').value,
        trip_number: document.getElementById('marker-trip-number').value
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
            document.getElementById('marker-form').reset();
            // Сбрасываем select остановок
            document.getElementById('marker-stop-id').innerHTML = '<option value="">Сначала выберите маршрут</option>';
            loadMarkers();  // Обновляем список маркеров
        } else {
            alert('Ошибка при добавлении маркера');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при добавлении маркера');
    }
});

// ========== ИНИЦИАЛИЗАЦИЯ ==========
if (document.getElementById('tab-routes')) {
    loadRoutes();
}
if (document.getElementById('tab-markers')) {
    loadMarkers();
}

// Загрузка остановок для модального окна маркера при открытии
document.getElementById('marker-route-id')?.addEventListener('change', loadStopsForMarker);

async function deleteMarker(markerId) {
    if (!confirm('Удалить этот маркер?')) return;
    
    try {
        const response = await fetch('/api/dispatcher/markers', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marker_id: markerId })
        });
        
        const result = await response.json();
        if (result.success) {
            loadMarkers(); // Обновляем список маркеров
        } else {
            alert('Ошибка при удалении маркера');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении маркера');
    }
}

async function editMarker(markerId) {
    try {
        const response = await fetch(`/api/dispatcher/markers/${markerId}`);
        const marker = await response.json();
        
        document.getElementById('edit-marker-id').value = marker.id;
        document.getElementById('edit-marker-route-id').value = marker.route_id;
        document.getElementById('edit-marker-type-id').value = marker.type_marker_id;
        
        // Загружаем рейсы для выбранного маршрута
        await loadTripsForEditMarker(marker.route_id);
        document.getElementById('edit-marker-trip-number').value = marker.trip_number;
        
        // Загружаем остановки для выбранного маршрута
        await loadStopsForEditMarker(marker.route_id);
        document.getElementById('edit-marker-stop-id').value = marker.stop_id;
        
        openModal('edit-marker-modal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить данные маркера');
    }
}

// Загрузка остановок для редактирования маркера
async function loadStopsForEditMarker(routeId) {
    const stopSelect = document.getElementById('edit-marker-stop-id');
    
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

// При изменении маршрута в модальном окне редактирования
document.getElementById('edit-marker-route-id')?.addEventListener('change', function() {
    loadStopsForEditMarker(this.value);
});

document.getElementById('edit-marker-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const markerId = document.getElementById('edit-marker-id').value;
    const formData = {
        route_id: document.getElementById('edit-marker-route-id').value,
        trip_number: document.getElementById('edit-marker-trip-number').value,
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
        } else {
            alert('Ошибка при обновлении маркера');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при обновлении маркера');
    }
});

// ========== РЕДАКТИРОВАНИЕ ОСТАНОВКИ В МАРШРУТЕ ==========

async function editStopInRoute(stopId) {
    const routeId = document.getElementById('route-stops-select').value;
    if (!routeId) return;
    
    try {
        // Получаем данные остановки
        const response = await fetch(`/api/dispatcher/route/stop/${routeId}/${stopId}`);
        const stop = await response.json();
        
        // Заполняем форму
        document.getElementById('edit-stop-route-id').value = routeId;
        document.getElementById('edit-old-stop-id').value = stopId;
        document.getElementById('edit-order-number').value = stop.order_number;
        document.getElementById('edit-current-stop').value = stop.stop_name;
        document.getElementById('edit-new-stop-id').value = '';
        
        // Открываем модальное окно
        openModal('edit-stop-modal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить данные остановки');
    }
}

// Обработчик отправки формы редактирования остановки
document.getElementById('edit-stop-form')?.addEventListener('submit', async (e) => {
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
            loadRouteStops(); // Обновляем список остановок
            alert('Остановка успешно изменена');
        } else {
            alert('Ошибка при обновлении остановки');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при обновлении остановки');
    }
});

// Загрузка остановок для выбранного маршрута
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

// Загрузка рейсов для редактирования маркера
async function loadTripsForEditMarker(routeId) {
    const tripSelect = document.getElementById('edit-marker-trip-number');
    
    if (!tripSelect) return;
    
    if (!routeId) {
        tripSelect.innerHTML = '<option value="">Сначала выберите маршрут</option>';
        return;
    }
    
    tripSelect.innerHTML = '<option value="">Загрузка...</option>';
    
    try {
        const response = await fetch(`/api/dispatcher/route/${routeId}/trips`);
        const trips = await response.json();
        
        if (trips.length === 0) {
            tripSelect.innerHTML = '<option value="">Нет рейсов на маршруте</option>';
        } else {
            tripSelect.innerHTML = trips.map(t => 
                `<option value="${t.trip_number}">Рейс №${t.trip_number} (${t.departure_time})</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        tripSelect.innerHTML = '<option value="">Ошибка загрузки рейсов</option>';
    }
}

// Загрузка остановок для выбранного маршрута (для расписания)
async function loadStopsForSchedule() {
    const routeId = document.getElementById('modal-route-id').value;
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

// Добавляем обработчик изменения маршрута в модальном окне расписания
document.getElementById('modal-route-id')?.addEventListener('change', loadStopsForSchedule);

// При открытии модального окна добавления рейса - сбрасываем и загружаем остановки
const addScheduleBtn = document.getElementById('add-schedule-btn');
if (addScheduleBtn) {
    addScheduleBtn.addEventListener('click', () => {
        document.getElementById('schedule-id').value = '';
        document.getElementById('schedule-form').reset();
        document.getElementById('modal-route-id').value = '';
        document.getElementById('modal-stop-id').innerHTML = '<option value="">Сначала выберите маршрут</option>';
        document.getElementById('schedule-modal-title').textContent = 'Добавление рейса';
        openModal('schedule-modal');
    });
}

// ========== УПРАВЛЕНИЕ МАРШРУТАМИ ==========
async function loadRoutes() {
    const tbody = document.getElementById('routes-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Загрузка...<\/td><\/tr>';
    
    try {
        const response = await fetch('/api/dispatcher/routes');
        const routes = await response.json();
        
        if (routes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет маршрутов<\/td><\/tr>';
            return;
        }
        
        tbody.innerHTML = routes.map(r => `
            <tr>
                <td>${r.route_id}<\/td>
                <td>${r.route_number}<\/td>
                <td>${r.route_name}<\/td>
                <td>${r.transport_type_name}<\/td>
                <td>
                    <button class="btn-edit" onclick="editRoute(${r.route_id})">Изменить<\/button>
                    <button class="btn-danger" onclick="deleteRoute(${r.route_id})">Удалить<\/button>
                 <\/td>
             <\/tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Ошибка загрузки<\/td><\/tr>';
    }
}

// Кнопка добавления маршрута
const addRouteBtn = document.getElementById('add-route-btn');
if (addRouteBtn) {
    addRouteBtn.addEventListener('click', () => {
        document.getElementById('route-modal-title').textContent = 'Добавление маршрута';
        document.getElementById('route-id').value = '';
        document.getElementById('route-number').value = '';
        document.getElementById('route-name').value = '';
        document.getElementById('route-transport-type-id').value = '';
        openModal('route-modal');
    });
}

// Форма добавления/редактирования маршрута
const routeForm = document.getElementById('route-form');
if (routeForm) {
    routeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            id: document.getElementById('route-id').value || null,
            number: document.getElementById('route-number').value,
            name: document.getElementById('route-name').value,
            transport_type_id: document.getElementById('route-transport-type-id').value
        };
        
        try {
            const response = await fetch('/api/dispatcher/routes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (result.success) {
                closeModal('route-modal');
                routeForm.reset();
                loadRoutes();
                // Показываем сообщение об успехе
                const msgDiv = document.createElement('div');
                msgDiv.className = 'success-message';
                msgDiv.textContent = 'Маршрут сохранён';
                msgDiv.style.marginBottom = '20px';
                const container = document.querySelector('.dashboard-container');
                if (container) container.insertBefore(msgDiv, container.firstChild);
                setTimeout(() => msgDiv.remove(), 3000);
            } else {
                alert(result.error || 'Ошибка при сохранении');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при сохранении');
        }
    });
}

// Редактирование маршрута
window.editRoute = async function(routeId) {
    try {
        const response = await fetch(`/api/dispatcher/routes/${routeId}`);
        const route = await response.json();
        
        document.getElementById('route-modal-title').textContent = 'Редактирование маршрута';
        document.getElementById('route-id').value = route.route_id;
        document.getElementById('route-number').value = route.route_number;
        document.getElementById('route-name').value = route.route_name;
        document.getElementById('route-transport-type-id').value = route.transport_type_id;
        
        openModal('route-modal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить данные маршрута');
    }
};

// Удаление маршрута
window.deleteRoute = async function(routeId) {
    if (!confirm('Удалить этот маршрут? Все связанные остановки, расписание и транспорт также будут удалены.')) return;
    
    try {
        const response = await fetch(`/api/dispatcher/routes/${routeId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            loadRoutes();
            const msgDiv = document.createElement('div');
            msgDiv.className = 'success-message';
            msgDiv.textContent = 'Маршрут удалён';
            msgDiv.style.marginBottom = '20px';
            const container = document.querySelector('.dashboard-container');
            if (container) container.insertBefore(msgDiv, container.firstChild);
            setTimeout(() => msgDiv.remove(), 3000);
        } else {
            alert(result.error || 'Ошибка при удалении');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении');
    }
};