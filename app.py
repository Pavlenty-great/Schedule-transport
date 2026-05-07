from flask import Flask, render_template, request, abort
import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv
from datetime import datetime

app = Flask(__name__)
load_dotenv()

def get_db_connection():
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD')
    )
    return conn

# Добавляем глобальные функции для шаблонов
@app.context_processor
def utility_processor():
    def get_weekday_id(date_str):
        try:
            date_obj = datetime.strptime(date_str, '%d.%m.%Y')
            return date_obj.weekday() + 1
        except:
            return None
    
    def now():
        return datetime.now()
    
    return {
        'now': now,
        'datetime': datetime,
        'get_weekday_id': get_weekday_id
    }

def get_weekday_by_date(date_str):
    """Возвращает id дня недели по дате (1-7, где 1 - понедельник)"""
    try:
        date_obj = datetime.strptime(date_str, '%d.%m.%Y')
        weekday_py = date_obj.weekday()  # 0-6 (пн=0, вс=6)
        weekday_id = weekday_py + 1  # 1-7
        return weekday_id
    except:
        return None

def get_transport_type_id_by_name(type_name):
    """Возвращает id типа транспорта по названию"""
    type_mapping = {
        'Автобус': 1
    }
    return type_mapping.get(type_name, 1)

@app.route('/', methods=['GET', 'POST'])
def main():
    routes_data = []
    search_params = {
        'from': '',
        'to': '',
        'date': '',
        'transport_type': 'Автобус'
    }
    error_message = None
    weekday_id = None  # <-- по умолчанию None
    
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
            weekday_id = get_weekday_by_date(search_params['date'])
            if weekday_id is None:
                error_message = 'Неверный формат даты'
            else:
                transport_type_id = get_transport_type_id_by_name(search_params['transport_type'])
                
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
                        error_message = f'Рейсов из "{search_params["from"]}" в "{search_params["to"]}" на выбранную дату не найдено'
                        
                except Exception as e:
                    print(f"Ошибка при вызове функции: {e}")
                    error_message = 'Произошла ошибка при поиске рейсов. Попробуйте позже.'
                finally:
                    cur.close()
                    conn.close()
    
    # Если это GET-запрос и есть дата в search_params (например, после перехода со страницы деталей)
    if not weekday_id and search_params['date']:
        weekday_id = get_weekday_by_date(search_params['date'])
    
    display_date = search_params['date'] if search_params['date'] else ''
    if display_date:
        try:
            date_obj = datetime.strptime(display_date, '%d.%m.%Y')
            weekdays = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
            display_date = f"{display_date}, {weekdays[date_obj.weekday()]}"
        except:
            pass
    
    return render_template('main.html', 
                         routes=routes_data, 
                         search=search_params,
                         display_date=display_date,
                         weekday_id=weekday_id,
                         error_message=error_message)

@app.route('/route/<int:route_id>')
def route_details(route_id):
    date_str = request.args.get('date', '')
    weekday_id = request.args.get('day', '')
    trip_number = request.args.get('trip', '')  # <-- добавляем trip_number
    departure_time = request.args.get('time', '')  # <-- добавляем время отправления
    
    if not date_str or not weekday_id:
        abort(404)
    
    try:
        weekday_id = int(weekday_id)
    except ValueError:
        abort(404)
    
    display_date = date_str
    try:
        date_obj = datetime.strptime(date_str, '%d.%m.%Y')
        weekdays = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
        display_date = f"{date_str}, {weekdays[date_obj.weekday()]}"
    except:
        pass
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Если есть trip_number и departure_time, используем их
    if trip_number and departure_time:
        try:
            trip_number = int(trip_number)
            # Получаем информацию о маршруте
            cur.callproc('get_route_info', [route_id])
            route_info = cur.fetchone()
            
            # Получаем детали маршрута для конкретного рейса
            cur.callproc('get_route_details', [route_id, weekday_id, trip_number])
            route_details = cur.fetchall()
            
        except Exception as e:
            print(f"Ошибка: {e}")
            route_details = []
            route_info = None
    else:
        # Если нет trip_number, получаем первый рейс
        try:
            # Получаем первый рейс (с минимальным временем)
            cur.execute("""
                SELECT DISTINCT trip_number, MIN(time_departure) as departure_time
                FROM "Schedules"
                WHERE route_id = %s AND day_id = %s AND trip_number IS NOT NULL
                GROUP BY trip_number
                ORDER BY MIN(time_departure)
                LIMIT 1
            """, (route_id, weekday_id))
            first_trip = cur.fetchone()
            
            if first_trip:
                trip_number = first_trip['trip_number']
                departure_time = first_trip['departure_time'].strftime('%H:%M')
                
                cur.callproc('get_route_info', [route_id])
                route_info = cur.fetchone()
                
                cur.callproc('get_route_details', [route_id, weekday_id, trip_number])
                route_details = cur.fetchall()
            else:
                route_details = []
                route_info = None
        except Exception as e:
            print(f"Ошибка: {e}")
            route_details = []
            route_info = None
    
    cur.close()
    conn.close()
    
    if not route_info:
        abort(404)
    
    search_params = {
        'from': '',
        'to': '',
        'date': date_str,
        'transport_type': 'Автобус'
    }
    
    return render_template('details_route.html',
                         route_info=route_info,
                         route_details=route_details,
                         display_date=display_date,
                         search=search_params)

if __name__ == '__main__':
    app.run(debug=True)