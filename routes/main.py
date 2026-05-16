from flask import Blueprint, render_template, request, abort, session
from db import get_db_connection
from helpers import get_weekday_id, format_display_date, get_transport_type_id
import psycopg2.extras

main_bp = Blueprint('main', __name__)


@main_bp.route('/', methods=['GET', 'POST'])
def main():
    user_info = {
        'name': session.get('user_name'),
        'role': session.get('role'),
        'is_authenticated': 'user_id' in session,
        'show_dashboard_btn': session.get('role') in ['Диспетчер', 'Администратор'] if 'user_id' in session else False
    }

    search_params = {
        'from': '',
        'to': '',
        'date': '',
        'transport_type': 'Автобус'
    }
    routes_data = []
    error_message = None
    
    if request.method == 'POST':
        search_params['from'] = request.form.get('from', '').strip()
        search_params['to'] = request.form.get('to', '').strip()
        search_params['date'] = request.form.get('date', '').strip()
        search_params['transport_type'] = request.form.get('transport_type', 'Автобус')
        
        if not search_params['from'] or not search_params['to']:
            error_message = 'Пожалуйста, заполните поля "Откуда" и "Куда"'
        elif not search_params['date']:
            error_message = 'Пожалуйста, выберите дату'
        else:
            weekday_id = get_weekday_id(search_params['date'])
            if not weekday_id:
                error_message = 'Неверный формат даты'
            else:
                transport_type_id = get_transport_type_id(search_params['transport_type'])
                
                conn = get_db_connection()
                cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                try:
                    cur.callproc('search_routes', [
                        search_params['from'],
                        search_params['to'],
                        weekday_id,
                        transport_type_id
                    ])
                    routes_data = cur.fetchall()
                    if not routes_data:
                        error_message = f'Рейсов из "{search_params["from"]}" в "{search_params["to"]}" не найдено'
                except Exception as e:
                    print(f"Ошибка: {e}")
                    error_message = 'Произошла ошибка при поиске рейсов'
                finally:
                    cur.close()
                    conn.close()
    
    return render_template('main.html', 
                         routes=routes_data,
                         search=search_params,
                         display_date=format_display_date(search_params['date']),
                         error_message=error_message,
                         user=user_info)


@main_bp.route('/route/<int:route_id>')
def route_details(route_id):
    user_info = {
        'name': session.get('user_name'),
        'role': session.get('role'),
        'is_authenticated': 'user_id' in session,
        'show_dashboard_btn': session.get('role') in ['Диспетчер', 'Администратор'] if 'user_id' in session else False
    }

    date_str = request.args.get('date', '')
    weekday_id = request.args.get('day', '')
    trip_number = request.args.get('trip', '')
    
    if not date_str or not weekday_id:
        abort(404)
    
    try:
        weekday_id = int(weekday_id)
        trip_number = int(trip_number) if trip_number else None
    except ValueError:
        abort(404)
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        cur.callproc('get_route_info', [route_id])
        route_info = cur.fetchone()
        
        if not route_info:
            abort(404)
        
        if not trip_number:
            cur.execute("""
                SELECT trip_number FROM "Schedules"
                WHERE route_id = %s AND day_id = %s AND trip_number IS NOT NULL
                GROUP BY trip_number
                ORDER BY MIN(time_departure)
                LIMIT 1
            """, (route_id, weekday_id))
            first = cur.fetchone()
            trip_number = first['trip_number'] if first else 1
        
        cur.callproc('get_route_details', [route_id, weekday_id, trip_number])
        route_details = cur.fetchall()
        
        # Получаем маркеры для каждого остановки и конкретного рейса
        for detail in route_details:
            cur.callproc('get_markers_for_route_stop_trip', [route_id, detail['stop_id'], trip_number])
            markers = cur.fetchall()
            detail['markers'] = markers
        
    except Exception as e:
        print(f"Ошибка: {e}")
        abort(404)
    finally:
        cur.close()
        conn.close()
    
    search_params = {'from': '', 'to': '', 'date': date_str, 'transport_type': 'Автобус'}
    
    return render_template('details_route.html',
                         route_info=route_info,
                         route_details=route_details,
                         display_date=format_display_date(date_str),
                         search=search_params,
                         user=user_info)


@main_bp.route('/stop/<int:stop_id>')
def stop_schedule(stop_id):
    user_info = {
        'name': session.get('user_name'),
        'role': session.get('role'),
        'is_authenticated': 'user_id' in session,
        'show_dashboard_btn': session.get('role') in ['Диспетчер', 'Администратор'] if 'user_id' in session else False
    }

    date_str = request.args.get('date', '')
    weekday_id = request.args.get('day', '')
    
    if not date_str or not weekday_id:
        abort(404)
    
    try:
        weekday_id = int(weekday_id)
    except ValueError:
        abort(404)
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    try:
        cur.callproc('get_stop_name', [stop_id])
        stop_info = cur.fetchone()
        
        if not stop_info:
            abort(404)
        
        cur.callproc('get_stop_schedule', [stop_id, weekday_id])
        schedule_raw = cur.fetchall()
        
        schedule_data = {}
        for item in schedule_raw:
            route_id = item['route_id']
            if route_id not in schedule_data:
                schedule_data[route_id] = {
                    'route_id': item['route_id'],
                    'route_number': item['route_number'],
                    'route_name': item['route_name'],
                    'transport_type': item['transport_type'],
                    'departure_times': [],
                    'trip_numbers': []
                }
            schedule_data[route_id]['departure_times'].append(item['departure_time'].strftime('%H:%M'))
            schedule_data[route_id]['trip_numbers'].append(item['trip_number'])
        
        schedule_list = list(schedule_data.values())
        
    except Exception as e:
        print(f"Ошибка: {e}")
        abort(404)
    finally:
        cur.close()
        conn.close()
    
    search_params = {
        'from': '',
        'to': '',
        'date': date_str,
        'transport_type': 'Автобус'
    }
    
    return render_template('stop_schedule.html',
                         stop_info=stop_info,
                         schedule_data=schedule_list,
                         display_date=format_display_date(date_str),
                         date_str=date_str,
                         weekday_id=weekday_id,
                         search=search_params,
                         user=user_info)