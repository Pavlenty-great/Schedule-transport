// admin.js - специфичный код для администратора

// ========== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ==========
async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка...<\/td><\/tr>';
    
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Нет пользователей<\/td><\/tr>';
            return;
        }
        
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.id}<\/td>
                <td>${u.name}<\/td>
                <td>${u.surname}<\/td>
                <td>${u.patronymic || '—'}<\/td>
                <td>${u.login}<\/td>
                <td><span class="role-badge role-${u.role === 'Администратор' ? 'admin' : (u.role === 'Диспетчер' ? 'dispatcher' : 'user')}">${u.role}</span><\/td>
                <td>
                    <button class="btn-edit" onclick="editUser(${u.id})">Изменить<\/button>
                    <button class="btn-danger" onclick="deleteUser(${u.id})">Удалить<\/button>
                 <\/td>
             <\/tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Ошибка загрузки<\/td><\/tr>';
    }
}

function initUserForm() {
    const form = document.getElementById('user-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
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
}

async function editUser(userId) {
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
}

async function deleteUser(userId) {
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
}

// ========== УПРАВЛЕНИЕ ТРАНСПОРТОМ ==========
async function loadTransport() {
    const tbody = document.getElementById('transport-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Загрузка...<\/td><\/tr>';
    
    try {
        const response = await fetch('/api/admin/transport');
        const transport = await response.json();
        
        if (transport.length === 0) {
            tbody.innerHTML = '<td><td colspan="7" style="text-align: center;">Нет транспортных средств<\/td><\/tr>';
            return;
        }
        
        tbody.innerHTML = transport.map(t => `
            <tr>
                <td>${t.id}<\/td>
                <td>${t.model}<\/td>
                <td>${t.capacity}<\/td>
                <td>${t.transport_type}<\/td>
                <td>${t.route_number} ${t.route_name}<\/td>
                <td>${t.vehicle_number}<\/td>
                <td>
                    <button class="btn-edit" onclick="editTransport(${t.id})">Изменить<\/button>
                    <button class="btn-danger" onclick="deleteTransport(${t.id})">Удалить<\/button>
                 <\/td>
             <\/tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Ошибка загрузки<\/td><\/tr>';
    }
}

function initTransportForm() {
    const form = document.getElementById('transport-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
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
                    form.reset();
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
}

async function editTransport(transportId) {
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
}

async function deleteTransport(transportId) {
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
}

// ========== УПРАВЛЕНИЕ МАРШРУТАМИ ==========
async function loadRoutes() {
    const tbody = document.getElementById('routes-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Загрузка...<\/td><\/tr>';
    
    try {
        const response = await fetch('/api/admin/routes');
        const routes = await response.json();
        
        if (routes.length === 0) {
            tbody.innerHTML = '<td><td colspan="5" style="text-align: center;">Нет маршрутов<\/td><\/tr>';
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

function initRouteForm() {
    const form = document.getElementById('route-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                id: document.getElementById('route-id').value || null,
                number: document.getElementById('route-number').value,
                name: document.getElementById('route-name').value,
                transport_type_id: document.getElementById('route-transport-type-id').value
            };
            
            try {
                const response = await fetch('/api/admin/routes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                if (result.success) {
                    closeModal('route-modal');
                    form.reset();
                    loadRoutes();
                    showMessage('Маршрут сохранён', 'success');
                } else {
                    alert(result.error || 'Ошибка при сохранении');
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка при сохранении');
            }
        });
    }
}

async function editRoute(routeId) {
    try {
        const response = await fetch(`/api/admin/routes/${routeId}`);
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
}

async function deleteRoute(routeId) {
    if (!confirm('Удалить этот маршрут? Все связанные остановки, расписание и транспорт также будут удалены.')) return;
    
    try {
        const response = await fetch(`/api/admin/routes/${routeId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (result.success) {
            loadRoutes();
            showMessage('Маршрут удалён', 'success');
        } else {
            alert(result.error || 'Ошибка при удалении');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при удалении');
    }
}

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

// ========== ИНИЦИАЛИЗАЦИЯ АДМИНИСТРАТОРА ==========
function initAdmin() {
    // Инициализация общих функций из dispatcher.js
    // Они уже должны быть вызваны при загрузке dispatcher.js
    
    initUserForm();
    initTransportForm();
    initRouteForm();
    
    // Кнопка добавления пользователя
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
    
    // Кнопка добавления транспорта
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
    
    // Загрузка данных для вкладок
    if (document.getElementById('tab-users')) loadUsers();
    if (document.getElementById('tab-transport')) loadTransport();
    if (document.getElementById('tab-routes')) loadRoutes();
    if (document.getElementById('tab-markers')) loadMarkers();
}

// Запуск
initAdmin();