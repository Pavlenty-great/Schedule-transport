from flask import Blueprint, render_template, request, session, jsonify, redirect, url_for, abort
from functools import wraps
from db import get_db_connection
import psycopg2.extras

admin_bp = Blueprint('admin', __name__)


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function


def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return redirect(url_for('auth.login'))
            if session.get('role') not in allowed_roles:
                abort(403)
            return f(*args, **kwargs)
        return decorated_function
    return decorator


@admin_bp.route('/admin')
@login_required
@role_required(['Администратор'])
def admin_dashboard():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.callproc('get_all_routes_admin')
    routes = cur.fetchall()
    
    cur.callproc('get_all_days')
    days = cur.fetchall()
    
    cur.callproc('get_all_stops')
    all_stops = cur.fetchall()
    
    cur.callproc('get_all_marker_types')
    marker_types = cur.fetchall()
    
    cur.execute('SELECT id as role_id, name as role_name FROM "Roles" ORDER BY id')
    roles = cur.fetchall()
    
    cur.callproc('get_all_transport_types')
    transport_types = cur.fetchall()
    
    cur.close()
    conn.close()

    search_params = {
        'from': '',
        'to': '',
        'date': '',
        'transport_type': 'Автобус'
    }

    user_info = {
        'name': session.get('user_name'),
        'role': session.get('role'),
        'is_authenticated': 'user_id' in session
    }
    
    return render_template('admin/dashboard.html',
                         routes=routes,
                         days=days,
                         all_stops=all_stops,
                         marker_types=marker_types,
                         roles=roles,
                         transport_types=transport_types,
                         search=search_params,
                         user=user_info)


# API для управления пользователями
@admin_bp.route('/api/admin/users', methods=['GET'])
@login_required
@role_required(['Администратор'])
def api_get_users():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute("""
        SELECT u.id, u.name, u.surname, u.patronymic, u.login, r.name as role, r.id as role_id
        FROM "Users" u
        JOIN "Users_roles" ur ON u.id = ur.user_id
        JOIN "Roles" r ON ur.role_id = r.id
        ORDER BY u.id
    """)
    users = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify(users)


