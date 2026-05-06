from flask import Flask, render_template, request
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
                         error_message=error_message)

if __name__ == '__main__':
    app.run(debug=True)