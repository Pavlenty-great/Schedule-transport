from flask import Flask, render_template, request, abort
import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv
from datetime import datetime

app = Flask(__name__)
load_dotenv()

# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD')
    )

def get_weekday_id(date_str):
    """Преобразует дату из формата дд.мм.гггг в id дня недели (1-7)"""
    try:
        return datetime.strptime(date_str, '%d.%m.%Y').weekday() + 1
    except:
        return None

def format_display_date(date_str):
    """Форматирует дату для отображения с днём недели"""
    if not date_str:
        return ''
    try:
        date_obj = datetime.strptime(date_str, '%d.%m.%Y')
        weekdays = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
        return f"{date_str}, {weekdays[date_obj.weekday()]}"
    except:
        return date_str

def get_transport_type_id(type_name):
    """Возвращает id типа транспорта по названию"""
    type_mapping = {
        'Автобус': 1,
        'Поезд': 2,
        'Электричка': 3
    }
    return type_mapping.get(type_name, 1)

# ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ШАБЛОНОВ ==========

@app.context_processor
def utility_processor():
    return {
        'now': datetime.now,
        'datetime': datetime,
        'get_weekday_id': get_weekday_id
    }

# ========== МАРШРУТЫ ==========

@app.route('/', methods=['GET', 'POST'])
def main():
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
                         error_message=error_message)

@app.route('/route/<int:route_id>')
def route_details(route_id):
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
        # Получаем информацию о маршруте
        cur.callproc('get_route_info', [route_id])
        route_info = cur.fetchone()
        
        if not route_info:
            abort(404)
        
        # Если нет trip_number, берём первый рейс
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
        
        # Получаем детали рейса
        cur.callproc('get_route_details', [route_id, weekday_id, trip_number])
        route_details = cur.fetchall()
        
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
                         search=search_params)

if __name__ == '__main__':
    app.run(debug=True)