@admin_bp.route('/api/admin/users/<int:user_id>', methods=['GET'])
@login_required
@role_required(['Администратор'])
def api_get_user(user_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute("""
        SELECT u.id, u.name, u.surname, u.patronymic, u.login, r.id as role_id
        FROM "Users" u
        JOIN "Users_roles" ur ON u.id = ur.user_id
        JOIN "Roles" r ON ur.role_id = r.id
        WHERE u.id = %s
    """, (user_id,))
    
    user = cur.fetchone()
    cur.close()
    conn.close()
    
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    
    return jsonify(user)


@admin_bp.route('/api/admin/users', methods=['POST'])
@login_required
@role_required(['Администратор'])
def api_create_update_user():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if data.get('id'):
            if data.get('password'):
                cur.execute("""
                    UPDATE "Users" 
                    SET name = %s, surname = %s, patronymic = %s, login = %s, password = %s
                    WHERE id = %s
                """, (data['name'], data['surname'], data.get('patronymic'), data['login'], data['password'], data['id']))
            else:
                cur.execute("""
                    UPDATE "Users" 
                    SET name = %s, surname = %s, patronymic = %s, login = %s
                    WHERE id = %s
                """, (data['name'], data['surname'], data.get('patronymic'), data['login'], data['id']))
            
            cur.execute("DELETE FROM \"Users_roles\" WHERE user_id = %s", (data['id'],))
            cur.execute("INSERT INTO \"Users_roles\" (user_id, role_id) VALUES (%s, %s)", (data['id'], data['role_id']))
        else:
            cur.execute("""
                INSERT INTO "Users" (name, surname, patronymic, login, password)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (data['name'], data['surname'], data.get('patronymic'), data['login'], data['password']))
            user_id = cur.fetchone()[0]
            cur.execute("INSERT INTO \"Users_roles\" (user_id, role_id) VALUES (%s, %s)", (user_id, data['role_id']))
        
        conn.commit()
        success = True
    except Exception as e:
        print(f"Ошибка при сохранении пользователя: {e}")
        conn.rollback()
        success = False
    finally:
        cur.close()
        conn.close()
    
    return jsonify({'success': success})


@admin_bp.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@login_required
@role_required(['Администратор'])
def api_delete_user(user_id):
    if user_id == session.get('user_id'):
        return jsonify({'success': False, 'error': 'Нельзя удалить самого себя'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("DELETE FROM \"Users_roles\" WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM \"Users\" WHERE id = %s", (user_id,))
        conn.commit()
        success = True
    except Exception as e:
        print(f"Ошибка при удалении пользователя: {e}")
        conn.rollback()
        success = False
    finally:
        cur.close()
        conn.close()
    
    return jsonify({'success': success})


# API для управления транспортом
@admin_bp.route('/api/admin/transport', methods=['GET'])
@login_required
@role_required(['Администратор'])
def api_get_transport():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.callproc('get_all_transport')
    transport = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify(transport)


@admin_bp.route('/api/admin/transport/<int:transport_id>', methods=['GET'])
@login_required
@role_required(['Администратор'])
def api_get_transport_item(transport_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.callproc('get_transport_by_id', [transport_id])
    transport = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if not transport:
        return jsonify({'error': 'Транспорт не найден'}), 404
    
    return jsonify(transport)


@admin_bp.route('/api/admin/transport', methods=['POST'])
@login_required
@role_required(['Администратор'])
def api_create_update_transport():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.callproc('upsert_transport', [
            data.get('id'),
            data['model'],
            data['capacity'],
            data['type_id'],
            data['route_id'],
            data['vehicle_number']
        ])
        conn.commit()
        success = True
    except Exception as e:
        print(f"Ошибка при сохранении транспорта: {e}")
        conn.rollback()
        success = False
    finally:
        cur.close()
        conn.close()
    
    return jsonify({'success': success})


@admin_bp.route('/api/admin/transport/<int:transport_id>', methods=['DELETE'])
@login_required
@role_required(['Администратор'])
def api_delete_transport(transport_id):
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('delete_transport', [transport_id])
    conn.commit()
    success = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    return jsonify({'success': success})


# ========== API ДЛЯ УПРАВЛЕНИЯ МАРШРУТАМИ ==========

@admin_bp.route('/api/admin/routes', methods=['GET'])
@login_required
@role_required(['Администратор'])
def api_get_routes():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.callproc('get_all_routes_admin')
    routes = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify(routes)


@admin_bp.route('/api/admin/routes/<int:route_id>', methods=['GET'])
@login_required
@role_required(['Администратор'])
def api_get_route(route_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.callproc('get_route_by_id', [route_id])
    route = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if not route:
        return jsonify({'error': 'Маршрут не найден'}), 404
    
    return jsonify(route)


@admin_bp.route('/api/admin/routes', methods=['POST'])
@login_required
@role_required(['Администратор'])
def api_create_update_route():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.callproc('upsert_route', [
            data.get('id'),
            data['number'],
            data['name'],
            data['transport_type_id']
        ])
        conn.commit()
        success = True
    except Exception as e:
        print(f"Ошибка при сохранении маршрута: {e}")
        conn.rollback()
        success = False
    finally:
        cur.close()
        conn.close()
    
    return jsonify({'success': success})


@admin_bp.route('/api/admin/routes/<int:route_id>', methods=['DELETE'])
@login_required
@role_required(['Администратор'])
def api_delete_route(route_id):
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('delete_route', [route_id])
    conn.commit()
    success = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    if not success:
        return jsonify({'success': False, 'error': 'Невозможно удалить маршрут. У него есть связанные остановки, расписание или транспорт'}), 400
    
    return jsonify({'success': success})