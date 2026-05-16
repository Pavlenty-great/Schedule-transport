from flask import Blueprint, render_template, request, session, jsonify, redirect, url_for, abort
from decorators import login_required, role_required
from functools import wraps
from db import get_db_connection
import psycopg2.extras
import json

dispatcher_bp = Blueprint('dispatcher', __name__)

@dispatcher_bp.route('/dispatcher')
@login_required
@role_required(['Администратор', 'Диспетчер'])
def dispatcher_dashboard():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.callproc('get_all_routes')
    routes = cur.fetchall()
    
    cur.callproc('get_all_days')
    days = cur.fetchall()
    
    cur.callproc('get_all_stops')
    all_stops = cur.fetchall()
    
    cur.callproc('get_all_marker_types')
    marker_types = cur.fetchall()
    
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
    
    return render_template('dispatcher/dashboard.html',
                         routes=routes,
                         days=days,
                         all_stops=all_stops,
                         marker_types=marker_types,
                         search=search_params,
                         user=user_info)


# API для расписания
@dispatcher_bp.route('/api/dispatcher/schedule', methods=['GET'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_get_schedule():
    route_id = request.args.get('route_id', type=int)
    day_id = request.args.get('day_id', type=int)
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('get_route_schedule_for_dispatcher', [route_id, day_id])
    result = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    if isinstance(result, str):
        data = json.loads(result) if result else []
    elif isinstance(result, (list, tuple)):
        data = result
    else:
        data = []
    
    for i, item in enumerate(data):
        item['schedule_id'] = i + 1
    
    return jsonify(data)


@dispatcher_bp.route('/api/dispatcher/schedule', methods=['POST'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_upsert_schedule():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('upsert_schedule', [
        data.get('schedule_id'),
        data['route_id'],
        data['stop_id'],
        data['day_id'],
        data['time'],
        data['trip_number']
    ])
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({'success': True})


@dispatcher_bp.route('/api/dispatcher/schedule', methods=['DELETE'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_delete_schedule():
    data = request.json
    schedule_id = data.get('schedule_id')
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('delete_schedule', [schedule_id])
    conn.commit()
    success = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    return jsonify({'success': success})


@dispatcher_bp.route('/api/dispatcher/schedule/<int:schedule_id>', methods=['GET'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_get_schedule_item(schedule_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute("""
        SELECT s.id, s.route_id, s.stop_id, s.day_id, s.time_departure, s.trip_number,
               r.number as route_number, r.name as route_name
        FROM "Schedules" s
        JOIN "Routes" r ON s.route_id = r.id
        WHERE s.id = %s
    """, (schedule_id,))
    
    schedule = cur.fetchone()
    cur.close()
    conn.close()
    
    if not schedule:
        return jsonify({'error': 'Расписание не найдено'}), 404
    
    if schedule['time_departure']:
        schedule['time_departure'] = schedule['time_departure'].strftime('%H:%M:%S')
    
    return jsonify(schedule)


@dispatcher_bp.route('/api/dispatcher/schedule/<int:schedule_id>', methods=['PUT'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_update_schedule(schedule_id):
    data = request.json
    
    required_fields = ['route_id', 'stop_id', 'day_id', 'time', 'trip_number']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Отсутствует поле {field}'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.callproc('upsert_schedule', [
            schedule_id,
            data['route_id'],
            data['stop_id'],
            data['day_id'],
            data['time'],
            data['trip_number']
        ])
        conn.commit()
        success = True
    except Exception as e:
        print(f"Ошибка при обновлении расписания: {e}")
        conn.rollback()
        success = False
    finally:
        cur.close()
        conn.close()
    
    return jsonify({'success': success})


# API для остановок маршрутов
@dispatcher_bp.route('/api/dispatcher/route/<int:route_id>/stops')
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_get_route_stops(route_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.callproc('get_route_stops', [route_id])
    result = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify(result)


@dispatcher_bp.route('/api/dispatcher/route/stop', methods=['POST'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_add_route_stop():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('add_stop_to_route', [data['route_id'], data['stop_id'], data['order_number']])
    conn.commit()
    
    cur.close()
    conn.close()
    
    return jsonify({'success': True})


@dispatcher_bp.route('/api/dispatcher/route/stop', methods=['DELETE'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_remove_route_stop():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('remove_stop_from_route', [data['route_id'], data['stop_id']])
    conn.commit()
    
    cur.close()
    conn.close()
    
    return jsonify({'success': True})


@dispatcher_bp.route('/api/dispatcher/route/stop/<int:route_id>/<int:stop_id>', methods=['GET'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_get_route_stop(route_id, stop_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute("""
        SELECT rs.route_id, rs.bus_stop_id as stop_id, rs.order_number,
               s.name as stop_name, st.name as settlement_name
        FROM "Routes_Stops" rs
        JOIN "Stops" s ON rs.bus_stop_id = s.id
        LEFT JOIN "Settlements" st ON s.settlement_id = st.id
        WHERE rs.route_id = %s AND rs.bus_stop_id = %s
    """, (route_id, stop_id))
    
    stop = cur.fetchone()
    cur.close()
    conn.close()
    
    if not stop:
        return jsonify({'error': 'Остановка не найдена'}), 404
    
    return jsonify(stop)


@dispatcher_bp.route('/api/dispatcher/route/stop', methods=['PUT'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_update_route_stop():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('update_route_stop', [
        data['route_id'],
        data['old_stop_id'],
        data['new_stop_id']
    ])
    conn.commit()
    success = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    return jsonify({'success': success})


# API для маркеров
@dispatcher_bp.route('/api/dispatcher/markers', methods=['GET'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_get_markers():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.callproc('get_active_markers')
    result = cur.fetchall()
    
    cur.close()
    conn.close()
    
    for row in result:
        if row['marker_time']:
            row['marker_time'] = row['marker_time'].isoformat()
    
    return jsonify(result)


@dispatcher_bp.route('/api/dispatcher/markers', methods=['POST'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_add_marker():
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('add_manual_marker', [
        data['stop_id'],
        data['route_id'],
        data['type_marker_id'],
        session['user_id']
    ])
    conn.commit()
    
    cur.close()
    conn.close()
    
    return jsonify({'success': True})


@dispatcher_bp.route('/api/dispatcher/markers', methods=['DELETE'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_delete_marker():
    data = request.json
    marker_id = data.get('marker_id')
    
    if not marker_id:
        return jsonify({'success': False, 'error': 'Не указан ID маркера'}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('delete_manual_marker', [marker_id])
    conn.commit()
    success = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    return jsonify({'success': success})


@dispatcher_bp.route('/api/dispatcher/markers/<int:marker_id>', methods=['GET'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_get_marker(marker_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute("""
        SELECT m.id, m.stop_id, m.route_id, m.type_marker_id, s.name as stop_name, r.number as route_number
        FROM "Manual_markers" m
        JOIN "Stops" s ON m.stop_id = s.id
        JOIN "Routes" r ON m.route_id = r.id
        WHERE m.id = %s
    """, (marker_id,))
    
    marker = cur.fetchone()
    cur.close()
    conn.close()
    
    if not marker:
        return jsonify({'error': 'Маркер не найден'}), 404
    
    return jsonify(marker)


@dispatcher_bp.route('/api/dispatcher/markers/<int:marker_id>', methods=['PUT'])
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_update_marker(marker_id):
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.callproc('update_manual_marker', [
        marker_id,
        data['stop_id'],
        data['route_id'],
        data['type_marker_id']
    ])
    conn.commit()
    success = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    
    return jsonify({'success': success})


@dispatcher_bp.route('/api/dispatcher/stops')
@login_required
@role_required(['Администратор', 'Диспетчер'])
def api_get_all_stops():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.callproc('get_all_stops')
    result = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify(result)